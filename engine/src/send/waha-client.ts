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
  | { kind: 'voice'; url?: string; data?: string; mimetype: string }
  | { kind: 'image'; url?: string; data?: string; mimetype: string; caption?: string }
  | { kind: 'file' | 'video'; url?: string; data?: string; mimetype: string; filename: string; caption?: string };

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
      case 'voice': {
        const fileObj: Record<string, string> = {
          mimetype: content.mimetype || 'audio/ogg; codecs=opus',
          filename: 'voice.ogg',
        };
        if ('data' in content && content.data) {
          fileObj.data = content.data;
        } else if ('url' in content && content.url) {
          fileObj.url = content.url;
        }
        return this.post('/api/sendVoice', {
          session,
          chatId,
          file: fileObj,
          convert: !content.mimetype.includes('ogg') && !content.mimetype.includes('opus'),
        });
      }
      case 'image': {
        const fileObj: Record<string, string> = {
          mimetype: content.mimetype,
        };
        if ('data' in content && content.data) {
          fileObj.data = content.data;
        } else if ('url' in content && content.url) {
          fileObj.url = content.url;
        }
        return this.post('/api/sendImage', { session, chatId, file: fileObj, caption: content.caption });
      }
      case 'file':
      case 'video': {
        const fileObj: Record<string, string> = {
          mimetype: content.mimetype,
          filename: content.filename,
        };
        if ('data' in content && content.data) {
          fileObj.data = content.data;
        } else if ('url' in content && content.url) {
          fileObj.url = content.url;
        }
        return this.post('/api/sendFile', {
          session,
          chatId,
          file: fileObj,
          caption: content.caption,
        });
      }
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

  async getSession(session: string): Promise<{ ok: boolean; status: string; session?: WahaSessionInfo; error?: string }> {
    try {
      const res = await this.fetchImpl(`${this.opts.baseUrl}/api/sessions/${encodeURIComponent(session)}`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Api-Key': this.opts.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return { ok: false, status: 'UNREACHABLE', error: `http_${res.status}` };
      }
      const data = (await res.json()) as WahaSessionInfo;
      return { ok: true, status: data.status || 'UNKNOWN', session: data };
    } catch (err) {
      return { ok: false, status: 'UNREACHABLE', error: (err as Error).message };
    }
  }

  async restartSession(session: string): Promise<{ ok: boolean; status?: string; error?: string }> {
    try {
      const res = await this.fetchImpl(`${this.opts.baseUrl}/api/sessions/${encodeURIComponent(session)}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.ok) {
        const data = (await res.json()) as { status?: string };
        return { ok: true, status: data.status || 'STARTING' };
      }
      // Repli si /restart non supporté : stop puis start
      await this.fetchImpl(`${this.opts.baseUrl}/api/sessions/${encodeURIComponent(session)}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
      }).catch(() => undefined);
      const startRes = await this.fetchImpl(`${this.opts.baseUrl}/api/sessions/${encodeURIComponent(session)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
      }).catch(() => undefined);
      if (startRes?.ok) {
        return { ok: true, status: 'STARTING' };
      }

      // Si la session n'existe pas encore sur WAHA, auto-création avec configuration haute stabilité
      const createRes = await this.fetchImpl(`${this.opts.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
        body: JSON.stringify({
          name: session,
          start: true,
          config: {
            noweb: { markOnline: false, store: { enabled: true, fullSync: false } },
            webhooks: [
              {
                url: 'http://waha-bridge:3001/webhook',
                events: ['message', 'message.any', 'session.status', 'message.reaction', 'message.ack', 'chat.archive'],
                hmac: { key: 'f50ca6dc4b9626c26d95ff0d4b3155076cc5c7b57c70621524ac9a4d00ff6066' },
              },
            ],
          },
        }),
      }).catch(() => undefined);
      if (createRes?.ok) {
        const createData = (await createRes.json().catch(() => ({}))) as { status?: string };
        return { ok: true, status: createData.status || 'STARTING' };
      }
      return { ok: false, error: 'session_restart_and_creation_failed' };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async getQrImage(session: string): Promise<{ ok: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
    try {
      const res = await this.fetchImpl(`${this.opts.baseUrl}/api/${encodeURIComponent(session)}/auth/qr?format=image`, {
        method: 'GET',
        headers: { 'X-Api-Key': this.opts.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return { ok: false, error: `http_${res.status}` };
      }
      const contentType = res.headers.get('content-type') || 'image/png';
      const arrayBuf = await res.arrayBuffer();
      return { ok: true, buffer: Buffer.from(arrayBuf), contentType };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async requestPairingCode(session: string, phoneNumber: string): Promise<{ ok: boolean; code?: string; error?: string }> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const res = await this.fetchImpl(`${this.opts.baseUrl}/api/${encodeURIComponent(session)}/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `http_${res.status}: ${text}` };
      }
      const data = await res.json() as { code?: string };
      return data.code ? { ok: true, code: data.code } : { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async archiveChat(session: string, chatId: string, archived: boolean): Promise<{ ok: boolean; error?: string }> {
    try {
      const action = archived ? 'archive' : 'unarchive';
      const normChat = chatId.includes('@') ? chatId : `${chatId.replace(/\D/g, '')}@c.us`;
      const res = await this.fetchImpl(`${this.opts.baseUrl}/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(normChat)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.opts.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return { ok: false, error: `http_${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async getContact(session: string, contactId: string): Promise<{ ok: boolean; id?: string | undefined; number?: string | undefined; pushname?: string | undefined } | null> {
    try {
      const res = await this.fetchImpl(`${this.opts.baseUrl}/api/contacts?contactId=${encodeURIComponent(contactId)}&session=${encodeURIComponent(session)}`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Api-Key': this.opts.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id?: string; number?: string; pushname?: string };
      return { ok: true, id: data.id, number: data.number, pushname: data.pushname };
    } catch {
      return null;
    }
  }
}

export interface WahaSessionInfo {
  name: string;
  status: string;
  me?: { id: string; pushName?: string } | null;
  timestamps?: Record<string, unknown>;
}

