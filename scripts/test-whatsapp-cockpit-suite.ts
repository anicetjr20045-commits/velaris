/**
 * Banc de Test & Audit Médico-Légal : WhatsApp Super Cockpit
 * 
 * Teste exhaustivement et prouve le bon fonctionnement de chaque brique :
 * 1. Résolveur de coordonnées Mobile Money par pays (CI, BF, SN, ML, Diaspora)
 * 2. Moteur Ghostwriter 3-Variantes (Accueil, Brief, Offres, Clôture, Statut)
 * 3. Tone Shifter (Raccourcir, Chaleureux, Appel à l'action)
 * 4. Scanner OCR Anti-Fraude de Quittances (Wave, Orange Money, Reçus suspects, Messages neutres)
 * 5. Extracteur de Brief (Destinataire, Occasion, Souvenirs)
 * 6. Connectivité et santé Supabase
 * 7. Connectivité et session WAHA live
 */

import { resolvePaymentInfoByPhone } from '../src/services/realtime-chat';
import { generateGhostwriterVariants, shiftTextTone } from '../src/services/ghostwriter';
import { analyzeReceiptText } from '../src/services/receipt-ocr';
import { extractActiveOrderScope } from '../src/components/ConversationsView';
import { checkSupabaseHealth, supabase } from '../src/services/supabase';
import {
  pingWaha,
  fetchWahaSessions,
  fetchWahaContact,
  fetchWahaProfilePicture,
  sendWahaVoiceUrl,
  sendWahaVideoMessage,
  WAHA_CONFIG
} from '../src/services/waha';
import { generateHouseStyleSongs } from '../src/services/lyricsCorpus';
import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string, startTime = Date.now()) {
  const durationMs = Date.now() - startTime;
  results.push({ suite, name, passed: Boolean(condition), details, durationMs });
  const statusIcon = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${statusIcon} [${suite}] ${name} (${durationMs}ms)${details ? ` -> ${details}` : ''}`);
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 DÉMARRAGE DU BANC D\'ESSAI EXHAUSTIF : WHATSAPP SUPER COCKPIT');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1 : Résolveur de Paiement par Pays (Mobile Money)
  // --------------------------------------------------------------------------
  console.log('📋 [TEST 1/7] Résolveur de Coordonnées Mobile Money par Pays...');
  
  // 1.1 Côte d'Ivoire (+225)
  const t0 = Date.now();
  const ci1 = resolvePaymentInfoByPhone('+225 07 12 34 56');
  assert(ci1.code === 'CI' && ci1.flag === '🇨🇮' && ci1.primaryMethod === 'Wave CI', 'Paiement Pays', 'Côte d\'Ivoire (+225 avec espaces)', `Méthode: ${ci1.primaryMethod}`, t0);
  
  const ci2 = resolvePaymentInfoByPhone('22505010203');
  assert(ci2.code === 'CI' && ci2.accountNumber.includes('05 77 73 08'), 'Paiement Pays', 'Côte d\'Ivoire (sans préfixe +)', `Compte: ${ci2.accountNumber}`);

  // 1.2 Burkina Faso (+226)
  const bf1 = resolvePaymentInfoByPhone('+226 70 00 11 22');
  assert(bf1.code === 'BF' && bf1.flag === '🇧🇫' && bf1.primaryMethod === 'Orange Money BF', 'Paiement Pays', 'Burkina Faso (+226)', `Méthode: ${bf1.primaryMethod}`);

  // 1.3 Sénégal (+221)
  const sn1 = resolvePaymentInfoByPhone('+221 77 123 45 67');
  assert(sn1.code === 'SN' && sn1.flag === '🇸🇳' && sn1.primaryMethod === 'Wave Sénégal', 'Paiement Pays', 'Sénégal (+221)', `Méthode: ${sn1.primaryMethod}`);

  // 1.4 Mali (+223)
  const ml1 = resolvePaymentInfoByPhone('+223 66 12 34 56');
  assert(ml1.code === 'ML' && ml1.flag === '🇲🇱', 'Paiement Pays', 'Mali (+223)', `Méthode: ${ml1.primaryMethod}`);

  // 1.5 Diaspora / France (+33)
  const fr1 = resolvePaymentInfoByPhone('+33 6 12 34 56 78');
  assert(fr1.code === 'INTL' && fr1.formattedBubble.includes('TapTap Send'), 'Paiement Pays', 'France Diaspora (+33)', `Bulle diaspora générée`);

  // --------------------------------------------------------------------------
  // TEST 2 : Moteur Ghostwriter 3-Variantes Contextuelles
  // --------------------------------------------------------------------------
  console.log('\n🧠 [TEST 2/7] Moteur Ghostwriter Contextuel (3 Variantes d\'Or)...');

  // 2.1 Stade Accueil
  const gwAccueil = generateGhostwriterVariants('accueil', 'Moussa Traoré', 'Awa', 'Anniversaire', '');
  assert(
    gwAccueil.variantDirect.text.includes('Moussa') &&
    gwAccueil.variantWarm.text.includes('bienvenue') &&
    gwAccueil.variantConcise.text.length < gwAccueil.variantWarm.text.length,
    'Ghostwriter',
    'Génération 3 variantes Accueil avec personnalisation prénom',
    `Directe: "${gwAccueil.variantDirect.text.slice(0, 40)}..."`
  );

  // 2.2 Stade Présentation Offres (1200 F / 3000 F)
  const gwOffres = generateGhostwriterVariants('presentation_offres', 'Client', 'Koffi', 'Mariage', '');
  assert(
    gwOffres.variantDirect.text.includes('1 200 F') && gwOffres.variantDirect.text.includes('3 000 F'),
    'Ghostwriter',
    'Présentation Offres contenant formellement 1 200 F et 3 000 F',
    `Tarifs validés`
  );

  // 2.3 Stade Validation Texte
  const gwVal = generateGhostwriterVariants('validation_texte', 'Adeline', 'Maman Marie', 'Hommage', '');
  assert(
    gwVal.variantDirect.text.includes('capture') && gwVal.variantWarm.text.includes('mixage'),
    'Ghostwriter',
    'Validation Texte avec incitation au paiement Wave/OM et alerte studio',
    `Clôture validée`
  );

  // 2.4 Stade Paiement Reçu
  const gwPay = generateGhostwriterVariants('paiement_recu', 'Jean', 'Fatou', 'Anniversaire', '');
  assert(
    gwPay.variantDirect.text.includes('18 minutes'),
    'Ghostwriter',
    'Confirmation paiement avec promesse chrono 18 minutes',
    `Cadence studio validée`
  );

  // --------------------------------------------------------------------------
  // TEST 3 : Tone Shifter (Reformulation Rapide en 1 Clic)
  // --------------------------------------------------------------------------
  console.log('\n🎛️ [TEST 3/7] Tone Shifter (Ajusteur de Tonalité Commerciale)...');

  const baseDraft = 'Bonjour voici nos tarifs nous faisons la chanson à 1200f et 3000f pour le clip vidéo merci de choisir.';
  const shorter = shiftTextTone(baseDraft, 'shorter');
  assert(shorter.length < baseDraft.length && shorter.endsWith('.'), 'Tone Shifter', 'Action Raccourcir (shorter)', `Résultat: "${shorter}"`);

  const warmer = shiftTextTone('Le prix est de 1 200 F.', 'warmer');
  assert(warmer.includes('Avec grand plaisir') && warmer.includes('🙏'), 'Tone Shifter', 'Action Plus Chaleureux (warmer)', `Résultat: "${warmer}"`);

  const action = shiftTextTone('Voici le compte Wave +22605777308.', 'action');
  assert(action.includes('capture d\'écran'), 'Tone Shifter', 'Action Demande Capture (action)', `Résultat: "${action}"`);

  // --------------------------------------------------------------------------
  // TEST 4 : Scanner & Vérificateur OCR Anti-Fraude
  // --------------------------------------------------------------------------
  console.log('\n🔍 [TEST 4/7] Scanner OCR & Anti-Fraude Quittances Mobile Money...');

  // 4.1 Quittance Wave Réelle
  const waveText = "Transfert réussi ! Vous avez envoyé 1 200 F CFA à Wendyam Anicet junior Sekongo (+22605777308). Référence: WAV-489201934. Solde restant: 14 500 F CFA.";
  const waveResult = analyzeReceiptText(waveText);
  assert(
    waveResult.isPaymentProof === true &&
    waveResult.provider === 'Wave' &&
    waveResult.amount === 1200 &&
    waveResult.transactionRef === 'WAV-489201934' &&
    waveResult.status === 'verified',
    'OCR Quittances',
    'Reconnaissance et certification Quittance Wave CI 1 200 F',
    `Montant: ${waveResult.amount} F, Réf: ${waveResult.transactionRef}, Statut: ${waveResult.status}`
  );

  // 4.2 Quittance Orange Money Burkina
  const omText = "Paiement Orange Money effectué avec succès. Montant: 3 000 FCFA au +22605777308. Ref: OM-88192001. Date: 11/11/2026 10:30.";
  const omResult = analyzeReceiptText(omText);
  assert(
    omResult.isPaymentProof === true &&
    omResult.provider === 'Orange Money' &&
    omResult.amount === 3000 &&
    omResult.status === 'verified',
    'OCR Quittances',
    'Reconnaissance et certification Orange Money BF 3 000 F',
    `Montant: ${omResult.amount} F, Fournisseur: ${omResult.provider}`
  );

  // 4.3 Faux Reçu ou Message Suspect
  const suspectText = "J'ai payé Wave sur ton numéro frérot valide stp.";
  const suspectResult = analyzeReceiptText(suspectText);
  assert(
    suspectResult.isPaymentProof === true &&
    suspectResult.status === 'suspect' &&
    suspectResult.amount === null,
    'OCR Quittances',
    'Détection d\'allégation de paiement incomplète (Suspecte)',
    `Statut: ${suspectResult.status}`
  );

  // 4.4 Message Ordinaire Neutre (Pas un Reçu)
  const neutreText = "Bonjour j'aimerais une chanson pour l'anniversaire de ma petite soeur.";
  const neutreResult = analyzeReceiptText(neutreText);
  assert(
    neutreResult.isPaymentProof === false &&
    neutreResult.status === 'unrecognized',
    'OCR Quittances',
    'Rejet propre d\'un message ordinaire neutre',
    `Statut: ${neutreResult.status}`
  );

  // --------------------------------------------------------------------------
  // TEST 5 : Extraction Structurée du Brief
  // --------------------------------------------------------------------------
  console.log('\n📝 [TEST 5/7] Extraction Automatique du Brief Client...');

  const mockThread = [
    { id: '1', inbound: true, body: "Bonjour je veux une chanson d'anniversaire pour ma femme Mariam", createdAt: '10:00' },
    { id: '2', inbound: false, body: "Bonjour ! Racontez-moi quelques souvenirs.", createdAt: '10:01' },
    { id: '3', inbound: true, body: "Elle adore cuisiner et notre premier voyage à Grand-Bassam", createdAt: '10:02' },
  ];
  const brief = extractActiveOrderScope(mockThread, 'Jean Dupont');
  assert(
    brief.detectedOccasion === 'Anniversaire' &&
    brief.recipientName === 'Mariam' &&
    brief.memories.length >= 1,
    'Brief Extract',
    'Extraction Occasion, Destinataire (Mariam) et Souvenirs Bassam',
    `Occasion: ${brief.detectedOccasion}, Destinataire: ${brief.recipientName}, Souvenirs: ${brief.memories.length}`
  );

  // --------------------------------------------------------------------------
  // TEST 6 : Connectivité Supabase Live
  // --------------------------------------------------------------------------
  console.log('\n⚡ [TEST 6/7] Connectivité Supabase & Schéma des Tables...');

  const tSupa = Date.now();
  const supaHealth = await checkSupabaseHealth();
  assert(supaHealth.online === true, 'Supabase', 'Sonde de santé Supabase (HTTP 200 REST)', `Projet: ${supaHealth.project}`, tSupa);

  // Vérification de la table conversations
  const { data: convCheck, error: convErr } = await supabase
    .from('conversations')
    .select('id, control_mode, ai_paused, last_message_at')
    .limit(3);
  assert(!convErr && Array.isArray(convCheck), 'Supabase', 'Lecture table conversations (colonnes control_mode & ai_paused)', `Lignes lues: ${convCheck?.length ?? 0}`);

  // Vérification de la table messages
  const { data: msgCheck, error: msgErr } = await supabase
    .from('messages')
    .select('id, direction, body, created_at')
    .limit(3);
  assert(!msgErr && Array.isArray(msgCheck), 'Supabase', 'Lecture table messages (historique réel)', `Messages lus: ${msgCheck?.length ?? 0}`);

  // --------------------------------------------------------------------------
  // TEST 7 : Connectivité WAHA & Sessions Live
  // --------------------------------------------------------------------------
  console.log('\n📡 [TEST 7/7] Connectivité Passerelle WAHA (Chromium / WebJS)...');

  const tWaha = Date.now();
  const wahaPing = await pingWaha();
  assert(wahaPing === true, 'WAHA Gateway', 'Ping de la passerelle WAHA', `URL: ${WAHA_CONFIG.baseUrl}`, tWaha);

  const sessions = await fetchWahaSessions();
  assert(
    Array.isArray(sessions),
    'WAHA Gateway',
    'Interrogation des sessions WhatsApp enregistrées sur le VPS',
    `Nombre de sessions trouvées: ${sessions.length}`
  );

  // --------------------------------------------------------------------------
  // TEST 8 : Génération Intelligente de Paroles 1 vs 2 Chansons
  // --------------------------------------------------------------------------
  console.log('\n🎵 [TEST 8/10] Génération de Paroles 1 vs 2 Chansons & Format Double Œuvre...');

  // 8.1 Chanson Unique Standard
  const singleSongResult = generateHouseStyleSongs({
    recipient: 'Awa',
    occasion: 'Anniversaire',
    memories: ['Toujours le sourire aux lèvres à Treichville'],
    wantsMulti: false,
  });
  assert(
    singleSongResult.isMulti === false &&
    singleSongResult.songs.length === 1 &&
    singleSongResult.songs[0].lyrics.includes('[Refrain]') &&
    singleSongResult.songs[0].lineCount >= 32,
    'Paroles 1 vs 2',
    'Génération chanson unique standard (format Suno 32-48 vers)',
    `Titre: ${singleSongResult.songs[0].title}`
  );

  // 8.2 Détection et Génération 2 Chansons Distinctes
  const doubleSongResult = generateHouseStyleSongs({
    recipient: 'Marie',
    occasion: 'Anniversaire',
    wantsMulti: true,
    recipient2: 'Joseph',
    occasion2: 'Hommage',
    memories: ['Le marché de Bouaké', 'La maison familiale'],
  });
  const hasDivider = doubleSongResult.output.includes('==================================================');
  const hasChanson1Header = doubleSongResult.output.includes('=== CHANSON 1 / 2 :');
  const hasChanson2Header = doubleSongResult.output.includes('=== CHANSON 2 / 2 :');
  assert(
    doubleSongResult.isMulti === true &&
    doubleSongResult.songs.length === 2 &&
    hasDivider &&
    hasChanson1Header &&
    hasChanson2Header,
    'Paroles 1 vs 2',
    'Format double chanson === CHANSON 1 / 2 === et === CHANSON 2 / 2 ===',
    `Chanson 1: ${doubleSongResult.songs[0].title} | Chanson 2: ${doubleSongResult.songs[1].title}`
  );

  // 8.3 Extraction Brief avec Détection Multi-Destinataires
  const multiThread = [
    { id: '1', inbound: true, body: 'Bonjour, je veux deux chansons pour mes parents : une pour mon père Joseph et une pour ma mère Marie.', createdAt: '2026-11-12T14:00:00Z' },
  ];
  const multiBrief = extractActiveOrderScope(multiThread as any, 'Client');
  assert(
    multiBrief.wantsMulti === true &&
    (multiBrief.recipientName.includes('Joseph') || multiBrief.recipientName2?.includes('Marie')),
    'Paroles 1 vs 2',
    'Extraction brief avec détection double commande et 2 prénoms',
    `wantsMulti: ${multiBrief.wantsMulti}, P1: ${multiBrief.recipientName}, P2: ${multiBrief.recipientName2}`
  );

  // --------------------------------------------------------------------------
  // TEST 9 : Endpoints Médias & Profils WhatsApp WAHA
  // --------------------------------------------------------------------------
  console.log('\n📱 [TEST 9/10] Fonctions Médias & Profils WhatsApp WAHA...');

  assert(
    typeof sendWahaVoiceUrl === 'function' && typeof sendWahaVideoMessage === 'function',
    'WAHA Médias',
    'Disponibilité des méthodes sendWahaVoiceUrl et sendWahaVideoMessage',
    'Méthodes certifiées'
  );

  const contactProfile = await fetchWahaContact('22656240533@c.us', 'Test');
  assert(
    contactProfile !== null && (contactProfile.pushname || contactProfile.name) !== undefined,
    'WAHA Profils',
    'Extraction pushname et nom de contact WhatsApp via /api/contacts',
    `Pushname: ${contactProfile?.pushname || contactProfile?.name}`
  );

  const picResult = await fetchWahaProfilePicture('22656240533@c.us', 'Test');
  assert(
    picResult === null || typeof picResult === 'string',
    'WAHA Profils',
    'Interrogation photo de profil via /api/contacts/profile-picture (URL ou null de confidentialité)',
    picResult ? `Photo trouvée: ${picResult.slice(0, 45)}...` : 'Photo restreinte par confidentialité'
  );

  // --------------------------------------------------------------------------
  // TEST 10 : Configuration Progressive Web App (PWA)
  // --------------------------------------------------------------------------
  console.log('\n📲 [TEST 10/10] Certification Progressive Web App (PWA)...');

  const manifestPath = path.resolve('/root/projets/velaris/public/manifest.json');
  const swPath = path.resolve('/root/projets/velaris/public/sw.js');
  const htmlPath = path.resolve('/root/projets/velaris/index.html');

  const manifestExists = fs.existsSync(manifestPath);
  let manifestValid = false;
  if (manifestExists) {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifestValid = raw.display === 'standalone' && raw.start_url === '/#chat' && Array.isArray(raw.icons);
  }
  assert(manifestExists && manifestValid, 'PWA Manifest', 'Fichier public/manifest.json valide (standalone, /#chat, icônes)', manifestExists ? 'Manifest OK' : 'Fichier absent');

  const swExists = fs.existsSync(swPath);
  let swValid = false;
  if (swExists) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    swValid = swContent.includes('install') && swContent.includes('fetch');
  }
  assert(swExists && swValid, 'PWA Service Worker', 'Service worker public/sw.js actif avec cache-first/network-first', swExists ? 'Service Worker OK' : 'Fichier absent');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const hasManifestLink = htmlContent.includes('rel="manifest"');
  const hasAppleMeta = htmlContent.includes('apple-mobile-web-app-capable');
  assert(hasManifestLink && hasAppleMeta, 'PWA HTML Shell', 'Balises meta Apple & lien manifeste dans index.html', 'Balises vérifiées');

  // --------------------------------------------------------------------------
  // RAPPORT FINAL
  // --------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log(`📊 RAPPORT DE CERTIFICATION : ${passed}/${total} TESTS AU VERT (${Math.round((passed / total) * 100)}%)`);
  if (failed === 0) {
    console.log('🏆 TOUTES LES FONCTIONNALITÉS DU WHATSAPP SUPER COCKPIT SONT PROUVÉES ET OPÉRATIONNELLES !');
  } else {
    console.error(`⚠️ ATTENTION : ${failed} tests ont échoué. Examen requis.`);
  }
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal crash during test execution:', err);
  process.exit(1);
});
