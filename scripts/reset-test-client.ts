#!/usr/bin/env node
/**
 * CLI de réinitialisation et purge instantanée d'un contact de test.
 *
 * Usage:
 *   npx tsx scripts/reset-test-client.ts <numero_ou_jid>
 *   npx tsx scripts/reset-test-client.ts --recent
 *
 * Exemples:
 *   npx tsx scripts/reset-test-client.ts 22547322216
 *   npx tsx scripts/reset-test-client.ts +22547322216
 *   npx tsx scripts/reset-test-client.ts 272970991841290@lid
 */

import { existsSync, readFileSync } from 'node:fs';
import { RestDb } from '../engine/src/db/rest.js';
import { resetTestClient } from '../engine/src/services/reset-client.js';

// Chargement des variables d'environnement
function loadEnv(): { supabaseUrl: string; supabaseKey: string } {
  let url = process.env.SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co';
  let key = process.env.SUPABASE_SECRET_KEY || '';

  const envFiles = ['.env.local', '.env', 'engine/.env.local', 'engine/.env'];
  for (const f of envFiles) {
    if (existsSync(f)) {
      const content = readFileSync(f, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [k, ...v] = trimmed.split('=');
        const val = v.join('=').trim().replace(/^["']|["']$/g, '');
        if (k.trim() === 'SUPABASE_URL' && !process.env.SUPABASE_URL) url = val;
        if (k.trim() === 'SUPABASE_SECRET_KEY' && !key) key = val;
      }
    }
  }

  if (!key) {
    throw new Error('SUPABASE_SECRET_KEY introuvable dans les variables d\'environnement ou fichiers .env');
  }

  return { supabaseUrl: url, supabaseKey: key };
}

async function main() {
  const args = process.argv.slice(2);
  const { supabaseUrl, supabaseKey } = loadEnv();
  const db = new RestDb({ url: supabaseUrl, secretKey: supabaseKey });

  if (args.length === 0 || args[0] === '--recent' || args[0] === '-l') {
    console.log('\n--- 5 Dernières Discussions en Base Supabase ---');
    try {
      const convs = await db.queryTable<Array<{ id: string; chat_id: string; last_message_at: string; contact_id: string; ai_paused: boolean; control_mode: string }>>(
        'conversations',
        'order=last_message_at.desc.nullslast&limit=5&select=id,chat_id,last_message_at,contact_id,ai_paused,control_mode'
      );

      for (const c of convs || []) {
        const contacts = await db.queryTable<Array<{ name: string | null; phone: string | null; wa_jid: string | null }>>(
          'contacts',
          `id=eq.${c.contact_id}&select=name,phone,wa_jid`
        ).catch(() => []);
        const ct = contacts?.[0];
        console.log(`• Chat: ${c.chat_id} | Contact: ${ct?.name || 'Inconnu'} (${ct?.phone || 'aucun tel'})`);
        console.log(`  Conv ID: ${c.id} | Pause IA: ${c.ai_paused} (${c.control_mode}) | Date: ${c.last_message_at}\n`);
      }
      console.log('Pour réinitialiser une discussion, tapez :');
      console.log('  npx tsx scripts/reset-test-client.ts <numero_ou_jid>\n');
      return;
    } catch (err: any) {
      console.error('Erreur lecture contacts récents:', err.message);
      return;
    }
  }

  const target = args[0]!;
  console.log(`\nPurge et réinitialisation en cours pour le client : "${target}"...`);

  const res = await resetTestClient(db, target);

  if (!res.ok) {
    console.error(`Échec de la réinitialisation : ${res.error}`);
    process.exit(1);
  }

  console.log('\n--- Bilan de la Purge Chirurgicale ---');
  console.log(`• Identifiant traité       : ${res.identifier} (chiffres: ${res.cleanPhone || 'n/a'})`);
  console.log(`• Contacts supprimés       : ${res.deletedContacts}`);
  console.log(`• Conversations purgées    : ${res.deletedConversations}`);
  console.log(`• Messages effacés         : ${res.deletedMessages}`);
  console.log(`• Commandes (orders) suprim: ${res.deletedOrders}`);
  console.log(`• Tours de file annulés    : ${res.deletedTurns}`);
  console.log(`• Événements dédupliqués   : ${res.deletedEvents}`);
  console.log('--------------------------------------');
  console.log('Statut : Client réinitialisé avec succès à 100%.');
  console.log('L\'agent traitera le prochain message WhatsApp comme un NOUVEAU client.\n');
}

main().catch((e) => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
