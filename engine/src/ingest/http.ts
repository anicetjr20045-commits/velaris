/**
 * Point d'entrée HTTP des webhooks WAHA (§ 7.1).
 *
 *   POST /webhooks/waha  → HMAC → normalisation → inbound_events (dédup) → 200 immédiat
 *                          → traitement asynchrone dans le processus
 *   GET  /health         → 200 si la boucle tourne
 *
 * Base injoignable : l'événement va dans le journal de secours et WAHA reçoit 200
 * (sinon WAHA réessaie et sature). Signature invalide : 401, rien n'est enregistré.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Spool } from '../db/spool.js';
import { verifyWahaHmac } from './hmac.js';
import { normalizeWahaEvent, type NormalizedEvent } from './normalize.js';
import { processEvent, type ProcessDeps } from './process-event.js';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface IngestServerDeps extends ProcessDeps {
  hmacKey: string;
  spool: Spool;
  log: (line: string, data?: Record<string, unknown>) => void;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Enregistre puis traite un corps de webhook déjà authentifié. Utilisé aussi par le rejeu du journal. */
export async function recordAndProcess(body: unknown, source: 'webhook' | 'spool_replay' | 'catch_up', deps: IngestServerDeps): Promise<string> {
  const norm = normalizeWahaEvent(body);
  if (!norm.ok) return `ignored:${norm.reason}`;
  const ev: NormalizedEvent = norm.event;
  const eventType = ev.kind;
  const id = await deps.db.rpc<number | null>('agent_record_inbound_event', {
    p_session: ev.session,
    p_event_type: eventType,
    p_dedup_key: ev.dedupKey,
    p_payload: body,
    p_source: source,
  });
  if (id === null) return 'duplicate';
  void runProcessing(id, ev, deps);
  return 'accepted';
}

export async function runProcessing(id: number, ev: NormalizedEvent, deps: IngestServerDeps): Promise<void> {
  try {
    const r = await processEvent(ev, deps);
    await deps.db.rpc('agent_mark_inbound_event', { p_id: id, p_status: 'processed', p_reason: r.outcome });
    deps.log('event processed', { id, kind: ev.kind, outcome: r.outcome });
  } catch (err) {
    deps.log('event processing failed', { id, kind: ev.kind, error: String((err as Error).message) });
    // Reste 'received' : le balayeur le reprendra (le traitement est idempotent).
  }
}

export function createIngestServer(deps: IngestServerDeps): Server {
  return createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, at: new Date().toISOString() });
      const isWebhook = req.url === '/webhooks/waha' || req.url === '/webhook' || req.url === '/api/public/waha-webhook';
      if (req.method !== 'POST' || !isWebhook) return json(res, 404, { error: 'not_found' });

      let raw: Buffer;
      try {
        raw = await readBody(req);
      } catch {
        return json(res, 413, { error: 'body_too_large' });
      }
      const sig = req.headers['x-webhook-hmac'];
      const algo = req.headers['x-webhook-hmac-algorithm'];
      if (!verifyWahaHmac(raw, Array.isArray(sig) ? sig[0] : sig, Array.isArray(algo) ? algo[0] : algo, deps.hmacKey)) {
        return json(res, 401, { error: 'invalid_signature' });
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        return json(res, 400, { error: 'invalid_json' });
      }
      try {
        const outcome = await recordAndProcess(body, 'webhook', deps);
        return json(res, 200, { ok: true, outcome });
      } catch (err) {
        await deps.spool.append({ receivedAt: new Date().toISOString(), body });
        deps.log('db unreachable → spooled', { error: String((err as Error).message) });
        return json(res, 200, { ok: true, outcome: 'spooled' });
      }
    })().catch(() => {
      if (!res.headersSent) json(res, 500, { error: 'internal' });
    });
  });
}
