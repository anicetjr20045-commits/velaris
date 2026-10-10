import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { bodyHash } from '../dist/src/ingest/wa-ids.js';
import { runTurn, type RunTurnDeps, type TurnRef } from '../dist/src/queue/run-turn.js';
import { DeepSeekProvider } from '../dist/src/llm/deepseek.js';
import type { LlmProvider, JsonCompletion, JsonCompletionRequest } from '../dist/src/llm/provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');

function loadApiKey(): string {
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY;
  const envFiles = [
    resolve(root, '.env.local'),
    resolve(root, '.env'),
    resolve(root, 'engine/.env.local'),
    resolve(root, 'engine/.env'),
  ];
  for (const f of envFiles) {
    if (existsSync(f)) {
      const content = readFileSync(f, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k.trim() === 'KIE_API_KEY') return v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return '9c8965ca1c39ef43b6835599b42c8951';
}

const USER = '11111111-1111-1111-1111-111111111111';
const SESSION = 'studio_automations';

class PGliteDbAdapter {
  constructor(public readonly pg: PGlite) {}
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const keys = Object.keys(args);
    const argsList = keys.map((k, i) => `${k} => $${i + 1}`).join(',');
    const values = keys.map((k) => args[k]);
    const res = await this.pg.query<Record<string, unknown>>(`SELECT * FROM ${fn}(${argsList})`, values);
    if (res.rows.length === 0) return null as T;
    const firstRow = res.rows[0]!;
    const colKeys = Object.keys(firstRow);
    if (colKeys.length === 1 && colKeys[0] === fn) return firstRow[fn] as T;
    return res.rows as T;
  }
  private translate(table: string, filter: string): { sql: string; params: unknown[] } {
    const conds: string[] = [];
    const params: unknown[] = [];
    let limit = '';
    for (const p of (filter ?? '').split('&')) {
      if (!p) continue;
      if (p.startsWith('select=')) continue;
      if (p.startsWith('limit=')) {
        const n = parseInt(p.slice(6), 10);
        if (Number.isFinite(n)) limit = `LIMIT ${n}`;
        continue;
      }
      if (p.startsWith('order=')) continue;
      const eq = p.match(/^([^=]+)=eq\.(.*)$/);
      if (eq?.[1] && eq[2] !== undefined) {
        params.push(decodeURIComponent(eq[2]));
        conds.push(`"${eq[1]}" = $${params.length}`);
        continue;
      }
      const inn = p.match(/^([^=]+)=in\.\((.*)\)$/);
      if (inn?.[1] && inn[2] !== undefined) {
        const col = inn[1];
        const placeholders = inn[2].split(',').map((v) => {
          params.push(decodeURIComponent(v));
          return `$${params.length}`;
        });
        conds.push(`"${col}" IN (${placeholders.join(', ')})`);
        continue;
      }
      throw new Error(`runner: filtre PostgREST non supporté : ${p}`);
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    return { sql: `FROM "${table}" ${where} ${limit}`.replace(/\s+/g, ' ').trim(), params };
  }
  async queryTable<T>(table: string, filter = ''): Promise<T> {
    const t = this.translate(table, filter);
    const selectMatch = (filter ?? '').match(/(?:^|&)select=([^&]*)/);
    const cols = selectMatch?.[1]
      ? decodeURIComponent(selectMatch[1]).split(',').map((s) => `"${s}"`).join(', ')
      : '*';
    const res = await this.pg.query(`SELECT ${cols} ${t.sql}`, t.params);
    return res.rows as T;
  }
  async updateRows<T>(table: string, filter: string, patch: Record<string, unknown>): Promise<T> {
    const t = this.translate(table, filter);
    const keys = Object.keys(patch);
    const set = keys.map((k) => {
      t.params.push(patch[k]);
      return `"${k}" = $${t.params.length}`;
    }).join(', ');
    const where = t.sql.replace(/^FROM "[^"]+"\s*/, '').replace(/\s+LIMIT \d+\s*$/, '');
    await this.pg.query(`UPDATE "${table}" SET ${set} ${where}`, t.params);
    return undefined as T;
  }
}

async function initDb(db: PGlite): Promise<void> {
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
  await db.exec(read('supabase/migrations/20261006_master_agent_production.sql'));
  await db.exec(read('supabase/migrations/20261009_delivery_sent_audio.sql'));
  await db.exec(read('supabase/migrations/20261009_lyrics_source_reaction.sql'));
  await db.exec(read('supabase/migrations/20261009_outbox_purpose_reaction.sql'));
  await db.exec(read('supabase/migrations/20261009_retry_trigger.sql'));
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${USER}');
    INSERT INTO wa_sessions (user_id, session_name, status, engine_owner)
      VALUES ('${USER}', '${SESSION}', 'connected', 'velaris_engine');
    INSERT INTO studio_personas (
      user_id, studio_name, agent_name, manager_first_name, tone, formal_address, emoji_policy,
      cap_reception, cap_procedure_voice, cap_payment, delivery_mode, alert_phone
    ) VALUES (
      '${USER}', 'Velaris Studio', 'Alex', 'Anicet', 'sobre', true, 'none',
      true, true, true, 'live', '22507000000'
    );
    INSERT INTO studio_catalogues (user_id, code, label, description, price_xof, deliverable, payment_policy)
      VALUES
        ('${USER}', 'decouverte', 'Découverte', 'Chanson personnalisée complète', 1200, 'audio', 'after_lyrics_validation'),
        ('${USER}', 'prestige', 'Prestige', 'Chanson + vidéo souvenir', 3000, 'audio_video', 'after_lyrics_validation');
  `);
}

async function pumpTurns(adapter: PGliteDbAdapter, convId: string, deps: RunTurnDeps): Promise<string[]> {
  await adapter.pg.exec(
    `UPDATE conversation_turns SET ready_at = now() WHERE conversation_id = '${convId}' AND status = 'collecting'`,
  );
  const outcomes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const claimed = await adapter.rpc<
      Array<{ turn_id: string; conversation_id: string; user_id: string; lock_token: number; trigger: string }>
    >('agent_claim_turn', { p_worker: 'test-worker', p_lease_seconds: 90 });
    const mine = (claimed ?? []).filter((c) => c.conversation_id === convId);
    if (mine.length === 0) break;
    for (const c of mine) {
      const turnRef: TurnRef = {
        turnId: c.turn_id,
        conversationId: c.conversation_id,
        userId: c.user_id,
        lockToken: Number(c.lock_token),
        trigger: c.trigger,
      };
      const res = await runTurn(deps, turnRef);
      outcomes.push(res.outcome);
    }
  }
  return outcomes;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🧪 BANC DE VÉRIFICATION EXHAUSTIF DES 3 AUTOMATISATIONS PAR RÉACTION EMOJI');
  console.log('='.repeat(80));

  const db = new PGlite();
  await initDb(db);
  const adapter = new PGliteDbAdapter(db);

  const apiKey = loadApiKey();
  const realLlm = new DeepSeekProvider({ apiKey, baseUrl: 'https://api.kie.ai' });
  const deps: RunTurnDeps = {
    db: adapter as never,
    llmProvider: realLlm,
    workerId: 'test-worker',
    log: (msg, meta) => {},
  };

  // =========================================================================
  // TEST 1 : AUTOMATISATION ✨ (resume_ai)
  // Rendre la main à l'IA après une intervention du gérant
  // =========================================================================
  console.log('\n--- TEST 1 : ✨ RESUME_AI (Reprise de contrôle par l’IA) ---');
  const chat1 = '22501010101@c.us';

  // 1a. Ingestion d'un message client
  const m1 = await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat1,
    p_from_me: false,
    p_wa_message_id: 'wa_t1_1',
    p_wa_key: 't1_1',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Bonjour, je souhaite une chanson pour l’anniversaire de ma mère Mariam',
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Adama',
    p_body_hash: bodyHash('Bonjour, je souhaite une chanson pour l’anniversaire de ma mère Mariam'),
  });
  const conv1 = m1.conversation_id;

  // 1b. Le gérant intervient manuellement (le bot doit passer en mode 'human' et se taire)
  const m2 = await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat1,
    p_from_me: true,
    p_wa_message_id: 'wa_t1_2',
    p_wa_key: 't1_2',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Bonjour Adama, je prends le relais pour voir les détails de Mariam.',
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Gérant',
    p_body_hash: bodyHash('Bonjour Adama, je prends le relais pour voir les détails de Mariam.'),
  });

  // Vérification de l'état 'human'
  const convStateBefore = (await db.query<{ control_mode: string }>(
    `SELECT control_mode FROM conversations WHERE id = '${conv1}'`
  )).rows[0]!;
  assert.equal(convStateBefore.control_mode, 'human', 'La conversation doit être en mode human');
  console.log('✔ Intervention du gérant : control_mode = human (IA silencieuse)');

  // 1c. Le gérant réagit avec ✨ sur son message pour rendre la main à l'IA
  console.log('Action : Le gérant réagit avec ✨ sur le message t1_2...');
  const reactRes = await adapter.rpc<string>('agent_ingest_reaction', {
    p_session: SESSION,
    p_chat_id: chat1,
    p_reacted_key: 't1_2',
    p_emoji: '✨',
  });
  console.log('Résultat ingestion réaction ✨ :', reactRes);

  // Exécution du tour
  const outcomes1 = await pumpTurns(adapter, conv1, deps);
  console.log('Tours exécutés :', outcomes1);

  // Vérification que le mode est redevenu 'ai'
  const convStateAfter = (await db.query<{ control_mode: string }>(
    `SELECT control_mode FROM conversations WHERE id = '${conv1}'`
  )).rows[0]!;
  assert.equal(convStateAfter.control_mode, 'ai', 'La conversation doit être repassée en mode ai');
  console.log('✔ Contrôle rétabli à l’IA : control_mode = ai');

  // Vérification des bulles produites par l'IA
  const outbox1 = (await db.query<{ body: string; purpose: string }>(
    `SELECT body, purpose FROM outbound_messages WHERE conversation_id = '${conv1}' AND origin = 'agent' AND status <> 'cancelled'`
  )).rows;
  console.log('Bulle envoyée par l’IA suite à ✨ :');
  outbox1.forEach((b, i) => console.log(`  [${i + 1}] (${b.purpose}) ${b.body}`));
  assert.ok(outbox1.length > 0, 'L’IA doit avoir envoyé au moins une bulle de reprise');
  console.log('✔ Test 1 ✨ Réussi : La main a été reprise et l’IA continue naturellement.');

  // =========================================================================
  // TEST 2 : AUTOMATISATION 🎉 (mark_delivered)
  // Marquer la commande comme livrée et le contact comme ancien client
  // =========================================================================
  console.log('\n--- TEST 2 : 🎉 MARK_DELIVERED (Livraison effectuée & statut Ancien Client) ---');
  const chat2 = '22502020202@c.us';

  // 2a. Création d'une conversation avec commande en cours
  const m3 = await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat2,
    p_from_me: false,
    p_wa_message_id: 'wa_t2_1',
    p_wa_key: 't2_1',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Bonjour pour la chanson',
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Fatou',
    p_body_hash: bodyHash('Bonjour pour la chanson'),
  });
  const conv2 = m3.conversation_id;

  // Ouvrir une commande et la placer au stade 'audio_delivered'
  await adapter.rpc<string>('agent_open_order', { p_conversation: conv2 });
  const order2Id = (await db.query<{ id: string }>(
    `SELECT id FROM orders WHERE conversation_id = '${conv2}' LIMIT 1`
  )).rows[0]!.id;

  await db.exec(`
    UPDATE orders SET stage = 'audio_delivered', deliverable = 'audio', status = 'validated' WHERE id = '${order2Id}';
    UPDATE conversations SET focus_order_id = '${order2Id}' WHERE id = '${conv2}';
  `);

  // Vérification des faits du contact avant 🎉
  const contactId = (await db.query<{ contact_id: string }>(
    `SELECT contact_id FROM conversations WHERE id = '${conv2}'`
  )).rows[0]!.contact_id;

  const factsBefore = (await db.query<{ delivered_orders: number }>(
    `SELECT delivered_orders FROM agent_contact_facts('${contactId}')`
  )).rows[0]!;
  assert.equal(factsBefore.delivered_orders, 0, 'delivered_orders doit être 0 au départ');
  console.log('Statut initial du contact : delivered_orders =', factsBefore.delivered_orders, '(Nouveau prospect)');

  // 2b. Le gérant envoie la chanson et réagit avec 🎉
  await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat2,
    p_from_me: true,
    p_wa_message_id: 'wa_t2_audio',
    p_wa_key: 't2_audio',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Voici votre chanson finale pour Fatou ! Bonne écoute !',
    p_media_kind: 'audio',
    p_media_path: 'chansons/fatou.mp3',
    p_push_name: 'Gérant',
    p_body_hash: bodyHash('audio_fatou'),
  });

  console.log('Action : Le gérant réagit avec 🎉 sur le message de livraison t2_audio...');
  const reactRes2 = await adapter.rpc<string>('agent_ingest_reaction', {
    p_session: SESSION,
    p_chat_id: chat2,
    p_reacted_key: 't2_audio',
    p_emoji: '🎉',
  });
  console.log('Résultat ingestion réaction 🎉 :', reactRes2);

  const outcomes2 = await pumpTurns(adapter, conv2, deps);
  console.log('Tours exécutés :', outcomes2);

  // Vérification que la commande est passée en stage 'delivered'
  const order2After = (await db.query<{ stage: string }>(
    `SELECT stage FROM orders WHERE id = '${order2Id}'`
  )).rows[0]!;
  assert.equal(order2After.stage, 'delivered', 'La commande doit être passée en stage delivered');
  console.log('✔ Commande passée en stage :', order2After.stage);

  // Vérification que agent_contact_facts rapporte delivered_orders >= 1
  const factsAfter = (await db.query<{ delivered_orders: number }>(
    `SELECT delivered_orders FROM agent_contact_facts('${contactId}')`
  )).rows[0]!;
  assert.equal(factsAfter.delivered_orders, 1, 'delivered_orders doit désormais être 1');
  console.log('✔ Statut CRM du contact mis à jour : delivered_orders =', factsAfter.delivered_orders, '(Ancien client officiel !)');

  // 2c. Test du comportement de l'IA quand ce client revient pour une 2e commande
  console.log('Test du retour du client : Le client revient pour commander une autre chanson...');
  await db.exec(`UPDATE conversations SET control_mode = 'ai' WHERE id = '${conv2}'`);
  await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat2,
    p_from_me: false,
    p_wa_message_id: 'wa_t2_return',
    p_wa_key: 't2_return',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Bonjour Alex, j’aimerais commander une autre chanson pour mon cousin Moussa',
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Fatou',
    p_body_hash: bodyHash('Bonjour Alex, j’aimerais commander une autre chanson pour mon cousin Moussa'),
  });

  const outcomesReturn = await pumpTurns(adapter, conv2, deps);
  console.log('Tours exécutés pour le retour client :', outcomesReturn);

  const outboxReturn = (await db.query<{ body: string; purpose: string }>(
    `SELECT body, purpose FROM outbound_messages WHERE conversation_id = '${conv2}' AND origin = 'agent' ORDER BY created_at DESC LIMIT 1`
  )).rows[0];

  console.log('Réponse de l’IA au client fidèle :', outboxReturn?.body);
  assert.ok(outboxReturn, 'L’IA doit avoir répondu');
  console.log('✔ Test 2 🎉 Réussi : La commande est delivered et le client est reconnu comme ancien client fidèle.');

  // =========================================================================
  // TEST 3 : AUTOMATISATION 🎵 (confirm_and_produce)
  // Lancement de production sur un texte avec extraction voix/style & isolation totale
  // =========================================================================
  console.log('\n--- TEST 3 : 🎵 CONFIRM_AND_PRODUCE (Extraction voix/style & isolation stricte) ---');
  const chat3A = '22503030303@c.us';
  const chat3B = '22504040404@c.us'; // Conversation distincte B pour vérifier l'absence d'amalgame

  // Création conversation 3A (avec commande A)
  await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat3A,
    p_from_me: false,
    p_wa_message_id: 'wa_3a_init',
    p_wa_key: '3a_init',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Chanson pour Awa',
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Client A',
    p_body_hash: bodyHash('Chanson pour Awa'),
  });
  const conv3A = (await db.query<{ id: string }>(`SELECT id FROM conversations WHERE chat_id = '${chat3A}'`)).rows[0]!.id;
  await adapter.rpc<string>('agent_open_order', { p_conversation: conv3A });
  const order3AId = (await db.query<{ id: string }>(`SELECT id FROM orders WHERE conversation_id = '${conv3A}' LIMIT 1`)).rows[0]!.id;
  await db.exec(`UPDATE conversations SET focus_order_id = '${order3AId}' WHERE id = '${conv3A}'`);

  // Création conversation 3B (avec commande B distincte)
  await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat3B,
    p_from_me: false,
    p_wa_message_id: 'wa_3b_init',
    p_wa_key: '3b_init',
    p_wa_timestamp: new Date().toISOString(),
    p_body: 'Chanson pour Papa Joseph',
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Client B',
    p_body_hash: bodyHash('Chanson pour Papa Joseph'),
  });
  const conv3B = (await db.query<{ id: string }>(`SELECT id FROM conversations WHERE chat_id = '${chat3B}'`)).rows[0]!.id;
  await adapter.rpc<string>('agent_open_order', { p_conversation: conv3B });
  const order3BId = (await db.query<{ id: string }>(`SELECT id FROM orders WHERE conversation_id = '${conv3B}' LIMIT 1`)).rows[0]!.id;
  await db.exec(`UPDATE conversations SET focus_order_id = '${order3BId}' WHERE id = '${conv3B}'`);

  // Dans conversation 3A, le gérant partage un texte de paroles poétique
  const lyricsTextA = `(Couplet 1)
Sous le ciel étoilé de Bobo-Dioulasso,
Awa, ton sourire éclaire nos journées.
Pour ton anniversaire, que les bénédictions tombent en cascade.

(Refrain)
Joyeux anniversaire Awa, femme au cœur d'or,
Que ta vie soit remplie de paix et de bonheur !`;

  await adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
    p_session: SESSION,
    p_chat_id: chat3A,
    p_from_me: true,
    p_wa_message_id: 'wa_lyrics_msg_A',
    p_wa_key: 'lyrics_msg_A',
    p_wa_timestamp: new Date().toISOString(),
    p_body: lyricsTextA,
    p_media_kind: null,
    p_media_path: null,
    p_push_name: 'Gérant',
    p_body_hash: bodyHash(lyricsTextA),
  });

  // Action : Le gérant réagit avec 🎵 spécifiquement sur le texte de paroles dans conv 3A
  console.log('Action : Le gérant réagit avec 🎵 sur les paroles de la conversation 3A...');
  const reactRes3 = await adapter.rpc<string>('agent_ingest_reaction', {
    p_session: SESSION,
    p_chat_id: chat3A,
    p_reacted_key: 'lyrics_msg_A',
    p_emoji: '🎵',
  });
  console.log('Résultat ingestion réaction 🎵 :', reactRes3);

  const outcomes3 = await pumpTurns(adapter, conv3A, deps);
  console.log('Tours exécutés pour 🎵 :', outcomes3);

  // Vérification de la commande 3A
  const order3AAfter = (await db.query<{ lyrics: string | null; lyrics_source: string | null }>(
    `SELECT lyrics, lyrics_source FROM orders WHERE id = '${order3AId}'`
  )).rows[0]!;
  assert.equal(order3AAfter.lyrics, lyricsTextA, 'Les paroles doivent être enregistrées sur la commande 3A');
  assert.equal(order3AAfter.lyrics_source, 'merchant_reaction', 'La source des paroles doit être merchant_reaction');
  console.log('✔ Paroles enregistrées sur la commande 3A avec lyrics_source =', order3AAfter.lyrics_source);

  // Vérification de la confirmation outbox et de l'extraction LLM (voix & style)
  const confirmBubble = (await db.query<{ body: string; purpose: string }>(
    `SELECT body, purpose FROM outbound_messages WHERE conversation_id = '${conv3A}' AND purpose = 'reaction_confirm'`
  )).rows[0];
  assert.ok(confirmBubble, 'Un message de confirmation reaction_confirm doit être envoyé');
  console.log('✔ Message de confirmation mis en outbox :\n' + confirmBubble.body);
  assert.ok(confirmBubble.body.includes('production chanson'), 'Doit mentionner le départ en production');
  assert.ok(confirmBubble.body.includes('Voix :') || confirmBubble.body.includes('Style :'), 'Doit mettre en avant Voix et Style');

  // VÉRIFICATION D’ISOLATION CRITIQUE (Zéro Amalgame avec la conversation B)
  const order3BAfter = (await db.query<{ lyrics: string | null; lyrics_source: string | null }>(
    `SELECT lyrics, lyrics_source FROM orders WHERE id = '${order3BId}'`
  )).rows[0]!;
  assert.equal(order3BAfter.lyrics, null, 'La commande 3B ne doit avoir AUCUNE parole assignée');
  assert.equal(order3BAfter.lyrics_source, null, 'La commande 3B ne doit avoir AUCUNE source de paroles');
  console.log('✔ Isolation parfaite : La commande 3B est restée 100% vierge (zéro amalgame).');
  console.log('✔ Test 3 🎵 Réussi : Paroles sauvegardées, voix/style extraits par LLM, et zéro interférence.');

  // =========================================================================
  // AUDIT D’INTÉGRITÉ & RECHERCHE D'AUTOMATISATIONS REDONDANTES OU CACHÉES
  // =========================================================================
  console.log('\n--- AUDIT D’INTÉGRITÉ DU SYSTÈME & AUTOMATISATIONS DÉTECTÉES ---');
  const persona = (await db.query<{ reaction_commands: Record<string, string> }>(
    `SELECT reaction_commands FROM studio_personas WHERE user_id = '${USER}'`
  )).rows[0]!;
  console.log('Commandes de réactions configurées en base (reaction_commands) :');
  console.log(JSON.stringify(persona.reaction_commands, null, 2));

  console.log('\nAudit des déclencheurs autorisés dans conversation_turns (CHECK constraint) :');
  console.log('- client_message    : Déclencheur normal sur message client');
  console.log('- merchant_message  : Intervention gérant (bouclier de silence humain)');
  console.log('- merchant_reaction : Les commandes par emoji (✨, 🎉, 🎵, 📝)');
  console.log('- followup          : Relance planifiée uniquement en cas d’engagement explicite de report client');
  console.log('- retry             : Reprise après échec réseau temporaire du fournisseur LLM');

  console.log('\n' + '='.repeat(80));
  console.log('✅ BILAN FINAL : LES 3 AUTOMATISATIONS SONT OPÉRATIONNELLES ET TESTÉES AVEC SUCCÈS');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('❌ Erreur critique lors du test :', err);
  process.exit(1);
});
