/**
 * Traitement d'un événement normalisé : une fonction SQL par type, donc une transaction.
 * Ce module ne décide rien pour le client : il enregistre, rattache, met en file.
 * Référence : § 7.2.
 */

import type { Db } from '../db/rest.js';
import type { NormalizedEvent } from './normalize.js';
import type { AudioTranscriber } from '../services/transcribe.js';

export interface IngestOutcome {
  outcome: string;
  user_id?: string;
  conversation_id?: string;
  message_id?: string;
  turn_id?: string | null;
  command?: string;
  previous?: string | null;
  current?: string;
}

export interface ProcessDeps {
  db: Db;
  protectedSessions: readonly string[];
  /** Téléchargement et stockage des médias (étape suivante du plan) ; null = non stocké. */
  storeMedia?: (url: string, mime: string | null, session: string) => Promise<string | null>;
  transcriber?: AudioTranscriber | undefined;
  onSessionDropped?: (session: string, previous: string | null, current: string) => Promise<void>;
}

export async function processEvent(ev: NormalizedEvent, deps: ProcessDeps): Promise<IngestOutcome> {
  if (deps.protectedSessions.includes(ev.session)) return { outcome: 'protected_session' };

  switch (ev.kind) {
    case 'message': {
      let mediaPath: string | null = null;
      if (ev.mediaUrl && deps.storeMedia) {
        try {
          mediaPath = await deps.storeMedia(ev.mediaUrl, ev.mediaMime, ev.session);
        } catch {
          mediaPath = null; // le message est enregistré quand même ; le média sera signalé manquant
        }
      }
      // Résolution anti-course écho WhatsApp / envoi outbox :
      // Lorsqu'un message sortant (notamment média, vocal de procédure, vidéo démo) est expédié par le bot,
      // l'écho WhatsApp (fromMe = true) arrive souvent AVANT que l'appel HTTP waha.send() n'ait
      // retourné son résultat et écrit wa_message_key en base.
      // Si un message sortant pour ce chat est en cours d'envoi ('sending' ou 'unknown'),
      // ou si l'événement provient explicitement de l'API WAHA (source = 'api'),
      // nous lions préemptivement wa_message_id et wa_message_key sur ce message sortant
      // afin que agent_ingest_message le reconnaisse immédiatement comme un écho
      // et ne prenne JAMAIS le contrôle humain par erreur.
      if (ev.fromMe && deps.db.queryTable && deps.db.updateRows) {
        try {
          const inFlight = await deps.db.queryTable<Array<{ id: string }>>(
            'outbound_messages',
            `session_name=eq.${encodeURIComponent(ev.session)}&chat_id=eq.${encodeURIComponent(ev.chatId)}&status=in.(sending,unknown)&order=created_at.desc&limit=1`
          ).catch(() => []);

          const firstFlight = inFlight?.[0];
          if (firstFlight) {
            await deps.db.updateRows(
              'outbound_messages',
              `id=eq.${firstFlight.id}`,
              { wa_message_id: ev.waMessageId, wa_message_key: ev.waKey }
            ).catch(() => undefined);
          } else if (ev.source === 'api') {
            const recent = await deps.db.queryTable<Array<{ id: string }>>(
              'outbound_messages',
              `session_name=eq.${encodeURIComponent(ev.session)}&chat_id=eq.${encodeURIComponent(ev.chatId)}&order=created_at.desc&limit=1`
            ).catch(() => []);
            const firstRecent = recent?.[0];
            if (firstRecent) {
              await deps.db.updateRows(
                'outbound_messages',
                `id=eq.${firstRecent.id}`,
                { wa_message_id: ev.waMessageId, wa_message_key: ev.waKey }
              ).catch(() => undefined);
            }
          }
        } catch {
          // Ne bloque jamais l'ingestion
        }
      }

      const res = await deps.db.rpc<IngestOutcome>('agent_ingest_message', {
        p_session: ev.session,
        p_chat_id: ev.chatId,
        p_from_me: ev.fromMe,
        p_wa_message_id: ev.waMessageId,
        p_wa_key: ev.waKey,
        p_wa_timestamp: ev.waTimestamp,
        p_body: ev.body,
        p_media_kind: ev.mediaKind,
        p_media_path: ev.mediaUrl ?? mediaPath,
        p_push_name: ev.pushName,
        p_body_hash: ev.bodyHash,
      });

      // Transcription asynchrone anticipée dès la réception pour être prête avant la fin du tampon de silence
      if (!ev.fromMe && ev.mediaKind === 'audio' && res.message_id && deps.transcriber) {
        void deps.transcriber.transcribeMessage(
          res.message_id,
          ev.session,
          ev.mediaUrl ?? mediaPath,
          ev.mediaKind,
          ev.waMessageId,
          ev.chatId
        ).catch(() => undefined);
      }

      // Bouclier de sécurité : si le message provient de l'API (source = 'api') mais a été classé 'merchant',
      // corriger immédiatement pour restituer le contrôle à l'IA
      if (ev.fromMe && ev.source === 'api' && res.outcome === 'merchant' && res.conversation_id) {
        await deps.db.rpc('agent_set_control', {
          p_conversation: res.conversation_id,
          p_mode: 'ai',
          p_reason: 'auto_corrected_api_echo',
          p_actor: 'merchant',
        }).catch(() => undefined);
        return { ...res, outcome: 'echo' };
      }

      return res;
    }
    case 'reaction':
      return deps.db.rpc<IngestOutcome>('agent_ingest_reaction', {
        p_session: ev.session,
        p_chat_id: ev.chatId,
        p_reacted_key: ev.reactedKey,
        p_emoji: ev.emoji,
      });
    case 'session_status': {
      const r = await deps.db.rpc<IngestOutcome>('agent_ingest_session_status', {
        p_session: ev.session,
        p_waha_status: ev.status,
        p_phone: ev.phone,
      });
      if (r.previous === 'connected' && r.current && r.current !== 'connected' && deps.onSessionDropped) {
        await deps.onSessionDropped(ev.session, r.previous, r.current).catch(() => undefined);
      }
      return r;
    }
    case 'ack':
      // Accusés de lecture : enregistrés dans inbound_events ; exploités par l'interface plus tard.
      return { outcome: 'ack_recorded' };
    case 'chat_archive': {
      const cleanPhone = ev.chatId.replace(/\D/g, '');
      try {
        await deps.db.rpc('agent_set_chat_archived', {
          p_phone: cleanPhone,
          p_archived: ev.archived,
        });
        return { outcome: ev.archived ? 'chat_archived' : 'chat_unarchived' };
      } catch (err: any) {
        return { outcome: `archive_error:${err.message}` };
      }
    }
  }
}
