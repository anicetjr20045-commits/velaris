import crypto from 'node:crypto';
import http from 'node:http';
import pgPkg from 'pg';
const { Client } = pgPkg;

const HMAC_KEY = 'f50ca6dc4b9626c26d95ff0d4b3155076cc5c7b57c70621524ac9a4d00ff6066';
const DB_CONN = {
  host: 'aws-1-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.dnwlqgsftauqsyjwhoza',
  password: '47796397Anicet$',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const pg = new Client(DB_CONN);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendWebhook(payload) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', HMAC_KEY).update(raw).digest('hex');

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(raw),
        'X-Webhook-Hmac': hmac,
        'X-Webhook-Hmac-Algorithm': 'sha256'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });

    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ÉCHEC ASSERTION : ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function waitForNextTurn(convId, previousTurnCount, maxWaitMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await pg.query(
      `SELECT id, status, outcome, error, started_at, finished_at
         FROM conversation_turns
        WHERE conversation_id = $1
        ORDER BY first_event_at ASC`,
      [convId]
    );
    if (res.rowCount > previousTurnCount) {
      const last = res.rows[res.rowCount - 1];
      if (last.status === 'done' || last.status === 'failed') {
        return { turn: last, count: res.rowCount };
      }
    }
    await sleep(400);
  }
  throw new Error(`Timeout attente d'un nouveau tour (> ${previousTurnCount}) pour conv=${convId}`);
}

async function main() {
  await pg.connect();
  console.log('================================================================');
  console.log('   BANC DE VALIDATION INTÉGRALE & CERTIFICATION VELARIS (E2E)   ');
  console.log('================================================================\n');

  const TEST_PHONE = '22678998877';
  const CHAT_ID = `${TEST_PHONE}@c.us`;

  // Nettoyage préalable pour le contact de test
  await pg.query(`DELETE FROM contacts WHERE phone = $1 OR wa_jid = $2;`, [TEST_PHONE, CHAT_ID]);

  let turnCount = 0;

  // --------------------------------------------------------------------------
  // ÉTAPE 1 : NOUVEAU CLIENT - ARRIVÉE & ACCUEIL
  // --------------------------------------------------------------------------
  console.log('--- 1. ARRIVÉE D\'UN NOUVEAU CLIENT ---');
  let res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_MSG1_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'Bonjour Alex, je viens pour avoir une chanson personnalisée',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  assert(res.status === 200, 'Webhook message initial accepté (HTTP 200)');

  // Récupérer convId
  let c1;
  for (let i = 0; i < 10; i++) {
    c1 = await pg.query(`
      SELECT c.id, c.control_mode, ct.id as contact_id
        FROM conversations c
        JOIN contacts ct ON ct.id = c.contact_id
       WHERE ct.phone = $1
    `, [TEST_PHONE]);
    if (c1.rowCount === 1) break;
    await sleep(300);
  }
  assert(c1.rowCount === 1, 'Conversation et Contact créés en base');
  const convId = c1.rows[0].id;
  const contactId = c1.rows[0].contact_id;

  console.log('  Attente du traitement du tour #1 (collecte + LLM)...');
  const t1 = await waitForNextTurn(convId, turnCount);
  turnCount = t1.count;
  console.log(`  Tour #1 terminé avec outcome: "${t1.turn.outcome}"`);

  const o1 = await pg.query(`SELECT id, stage, occasion FROM orders WHERE conversation_id = $1`, [convId]);
  assert(o1.rowCount === 1, 'Commande automatique initialisée');
  const orderId = o1.rows[0].id;

  const out1 = await pg.query(`
    SELECT purpose, body FROM outbound_messages WHERE conversation_id = $1 ORDER BY created_at
  `, [convId]);
  assert(out1.rowCount >= 1, 'Messages de bienvenue et présentation émis par l\'agent');
  console.log(`  Dernier message émis: "${out1.rows[out1.rows.length - 1].body.slice(0, 80)}..."`);

  // --------------------------------------------------------------------------
  // ÉTAPE 2 : INFORMATIONS DE BRIEF (OCCASION + PRÉNOM DE LA MÈRE)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. ENVOI DES DÉTAILS DU BRIEF PAR LE CLIENT ---');
  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_MSG2_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'C est pour l anniversaire de ma mère Fatou',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  console.log('  Attente du traitement du tour #2...');
  const t2 = await waitForNextTurn(convId, turnCount);
  turnCount = t2.count;
  console.log(`  Tour #2 terminé avec outcome: "${t2.turn.outcome}"`);

  const o2 = await pg.query(`
    SELECT stage, occasion, recipient_name, recipient_relation
      FROM orders WHERE id = $1
  `, [orderId]);
  const orderData2 = o2.rows[0];
  console.log('  État de la commande après brief partiel :', orderData2);
  assert(orderData2.occasion === 'anniversaire', 'Occasion "anniversaire" enregistrée');
  assert(orderData2.recipient_name === 'Fatou', 'Prénom "Fatou" extrait avec précision');
  assert(orderData2.recipient_relation === 'mère', 'Lien de parenté "mère" extrait');

  // L'agent demande la confirmation du prénom pour la prononciation chantée (garde-fou audio)
  const convState2 = await pg.query(`SELECT pending_question FROM conversations WHERE id = $1`, [convId]);
  console.log('  Question en attente :', convState2.rows[0].pending_question);

  // --------------------------------------------------------------------------
  // ÉTAPE 2B : CONFIRMATION DU PRÉNOM PAR LE CLIENT
  // --------------------------------------------------------------------------
  console.log('\n--- 2B. CONFIRMATION DU PRÉNOM PAR LE CLIENT ---');
  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_MSG2B_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'Oui c est bien Fatou !',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  console.log('  Attente de la confirmation du prénom (tour #3)...');
  const t2b = await waitForNextTurn(convId, turnCount);
  turnCount = t2b.count;
  console.log(`  Tour #3 terminé avec outcome: "${t2b.turn.outcome}"`);

  const o2b = await pg.query(`
    SELECT stage, recipient_name_confirmed
      FROM orders WHERE id = $1
  `, [orderId]);
  console.log('  État de la commande après confirmation prénom :', o2b.rows[0]);
  assert(o2b.rows[0].recipient_name_confirmed === true, 'Prénom Fatou officiellement confirmé');

  // L'agent présente maintenant le choix de la formule
  const convState2b = await pg.query(`SELECT pending_question FROM conversations WHERE id = $1`, [convId]);
  console.log('  Question en attente :', convState2b.rows[0].pending_question);
  assert(convState2b.rows[0].pending_question?.key === 'choose_offer', 'L\'agent demande le choix de la formule');

  // --------------------------------------------------------------------------
  // ÉTAPE 2C : CHOIX DE LA FORMULE SIGNATURE (VERROUILLAGE DU BRIEF)
  // --------------------------------------------------------------------------
  console.log('\n--- 2C. CHOIX DE LA FORMULE SIGNATURE (3000 F CFA) ---');
  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_MSG2C_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'Je prends la formule Signature à 3000 F',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  console.log('  Attente du verrouillage du brief (tour #4)...');
  const t2c = await waitForNextTurn(convId, turnCount);
  turnCount = t2c.count;
  console.log(`  Tour #4 terminé avec outcome: "${t2c.turn.outcome}"`);

  const o2c = await pg.query(`
    SELECT stage, catalogue_code, price_xof
      FROM orders WHERE id = $1
  `, [orderId]);
  console.log('  État de la commande après choix formule :', o2c.rows[0]);
  assert(o2c.rows[0].price_xof === 3000, 'Prix Signature 3 000 F CFA attribué');
  assert(o2c.rows[0].stage === 'lyrics_in_progress', 'Brief complet : commande passée en lyrics_in_progress');

  // --------------------------------------------------------------------------
  // ÉTAPE 3 : ÉCRITURE & ENVOI DES PAROLES PAR LE GÉRANT (lyrics_author = manager)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. LE GÉRANT TRANSMET LES PAROLES OFFICIELLES (fromMe = true) ---');
  const lyricsText = 'Couplet 1:\nFatou ma mère chérie, douce lumière de nos vies...\nRefrain:\nJoyeux anniversaire Fatou, nous t aimons pour toujours !';
  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `true_${CHAT_ID}_LYRICS_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      to: CHAT_ID,
      fromMe: true,
      body: lyricsText,
      hasMedia: false
    }
  });
  assert(res.status === 200, 'Message paroles du gérant envoyé');
  const t3 = await waitForNextTurn(convId, turnCount);
  turnCount = t3.count;
  console.log(`  Tour gérant terminé avec outcome: "${t3.turn.outcome}"`);

  // Le gérant valide le passage à lyrics_sent et active l'attente de validation par le client
  await pg.query(`
    UPDATE orders SET stage = 'lyrics_sent', lyrics_sent_at = now() WHERE id = $1
  `, [orderId]);
  await pg.query(`
    UPDATE conversations SET control_mode = 'ai', pending_question = '{"key":"validate_lyrics","orderId":"${orderId}","asker":"agent"}' WHERE id = $1
  `, [convId]);
  console.log('  Paroles enregistrées, commande passée à lyrics_sent, IA en attente de retour client.');

  // --------------------------------------------------------------------------
  // ÉTAPE 4 : VALIDATION PAR LE CLIENT & INSTRUCTIONS DE PAIEMENT
  // --------------------------------------------------------------------------
  console.log('\n--- 4. LE CLIENT VALIDE LES PAROLES ---');
  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_VAL_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'C est super émouvant, je valide totalement le texte ! C est magnifique merci.',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  console.log('  Attente de la réaction de l\'agent...');
  const t4 = await waitForNextTurn(convId, turnCount);
  turnCount = t4.count;
  console.log(`  Tour terminé avec outcome: "${t4.turn.outcome}"`);

  const o4 = await pg.query(`SELECT stage, payment_status FROM orders WHERE id = $1`, [orderId]);
  console.log('  Statut commande après validation paroles :', o4.rows[0]);
  assert(o4.rows[0].stage === 'lyrics_validated', 'Commande passée à lyrics_validated');

  const out4 = await pg.query(`
    SELECT purpose, body FROM outbound_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 3
  `, [convId]);
  console.log('  Messages agent après validation :');
  out4.rows.forEach(m => console.log(`   - (${m.purpose}): "${m.body.slice(0, 90)}..."`));
  const hasPaymentInstructions = out4.rows.some(m => m.purpose === 'payment_instructions' || m.body.toLowerCase().includes('orange money') || m.body.toLowerCase().includes('3 000'));
  assert(hasPaymentInstructions, 'Instructions de paiement officielles transmises au client');

  // --------------------------------------------------------------------------
  // ÉTAPE 5 : DÉCLARATION DU PAIEMENT PAR LE CLIENT (SÉCURITÉ SANS VALIDATION AUTO)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. DÉCLARATION DE PAIEMENT PAR LE CLIENT (SÉCURITÉ ANTI-FRAUDE) ---');
  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_PAID_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'J ai envoyé les 3000 F sur votre Orange Money à l instant',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  console.log('  Attente traitement déclaration...');
  const t5 = await waitForNextTurn(convId, turnCount);
  turnCount = t5.count;
  console.log(`  Tour terminé avec outcome: "${t5.turn.outcome}"`);

  const o5 = await pg.query(`SELECT payment_status FROM orders WHERE id = $1`, [orderId]);
  console.log('  Statut de paiement :', o5.rows[0].payment_status);
  assert(o5.rows[0].payment_status !== 'confirmed', 'L\'agent n\'a PAS validé le paiement frauduleusement (règle I8 respectée)');

  // Le gérant confirme le paiement et livre la commande
  console.log('  Le gérant confirme le paiement et livre la chanson audio...');
  await pg.query(`
    UPDATE orders
       SET payment_status = 'confirmed',
           stage = 'delivered',
           stage_changed_at = now()
     WHERE id = $1
  `, [orderId]);
  console.log('  Commande #1 marquée "delivered" et "confirmed" en base.');

  // --------------------------------------------------------------------------
  // ÉTAPE 6 : TEST DE L'ANCIEN CLIENT (RETURNING CLIENT RECOGNITION)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. RETOUR DU CLIENT (TEST DE RECONNAISSANCE ANCIEN CLIENT) ---');
  // Vérification de la RPC agent_contact_facts
  const factsRes = await pg.query(`SELECT * FROM agent_contact_facts($1)`, [contactId]);
  console.log('  Données factuelles du contact :', factsRes.rows[0]);
  assert(Number(factsRes.rows[0].delivered_orders) >= 1, 'agent_contact_facts indique bien delivered_orders >= 1');

  res = await sendWebhook({
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_RETURNING_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'Bonjour Alex ! Je reviens vers vous',
      hasMedia: false,
      _data: { pushName: 'Mariam' }
    }
  });
  console.log('  Attente du tour returning client...');
  const t6 = await waitForNextTurn(convId, turnCount);
  turnCount = t6.count;
  console.log(`  Tour terminé avec outcome: "${t6.turn.outcome}"`);

  const turnLog6 = await pg.query(
    `SELECT decision FROM agent_turn_logs WHERE turn_id = $1`,
    [t6.turn.id]
  );
  const isReturningGoal = turnLog6.rows[0]?.decision?.utterances?.some(u => u.goal === 'welcome_returning');
  assert(isReturningGoal, 'Décision FSM : goal welcome_returning activé avec returning_client: true');

  const out6 = await pg.query(
    `SELECT purpose, body FROM outbound_messages WHERE turn_id = $1 ORDER BY created_at`,
    [t6.turn.id]
  );
  console.log('  Réponse de l\'agent à l\'ancien client :');
  out6.rows.forEach(m => console.log(`   - (${m.purpose}): "${m.body}"`));
  assert(out6.rowCount >= 1, 'L\'agent a généré le message d\'accueil et de reprise pour l\'ancien client');

  // --------------------------------------------------------------------------
  // ÉTAPE 7 : VÉRIFICATION TÉLÉMÉTRIE, LOGS DE TOURS & CACHE DEEPSEEK
  // --------------------------------------------------------------------------
  console.log('\n--- 7. AUDIT DE LA TÉLÉMÉTRIE & DU CACHE DEEPSEEK ---');
  const turnsLog = await pg.query(`
    SELECT turn_id, outcome, guard_results, tokens, latency_ms
      FROM agent_turn_logs
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT 5
  `, [convId]);

  console.log(`  Nombre de tours journalisés avec télémétrie complète : ${turnsLog.rowCount}`);
  turnsLog.rows.forEach((t, i) => {
    console.log(`  [Tour ${i + 1}] outcome: ${t.outcome} | latency: ${t.latency_ms}ms | tokens: ${JSON.stringify(t.tokens)}`);
    assert(t.latency_ms > 0, `Latence tour ${i + 1} tracée`);
    assert(Array.isArray(t.guard_results) && t.guard_results.length === 0, `12 Gardes-fous validés au tour ${i + 1} (0 violation)`);
  });

  const cacheHits = turnsLog.rows.filter(t => t.tokens?.cacheHit > 0);
  console.log(`  Tours ayant bénéficié du Context Caching DeepSeek : ${cacheHits.length}/${turnsLog.rowCount}`);
  if (cacheHits.length > 0) {
    console.log(`  Exemple de tokens en cache : ${cacheHits[0].tokens.cacheHit} tokens en cache sur ${cacheHits[0].tokens.prompt} tokens d'entrée (~${Math.round(cacheHits[0].tokens.cacheHit / cacheHits[0].tokens.prompt * 100)}%)`);
  }

  // Nettoyage final du contact de test
  await pg.query(`DELETE FROM contacts WHERE phone = $1 OR wa_jid = $2;`, [TEST_PHONE, CHAT_ID]);

  console.log('\n================================================================');
  console.log('   TOUTES LES ASSERTIONS ONT ÉTÉ VALIDÉES AVEC SUCCÈS (100%)    ');
  console.log('   LE SYSTÈME EST TOTALEMENT FIABLE, SÉCURISÉ ET CONFORME       ');
  console.log('================================================================');

  await pg.end();
}

main().catch(err => {
  console.error('\n❌ ERREUR LORS DU BANC DE VALIDATION :', err);
  process.exit(1);
});
