/**
 * Exécution réelle de la migration sur Postgres (PGlite, Postgres compilé en WebAssembly).
 * Vérifie : syntaxe, idempotence (double application), reprise des données existantes,
 * et le comportement des fonctions atomiques (verrou, tampon, garde d'envoi, transitions).
 *
 * Limite : PGlite n'a qu'une connexion. La concurrence réelle (SKIP LOCKED entre processus)
 * se teste sur un Postgres complet (étape 1.7 du plan).
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const CONTACT = '33333333-3333-3333-3333-333333333333';
const CONV = '44444444-4444-4444-4444-444444444444';
const LEGACY_ORDER = '55555555-5555-5555-5555-555555555555';

const db = new PGlite();

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  assert.ok(r.rows.length > 0, `aucune ligne : ${sql}`);
  return r.rows[0]!;
}

async function asUser(uid: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
}

before(async () => {
  // Bouchons minimaux de Supabase
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
  `);
  // PGlite n'embarque pas uuid-ossp / pgcrypto ; gen_random_uuid() est natif depuis Postgres 13.
  const init = read('supabase_schema_init.sql')
    .split('\n')
    .filter((l) => !l.startsWith('CREATE EXTENSION'))
    .join('\n');
  await db.exec(init);
  // Données existantes : une commande livrée historique, la conversation en pause du script initial
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${USER}', 'studio@test'), ('${OTHER}', 'autre@test');
    INSERT INTO public.contacts (id, user_id, name, phone, wa_jid) VALUES ('${CONTACT}', '${USER}', 'Awa', '22670000000', '22670000000@c.us');
    INSERT INTO public.conversations (id, user_id, contact_id) VALUES ('${CONV}', '${USER}', '${CONTACT}');
    INSERT INTO public.orders (id, user_id, contact_id, conversation_id, amount_cents, status)
      VALUES ('${LEGACY_ORDER}', '${USER}', '${CONTACT}', '${CONV}', 300000, 'delivered');
  `);
  const migration = read('supabase/migrations/20261004_agent_core.sql');
  await db.exec(migration);
  await db.exec(migration); // idempotence
  await db.exec(`
    INSERT INTO public.studio_personas (user_id, studio_name, manager_first_name, cap_reception, max_open_orders, max_agent_msgs_per_hour)
      VALUES ('${USER}', 'Studio Test', 'Anicet', TRUE, 3, 2);
    INSERT INTO public.studio_catalogues (user_id, code, label, description, price_xof, deliverable)
      VALUES ('${USER}', 'standard', 'Chanson complète', 'Chanson audio masterisée', 3000, 'audio');
  `);
});

describe('migration 20261004_agent_core', () => {
  test('appliquée deux fois sans erreur ; 35 transitions (procedure_voice_sent supprimée, transition morte)', async () => {
    const r = await one<{ n: number }>('SELECT count(*)::int AS n FROM order_transitions');
    assert.equal(r.n, 35);
  });

  test('reprise : la commande livrée historique reste livrée et payée', async () => {
    const o = await one<{ stage: string; payment_status: string; status: string; price_xof: number }>(
      'SELECT stage, payment_status, status, price_xof FROM orders WHERE id = $1', [LEGACY_ORDER]);
    assert.deepEqual(o, { stage: 'delivered', payment_status: 'confirmed', status: 'delivered', price_xof: 3000 });
  });

  test('reprise : les conversations en pause passent sous contrôle du gérant', async () => {
    const c = await one<{ control_mode: string; ai_paused: boolean }>(
      `SELECT control_mode, ai_paused FROM conversations WHERE id = 'b0000001-0000-0000-0000-000000000001'`);
    assert.deepEqual(c, { control_mode: 'human', ai_paused: true });
  });

  test('politique d\'étape : paiement jamais silencieux, vocal exige un enregistrement', async () => {
    await assert.rejects(db.query(`INSERT INTO studio_step_policies (user_id, step, channel) VALUES ('${USER}', 'payment', 'silent')`));
    await assert.rejects(db.query(`INSERT INTO studio_step_policies (user_id, step, channel) VALUES ('${USER}', 'handoff_ack', 'silent')`));
    await assert.rejects(db.query(`INSERT INTO studio_step_policies (user_id, step, channel) VALUES ('${USER}', 'procedure', 'voice')`));
    await db.query(`INSERT INTO studio_step_policies (user_id, step, channel) VALUES ('${USER}', 'brief_question', 'template')`);
  });
});

describe('tampon, verrou, garde d\'envoi', () => {
  let turnId = '';
  let token = 0;

  test('trois bulles rapprochées → un seul tour en collecte', async () => {
    const ids: string[] = [];
    for (const body of ['Bonjour', "c'est pour un anniversaire", 'pour ma femme Awa']) {
      const m = await one<{ id: string }>(
        `INSERT INTO messages (conversation_id, user_id, role, direction, body) VALUES ($1, $2, 'user', 'inbound', $3) RETURNING id`,
        [CONV, USER, body]);
      ids.push(m.id);
      await db.query('SELECT agent_buffer_inbound($1, $2, $3, 4000, 12000)', [USER, CONV, m.id]);
    }
    const rows = await db.query<{ ids: string[] }>(
      `SELECT inbound_message_ids AS ids FROM conversation_turns WHERE conversation_id = $1 AND status = 'collecting'`, [CONV]);
    assert.equal(rows.rows.length, 1);
    assert.deepEqual(rows.rows[0]!.ids, ids);
  });

  test('pas de réservation avant la fin de la fenêtre de silence', async () => {
    const r = await db.query('SELECT * FROM agent_claim_turn($1, 90)', ['w1']);
    assert.equal(r.rows.length, 0);
  });

  test('réservation exclusive : un seul travailleur obtient le tour', async () => {
    await db.query(`UPDATE conversation_turns SET ready_at = now() - interval '1 second' WHERE conversation_id = $1`, [CONV]);
    const a = await db.query<{ turn_id: string; lock_token: number }>('SELECT * FROM agent_claim_turn($1, 90)', ['w1']);
    const b = await db.query('SELECT * FROM agent_claim_turn($1, 90)', ['w2']);
    assert.equal(a.rows.length, 1);
    assert.equal(b.rows.length, 0);
    turnId = a.rows[0]!.turn_id;
    token = Number(a.rows[0]!.lock_token);
    assert.equal((await one<{ ok: boolean }>('SELECT agent_renew_lease($1, $2, 90) AS ok', [CONV, token])).ok, true);
    assert.equal((await one<{ ok: boolean }>('SELECT agent_renew_lease($1, $2, 90) AS ok', [CONV, token + 999])).ok, false);
  });

  async function outbox(key: string, purpose = 'reply', isRelay = false): Promise<string> {
    const r = await one<{ id: string }>(
      `INSERT INTO outbound_messages (user_id, conversation_id, turn_id, origin, kind, purpose, is_relay, session_name, chat_id, body, idempotency_key, lock_token)
       VALUES ($1, $2, $3, 'agent', 'text', $4, $5, 'studio_test', '22670000000@c.us', 'Bonjour', $6, $7) RETURNING id`,
      [USER, CONV, turnId, purpose, isRelay, key, token]);
    return r.id;
  }
  const beginSend = async (id: string): Promise<string> => (await one<{ r: string }>('SELECT agent_begin_send($1) AS r', [id])).r;

  test('envoi autorisé avec le bon jeton', async () => {
    assert.equal(await beginSend(await outbox('t:0')), 'ok');
  });

  test('nouveau message client pendant le tour → envoi annulé (supersession)', async () => {
    const m = await one<{ id: string }>(
      `INSERT INTO messages (conversation_id, user_id, role, direction, body) VALUES ($1, $2, 'user', 'inbound', 'ah et aussi') RETURNING id`, [CONV, USER]);
    await db.query('SELECT agent_buffer_inbound($1, $2, $3, 4000, 12000)', [USER, CONV, m.id]);
    assert.equal(await beginSend(await outbox('t:1')), 'superseded');
    await db.query(`DELETE FROM conversation_turns WHERE conversation_id = $1 AND status = 'collecting'`, [CONV]);
  });

  test('le gérant prend la main → l\'agent ne peut plus envoyer, sauf relais de paiement', async () => {
    assert.equal((await one<{ r: string }>(`SELECT agent_set_control($1, 'human', 'merchant_reply', 'merchant') AS r`, [CONV])).r, 'ok');
    assert.equal(await beginSend(await outbox('t:2')), 'paused');
    assert.equal(await beginSend(await outbox('t:3', 'payment_instructions', true)), 'ok');
  });

  test('l\'agent ne peut pas lever une prise de main du gérant (I6)', async () => {
    assert.equal((await one<{ r: string }>(`SELECT agent_set_control($1, 'ai', 'auto', 'agent') AS r`, [CONV])).r, 'merchant_lock');
    assert.equal((await one<{ r: string }>(`SELECT agent_set_control($1, 'ai', 'merchant_return', 'merchant') AS r`, [CONV])).r, 'ok');
  });

  test('disjoncteur : au-delà du plafond horaire, envoi refusé (I31)', async () => {
    // plafond du studio de test = 2 ; deux envois 'ok' déjà comptés (t:0 et le relais t:3)
    assert.equal(await beginSend(await outbox('t:4')), 'rate_limited');
  });

  test('un studio ne peut pas piloter la conversation d\'un autre', async () => {
    await asUser(OTHER);
    assert.equal((await one<{ r: string }>(`SELECT agent_set_control($1, 'human', 'x', 'merchant') AS r`, [CONV])).r, 'forbidden');
    await asUser(null);
  });

  test('fin de tour : verrou libéré', async () => {
    await db.query(`SELECT agent_finish_turn($1, $2, $3, 'done', 'test')`, [turnId, CONV, token]);
    const r = await one<{ n: number }>('SELECT count(*)::int AS n FROM automation_locks WHERE conversation_id = $1', [CONV]);
    assert.equal(r.n, 0);
  });
});

describe('commandes : deux pistes', () => {
  let orderId = '';
  const version = async (): Promise<number> => (await one<{ version: number }>('SELECT version FROM orders WHERE id = $1', [orderId])).version;
  const transition = async (track: string, event: string, actor: string): Promise<string> =>
    (await one<{ r: string }>('SELECT agent_transition_order($1, $2, $3, $4, $5) AS r', [orderId, await version(), track, event, actor])).r;

  test('ouverture et plafond de commandes ouvertes', async () => {
    orderId = (await one<{ id: string }>('SELECT agent_open_order($1) AS id', [CONV])).id;
    await db.query('SELECT agent_open_order($1)', [CONV]);
    await db.query('SELECT agent_open_order($1)', [CONV]);
    await assert.rejects(db.query('SELECT agent_open_order($1)', [CONV]), /too_many_open_orders/);
  });

  test('aucun effacement implicite d\'un champ du brief (I20)', async () => {
    await db.query('SELECT agent_patch_order_fields($1, $2, $3::jsonb)', [orderId, await version(), JSON.stringify({ recipient_name: 'Awa', occasion: 'anniversaire' })]);
    await db.query('SELECT agent_patch_order_fields($1, $2, $3::jsonb)', [orderId, await version(), JSON.stringify({ recipient_name: null })]);
    const o = await one<{ recipient_name: string }>('SELECT recipient_name FROM orders WHERE id = $1', [orderId]);
    assert.equal(o.recipient_name, 'Awa');
    await db.query('SELECT agent_patch_order_fields($1, $2, $3::jsonb, TRUE)', [orderId, await version(), JSON.stringify({ recipient_name: null })]);
    const c = await one<{ recipient_name: string | null }>('SELECT recipient_name FROM orders WHERE id = $1', [orderId]);
    assert.equal(c.recipient_name, null);
  });

  test('conflit de version refusé', async () => {
    const r = await one<{ r: string }>('SELECT agent_patch_order_fields($1, $2, $3::jsonb) AS r', [orderId, (await version()) - 1, '{}']);
    assert.equal(r.r, 'version_conflict');
  });

  test('prix lu dans le catalogue, montant historique synchronisé', async () => {
    assert.equal((await one<{ r: string }>('SELECT agent_choose_offer($1, $2, $3) AS r', [orderId, await version(), 'standard'])).r, 'ok');
    assert.equal((await one<{ r: string }>('SELECT agent_choose_offer($1, $2, $3) AS r', [orderId, await version(), 'inexistante'])).r, 'unknown_offer');
    const o = await one<{ price_xof: number; amount_cents: number }>('SELECT price_xof, amount_cents FROM orders WHERE id = $1', [orderId]);
    assert.deepEqual(o, { price_xof: 3000, amount_cents: 300000 });
  });

  test('l\'agent ne confirme jamais un paiement ; la production exige un paiement confirmé', async () => {
    assert.equal(await transition('payment', 'instructions_sent', 'agent'), 'ok');
    assert.equal(await transition('payment', 'payment_confirmed', 'agent'), 'actor_forbidden');
    assert.equal(await transition('creative', 'brief_completed', 'agent'), 'ok');
    assert.equal(await transition('creative', 'lyrics_work_started', 'agent'), 'ok');
    assert.equal(await transition('creative', 'lyrics_sent', 'agent'), 'ok');
    assert.equal(await transition('creative', 'lyrics_validated', 'agent'), 'ok');
    assert.equal(await transition('creative', 'production_started', 'agent'), 'payment_not_confirmed');
    assert.equal(await transition('payment', 'payment_claimed', 'agent'), 'ok');
    assert.equal(await transition('creative', 'order_cancelled', 'agent'), 'payment_lock');
    assert.equal(await transition('payment', 'payment_confirmed', 'merchant'), 'ok');
    assert.equal(await transition('creative', 'production_started', 'system'), 'ok');
    const o = await one<{ stage: string; payment_status: string; status: string; confirmed_by: string }>(
      'SELECT stage, payment_status, status, payment_confirmed_by AS confirmed_by FROM orders WHERE id = $1', [orderId]);
    assert.deepEqual(o, { stage: 'in_production', payment_status: 'confirmed', status: 'validated', confirmed_by: 'merchant' });
    const ev = await one<{ n: number }>('SELECT count(*)::int AS n FROM order_events WHERE order_id = $1', [orderId]);
    assert.equal(ev.n, 8);
  });

  test('entonnoir de la conversation suivi automatiquement', async () => {
    const c = await one<{ funnel_stage: string }>('SELECT funnel_stage FROM conversations WHERE id = $1', [CONV]);
    assert.equal(c.funnel_stage, 'paid');
  });

  test('faits client calculés sans date calendaire', async () => {
    const f = await one<{ delivered_orders: number; open_orders: number }>('SELECT * FROM agent_contact_facts($1)', [CONTACT]);
    assert.equal(f.delivered_orders, 1);
    assert.equal(f.open_orders, 3);
  });
});

describe('migration 20261009_delivery_sent_audio (🎉 depuis audio_delivered)', () => {
  const TADA_ORDER = '77777777-7777-7777-7777-777777777777';
  const version = async (): Promise<number> =>
    (await one<{ version: number }>('SELECT version FROM orders WHERE id = $1', [TADA_ORDER])).version;

  test('migration rejouable : la transition existe une seule fois', async () => {
    const mig = read('supabase/migrations/20261009_delivery_sent_audio.sql');
    await db.exec(mig);
    await db.exec(mig); // idempotence
    const r = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM order_transitions
        WHERE track = 'creative' AND from_state = 'audio_delivered' AND event = 'delivery_sent'`);
    assert.equal(r.n, 1);
  });

  test('🎉 du gérant sur la chanson audio livrée → commande delivered (cas Découverte)', async () => {
    await db.query(
      `INSERT INTO public.orders (id, user_id, contact_id, conversation_id, amount_cents, status, stage, deliverable)
       VALUES ($1, $2, $3, $4, 120000, 'validated', 'audio_delivered', 'audio')`,
      [TADA_ORDER, USER, CONTACT, CONV]);
    const tr = await one<{ r: string }>(
      'SELECT agent_transition_order($1, $2, $3, $4, $5) AS r',
      [TADA_ORDER, await version(), 'creative', 'delivery_sent', 'merchant']);
    assert.equal(tr.r, 'ok');
    const o = await one<{ stage: string }>('SELECT stage FROM orders WHERE id = $1', [TADA_ORDER]);
    assert.equal(o.stage, 'delivered');
  });
});

describe('migrations 20261009 (réactions 🎵/📝 : lyrics_source + purpose)', () => {
  test('rejouables : contraintes mises à jour', async () => {
    const m1 = read('supabase/migrations/20261009_lyrics_source_reaction.sql');
    const m2 = read('supabase/migrations/20261009_outbox_purpose_reaction.sql');
    await db.exec(m1); await db.exec(m1);
    await db.exec(m2); await db.exec(m2);
    const c1 = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'chk_lyrics_source'`);
    const c2 = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'outbound_messages_purpose_check'`);
    assert.equal(c1.n, 1);
    assert.equal(c2.n, 1);
  });

  test("🎵 écrit lyrics_source='merchant_reaction' sans violation", async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    await db.query(
      `INSERT INTO public.orders (id, user_id, contact_id, conversation_id, amount_cents, status, stage)
       VALUES ($1, $2, $3, $4, 120000, 'validated', 'lyrics_validated')`,
      [id, USER, CONTACT, CONV]);
    await db.query(
      `UPDATE public.orders SET lyrics = 'test', lyrics_source = 'merchant_reaction' WHERE id = $1`, [id]);
    const o = await one<{ s: string | null }>('SELECT lyrics_source AS s FROM orders WHERE id = $1', [id]);
    assert.equal(o.s, 'merchant_reaction');
  });

  test("📝 écrit lyrics_source='merchant_reaction_mark' sans violation", async () => {
    const id = '99999999-9999-9999-9999-999999999999';
    await db.query(
      `INSERT INTO public.orders (id, user_id, contact_id, conversation_id, amount_cents, status, stage)
       VALUES ($1, $2, $3, $4, 120000, 'validated', 'lyrics_validated')`,
      [id, USER, CONTACT, CONV]);
    await db.query(
      `UPDATE public.orders SET lyrics = 'test', lyrics_source = 'merchant_reaction_mark' WHERE id = $1`, [id]);
    const o = await one<{ s: string | null }>('SELECT lyrics_source AS s FROM orders WHERE id = $1', [id]);
    assert.equal(o.s, 'merchant_reaction_mark');
  });

  test("purpose='reaction_confirm' accepté en outbox", async () => {
    const r = await db.query(
      `INSERT INTO public.outbound_messages
         (user_id, conversation_id, origin, kind, purpose, session_name, chat_id, body, idempotency_key, lock_token)
       VALUES ($1, $2, 'agent', 'text', 'reaction_confirm', 's', 'c', 'b', 'idem_react_1', 1)
       RETURNING id`,
      [USER, CONV]);
    assert.equal(r.rows.length, 1);
  });
});
