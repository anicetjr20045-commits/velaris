/**
 * Fonctions d'ingestion (migration 20261005) exécutées sur Postgres (PGlite),
 * au-dessus du schéma réel de production (identique à supabase_schema_init.sql, relevé le 2026-10-04).
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { bodyHash } from '../src/ingest/wa-ids.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');
const USER = '11111111-1111-1111-1111-111111111111';
const SESSION = 'studio_test';
const CHAT = '22670000000@c.us';
const db = new PGlite();

type Outcome = { outcome: string; conversation_id?: string; message_id?: string; turn_id?: string | null; command?: string; previous?: string; current?: string };

async function ingest(p: { fromMe?: boolean; key: string; body?: string | null; media?: string | null; push?: string }): Promise<Outcome> {
  const r = await db.query<{ r: Outcome }>(
    'SELECT agent_ingest_message($1,$2,$3,$4,$5,now(),$6,$7,NULL,$8,$9) AS r',
    [SESSION, CHAT, p.fromMe ?? false, `x_${CHAT}_${p.key}`, p.key, p.body ?? null, p.media ?? null, p.push ?? 'Awa', bodyHash(p.body ?? null)],
  );
  return r.rows[0]!.r;
}

async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  return r.rows[0]!.v;
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
  await db.exec(read('supabase/migrations/20261005_agent_ingest.sql')); // idempotence
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${USER}');
    INSERT INTO wa_sessions (user_id, session_name, status, engine_owner) VALUES ('${USER}', '${SESSION}', 'scanning', 'velaris_engine');
    INSERT INTO studio_personas (user_id, studio_name, manager_first_name) VALUES ('${USER}', 'Studio Test', 'Anicet');
  `);
});

describe('agent_ingest_message', () => {
  let conv = '';

  test('message client → contact, conversation, message, tour en collecte', async () => {
    const r = await ingest({ key: 'K1', body: 'Bonjour' });
    assert.equal(r.outcome, 'inbound');
    assert.ok(r.turn_id);
    conv = r.conversation_id!;
    assert.equal(await scalar<string>('SELECT name AS v FROM contacts WHERE wa_jid = $1', [CHAT]), 'Awa');
    assert.equal(await scalar<string>('SELECT phone AS v FROM contacts WHERE wa_jid = $1', [CHAT]), '22670000000');
  });

  test('même message livré deux fois (message + message.any) → doublon, rien d\'autre', async () => {
    const r = await ingest({ key: 'K1', body: 'Bonjour' });
    assert.equal(r.outcome, 'duplicate');
    assert.equal(await scalar<number>('SELECT count(*)::int AS v FROM messages WHERE conversation_id = $1', [conv]), 1);
  });

  test('rafale : les bulles suivantes rejoignent le même tour', async () => {
    await ingest({ key: 'K2', body: "c'est pour un anniversaire" });
    const r = await ingest({ key: 'K3', body: 'pour ma femme Awa' });
    assert.equal(await scalar<number>(`SELECT count(*)::int AS v FROM conversation_turns WHERE conversation_id = $1 AND status = 'collecting'`, [conv]), 1);
    assert.equal(await scalar<number>(`SELECT cardinality(inbound_message_ids) AS v FROM conversation_turns WHERE id = $1`, [r.turn_id]), 3);
  });

  test('vocal → transcription en attente (le tour patiente)', async () => {
    await ingest({ key: 'K4', body: null, media: 'audio' });
    assert.equal(await scalar<string>(`SELECT transcript_status AS v FROM messages WHERE wa_message_key = 'K4'`), 'pending');
  });

  test('écho de notre envoi (identifiant pas encore connu) → reconnu par l\'empreinte, jamais pris pour le gérant', async () => {
    const outbox = await scalar<string>(
      `SELECT agent_enqueue_outbox($1,$2,NULL,NULL,'merchant_ui','text','merchant',FALSE,$3,$4,$5,NULL,NULL,$6,'ui:1',NULL) AS v`,
      [USER, conv, SESSION, CHAT, 'Bonjour Awa, avec plaisir', bodyHash('Bonjour Awa, avec plaisir')]);
    assert.equal(await scalar<string>('SELECT agent_begin_send($1) AS v', [outbox]), 'ok');
    const r = await ingest({ fromMe: true, key: 'E1', body: 'Bonjour  Awa, avec plaisir ' });
    assert.equal(r.outcome, 'echo');
    assert.equal(await scalar<string>('SELECT control_mode AS v FROM conversations WHERE id = $1', [conv]), 'ai');
    // La réponse de WAHA arrive après l'écho : pas de second message
    assert.equal(await scalar<string>(`SELECT agent_finish_send($1, 'sent', 'x', 'E1') AS v`, [outbox]), 'already_sent');
    assert.equal(await scalar<string>(`SELECT status AS v FROM outbound_messages WHERE id = $1`, [outbox]), 'sent');
    assert.equal(await scalar<number>(`SELECT count(*)::int AS v FROM messages WHERE outbox_id = $1`, [outbox]), 1);
  });

  test('mise en boîte d\'envoi idempotente', async () => {
    const a = await scalar<string>(`SELECT agent_enqueue_outbox($1,$2,NULL,NULL,'merchant_ui','text','merchant',FALSE,$3,$4,'x',NULL,NULL,NULL,'ui:2',NULL) AS v`, [USER, conv, SESSION, CHAT]);
    const b = await scalar<string>(`SELECT agent_enqueue_outbox($1,$2,NULL,NULL,'merchant_ui','text','merchant',FALSE,$3,$4,'x',NULL,NULL,NULL,'ui:2',NULL) AS v`, [USER, conv, SESSION, CHAT]);
    assert.equal(a, b);
  });

  test('message tapé par le gérant → il prend la main, envois de l\'agent annulés, lecture programmée', async () => {
    const r = await ingest({ fromMe: true, key: 'M1', body: 'Voici le texte de la chanson pour Awa…' });
    assert.equal(r.outcome, 'merchant');
    assert.equal(await scalar<string>('SELECT control_mode AS v FROM conversations WHERE id = $1', [conv]), 'human');
    assert.equal(await scalar<boolean>('SELECT ai_paused AS v FROM conversations WHERE id = $1', [conv]), true);
    assert.equal(await scalar<number>(`SELECT count(*)::int AS v FROM handoffs WHERE conversation_id = $1 AND status = 'open'`, [conv]), 1);
    assert.equal(await scalar<string>(`SELECT trigger AS v FROM conversation_turns WHERE id = $1`, [r.turn_id]), 'merchant_message');
  });

  test('session inconnue → rien n\'est écrit', async () => {
    const r = await db.query<{ r: Outcome }>(`SELECT agent_ingest_message('inconnue',$1,FALSE,'i','I',now(),'x',NULL,NULL,NULL,NULL) AS r`, [CHAT]);
    assert.equal(r.rows[0]!.r.outcome, 'unknown_session');
  });
});

describe('réactions et statut de session', () => {
  test('réaction ✨ du gérant (variante FE0F en base) → commande resume_ai en file', async () => {
    await db.exec(`UPDATE studio_personas SET reaction_commands = '{"✨️":"resume_ai","🎵":"confirm_and_produce"}' WHERE user_id = '${USER}'`);
    const r = await scalar<Outcome>(`SELECT agent_ingest_reaction($1,$2,'M1','✨') AS v`, [SESSION, CHAT]);
    assert.equal(r.outcome, 'command');
    assert.equal(r.command, 'resume_ai');
  });

  test('réaction sans commande → aucune action', async () => {
    const r = await scalar<Outcome>(`SELECT agent_ingest_reaction($1,$2,'M1','😊') AS v`, [SESSION, CHAT]);
    assert.equal(r.outcome, 'no_command');
  });

  test('statut écrit seulement au changement ; perte de connexion détectable', async () => {
    const a = await scalar<Outcome>(`SELECT agent_ingest_session_status($1,'WORKING','22656240533') AS v`, [SESSION]);
    assert.deepEqual([a.previous, a.current], ['scanning', 'connected']);
    const b = await scalar<Outcome>(`SELECT agent_ingest_session_status($1,'FAILED',NULL) AS v`, [SESSION]);
    assert.deepEqual([b.previous, b.current], ['connected', 'failed']);
  });
});

describe('journal brut', () => {
  test('un événement = une ligne ; le doublon renvoie NULL', async () => {
    const a = await scalar<number | null>(`SELECT agent_record_inbound_event($1,'message','K9','{}'::jsonb) AS v`, [SESSION]);
    const b = await scalar<number | null>(`SELECT agent_record_inbound_event($1,'message','K9','{}'::jsonb) AS v`, [SESSION]);
    assert.ok(a !== null);
    assert.equal(b, null);
  });
});
