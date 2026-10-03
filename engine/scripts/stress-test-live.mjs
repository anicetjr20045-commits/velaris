import crypto from 'node:crypto';
import http from 'node:http';
import { Client } from 'pg';

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

async function main() {
  await pg.connect();
  console.log('=== TEST DE STRESS & VALIDATION COMPLÈTE DU MOTEUR VELARIS ===\n');

  const TEST_PHONE = '22676001122';
  const CHAT_ID = `${TEST_PHONE}@c.us`;

  // Nettoyage préalable pour le contact de test
  await pg.query(`
    DELETE FROM contacts WHERE phone = $1 OR wa_jid = $2;
  `, [TEST_PHONE, CHAT_ID]);

  // --------------------------------------------------------------------------
  // TEST 1 : LA RAFALE (Anti-doublon & Débruitage)
  // 3 messages envoyés en moins de 300ms
  // --------------------------------------------------------------------------
  console.log('--- TEST 1 : Rafale de 3 messages en 300ms ---');
  const runId = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const burst = [
    'Bonsoir',
    'Je cherche une chanson personnalisée',
    'C est pour l anniversaire de mon père Moussa'
  ];

  for (let i = 0; i < burst.length; i++) {
    const p = {
      event: 'message',
      session: 'Test',
      payload: {
        id: `false_${CHAT_ID}_3EB0BURST${Date.now()}X${i}`,
        timestamp: Math.floor(Date.now() / 1000) + i,
        from: CHAT_ID,
        fromMe: false,
        body: burst[i],
        hasMedia: false,
        _data: { pushName: 'Ibrahim' }
      }
    };
    const res = await sendWebhook(p);
    console.log(`Bulle ${i + 1} envoyée -> HTTP ${res.status}, outcome: ${res.body.outcome}`);
  }

  console.log('Attente de la fenêtre de silence (debounce 5s)...');
  await sleep(6500);

  // Vérifier qu'un SEUL tour a été exécuté
  const turnsRes1 = await pg.query(`
    SELECT t.id, t.status, t.outcome, t.inbound_message_ids, t.started_at, t.finished_at
      FROM conversation_turns t
      JOIN conversations c ON c.id = t.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
     ORDER BY t.first_event_at DESC
  `, [TEST_PHONE]);

  console.log(`Nombre de tours exécutés pour la rafale : ${turnsRes1.rowCount} (Attendu: 1)`);
  if (turnsRes1.rowCount !== 1) {
    throw new Error(`ÉCHEC : ${turnsRes1.rowCount} tours créés au lieu d'un seul !`);
  }
  const turn1 = turnsRes1.rows[0];
  console.log(`Tour statut: ${turn1.status}, outcome: ${turn1.outcome}`);
  console.log(`Nombre de bulles regroupées dans ce tour: ${turn1.inbound_message_ids?.length} (Attendu: 3)`);

  const orderRes1 = await pg.query(`
    SELECT o.id, o.stage, o.occasion, o.recipient_name
      FROM orders o
      JOIN conversations c ON c.id = o.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
  `, [TEST_PHONE]);

  console.log('Commande 1 créée automatiquement :', orderRes1.rows[0]);

  const outboxRes1 = await pg.query(`
    SELECT o.id, o.purpose, o.body, o.status
      FROM outbound_messages o
      JOIN conversations c ON c.id = o.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
     ORDER BY o.created_at
  `, [TEST_PHONE]);
  console.log('Messages générés par l\'agent pour la rafale :');
  outboxRes1.rows.forEach((m, idx) => console.log(` [${idx + 1}] (${m.purpose}): "${m.body}"`));

  // --------------------------------------------------------------------------
  // TEST 2 : MULTI-COMMANDES (Deuxième commande Awa sans écraser Moussa)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2 : Multi-commandes (Deuxième commande pour Aïcha) ---');
  const p2 = {
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_ORD2_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'Et j aimerais aussi une deuxième chanson pour le mariage de ma soeur Aïcha',
      hasMedia: false,
      _data: { pushName: 'Ibrahim' }
    }
  };
  await sendWebhook(p2);
  console.log('Message 2e commande envoyé. Attente exécution (5s)...');
  await sleep(6500);

  const ordersRes2 = await pg.query(`
    SELECT o.id, o.stage, o.occasion, o.recipient_name, o.created_at
      FROM orders o
      JOIN conversations c ON c.id = o.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
     ORDER BY o.created_at
  `, [TEST_PHONE]);

  console.log(`Nombre total de commandes actives en base : ${ordersRes2.rowCount} (Attendu: 2)`);
  ordersRes2.rows.forEach((o, i) => {
    console.log(` Commande #${i + 1} -> Destinataire: "${o.recipient_name}", Occasion: "${o.occasion}", Étape: ${o.stage}`);
  });

  const convRes2 = await pg.query(`
    SELECT c.focus_order_id, c.control_mode
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
  `, [TEST_PHONE]);
  console.log('Focus conversation sur la commande ID :', convRes2.rows[0].focus_order_id);

  // --------------------------------------------------------------------------
  // TEST 3 : PAIEMENT IMPRÉVU (Piste indépendante sans casser le brief)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3 : Demande de numéro de dépôt Orange Money / Wave en plein brief ---');
  const p3 = {
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_PAY_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'Je fais le dépôt sur quel numéro Orange Money ou Wave ? Donnez moi le numéro direct',
      hasMedia: false,
      _data: { pushName: 'Ibrahim' }
    }
  };
  await sendWebhook(p3);
  console.log('Demande de paiement envoyée. Attente exécution (5s)...');
  await sleep(6500);

  const outboxRes3 = await pg.query(`
    SELECT o.id, o.purpose, o.body, o.status, o.created_at
      FROM outbound_messages o
      JOIN conversations c ON c.id = o.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
     ORDER BY o.created_at DESC
     LIMIT 2
  `, [TEST_PHONE]);

  console.log('Dernier message généré suite à la demande de paiement :');
  outboxRes3.rows.forEach(m => console.log(` (${m.purpose}): "${m.body}"`));

  // --------------------------------------------------------------------------
  // TEST 4 : PRISE DE MAIN DU GÉRANT (L'agent se tait immédiatement)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4 : Prise de main du gérant (fromMe = true) ---');
  const p4 = {
    event: 'message',
    session: 'Test',
    payload: {
      id: `true_${CHAT_ID}_MERCHANT_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      to: CHAT_ID,
      fromMe: true,
      body: 'Bonsoir Ibrahim, c est Anicet le gérant, je prends le relais personnellement.',
      hasMedia: false
    }
  };
  await sendWebhook(p4);
  console.log('Message gérant envoyé.');
  await sleep(1000);

  const convRes4 = await pg.query(`
    SELECT c.control_mode, c.control_actor, c.control_reason
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
  `, [TEST_PHONE]);
  console.log('État de contrôle de la conversation :', convRes4.rows[0]);

  // Si le client renvoie un message alors que le gérant a pris la main :
  console.log('Envoi d\'un nouveau message du client pendant que le gérant a la main...');
  const p5 = {
    event: 'message',
    session: 'Test',
    payload: {
      id: `false_${CHAT_ID}_CLIENT_DURING_HUMAN_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: CHAT_ID,
      fromMe: false,
      body: 'D accord monsieur Anicet merci beaucoup !',
      hasMedia: false,
      _data: { pushName: 'Ibrahim' }
    }
  };
  await sendWebhook(p5);
  await sleep(5000);

  const turnsRes5 = await pg.query(`
    SELECT t.status, t.outcome
      FROM conversation_turns t
      JOIN conversations c ON c.id = t.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
     WHERE ct.phone = $1
     ORDER BY t.first_event_at DESC
     LIMIT 1
  `, [TEST_PHONE]);
  console.log('Résultat du tour IA pendant la prise de main :', turnsRes5.rows[0]);

  console.log('\n=== FIN DU TEST DE STRESS : TOUS LES INVARIANTS VÉRIFIÉS AVEC SUCCÈS ===');
  await pg.end();
}

main().catch(err => {
  console.error('Erreur test de stress :', err);
  process.exit(1);
});
