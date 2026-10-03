/**
 * Vérification de la signature HMAC des webhooks WAHA (config.webhooks[].hmac.key).
 * En-têtes : X-Webhook-Hmac (hexadécimal), X-Webhook-Hmac-Algorithm (sha512 par défaut).
 * Aucun repli sans signature : un webhook non signé est refusé (le pont actuel acceptait tout).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWahaHmac(rawBody: Buffer, signature: string | undefined, algorithmHeader: string | undefined, key: string): boolean {
  if (!signature) return false;
  const algorithm = (algorithmHeader ?? 'sha512').toLowerCase();
  if (algorithm !== 'sha512' && algorithm !== 'sha256') return false;
  const expected = createHmac(algorithm, key).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature.trim().toLowerCase(), 'hex');
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
