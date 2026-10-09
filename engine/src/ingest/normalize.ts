/**
 * Normalisation des webhooks WAHA en événements internes typés.
 * Fonction pure : aucune I/O. Tout ce qui n'est pas reconnu avec certitude est ignoré
 * avec une raison (journalisée), jamais deviné.
 *
 * Abonnement attendu côté WAHA : message.any, message.reaction, message.ack, session.status.
 * (message + message.any livrent deux fois les messages entrants : la clé de déduplication
 * est la même pour les deux, donc le second est écarté par inbound_events.)
 */

import { bodyHash, isBroadcastJid, isGroupJid, normalizeEmoji, normalizeWaMessageId, waMessageIdKey } from './wa-ids.js';

export type MediaKind = 'audio' | 'image' | 'video' | 'document' | 'sticker';

export interface MessageEvent {
  kind: 'message';
  session: string;
  dedupKey: string;
  chatId: string;
  fromMe: boolean;
  source?: string | null;
  waMessageId: string;
  waKey: string;
  waTimestamp: string | null;
  body: string | null;
  bodyHash: string | null;
  mediaKind: MediaKind | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  pushName: string | null;
}

export interface ReactionEvent {
  kind: 'reaction';
  session: string;
  dedupKey: string;
  chatId: string;
  reactedKey: string;
  emoji: string;
}

export interface SessionStatusEvent {
  kind: 'session_status';
  session: string;
  dedupKey: string;
  status: string;
  phone: string | null;
}

export interface AckEvent {
  kind: 'ack';
  session: string;
  dedupKey: string;
  waKey: string;
  ack: number;
}

export interface ChatArchiveEvent {
  kind: 'chat_archive';
  session: string;
  dedupKey: string;
  chatId: string;
  archived: boolean;
  timestamp: string | null;
}

export type NormalizedEvent = MessageEvent | ReactionEvent | SessionStatusEvent | AckEvent | ChatArchiveEvent;
export type NormalizeResult = { ok: true; event: NormalizedEvent } | { ok: false; reason: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function mediaKindOf(mime: string | null, hasMedia: boolean): MediaKind | null {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('audio/') || m.includes('ogg') || m.includes('opus')) return 'audio';
  if (m === 'image/webp') return 'sticker';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('application/')) return 'document';
  return hasMedia ? 'document' : null;
}

function epochToIso(ts: unknown): string | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toISOString();
}

export function normalizeWahaEvent(body: unknown): NormalizeResult {
  if (!isObj(body)) return { ok: false, reason: 'invalid_body' };
  const event = str(body.event);
  const session = str(body.session);
  const payload = body.payload;
  if (!event || !session) return { ok: false, reason: 'missing_event_or_session' };
  if (!isObj(payload)) return { ok: false, reason: 'missing_payload' };

  if (event === 'session.status') {
    const status = str(payload.status);
    if (!status) return { ok: false, reason: 'missing_status' };
    const me = isObj(payload.me) ? str(payload.me.id) : null;
    const phone = me ? me.split('@')[0]!.split(':')[0]!.replace(/\D/g, '') || null : null;
    const ts = typeof body.timestamp === 'number' ? body.timestamp : Date.now();
    return { ok: true, event: { kind: 'session_status', session, dedupKey: `${status}|${ts}`, status, phone } };
  }

  if (event === 'message.reaction') {
    // Seules les réactions du GÉRANT comptent. fromMe absent = rejet (corrige E1).
    if (payload.fromMe !== true) return { ok: false, reason: 'reaction_not_from_merchant' };
    const reaction = isObj(payload.reaction) ? payload.reaction : null;
    const emojiRaw = reaction ? str(reaction.text) : null;
    if (!emojiRaw) return { ok: false, reason: 'reaction_removed_or_empty' };
    const reacted = waMessageIdKey(normalizeWaMessageId(reaction?.messageId));
    if (!reacted) return { ok: false, reason: 'reaction_without_target' };
    const chatId = str(payload.to) ?? str(payload.from);
    if (!chatId || isGroupJid(chatId) || isBroadcastJid(chatId)) return { ok: false, reason: 'reaction_ignored_chat' };
    const emoji = normalizeEmoji(emojiRaw);
    return { ok: true, event: { kind: 'reaction', session, dedupKey: `${reacted}|${emoji}`, chatId, reactedKey: reacted, emoji } };
  }

  if (event === 'message.ack') {
    const waKey = waMessageIdKey(normalizeWaMessageId(payload.id));
    const ack = typeof payload.ack === 'number' ? payload.ack : null;
    if (!waKey || ack === null) return { ok: false, reason: 'invalid_ack' };
    return { ok: true, event: { kind: 'ack', session, dedupKey: `${waKey}|${ack}`, waKey, ack } };
  }

  if (event === 'chat.archive') {
    const rawId = isObj(payload) ? (str(payload.id) ?? str(payload.chatId)) : null;
    if (!rawId) return { ok: false, reason: 'missing_chat_id' };
    const archived = Boolean(payload.archived);
    const ts = typeof body.timestamp === 'number' ? body.timestamp : Date.now();
    return {
      ok: true,
      event: {
        kind: 'chat_archive',
        session,
        dedupKey: `${rawId}|${archived}|${ts}`,
        chatId: rawId,
        archived,
        timestamp: epochToIso(ts),
      },
    };
  }

  if (event !== 'message' && event !== 'message.any') return { ok: false, reason: `ignored_event:${event}` };

  const fromMe = payload.fromMe === true;
  const chatId = fromMe ? str(payload.to) : str(payload.from);
  if (!chatId) return { ok: false, reason: 'missing_chat' };
  if (isGroupJid(chatId) || isBroadcastJid(chatId) || isGroupJid(str(payload.from)) || isBroadcastJid(str(payload.from))) {
    return { ok: false, reason: 'group_or_broadcast' };
  }
  const waMessageId = normalizeWaMessageId(payload.id);
  const waKey = waMessageIdKey(waMessageId);
  if (!waMessageId || !waKey) return { ok: false, reason: 'missing_message_id' };

  const media = isObj(payload.media) ? payload.media : null;
  const data = isObj(payload._data) ? payload._data : null;
  const mime = (media ? str(media.mimetype) : null) ?? (data ? str(data.mimetype) : null);
  const hasMedia = payload.hasMedia === true;
  const mediaKind = mediaKindOf(mime, hasMedia);
  const text = str(payload.body);
  if (!text && !mediaKind) return { ok: false, reason: 'empty_message' };

  const source = str(payload.source);

  return {
    ok: true,
    event: {
      kind: 'message',
      session,
      dedupKey: waKey,
      chatId,
      fromMe,
      source,
      waMessageId,
      waKey,
      waTimestamp: epochToIso(payload.timestamp),
      body: text,
      bodyHash: bodyHash(text),
      mediaKind,
      mediaUrl: media ? str(media.url) : null,
      mediaMime: mime,
      pushName: (data ? (str(data.pushName) ?? str(data.notifyName)) : null) ?? str(payload.pushName),
    },
  };
}
