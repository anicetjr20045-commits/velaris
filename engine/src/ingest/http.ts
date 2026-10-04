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
import type { WahaClient } from '../send/waha-client.js';
import { verifyWahaHmac } from './hmac.js';
import { normalizeWahaEvent, type NormalizedEvent } from './normalize.js';
import { processEvent, type ProcessDeps } from './process-event.js';
import { runCopilotBrain } from '../llm/copilot-brain.js';
import type { DeepSeekProvider } from '../llm/deepseek.js';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface IngestServerDeps extends ProcessDeps {
  hmacKey: string;
  spool: Spool;
  log: (line: string, data?: Record<string, unknown>) => void;
  waha?: WahaClient;
  llmProvider?: DeepSeekProvider;
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
      // CORS permissif pour les appels dashboard et pages publiques
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, at: new Date().toISOString() });

      const parsedUrl = new URL(req.url || '/', 'http://localhost');

      // Endpoints publics d'appairage QR Code WhatsApp
      if (parsedUrl.pathname === '/api/qr/status' && req.method === 'GET') {
        const session = parsedUrl.searchParams.get('session') || 'Test';
        if (!deps.waha) return json(res, 503, { ok: false, error: 'waha_not_configured' });
        const r = await deps.waha.getSession(session);
        return json(res, 200, {
          ok: r.ok,
          session,
          status: r.status,
          isScanning: r.status === 'SCAN_QR_CODE',
          isOnline: r.status === 'WORKING',
          phone: r.session?.me?.id ? `+${r.session.me.id.split('@')[0]}` : null,
          pushName: r.session?.me?.pushName || null,
          updatedAt: new Date().toISOString(),
        });
      }

      if (parsedUrl.pathname === '/api/qr/restart' && (req.method === 'POST' || req.method === 'GET')) {
        const session = parsedUrl.searchParams.get('session') || 'Test';
        if (deps.protectedSessions?.includes(session)) {
          return json(res, 403, { ok: false, error: `session_${session}_is_protected` });
        }
        if (!deps.waha) return json(res, 503, { ok: false, error: 'waha_not_configured' });
        const r = await deps.waha.restartSession(session);
        return json(res, r.ok ? 200 : 500, {
          ok: r.ok,
          session,
          status: r.status || 'STARTING',
          message: r.ok ? 'Passerelle WhatsApp relancée' : r.error,
        });
      }

      if (parsedUrl.pathname === '/api/qr/image' && req.method === 'GET') {
        const session = parsedUrl.searchParams.get('session') || 'Test';
        if (!deps.waha) return json(res, 503, { ok: false, error: 'waha_not_configured' });
        const s = await deps.waha.getSession(session);
        if (s.status !== 'SCAN_QR_CODE') {
          return json(res, 404, { ok: false, error: 'not_scanning', status: s.status });
        }
        const img = await deps.waha.getQrImage(session);
        if (!img.ok || !img.buffer) {
          return json(res, 502, { ok: false, error: 'qr_fetch_failed' });
        }
        res.writeHead(200, {
          'Content-Type': img.contentType || 'image/png',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Content-Length': img.buffer.length,
        });
        res.end(img.buffer);
        return;
      }

      // Endpoint d'archivage / désarchivage synchronisé WhatsApp & Supabase
      if (parsedUrl.pathname === '/api/chat-archive' && req.method === 'POST') {
        let body: any;
        try {
          const raw = await readBody(req);
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          return json(res, 400, { ok: false, error: 'invalid_json_body' });
        }

        const session = String(body.session || 'Test');
        const chatId = String(body.chatId || '');
        const archived = Boolean(body.archived);

        if (!chatId) {
          return json(res, 400, { ok: false, error: 'missing_chat_id' });
        }

        // 1. Commande d'archivage vers WAHA
        let wahaOk = false;
        if (deps.waha) {
          const wahaRes = await deps.waha.archiveChat(session, chatId, archived);
          wahaOk = wahaRes.ok;
          deps.log('waha archive executed', { session, chatId, archived, ok: wahaRes.ok, error: wahaRes.error });
        }

        // 2. Persistance dans Supabase (conversations.ack_log)
        const cleanPhone = chatId.replace(/\D/g, '');
        try {
          await deps.db.rpc('agent_set_chat_archived', {
            p_phone: cleanPhone,
            p_archived: archived,
          });
        } catch (dbErr: any) {
          deps.log('db update error on chat-archive', { error: dbErr.message });
        }

        return json(res, 200, { ok: true, session, chatId, archived, wahaSuccess: wahaOk });
      }

      // Endpoint intelligent Copilot IA (DeepSeek V3)
      if (parsedUrl.pathname === '/api/copilot' && req.method === 'POST') {
        if (!deps.llmProvider) return json(res, 503, { ok: false, error: 'llm_not_configured' });
        let body: any;
        try {
          const raw = await readBody(req);
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          return json(res, 400, { ok: false, error: 'invalid_json_body' });
        }

        try {
          const brainRes = await runCopilotBrain({
            prompt: body.prompt || '',
            history: body.history || [],
            sessionName: body.sessionName || 'Test',
            user: body.user || null,
            clientContext: body.context || null,
          }, {
            db: deps.db as any,
            llm: deps.llmProvider,
            waha: deps.waha,
            log: deps.log,
          });

          return json(res, 200, { ok: true, data: brainRes });
        } catch (err: any) {
          deps.log('api/copilot execution error', { error: err.message });
          return json(res, 500, { ok: false, error: err.message || 'copilot_brain_error' });
        }
      }

      const isWebhook = parsedUrl.pathname === '/webhooks/waha' || parsedUrl.pathname === '/webhook' || parsedUrl.pathname === '/api/public/waha-webhook';
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
