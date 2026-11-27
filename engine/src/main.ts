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
import { VoiceClonerService, DraftClonerManager } from './services/voice-cloner.js';
import { ConciergeService } from './services/concierge-service.js';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const config = loadConfig();

const log = (line: string, data: Record<string, unknown> = {}): void => {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), worker: config.workerId, msg: line, ...data })}\n`);
};

const db = new RestDb({ url: config.supabaseUrl, secretKey: config.supabaseSecretKey, timeoutMs: 25_000 });
const spool = new Spool(config.spoolDir);
const waha = new WahaClient({
  baseUrl: config.wahaUrl,
  apiKey: config.wahaApiKey,
  ...(config.wahaGowsUrl && config.wahaGowsApiKey
    ? { gows: { baseUrl: config.wahaGowsUrl, apiKey: config.wahaGowsApiKey } }
    : {}),
  webhookHmacKey: config.wahaWebhookHmacKey,
});

const llmProvider = new DeepSeekProvider({
  apiKey: config.deepseek.apiKey,
  baseUrl: config.deepseek.baseUrl,
  model: config.deepseek.model,
  timeoutMs: config.deepseek.timeoutMs,
});

const transcriber = (config.sttUrl || config.kieApiKey)
  ? new AudioTranscriber({
      wahaUrl: config.wahaUrl,
      wahaApiKey: config.wahaApiKey,
      sttUrl: config.sttUrl,
      kieApiKey: config.kieApiKey ?? undefined,
      db,
      log,
    })
  : undefined;
if (!transcriber) {
  log('WARNING: Service STT non configuré — transcription des notes vocales DÉSACTIVÉE');
}

const voiceCloner = new VoiceClonerService({
  apiKey: config.fishApiKey,
  log,
});

const draftManager = new DraftClonerManager({
  cloner: voiceCloner,
  storagePath: `${config.spoolDir}/armed-drafts.json`,
  log,
});

if (!config.enableAiAutoReply) {
  log('Mode Pilote Auto Commercial DÉSACTIVÉ (mode 100% gérant humain — aucune réponse auto aux clients)');
}
log('Mode Brouillon Studio & Clonage Vocal Sœur ACTIVÉ (/vocal, /on, /stop, /off)');

const conciergeService = config.enableConcierge
  ? new ConciergeService({
      db,
      waha,
      wahaUrl: config.wahaUrl,
      wahaApiKey: config.wahaApiKey,
      kieApiKey: config.kieApiKey,
      llmProvider,
      transcriber,
      protectedSessions: config.protectedSessions,
      log,
    })
  : undefined;

if (conciergeService) {
  log('Concierge Djélia 24/7 ACTIVÉ (Onboarding Web-First + Support Différé 30s + Vision Screenshots + Typing Indicator)');
}

const wakeWaiters: Array<() => void> = [];
function wakeWorkers(): void {
  while (wakeWaiters.length > 0) {
    const resolve = wakeWaiters.shift();
    resolve?.();
  }
}

function sleepOrWake(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    wakeWaiters.push(done);
  });
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
  voiceCloner,
  draftManager,
  conciergeService,
  onWake: wakeWorkers,
  supabaseUrl: config.supabaseUrl,
  supabaseSecretKey: config.supabaseSecretKey,
  signMedia: createMediaSigner({ supabaseUrl: config.supabaseUrl, secretKey: config.supabaseSecretKey }),
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
  kieApiKey: config.kieApiKey ?? undefined,
  enableAiAutoReply: config.enableAiAutoReply,
  protectedSessions: config.protectedSessions,
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

async function adaptiveLoop(
  name: string,
  minMs: number,
  maxMs: number,
  fn: () => Promise<boolean>,
): Promise<void> {
  let delayMs = minMs;
  while (!stopping) {
    let hadWork = false;
    try {
      hadWork = await fn();
    } catch (err) {
      log(`${name} failed`, { error: String((err as Error).message) });
    }
    delayMs = hadWork ? minMs : Math.min(maxMs, Math.max(minMs, delayMs * 2));
    await sleepOrWake(delayMs);
  }
}

const server = createIngestServer(ingestDeps);
server.listen(config.port, '0.0.0.0', () => log('ingest listening', { port: config.port }));

void adaptiveLoop('turn-worker', 400, 60_000, async () => {
  const claimed = await turnWorker.tick();
  if (claimed > 0) wakeWorkers();
  return claimed > 0;
});
void adaptiveLoop('outbox', 400, 60_000, async () => {
  const started = await sender.tick();
  return started.length > 0;
});
void loop('turn-sweeper', 120_000, () => turnSweeper.tick());

void loop('stale-events', 60_000, async () => {
  const rows = await db.rpc<Array<{ id: number; payload: unknown }>>('agent_stale_inbound_events', { p_older_than_seconds: 10, p_limit: 50 });
  for (const r of rows ?? []) {
    const norm = normalizeWahaEvent(r.payload);
    if (norm.ok) await runProcessing(r.id, norm.event, ingestDeps);
    else await db.rpc('agent_mark_inbound_event', { p_id: r.id, p_status: 'ignored', p_reason: norm.reason });
  }
});

void loop('spool-replay', 60_000, async () => {
  const n = await spool.replay(async (entry) => { await recordAndProcess(entry.body, 'spool_replay', ingestDeps); });
  if (n > 0) log('spool replayed', { entries: n });
});

void loop('stale-cleanup', 86_400_000, async () => {
  await db.rpc('agent_cleanup_stale_events', {});
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
