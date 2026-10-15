/**
 * Boîte d'envoi (§ 7.7) : mise en file idempotente, puis envoi sous garde.
 *
 *   agent_pending_outbox → agent_begin_send (verrou, supersession, contrôle, relais, disjoncteur)
 *     → « en train d'écrire » + délai humain → WAHA → agent_finish_send
 *
 * Régulation : un envoi à la fois par discussion, N (2 par défaut) par session.
 */

import type { Db } from '../db/rest.js';
import type { OutgoingContent, SendResult, WahaClient } from './waha-client.js';
import { PROCEDURE_VOICE_NOTE } from '../assets/procedure-voice.js';

export interface OutboxRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  origin: 'agent' | 'merchant_ui' | 'automation' | 'system_alert' | 'delivery';
  kind: 'text' | 'voice' | 'file' | 'image' | 'video';
  purpose: string;
  session_name: string;
  chat_id: string;
  body: string | null;
  media_path: string | null;
  caption: string | null;
  is_relay?: boolean;
}

/** Pause silencieuse de base pour les messages hors texte ou non-agent. */
export const READING_PAUSE_MS = 600;

/**
 * Pause de réflexion/lecture silencieuse avant de commencer à taper.
 * Pour l'agent conversationnel texte : configurée à 20s par défaut (ou via AGENT_READING_PAUSE_MS),
 * ce qui donne un cycle total de 45-50s avec l'inbound buffer de Supabase (15s) et l'inférence LLM (3s).
 */
export function readingPauseMs(row: { kind: OutboxRow['kind']; origin?: OutboxRow['origin']; purpose?: string }): number {
  if (row.origin !== 'agent') return 300;
  if (row.purpose && ['handoff_ack', 'stop_ack', 'reaction_confirm'].includes(row.purpose as string)) return 800;
  if (row.kind !== 'text') return 1_500;
  const envVal = process.env.AGENT_READING_PAUSE_MS ? Number(process.env.AGENT_READING_PAUSE_MS) : NaN;
  return Number.isFinite(envVal) && envVal >= 0 ? envVal : 20_000;
}

/**
 * Délai « humain » de frappe pendant lequel l'indicateur WhatsApp « En train d'écrire... » est affiché.
 * Calibré entre 8 s et 11 s pour un rendu réaliste (ou via AGENT_TYPING_MIN_MS / AGENT_TYPING_MAX_MS).
 */
export function humanDelayMs(row: { kind: OutboxRow['kind']; body: OutboxRow['body']; origin?: OutboxRow['origin'] }): number {
  if (row.kind !== 'text') return 1_500;
  if (row.origin && row.origin !== 'agent') return 1_500;
  const minMs = Number(process.env.AGENT_TYPING_MIN_MS) || 8_000;
  const maxMs = Number(process.env.AGENT_TYPING_MAX_MS) || 11_000;
  const len = row.body?.length ?? 0;
  return Math.min(maxMs, Math.max(minMs, minMs + Math.round(len * 15)));
}

export interface OutboxSenderDeps {
  db: Db;
  waha: Pick<WahaClient, 'send' | 'typing'>;
  /** URL signée d'un média du bucket privé (§ send/storage.ts). */
  signMedia: (path: string) => Promise<{ url: string; mimetype: string; filename: string }>;
  perSessionConcurrency: number;
  protectedSessions: readonly string[];
  sleep?: (ms: number) => Promise<void>;
  log: (line: string, data?: Record<string, unknown>) => void;
}

export class OutboxSender {
  private readonly busyChats = new Set<string>();
  private readonly perSession = new Map<string, number>();
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: OutboxSenderDeps) {
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Un passage : lit les envois dus et lance ceux que la régulation autorise. */
  async tick(limit = 20): Promise<Promise<void>[]> {
    const rows = await this.deps.db.rpc<OutboxRow[]>('agent_pending_outbox', { p_limit: limit });
    const started: Promise<void>[] = [];
    for (const row of rows ?? []) {
      const chatKey = `${row.session_name}|${row.chat_id}`;
      const inSession = this.perSession.get(row.session_name) ?? 0;
      if (this.busyChats.has(chatKey) || inSession >= this.deps.perSessionConcurrency) continue;
      this.busyChats.add(chatKey);
      this.perSession.set(row.session_name, inSession + 1);
      started.push(
        this.sendOne(row).finally(() => {
          this.busyChats.delete(chatKey);
          this.perSession.set(row.session_name, (this.perSession.get(row.session_name) ?? 1) - 1);
        }),
      );
    }
    return started;
  }

  async sendOne(row: OutboxRow): Promise<void> {
    const { db, waha, log } = this.deps;
    if (this.deps.protectedSessions.includes(row.session_name)) {
      await db.rpc('agent_begin_send', { p_outbox: row.id }).catch(() => undefined);
      await db.rpc('agent_finish_send', { p_outbox: row.id, p_status: 'failed', p_error: 'protected_session' }).catch(() => undefined);
      log('outbox refused: protected session', { id: row.id, session: row.session_name });
      return;
    }

    const gate = await db.rpc<string>('agent_begin_send', { p_outbox: row.id });
    if (gate !== 'ok') {
      log('outbox not sent', { id: row.id, gate });
      return;
    }

    let result: SendResult;
    try {
      const content = await this.contentOf(row);
      const isAgentText = row.origin === 'agent' && content.kind === 'text';

      if (isAgentText) {
        let isAborted = false;
        let abortReason = '';

        // Phase 1 : Pause silencieuse de réflexion (par défaut 20 s pour un cycle total ~47 s)
        // Vérification par paliers de 1 s pour annulation immédiate si gérant ou client intervient
        const pauseMs = readingPauseMs(row);
        const pauseStep = 3_000;
        let elapsedPause = 0;
        while (elapsedPause < pauseMs) {
          const step = Math.min(pauseStep, pauseMs - elapsedPause);
          await this.sleep(step);
          elapsedPause += step;

          const check = await this.checkAbort(row);
          if (check) {
            isAborted = true;
            abortReason = check;
            break;
          }
        }

        // Phase 2 : Animation de frappe WhatsApp « En train d'écrire... » (8 s à 11 s)
        if (!isAborted) {
          await waha.typing(row.session_name, row.chat_id, true);
          const typingMs = humanDelayMs(row);
          const typingStep = 3_000;
          let elapsedTyping = 0;
          while (elapsedTyping < typingMs) {
            const step = Math.min(typingStep, typingMs - elapsedTyping);
            await this.sleep(step);
            elapsedTyping += step;

            const check = await this.checkAbort(row);
            if (check) {
              isAborted = true;
              abortReason = check;
              break;
            }
          }
        }

        // Interruption immédiate et extinction de frappe si intervention détectée
        if (isAborted) {
          await waha.typing(row.session_name, row.chat_id, false).catch(() => undefined);
          await db.rpc('agent_finish_send', {
            p_outbox: row.id,
            p_status: 'failed',
            p_error: abortReason,
          }).catch(() => undefined);
          log('outbox aborted during pause/typing delay', { id: row.id, reason: abortReason });
          return;
        }
      } else {
        await this.sleep(readingPauseMs(row));
      }

      result = await waha.send(row.session_name, row.chat_id, content);
      if (content.kind === 'text') await waha.typing(row.session_name, row.chat_id, false);
    } catch (err) {
      // Échec AVANT l'appel d'envoi (média introuvable, signature) : rien n'est parti
      result = { status: 'failed', error: `prepare:${(err as Error).message}` };
    }

    const args: Record<string, unknown> = { p_outbox: row.id, p_status: result.status };
    if (result.status === 'sent') {
      args.p_wa_message_id = result.waMessageId;
      args.p_wa_key = result.waKey;
    } else {
      args.p_error = result.error;
      if (result.status === 'retry') args.p_retry_in_seconds = result.retryInSeconds;
    }
    await db.rpc('agent_finish_send', args);
    log('outbox sent', { id: row.id, status: result.status, purpose: row.purpose });
  }

  /**
   * Vérifie si l'envoi doit être annulé immédiatement :
   * 1. Annulé en base (ex: intervention gérant détectée par webhook)
   * 2. Conversation passée sous contrôle humain (le gérant a parlé manuellement)
   * 3. Le client a envoyé un nouveau message (tour 'collecting' ouvert en base)
   */
  private async checkAbort(row: OutboxRow): Promise<string | null> {
    const { db } = this.deps;
    if (!db.queryTable) return null;

    try {
      // 1. Vérifier si le message lui-même a été annulé en base
      const currentOutbox = await db.queryTable<Array<{ status: string }>>(
        'outbound_messages',
        `id=eq.${row.id}&select=status`
      ).catch(() => []);
      if (currentOutbox?.[0] && currentOutbox[0].status !== 'sending') {
        return `outbox_status_${currentOutbox[0].status}`;
      }

      // 2. Vérifier si la discussion est passée sous contrôle humain
      if (row.conversation_id) {
        const currentConv = await db.queryTable<Array<{ control_mode: string; control_reason: string | null }>>(
          'conversations',
          `id=eq.${row.conversation_id}&select=control_mode,control_reason`
        ).catch(() => []);
        const c = currentConv?.[0];
        if (c && c.control_mode === 'human' && !row.is_relay && !['handoff_ack', 'identity'].includes(row.purpose)) {
          return 'human_control_merchant_took_over';
        }

        // 3. Vérifier si le client a renvoyé un nouveau message pendant notre réflexion/frappe
        const collectingTurns = await db.queryTable<Array<{ id: string }>>(
          'conversation_turns',
          `conversation_id=eq.${row.conversation_id}&status=eq.collecting&select=id`
        ).catch(() => []);
        if (collectingTurns && collectingTurns.length > 0) {
          return 'client_sent_new_message_superseded';
        }
      }
    } catch {
      // Tolérance aux erreurs réseau sur la vérification
    }

    return null;
  }

  private async contentOf(row: OutboxRow): Promise<OutgoingContent> {
    if (row.kind === 'text') {
      if (!row.body) throw new Error('empty_text');
      return { kind: 'text', text: row.body };
    }
    if (row.kind === 'voice') {
      // Priorité 1 : pour le vocal de procédure, utiliser le base64 OGG Opus natif WhatsApp
      // (garantit la livraison instantanée sous forme de vrai PTT WhatsApp sans dépendance réseau).
      // CORRECTIF (M7) : le repli embarqué est vérifié AVANT tout appel réseau. Avant, signMedia()
      // était appelé en premier pour 'assets/procedure_voice.ogg' : un simple souci storage/réseau
      // faisait échouer une étape critique du funnel alors que les données étaient déjà embarquées.
      if (row.media_path === 'embedded:procedure_voice' || row.media_path === 'assets/procedure_voice.ogg') {
        return {
          kind: 'voice',
          data: PROCEDURE_VOICE_NOTE.base64,
          mimetype: PROCEDURE_VOICE_NOTE.mimeType,
        };
      }
      if (!row.media_path) throw new Error('missing_media');
      const m = await this.deps.signMedia(row.media_path);
      return { kind: 'voice', url: m.url, mimetype: m.mimetype };
    }
    if (!row.media_path) throw new Error('missing_media');
    const m = await this.deps.signMedia(row.media_path);
    const caption = row.caption ?? undefined;
    switch (row.kind) {
      case 'image':
        return caption === undefined ? { kind: 'image', url: m.url, mimetype: m.mimetype } : { kind: 'image', url: m.url, mimetype: m.mimetype, caption };
      case 'file':
      case 'video':
        return caption === undefined
          ? { kind: row.kind, url: m.url, mimetype: m.mimetype, filename: m.filename }
          : { kind: row.kind, url: m.url, mimetype: m.mimetype, filename: m.filename, caption };
    }
  }
}
