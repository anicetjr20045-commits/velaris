/**
 * Traitement d'un événement normalisé : une fonction SQL par type, donc une transaction.
 * Ce module ne décide rien pour le client : il enregistre, rattache, met en file.
 * Référence : § 7.2.
 */

import type { Db } from '../db/rest.js';
import type { NormalizedEvent } from './normalize.js';

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
      return deps.db.rpc<IngestOutcome>('agent_ingest_message', {
        p_session: ev.session,
        p_chat_id: ev.chatId,
        p_from_me: ev.fromMe,
        p_wa_message_id: ev.waMessageId,
        p_wa_key: ev.waKey,
        p_wa_timestamp: ev.waTimestamp,
        p_body: ev.body,
        p_media_kind: ev.mediaKind,
        p_media_path: mediaPath,
        p_push_name: ev.pushName,
        p_body_hash: ev.bodyHash,
      });
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
