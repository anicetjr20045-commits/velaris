/**
 * Boîte d'envoi (§ 7.7) : mise en file idempotente, puis envoi sous garde.
 *
 *   agent_pending_outbox → agent_begin_send (verrou, supersession, contrôle, relais, disjoncteur)
 *     → « en train d'écrire » + délai humain → WAHA → agent_finish_send
 *
 * Régulation : un envoi à la fois par discussion, N (2 par défaut) par session.
 */

import type { Db } from '../db/rest.js';
import { bodyHash } from '../ingest/wa-ids.js';
import type { OutgoingContent, SendResult, WahaClient } from './waha-client.js';

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
}

export interface EnqueueInput {
  userId: string;
  conversationId: string | null;
  orderId?: string | null;
  turnId?: string | null;
  origin: OutboxRow['origin'];
  kind: OutboxRow['kind'];
  purpose: string;
  isRelay?: boolean;
  session: string;
  chatId: string;
  body?: string | null;
  mediaPath?: string | null;
  caption?: string | null;
  idempotencyKey: string;
  lockToken?: number | null;
  status?: 'pending' | 'proposed';
  notBefore?: string | null;
  expiresAt?: string | null;
}

export function enqueueOutbox(db: Db, i: EnqueueInput): Promise<string> {
  return db.rpc<string>('agent_enqueue_outbox', {
    p_user: i.userId,
    p_conversation: i.conversationId,
    p_order: i.orderId ?? null,
    p_turn: i.turnId ?? null,
    p_origin: i.origin,
    p_kind: i.kind,
    p_purpose: i.purpose,
    p_is_relay: i.isRelay ?? false,
    p_session: i.session,
    p_chat_id: i.chatId,
    p_body: i.body ?? null,
    p_media_path: i.mediaPath ?? null,
    p_caption: i.caption ?? null,
    p_body_hash: bodyHash(i.body ?? i.caption ?? null),
    p_idempotency_key: i.idempotencyKey,
    p_lock_token: i.lockToken ?? null,
    p_status: i.status ?? 'pending',
    p_not_before: i.notBefore ?? null,
    p_expires_at: i.expiresAt ?? null,
  });
}

/** Pause silencieuse de lecture avant le déclenchement de la frappe (totalisant 20s de délai humain). */
export const READING_PAUSE_MS = 14_000;

/** Délai « humain » de frappe avant un texte : 25 ms par caractère, entre 1,5 s et 6 s. */
export function humanDelayMs(row: Pick<OutboxRow, 'kind' | 'body'>): number {
  if (row.kind !== 'text') return 1_500;
  return Math.min(6_000, Math.max(1_500, (row.body?.length ?? 0) * 25));
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
      if (content.kind === 'text') {
        await this.sleep(READING_PAUSE_MS);
        await waha.typing(row.session_name, row.chat_id, true);
        await this.sleep(humanDelayMs(row));
      } else {
        await this.sleep(READING_PAUSE_MS);
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

  private async contentOf(row: OutboxRow): Promise<OutgoingContent> {
    if (row.kind === 'text') {
      if (!row.body) throw new Error('empty_text');
      return { kind: 'text', text: row.body };
    }
    if (!row.media_path) throw new Error('missing_media');
    const m = await this.deps.signMedia(row.media_path);
    const caption = row.caption ?? undefined;
    switch (row.kind) {
      case 'voice':
        return { kind: 'voice', url: m.url, mimetype: m.mimetype };
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
