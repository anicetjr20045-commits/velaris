/**
 * Identifiants WhatsApp (repris de velaris-agent, éprouvés en production).
 *
 * WAHA renvoie un même message sous deux formes :
 *   - longue (`_serialized`) : `true_<chatId>_<MSGID>` ;
 *   - courte (réponse de sendText) : `<MSGID>`.
 * Le chatId ne contient jamais `_` : le dernier segment est la clé stable du message.
 */

import { createHash } from 'node:crypto';

export function normalizeWaMessageId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj._serialized === 'string' && obj._serialized.trim()) return obj._serialized.trim();
  if (typeof obj.id === 'string' && obj.id.trim()) return obj.id.trim();
  if (obj.id && typeof obj.id === 'object') return normalizeWaMessageId(obj.id);
  return null;
}

export function waMessageIdKey(id: string | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  const trimmed = String(id).trim();
  if (!trimmed) return null;
  const parts = trimmed.split('_');
  const last = parts[parts.length - 1];
  return (last || trimmed).toUpperCase();
}

export const isGroupJid = (jid?: string | null): boolean => Boolean(jid && jid.endsWith('@g.us'));
export const isBroadcastJid = (jid?: string | null): boolean =>
  Boolean(jid && (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')));

/**
 * Empreinte d'un corps de message, pour reconnaître l'écho d'un envoi dont l'identifiant
 * n'est pas encore connu. Insensible aux espaces de bord et aux espaces multiples.
 */
export function bodyHash(body: string | null | undefined): string | null {
  if (!body) return null;
  const norm = body.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!norm) return null;
  return createHash('sha256').update(norm).digest('hex');
}

/** Emoji sans sélecteur de variante ni teinte de peau (❤ ≡ ❤️, 👍🏾 ≡ 👍). */
export function normalizeEmoji(emoji: string): string {
  return Array.from(emoji)
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp !== 0xfe0f && cp !== 0xfe0e && !(cp >= 0x1f3fb && cp <= 0x1f3ff);
    })
    .join('')
    .trim();
}
