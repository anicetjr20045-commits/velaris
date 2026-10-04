import { Client } from 'pg';
import fs from 'fs';

const ANICET_USER_ID = '043a33b4-429c-4056-b333-ee61d4c0a515';
const DUMP_PATH = '/root/projets/chansons-personnalisees/observation/raw/snapshot_full_20260910_090423.json';

const client = new Client({
  host: 'aws-1-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.dnwlqgsftauqsyjwhoza',
  password: '47796397Anicet$',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

function cleanDigits(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

async function run() {
  console.log('--- Démarrage de l\'ingestion des données historiques pour l\'agent d\'Anicet ---');
  await client.connect();
  console.log('Connecté à Supabase Postgres.');

  // 1. Assigner tous les enregistrements sans user_id à Anicet
  await client.query(`
    UPDATE public.contacts 
       SET user_id = $1,
           phone = regexp_replace(phone, '[^0-9]', '', 'g'),
           wa_jid = regexp_replace(phone, '[^0-9]', '', 'g') || '@c.us'
     WHERE user_id IS NULL OR user_id = $1;
  `, [ANICET_USER_ID]);

  await client.query('UPDATE public.conversations SET user_id = $1 WHERE user_id IS NULL', [ANICET_USER_ID]);
  await client.query('UPDATE public.orders SET user_id = $1 WHERE user_id IS NULL', [ANICET_USER_ID]);
  await client.query('UPDATE public.messages SET user_id = $1 WHERE user_id IS NULL', [ANICET_USER_ID]);

  // 2. Charger le dump complet
  console.log('Lecture du fichier dump JSON...');
  const raw = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
  const details = raw.details || {};
  const totalChats = Object.keys(details).length;
  console.log(`Chats trouvés dans le dump : ${totalChats}`);

  // 3. Charger les contacts et conversations existants d'Anicet
  const existingContactsRes = await client.query(
    'SELECT id, phone, wa_jid FROM public.contacts WHERE user_id = $1',
    [ANICET_USER_ID]
  );
  const contactByPhone = new Map();
  const contactByJid = new Map();
  for (const c of existingContactsRes.rows) {
    if (c.phone) contactByPhone.set(cleanDigits(c.phone), c.id);
    if (c.wa_jid) contactByJid.set(c.wa_jid.toLowerCase(), c.id);
  }

  const existingConvsRes = await client.query(
    'SELECT id, contact_id FROM public.conversations WHERE user_id = $1',
    [ANICET_USER_ID]
  );
  const convByContactId = new Map();
  const convById = new Set();
  for (const c of existingConvsRes.rows) {
    convById.add(c.id);
    if (c.contact_id) convByContactId.set(c.contact_id, c.id);
  }

  // 4. Traitement et insertion des Contacts & Conversations
  console.log('Traitement des contacts et conversations...');
  let contactsCreated = 0;
  let convsUpserted = 0;
  let ordersUpserted = 0;

  const dumpConvToRealConvMap = new Map();

  for (const [dumpConvId, chat] of Object.entries(details)) {
    const conv = chat.conversation || {};
    const ct = conv.contacts || {};
    const rawPhone = (ct.phone || '').trim();
    const digits = cleanDigits(rawPhone);
    if (!digits) continue;

    const jid = `${digits}@c.us`;
    const name = (ct.name || '').trim() || `Client +${digits}`;
    const occasion = (ct.occasion || '').trim() || 'Chanson personnalisée';

    let contactId = contactByPhone.get(digits) || contactByJid.get(jid.toLowerCase());

    if (!contactId) {
      const insRes = await client.query(`
        INSERT INTO public.contacts (
          user_id, name, phone, wa_jid, occasion, source, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'whatsapp_import', now(), now()
        )
        RETURNING id;
      `, [ANICET_USER_ID, name, digits, jid, occasion]);
      contactId = insRes.rows[0].id;
      contactByPhone.set(digits, contactId);
      contactByJid.set(jid.toLowerCase(), contactId);
      contactsCreated++;
    }

    // Résolution de la conversation pour ce contact
    const funnelStage = conv.funnel_stage || 'delivered';
    const summary = conv.summary || `Historique WhatsApp - ${name}`;
    const lastMsgAt = conv.last_message_at || new Date().toISOString();

    let actualConvId = convByContactId.get(contactId);

    if (actualConvId) {
      await client.query(`
        UPDATE public.conversations
           SET funnel_stage = $1,
               summary = $2,
               last_message_at = $3,
               session_name = 'Test',
               chat_id = $4,
               updated_at = now()
         WHERE id = $5 AND user_id = $6;
      `, [funnelStage, summary, lastMsgAt, jid, actualConvId, ANICET_USER_ID]);
    } else if (convById.has(dumpConvId)) {
      actualConvId = dumpConvId;
      await client.query(`
        UPDATE public.conversations
           SET contact_id = $1,
               funnel_stage = $2,
               summary = $3,
               last_message_at = $4,
               session_name = 'Test',
               chat_id = $5,
               updated_at = now()
         WHERE id = $6 AND user_id = $7;
      `, [contactId, funnelStage, summary, lastMsgAt, jid, actualConvId, ANICET_USER_ID]);
      convByContactId.set(contactId, actualConvId);
    } else {
      const insConvRes = await client.query(`
        INSERT INTO public.conversations (
          id, user_id, contact_id, funnel_stage, ai_paused, pause_reason,
          summary, last_message_at, session_name, chat_id, control_mode,
          control_reason, control_actor, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, true, 'historical_archive',
          $5, $6, 'Test', $7, 'human',
          'historical_archive', 'merchant', $6, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          contact_id = EXCLUDED.contact_id,
          user_id = EXCLUDED.user_id,
          funnel_stage = EXCLUDED.funnel_stage,
          summary = EXCLUDED.summary,
          last_message_at = EXCLUDED.last_message_at,
          session_name = EXCLUDED.session_name,
          chat_id = EXCLUDED.chat_id,
          updated_at = now()
        RETURNING id;
      `, [dumpConvId, ANICET_USER_ID, contactId, funnelStage, summary, lastMsgAt, jid]);
      actualConvId = insConvRes.rows[0].id;
      convByContactId.set(contactId, actualConvId);
      convById.add(actualConvId);
    }

    dumpConvToRealConvMap.set(dumpConvId, actualConvId);
    convsUpserted++;

    // Traitement des Orders
    for (const ord of (chat.orders || [])) {
      const orderId = ord.id;
      if (!orderId) continue;
      const amtCents = ord.amount_cents || 120000;
      const priceXof = Math.round(amtCents / 100);
      const isDelivered = Boolean(ord.delivered_at);
      const isValidated = Boolean(ord.validated_at) || isDelivered;

      const stage = isDelivered ? 'delivered' : isValidated ? 'lyrics_validated' : 'collecting_brief';
      const paymentStatus = (isDelivered || isValidated) ? 'confirmed' : 'unpaid';
      const status = isDelivered ? 'delivered' : isValidated ? 'validated' : 'pending';
      const deliverable = amtCents >= 500000 ? 'audio_video' : 'audio';

      await client.query(`
        INSERT INTO public.orders (
          id, user_id, contact_id, conversation_id, amount_cents, currency,
          status, stage, payment_status, price_xof, price_source, deliverable,
          payment_policy, recipient_name_confirmed, version, created_at,
          delivered_at, validated_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'XOF',
          $6, $7, $8, $9, 'merchant', $10,
          'after_lyrics_validation', true, 1, $11,
          $12, $13, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          contact_id = EXCLUDED.contact_id,
          conversation_id = EXCLUDED.conversation_id,
          amount_cents = EXCLUDED.amount_cents,
          status = EXCLUDED.status,
          stage = EXCLUDED.stage,
          payment_status = EXCLUDED.payment_status,
          price_xof = EXCLUDED.price_xof,
          updated_at = now();
      `, [
        orderId, ANICET_USER_ID, contactId, actualConvId, amtCents,
        status, stage, paymentStatus, priceXof, deliverable,
        ord.created_at || lastMsgAt,
        ord.delivered_at || null,
        ord.validated_at || null
      ]);
      ordersUpserted++;
    }
  }

  console.log(`\nContacts créés : ${contactsCreated}`);
  console.log(`Conversations synchronisées : ${convsUpserted}`);
  console.log(`Commandes synchronisées : ${ordersUpserted}`);

  // 5. Ingestion des Messages par paquets
  console.log('Préparation de l\'ingestion des messages...');
  let totalMessagesProcessed = 0;
  let batch = [];
  const BATCH_SIZE = 500;

  async function flushBatch() {
    if (batch.length === 0) return;
    const values = [];
    const params = [];
    let pIdx = 1;

    for (const m of batch) {
      values.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5})`);
      params.push(
        m.convId,
        ANICET_USER_ID,
        m.role,
        m.direction,
        m.body,
        m.createdAt
      );
      pIdx += 6;
    }

    const sql = `
      INSERT INTO public.messages (
        conversation_id, user_id, role, direction, body, created_at
      ) VALUES ${values.join(', ')}
    `;
    await client.query(sql, params);
    totalMessagesProcessed += batch.length;
    batch = [];
    process.stdout.write(`\rMessages insérés : ${totalMessagesProcessed} / ~40000`);
  }

  const existingMsgCountRes = await client.query(
    'SELECT count(*)::int as count FROM public.messages WHERE user_id = $1',
    [ANICET_USER_ID]
  );
  const existingMsgCount = existingMsgCountRes.rows[0].count;

  if (existingMsgCount > 5000) {
    console.log(`\nLa table messages contient déjà ${existingMsgCount} messages pour Anicet. Importation des messages ignorée.`);
  } else {
    for (const [dumpConvId, chat] of Object.entries(details)) {
      const realConvId = dumpConvToRealConvMap.get(dumpConvId);
      if (!realConvId) continue;

      const msgs = chat.messages || [];
      for (const m of msgs) {
        const body = (m.body || '').trim();
        if (!body) continue;
        let role = m.role || 'user';
        if (!['user', 'assistant', 'human_agent', 'system'].includes(role)) {
          role = 'user';
        }
        let dir = m.direction || (role === 'user' ? 'inbound' : 'outbound');
        if (!['inbound', 'outbound'].includes(dir)) {
          dir = 'inbound';
        }

        batch.push({
          convId: realConvId,
          role,
          direction: dir,
          body,
          createdAt: m.created_at || new Date().toISOString()
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
    }
    await flushBatch();
    console.log(`\nTotal messages importés : ${totalMessagesProcessed}`);
  }

  // Notifier PostgREST pour recharger le cache
  await client.query("SELECT pg_notify('pgrst', 'reload schema')");
  console.log('Schéma PostgREST rechargé.');

  // 6. Vérification finale d'isolation stricte pour Anicet
  const checkContacts = await client.query('SELECT count(*)::int as cnt FROM public.contacts WHERE user_id = $1', [ANICET_USER_ID]);
  const checkConvs = await client.query('SELECT count(*)::int as cnt FROM public.conversations WHERE user_id = $1', [ANICET_USER_ID]);
  const checkOrders = await client.query('SELECT count(*)::int as cnt FROM public.orders WHERE user_id = $1', [ANICET_USER_ID]);
  const checkMsgs = await client.query('SELECT count(*)::int as cnt FROM public.messages WHERE user_id = $1', [ANICET_USER_ID]);
  const checkOthers = await client.query('SELECT count(*)::int as cnt FROM public.contacts WHERE user_id <> $1', [ANICET_USER_ID]);

  console.log('\n--- RÉSULTAT FINAL POUR L\'AGENT D\'ANICET (user_id: 043a33b4...) ---');
  console.log(`Contacts exclusifs d'Anicet : ${checkContacts.rows[0].cnt}`);
  console.log(`Conversations exclusives d'Anicet : ${checkConvs.rows[0].cnt}`);
  console.log(`Commandes exclusives d'Anicet : ${checkOrders.rows[0].cnt}`);
  console.log(`Messages exclusifs d'Anicet : ${checkMsgs.rows[0].cnt}`);
  console.log(`Contacts des autres studios préservés séparément : ${checkOthers.rows[0].cnt}`);

  await client.end();
  console.log('Importation terminée avec succès.');
}

run().catch(err => {
  console.error('\nErreur durant l\'ingestion:', err);
  process.exit(1);
});
