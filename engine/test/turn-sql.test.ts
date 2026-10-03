/**
 * Tests des fonctions de tour (migration 20261006_agent_turn.sql) et du moteur runTurn
 * exécutés sur Postgres (PGlite) avec toutes les migrations appliquées.
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { bodyHash } from '../src/ingest/wa-ids.js';
import type { Db } from '../src/db/rest.js';
import type { JsonCompletion, JsonCompletionRequest, LlmProvider } from '../src/llm/provider.js';
import { runTurn, type RunTurnDeps, type TurnRef } from '../src/queue/run-turn.js';
import { TurnWorker } from '../src/queue/worker.js';
import { TurnSweeper } from '../src/queue/sweeper.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');
const USER = '11111111-1111-1111-1111-111111111111';
const SESSION = 'studio_turn_test';
const CHAT = '22670000000@c.us';
const db = new PGlite();

class PGliteDbAdapter implements Db {
  constructor(private readonly pg: PGlite) {}

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const keys = Object.keys(args);
    const argsList = keys.map((k, i) => `${k} => $${i + 1}`).join(',');
    const values = keys.map((k) => args[k]);
    const res = await this.pg.query<Record<string, unknown>>(`SELECT * FROM ${fn}(${argsList})`, values);
    if (res.rows.length === 0) return null as T;
    const firstRow = res.rows[0]!;
    const colKeys = Object.keys(firstRow);
    if (colKeys.length === 1 && colKeys[0] === fn) {
      return firstRow[fn] as T;
    }
    return res.rows as T;
  }
}

const adapter = new PGliteDbAdapter(db);

class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  constructor(private readonly mockData: Record<string, unknown>) {}

  async completeJson(_req: JsonCompletionRequest): Promise<JsonCompletion> {
    return {
      data: this.mockData,
      model: 'mock-model',
      usage: { promptTokens: 100, completionTokens: 50, cacheHitTokens: 0 },
      latencyMs: 15,
      attempts: 1,
      reasoningDiscarded: false,
    };
  }
}

before(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
  `);

  await db.exec(read('supabase_schema_init.sql').split('\n').filter((l) => !l.startsWith('CREATE EXTENSION')).join('\n'));
  await db.exec(read('supabase/migrations/20261004_agent_core.sql'));
  await db.exec(read('supabase/migrations/20261005_agent_ingest.sql'));
  await db.exec(read('supabase/migrations/20261006_agent_turn.sql'));
  await db.exec(read('supabase/migrations/20261006_agent_turn.sql')); // Idempotence check

  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${USER}');
    INSERT INTO wa_sessions (user_id, session_name, status, engine_owner)
      VALUES ('${USER}', '${SESSION}', 'connected', 'velaris_engine');
    INSERT INTO studio_personas (
      user_id, studio_name, agent_name, manager_first_name, tone, formal_address, emoji_policy,
      cap_reception, cap_procedure_voice, cap_payment, delivery_mode
    ) VALUES (
      '${USER}', 'Studio Test', 'Alex', 'Anicet', 'chaleureux', true, 'none',
      true, true, true, 'live'
    );
    INSERT INTO studio_catalogues (user_id, code, label, description, price_xof, deliverable, payment_policy)
      VALUES
        ('${USER}', 'essentiel', 'Essentiel', 'Chanson personnalisée 1 couplet 1 refrain', 1200, 'audio', 'after_lyrics_validation'),
        ('${USER}', 'signature', 'Signature', 'Chanson personnalisée complète 2 couplets', 3000, 'audio', 'after_lyrics_validation'),
        ('${USER}', 'prestige', 'Prestige', 'Chanson audio + vidéo diaporama photo', 5000, 'audio_video', 'after_lyrics_validation');
  `);
});

describe('20261006_agent_turn SQL functions', () => {
  let convId = '';
  let turnId = '';
  let lockToken = 0;

  test('ingestion -> tour créé -> réservation -> context complet', async () => {
    // 1. Ingestion d'un message client
    const ingestRes = await adapter.rpc<{ outcome: string; conversation_id: string; turn_id: string }>(
      'agent_ingest_message',
      {
        p_session: SESSION,
        p_chat_id: CHAT,
        p_from_me: false,
        p_wa_message_id: 'wa_msg_001',
        p_wa_key: 'key_001',
        p_wa_timestamp: new Date().toISOString(),
        p_body: 'Bonjour, je veux une chanson pour ma femme Awa',
        p_media_kind: null,
        p_media_path: null,
        p_push_name: 'Client Awa',
        p_body_hash: bodyHash('Bonjour, je veux une chanson pour ma femme Awa'),
      },
    );

    assert.equal(ingestRes.outcome, 'inbound');
    convId = ingestRes.conversation_id;

    // Avancer ready_at pour pouvoir réserver le tour immédiatement
    await db.exec(`UPDATE conversation_turns SET ready_at = now() - interval '1 second' WHERE conversation_id = '${convId}'`);

    // 2. Réservation du tour par un worker
    const claimed = await adapter.rpc<Array<{ turn_id: string; conversation_id: string; user_id: string; lock_token: number; trigger: string }>>(
      'agent_claim_turn',
      { p_worker: 'worker-test-1', p_lease_seconds: 90 },
    );

    assert.ok(claimed && claimed.length > 0);
    turnId = claimed[0]!.turn_id;
    lockToken = Number(claimed[0]!.lock_token);
    assert.equal(claimed[0]!.conversation_id, convId);
    assert.equal(claimed[0]!.trigger, 'client_message');

    // 3. Lecture du contexte complet via agent_turn_context
    const ctx = await adapter.rpc<any>('agent_turn_context', { p_turn: turnId });
    assert.ok(ctx);
    assert.equal(ctx.conversation.id, convId);
    assert.equal(ctx.persona.studio_name, 'Studio Test');
    assert.equal(ctx.persona.agent_name, 'Alex');
    assert.equal(ctx.catalogue.length, 3);
    assert.equal(ctx.inbound.length, 1);
    assert.equal(ctx.inbound[0].body, 'Bonjour, je veux une chanson pour ma femme Awa');
  });

  test('agent_conversation_effect : mise à jour des compteurs et état', async () => {
    // pending question
    await adapter.rpc('agent_conversation_effect', {
      p_conversation: convId,
      p_kind: 'pending_question',
      p_data: { question: { key: 'confirm_recipient_name', value: 'Awa' } },
    });

    const c1 = await db.query<any>(`SELECT pending_question FROM conversations WHERE id = '${convId}'`);
    assert.equal(c1.rows[0].pending_question?.key, 'confirm_recipient_name');

    // low conf streak
    await adapter.rpc('agent_conversation_effect', {
      p_conversation: convId,
      p_kind: 'low_conf_streak',
      p_data: { value: 2 },
    });

    const c2 = await db.query<any>(`SELECT low_conf_streak FROM conversations WHERE id = '${convId}'`);
    assert.equal(c2.rows[0].low_conf_streak, 2);

    // mark ack
    await adapter.rpc('agent_conversation_effect', {
      p_conversation: convId,
      p_kind: 'mark_ack',
      p_data: { key: 'welcome:sent' },
    });

    const c3 = await db.query<any>(`SELECT ack_log FROM conversations WHERE id = '${convId}'`);
    assert.ok(c3.rows[0].ack_log['welcome:sent']);
  });

  test('agent_order_effect et transitions', async () => {
    // Ouvrir une commande
    const orderId = await adapter.rpc<string>('agent_open_order', { p_conversation: convId });
    assert.ok(orderId);

    // Patch brief
    const patchRes = await adapter.rpc<string>('agent_patch_order_fields', {
      p_order: orderId,
      p_expected_version: 0,
      p_patch: { occasion: 'anniversaire', recipient_name: 'Awa' },
      p_allow_clear: false,
    });
    assert.equal(patchRes, 'ok');

    // Effet order : deferral
    const defRes = await adapter.rpc<string>('agent_order_effect', {
      p_order: orderId,
      p_expected_version: 1,
      p_kind: 'payment_deferral',
      p_data: { reason: 'kiosk_closed', when: 'tomorrow' },
    });
    assert.equal(defRes, 'ok');

    const o = await db.query<any>(`SELECT version, payment_deferral, occasion FROM orders WHERE id = '${orderId}'`);
    assert.equal(o.rows[0].version, 2);
    assert.equal(o.rows[0].occasion, 'anniversaire');
    assert.equal(o.rows[0].payment_deferral.reason, 'kiosk_closed');
  });

  test('clôture et journalisation atomique', async () => {
    // agent_finish_turn
    await adapter.rpc('agent_finish_turn', {
      p_turn: turnId,
      p_conversation: convId,
      p_token: lockToken,
      p_status: 'done',
      p_outcome: 'replied',
    });

    const t = await db.query<any>(`SELECT status, outcome FROM conversation_turns WHERE id = '${turnId}'`);
    assert.equal(t.rows[0].status, 'done');
    assert.equal(t.rows[0].outcome, 'replied');

    // agent_log_turn
    await adapter.rpc('agent_log_turn', {
      p: {
        turn_id: turnId,
        user_id: USER,
        conversation_id: convId,
        policy_version: 'v2',
        orders_before: [],
        understanding: { primary_intent: 'order_song' },
        target_resolution: { resolution: 'none' },
        decision: { actions: [], utterances: [] },
        actions: [],
        draft: [],
        guard_results: [],
        final_outbox_ids: [],
        outcome: 'replied',
        models: { understand: 'mock' },
        tokens: { prompt: 100, completion: 50 },
        latency_ms: 120,
      },
    });

    const l = await db.query<any>(`SELECT count(*) AS n FROM agent_turn_logs WHERE turn_id = '${turnId}'`);
    assert.equal(Number(l.rows[0].n), 1);
  });
});

describe('runTurn & TurnWorker end-to-end', () => {
  test('exécute un tour de A à Z avec compréhension, décision, outbox et journalisation', async () => {
    const CHAT2 = '22678888888@c.us';

    // Ingestion
    const ing = await adapter.rpc<{ conversation_id: string; turn_id: string }>(
      'agent_ingest_message',
      {
        p_session: SESSION,
        p_chat_id: CHAT2,
        p_from_me: false,
        p_wa_message_id: 'wa_msg_e2e_1',
        p_wa_key: 'key_e2e_1',
        p_wa_timestamp: new Date().toISOString(),
        p_body: 'Bonjour, je veux commander une chanson pour ma chérie Fadila',
        p_media_kind: null,
        p_media_path: null,
        p_push_name: 'Amadou',
        p_body_hash: bodyHash('Bonjour, je veux commander une chanson pour ma chérie Fadila'),
      },
    );

    const convId2 = ing.conversation_id;
    await db.exec(`UPDATE conversation_turns SET ready_at = now() - interval '1 second' WHERE conversation_id = '${convId2}'`);

    const claimed = await adapter.rpc<Array<{ turn_id: string; conversation_id: string; user_id: string; lock_token: number; trigger: string }>>(
      'agent_claim_turn',
      { p_worker: 'worker-e2e', p_lease_seconds: 90 },
    );

    assert.ok(claimed && claimed.length > 0);
    const turnRef: TurnRef = {
      turnId: claimed[0]!.turn_id,
      conversationId: claimed[0]!.conversation_id,
      userId: claimed[0]!.user_id,
      lockToken: Number(claimed[0]!.lock_token),
      trigger: claimed[0]!.trigger,
    };

    const mockLlm = new MockLlmProvider({
      primary_intent: 'order_song',
      secondary_intents: [],
      negated: false,
      confidence: 0.95,
      fields: {
        recipient_name: { value: 'Fadila', quote: 'Fadila' },
        recipient_relation: { value: 'chérie', quote: 'chérie' },
      },
      payment_signal: { kind: 'none' },
      emotional_weight: 'none',
      sensitive_topic: 'none',
      sentiment: 'positive',
      wants_human: false,
      stop_request: false,
      order_reference: { recipient_name: 'Fadila' },
    });

    const deps: RunTurnDeps = {
      db: adapter,
      llmProvider: mockLlm,
      workerId: 'worker-e2e',
      log: () => {},
    };

    const outcome = await runTurn(deps, turnRef);

    // Vérifications
    assert.equal(outcome.outcome, 'replied');
    assert.ok(outcome.enqueuedIds.length > 0, 'au moins 1 message en boîte d\'envoi');

    // Vérifier en base que la commande a été créée
    const ordersInDb = await db.query<any>(`SELECT * FROM orders WHERE conversation_id = '${convId2}'`);
    assert.equal(ordersInDb.rows.length, 1);
    assert.equal(ordersInDb.rows[0].recipient_name, 'Fadila');
    assert.equal(ordersInDb.rows[0].stage, 'collecting_brief');

    // Vérifier la boîte d'envoi
    const outboxInDb = await db.query<any>(`SELECT * FROM outbound_messages WHERE conversation_id = '${convId2}'`);
    assert.ok(outboxInDb.rows.length > 0);
    assert.equal(outboxInDb.rows[0].origin, 'agent');
    assert.equal(outboxInDb.rows[0].status, 'pending');
    assert.ok(outboxInDb.rows[0].body.includes('occasion') || outboxInDb.rows[0].body.includes('Fadila'));

    // Vérifier que le verrou est bien libéré
    const lock = await db.query<any>(`SELECT * FROM automation_locks WHERE conversation_id = '${convId2}'`);
    assert.equal(lock.rows.length, 0);

    // Vérifier le journal
    const turnLog = await db.query<any>(`SELECT * FROM agent_turn_logs WHERE turn_id = '${turnRef.turnId}'`);
    assert.equal(turnLog.rows.length, 1);
    assert.equal(turnLog.rows[0].outcome, 'replied');
  });

  test('TurnWorker & TurnSweeper ticks s\'exécutent sans erreur', async () => {
    const worker = new TurnWorker({
      db: adapter,
      llmProvider: new MockLlmProvider({ primary_intent: 'acknowledgement', confidence: 0.9 }),
      workerId: 'worker-unit',
      log: () => {},
    });

    const sweeper = new TurnSweeper({
      db: adapter,
      log: () => {},
    });

    const wCount = await worker.tick();
    assert.equal(typeof wCount, 'number');

    const sCount = await sweeper.tick();
    assert.equal(typeof sCount, 'number');
  });
});
