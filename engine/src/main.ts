/**
 * Point d'entrée du moteur :
 *  - Ingestion HTTP des webhooks WAHA (avec vérification HMAC temps constant)
 *  - Tampon de regroupement des rafales dans conversation_turns
 *  - Travailleur autonome d'exécution des tours (compréhension DeepSeek -> décision FSM -> rendu -> outbox)
 *  - Boîte d'envoi OutboxSender régulée vers WAHA
 *  - Balayeur de secours (récupération des tours orphelins et passations expirées)
 *  - Rejeu automatique du journal de secours (Spool) en cas de panne DB.
 */

import { existsSync } from 'node:fs';
import { loadConfig } from './config.js';
import { RestDb } from './db/rest.js';
import { Spool } from './db/spool.js';
import { createIngestServer, recordAndProcess, runProcessing, type IngestServerDeps } from './ingest/http.js';
import { normalizeWahaEvent } from './ingest/normalize.js';
import { DeepSeekProvider } from './llm/deepseek.js';
import { TurnSweeper } from './queue/sweeper.js';
import { TurnWorker } from './queue/worker.js';
import { OutboxSender } from './send/outbox.js';
import { createMediaSigner } from './send/storage.js';
import { WahaClient } from './send/waha-client.js';
import { AudioTranscriber } from './services/transcribe.js';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const config = loadConfig();

const log = (line: string, data: Record<string, unknown> = {}): void => {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), worker: config.workerId, msg: line, ...data })}\n`);
};

const db = new RestDb({ url: config.supabaseUrl, secretKey: config.supabaseSecretKey });
const spool = new Spool(config.spoolDir);
const waha = new WahaClient({ baseUrl: config.wahaUrl, apiKey: config.wahaApiKey, webhookHmacKey: config.wahaWebhookHmacKey });

const llmProvider = new DeepSeekProvider({
  apiKey: config.deepseek.apiKey,
  baseUrl: config.deepseek.baseUrl,
  model: config.deepseek.model,
  timeoutMs: config.deepseek.timeoutMs,
});

const transcriber = config.kieApiKey
  ? new AudioTranscriber({
      wahaUrl: config.wahaUrl,
      wahaApiKey: config.wahaApiKey,
      kieApiKey: config.kieApiKey,
      db,
      log,
    })
  : undefined;
if (!transcriber) {
  log('WARNING: KIE_API_KEY non configurée — transcription des notes vocales DÉSACTIVÉE');
}

const ingestDeps: IngestServerDeps = {
  db,
  spool,
  log,
  hmacKey: config.wahaWebhookHmacKey,
  adminApiKey: config.adminApiKey,
  protectedSessions: config.protectedSessions,
  waha,
  llmProvider,
  transcriber,
};

const sender = new OutboxSender({
  db,
  waha,
  signMedia: createMediaSigner({ supabaseUrl: config.supabaseUrl, secretKey: config.supabaseSecretKey }),
  perSessionConcurrency: config.senderConcurrencyPerSession,
  protectedSessions: config.protectedSessions,
  log,
});

const turnWorker = new TurnWorker({
  db,
  llmProvider,
  workerId: config.workerId,
  concurrency: 2,
  transcriber,
  log,
});

const turnSweeper = new TurnSweeper({
  db,
  log,
});

let stopping = false;

async function loop(name: string, everyMs: number, fn: () => Promise<unknown>): Promise<void> {
  while (!stopping) {
    try {
      await fn();
    } catch (err) {
      log(`${name} failed`, { error: String((err as Error).message) });
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

const server = createIngestServer(ingestDeps);
server.listen(config.port, '0.0.0.0', () => log('ingest listening', { port: config.port }));

void loop('turn-worker', 500, () => turnWorker.tick());
void loop('outbox', 500, () => sender.tick());
void loop('turn-sweeper', 30_000, () => turnSweeper.tick());

void loop('stale-events', 15_000, async () => {
  const rows = await db.rpc<Array<{ id: number; payload: unknown }>>('agent_stale_inbound_events', { p_older_than_seconds: 10, p_limit: 50 });
  for (const r of rows ?? []) {
    const norm = normalizeWahaEvent(r.payload);
    if (norm.ok) await runProcessing(r.id, norm.event, ingestDeps);
    else await db.rpc('agent_mark_inbound_event', { p_id: r.id, p_status: 'ignored', p_reason: norm.reason });
  }
});

void loop('spool-replay', 20_000, async () => {
  const n = await spool.replay(async (entry) => { await recordAndProcess(entry.body, 'spool_replay', ingestDeps); });
  if (n > 0) log('spool replayed', { entries: n });
});

function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  turnWorker.stop();
  log('shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 60_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
