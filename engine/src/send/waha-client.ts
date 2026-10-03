/**
 * Client d'envoi WAHA.
 *
 * Règle d'or (§ 7.7) : on ne réessaie QUE si l'on est certain que le message n'est pas parti
 * (connexion refusée, 429, 502, 503). Un délai dépassé ou une réponse illisible = « unknown » :
 * le message a peut-être été envoyé, l'écho tranchera. Jamais de doublon chez le client.
 */

import { normalizeWaMessageId, waMessageIdKey } from '../ingest/wa-ids.js';

export type SendResult =
  | { status: 'sent'; waMessageId: string | null; waKey: string | null }
  | { status: 'unknown'; error: string }
  | { status: 'retry'; error: string; retryInSeconds: number }
  | { status: 'failed'; error: string };

export interface WahaClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type OutgoingContent =
  | { kind: 'text'; text: string }
  | { kind: 'voice'; url: string; mimetype: string }
  | { kind: 'image'; url: string; mimetype: string; caption?: string }
  | { kind: 'file' | 'video'; url: string; mimetype: string; filename: string; caption?: string };

export class WahaClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: WahaClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  async send(session: string, chatId: string, content: OutgoingContent): Promise<SendResult> {
    switch (content.kind) {
      case 'text':
        return this.post('/api/sendText', { session, chatId, text: content.text });
      case 'voice':
        return this.post('/api/sendVoice', { session, chatId, file: { mimetype: content.mimetype, url: content.url }, convert: !content.mimetype.includes('ogg') });
      case 'image':
        return this.post('/api/sendImage', { session, chatId, file: { mimetype: content.mimetype, url: content.url }, caption: content.caption });
      case 'file':
      case 'video':
        return this.post('/api/sendFile', {
          session, chatId, file: { mimetype: content.mimetype, url: content.url, filename: content.filename }, caption: content.caption,
        });
    }
  }

  /** Indicateur « en train d'écrire » : au mieux, jamais bloquant. */
  async typing(session: string, chatId: string, on: boolean): Promise<void> {
    await this.post(on ? '/api/startTyping' : '/api/stopTyping', { session, chatId }).catch(() => undefined);
  }

  private async post(path: string, body: unknown): Promise<SendResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const e = err as Error & { cause?: { code?: string } };
      if (e.name === 'TimeoutError' || e.name === 'AbortError') return { status: 'unknown', error: 'timeout' };
      const code = e.cause?.code;
      // Connexion jamais établie : le message n'a pas pu partir
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return { status: 'retry', error: `network:${code}`, retryInSeconds: 10 };
      }
      return { status: 'unknown', error: `network:${code ?? e.name}` };
    }

    if (res.status === 429 || res.status === 502 || res.status === 503) {
      const ra = Number(res.headers.get('retry-after'));
      return { status: 'retry', error: `http_${res.status}`, retryInSeconds: Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) : 15 };
    }
    if (res.status >= 500) return { status: 'unknown', error: `http_${res.status}` };
    if (!res.ok) return { status: 'failed', error: `http_${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}` };

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      return { status: 'sent', waMessageId: null, waKey: null };
    }
    const obj = (payload ?? {}) as Record<string, unknown>;
    const key = obj.key as Record<string, unknown> | undefined;
    const data = obj._data as Record<string, unknown> | undefined;
    const id = normalizeWaMessageId(obj.id) ?? normalizeWaMessageId(key?.id) ?? normalizeWaMessageId(data?.id);
    return { status: 'sent', waMessageId: id, waKey: waMessageIdKey(id) };
  }
}
