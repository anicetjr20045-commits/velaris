#!/usr/bin/env node
/**
 * 🚀 EXPORTATEUR COMPLET DE TOUTES LES CONVERSATIONS RÉELLES DE PRODUCTION
 * 
 * Extrait l'intégralité des 649 conversations clients réelles, des 40 500+ messages
 * et des 674 commandes directement depuis Supabase.
 * 
 * Génère deux fichiers prêts pour l'analyse, l'ingestion IA et les benchmarks :
 * 1. dataset_toutes_conversations_reelles.json (JSON indenté complet)
 * 2. dataset_toutes_conversations_reelles.jsonl (1 ligne par conversation, standard e2e)
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

function detectCountry(phone: string | null): string {
  if (!phone) return 'International';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('225')) return "Côte d'Ivoire (+225)";
  if (clean.startsWith('226')) return "Burkina Faso (+226)";
  if (clean.startsWith('229')) return "Bénin (+229)";
  if (clean.startsWith('221')) return "Sénégal (+221)";
  if (clean.startsWith('223')) return "Mali (+223)";
  if (clean.startsWith('228')) return "Togo (+228)";
  if (clean.startsWith('227')) return "Niger (+227)";
  if (clean.startsWith('224')) return "Guinée (+224)";
  if (clean.startsWith('241')) return "Gabon (+241)";
  if (clean.startsWith('242')) return "République du Congo (+242)";
  if (clean.startsWith('243')) return "RDC (+243)";
  if (clean.startsWith('237')) return "Cameroun (+237)";
  if (clean.startsWith('33')) return "France (+33)";
  if (clean.startsWith('39')) return "Italie (+39)";
  return "International";
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  return clean ? `+${clean}` : phone;
}

interface RawConv {
  id: string;
  contact_id: string;
  funnel_stage: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  wa_jid: string | null;
}

interface RawOrder {
  id: string;
  conversation_id: string | null;
  contact_id: string | null;
  occasion: string | null;
  recipient_name: string | null;
  sender_name: string | null;
  style: string | null;
  stage: string | null;
  payment_status: string | null;
  amount_cents: number | null;
  price_xof: number | null;
  created_at: string;
}

interface RawMsg {
  id: string;
  conversation_id: string;
  role: string;
  direction: string;
  body: string | null;
  transcript: string | null;
  media_kind: string | null;
  created_at: string;
  wa_timestamp: string | null;
}

async function main() {
  console.log('='.repeat(78));
  console.log('🚀 DÉMARRAGE DE L\'EXTRACTION COMPLÈTE DE TOUTES LES CONVERSATIONS RÉELLES');
  console.log('='.repeat(78));

  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'postgres',
    password: '47796397Anicet$',
    database: 'postgres',
    ssl: false,
  });

  await client.connect();
  console.log('✅ Connecté à Supabase PostgreSQL via tunnel sécurisé.\n');

  console.log('⏳ Téléchargement des tables conversations, contacts, orders, messages...');
  const t0 = Date.now();

  const [convsRes, ordersRes, msgsRes] = await Promise.all([
    client.query<RawConv>(`
      SELECT c.id, c.contact_id, c.funnel_stage, c.created_at, ct.name, ct.phone, ct.wa_jid
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      ORDER BY c.created_at ASC
    `),
    client.query<RawOrder>(`
      SELECT id, conversation_id, contact_id, occasion, recipient_name, sender_name, style, stage, payment_status, amount_cents, price_xof, created_at
      FROM orders
      ORDER BY created_at DESC
    `),
    client.query<RawMsg>(`
      SELECT id, conversation_id, role, direction, body, transcript, media_kind, created_at, wa_timestamp
      FROM messages
      WHERE conversation_id IS NOT NULL
      ORDER BY COALESCE(wa_timestamp, created_at) ASC
    `),
  ]);

  await client.end();
  const fetchSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`✅ Données brutes récupérées en ${fetchSec}s :`);
  console.log(`   • ${convsRes.rows.length} conversations`);
  console.log(`   • ${ordersRes.rows.length} commandes`);
  console.log(`   • ${msgsRes.rows.length} messages réels\n`);

  // Indexation des messages par conversation
  const msgsByConv = new Map<string, RawMsg[]>();
  for (const m of msgsRes.rows) {
    let arr = msgsByConv.get(m.conversation_id);
    if (!arr) {
      arr = [];
      msgsByConv.set(m.conversation_id, arr);
    }
    arr.push(m);
  }

  // Indexation des commandes par conversation_id et contact_id
  const ordersByConvId = new Map<string, RawOrder>();
  const ordersByContactId = new Map<string, RawOrder>();
  for (const o of ordersRes.rows) {
    if (o.conversation_id && !ordersByConvId.has(o.conversation_id)) {
      ordersByConvId.set(o.conversation_id, o);
    }
    if (o.contact_id && !ordersByContactId.has(o.contact_id)) {
      ordersByContactId.set(o.contact_id, o);
    }
  }

  console.log('⚙️ Traitement et structuration des conversations...');

  const extracted = [];
  let convIndex = 1;

  for (const c of convsRes.rows) {
    const rawMsgs = msgsByConv.get(c.id) || [];
    if (rawMsgs.length === 0) continue; // On ne retient que les conversations ayant des messages réels

    // Trouver la commande correspondante
    const order = ordersByConvId.get(c.id) || (c.contact_id ? ordersByContactId.get(c.contact_id) : null);

    // Formater le transcript chronologique
    const fullTranscript = rawMsgs.map((m) => {
      const isClient = m.direction === 'inbound' || m.role === 'client' || m.role === 'user';
      const text = (m.body || m.transcript || '').trim();
      const mediaType = m.media_kind || (m.transcript ? 'audio' : 'text');
      const timestamp = (m.wa_timestamp || m.created_at || '').toString();

      return {
        role: (isClient ? 'client' : 'assistant') as 'client' | 'assistant',
        text,
        media_type: mediaType,
        timestamp,
      };
    });

    // Extraire les messages clients séquentiels pour le replay de test
    const clientInputs = fullTranscript
      .filter((t) => t.role === 'client' && t.text.length > 0)
      .map((t) => t.text);

    const clientTurnsCount = fullTranscript.filter((t) => t.role === 'client').length;

    const convIdFormatted = `CONV_${String(convIndex).padStart(3, '0')}`;
    convIndex++;

    extracted.push({
      conversation_id: convIdFormatted,
      original_uuid: c.id,
      client_info: {
        phone: formatPhone(c.phone),
        country: detectCountry(c.phone),
        name: c.name || 'Client WhatsApp',
      },
      order_summary: {
        occasion: order?.occasion || null,
        recipient: order?.recipient_name || null,
        sender: order?.sender_name || null,
        style: order?.style || null,
        stage_reached: order?.stage || c.funnel_stage || 'new',
        payment_status: order?.payment_status || 'unpaid',
        amount_cents: order?.amount_cents || (order?.price_xof ? order.price_xof * 100 : null),
      },
      total_turns: fullTranscript.length,
      client_turns_count: clientTurnsCount,
      client_inputs_for_replay: clientInputs,
      full_transcript: fullTranscript,
    });
  }

  console.log(`✅ ${extracted.length} conversations réelles structurées avec succès.`);

  // Sauvegarde JSON indenté
  const jsonOutPath = resolve('/root/projets/velaris/dataset_toutes_conversations_reelles.json');
  writeFileSync(jsonOutPath, JSON.stringify(extracted, null, 2), 'utf8');
  console.log(`💾 JSON sauvegardé : ${jsonOutPath}`);

  // Sauvegarde JSONL (1 ligne par conversation)
  const jsonlOutPath = resolve('/root/projets/velaris/dataset_toutes_conversations_reelles.jsonl');
  const jsonlContent = extracted.map((c) => JSON.stringify(c)).join('\n');
  writeFileSync(jsonlOutPath, jsonlContent, 'utf8');
  console.log(`💾 JSONL sauvegardé : ${jsonlOutPath}`);

  // Statistiques de synthèse
  let totalTurns = 0;
  let totalClientInputs = 0;
  let audioMessagesCount = 0;
  let deliveredCount = 0;
  const countryCounts: Record<string, number> = {};

  for (const c of extracted) {
    totalTurns += c.total_turns;
    totalClientInputs += c.client_inputs_for_replay.length;
    if (c.order_summary.stage_reached === 'delivered') deliveredCount++;
    countryCounts[c.client_info.country] = (countryCounts[c.client_info.country] || 0) + 1;
    for (const t of c.full_transcript) {
      if (t.media_type === 'audio') audioMessagesCount++;
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('📊 STATISTIQUES FACTUELLES DU JEU COMPLET');
  console.log('='.repeat(78));
  console.log(`• Conversations réelles extraites : ${extracted.length}`);
  console.log(`• Total messages / tours échangés : ${totalTurns}`);
  console.log(`• Total inputs client pour rejeu : ${totalClientInputs}`);
  console.log(`• Notes vocales identifiées : ${audioMessagesCount}`);
  console.log(`• Commandes livrées (succès total) : ${deliveredCount}`);
  console.log('• Répartition par pays :');
  for (const [country, count] of Object.entries(countryCounts)) {
    console.log(`   - ${country} : ${count} conversations`);
  }
  console.log('='.repeat(78));
}

main().catch((err) => {
  console.error('Erreur extraction:', err);
  process.exit(1);
});
