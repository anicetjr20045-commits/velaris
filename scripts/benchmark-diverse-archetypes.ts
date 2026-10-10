#!/usr/bin/env node
/**
 * 🧪 BANC D'ESSAI DES 8 ARCHÉTYPES CLIENTS VARIÉS (CONDITIONS 100% RÉELLES)
 * 
 * Rejoue en direct contre DeepSeek Flash (vrais crédits Kie.ai)
 * les cas les plus complexes et variés identifiés dans les données de production :
 * 
 * 1. ARCH_VOICE        : Client vocal ouest-africain transcrit (Miss Daniella)
 * 2. ARCH_BURST        : Client rafale hachée (3 messages successifs en 2s)
 * 3. ARCH_FALSE_OK     : Client envoyant un "ok" isolé en plein brief
 * 4. ARCH_EXTERNAL_LINK: Client partageant un lien TikTok/YouTube ("voici ma vidéo")
 * 5. ARCH_HAGGLING     : Client qui tente de négocier ("trop cher, laisse à 1000 F")
 * 6. ARCH_PRICE_FIRST  : Client qui exige le tarif avant de dire l'occasion
 * 7. ARCH_RETURNING    : Ancienne cliente fidèle (5e commande, Mme Sawadogo)
 * 8. ARCH_GOSPEL_FAITH : Client pour chant chrétien / message spirituel (Razben)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DeepSeekProvider } from '../engine/dist/src/llm/deepseek.js';
import { generateSalesReply, type SalesBrainInput } from '../engine/dist/src/llm/sales-brain.js';
import type { OrderSnapshot } from '../engine/dist/src/domain/types.js';

function loadApiKey(): string {
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY;
  const envFiles = ['.env.local', '.env', 'engine/.env.local', 'engine/.env'];
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

interface ArchetypeScenario {
  id: string;
  title: string;
  description: string;
  clientName: string;
  phone: string;
  country: string;
  turns: string[];
}

const ARCHETYPES: ArchetypeScenario[] = [
  {
    id: "ARCH_01_VOICE",
    title: "Client Vocal Ouest-Africain (Note vocale transcrite)",
    description: "Note vocale authentique avec hésitations et tournure ivoirienne.",
    clientName: "Miss Daniella",
    phone: "+2250701020304",
    country: "Côte d'Ivoire (+225)",
    turns: [
      "Salut",
      "🎙️ [Note vocale 0:42] So je veux vous conter de la part de l'une de mes mamans là. Donc je voulais qu'on fasse une chanson pour elle, elle s'appelle Maman Henriette, c'est pour son anniversaire le 25 octobre.",
      "C'est moi sa fille Daniella qui offre la chanson. Dites-moi comment on fait.",
      "D'accord j'ai bien écouté le vocal, ça me va.",
      "Je prends la formule Prestige à 3000 F avec la vidéo."
    ]
  },
  {
    id: "ARCH_02_BURST",
    title: "Client Rafaleur (Messages hachés en plusieurs bulles)",
    description: "Le client envoie plusieurs fragments de pensée à la suite.",
    clientName: "Muller Abrodan",
    phone: "+2250506070809",
    country: "Côte d'Ivoire (+225)",
    turns: [
      "Cc bjr \n\n L anniverssaire de ma fille tryphene oceanne \n\n Elle aura 5 ans le 10 octobre",
      "C'est son papa Elvis qui offre",
      "Elle aime danser et regarder les dessins animés",
      "C'est bon j'ai écouté",
      "La formule à 1200 F s'il vous plaît"
    ]
  },
  {
    id: "ARCH_03_FALSE_OK",
    title: "Client Faux Positif 'OK' (Piège du court acquittement)",
    description: "Le client dit juste 'ok' ou 'd'accord' sans avoir fini son brief.",
    clientName: "Kouassi David",
    phone: "+2250102030405",
    country: "Côte d'Ivoire (+225)",
    turns: [
      "Bonjour je veux une chanson",
      "Ok",
      "C'est pour le mariage de mon frère Jean",
      "Le 15 décembre, de la part de David son petit frère",
      "Ok super j'ai entendu le vocal",
      "Je valide la formule découverte"
    ]
  },
  {
    id: "ARCH_04_EXTERNAL_LINK",
    title: "Partage de Lien Vidéo Externe (TikTok / YouTube)",
    description: "Le client envoie un lien vidéo externe sans demander la démo Velaris.",
    clientName: "Sandrine",
    phone: "+2250788990011",
    country: "Côte d'Ivoire (+225)",
    turns: [
      "Bonjour ! Je veux une chanson",
      "Regardez cette vidéo TikTok https://vm.tiktok.com/ZMxxxx/ je veux exactement le même rythme",
      "C'est pour l'anniversaire de mon mari Rodrigue le 12 novembre, de la part de Sandrine",
      "Il est très travailleur et attentionné avec les enfants",
      "J'ai écouté les explications",
      "Prestige à 3000 F avec la vidéo souvenir"
    ]
  },
  {
    id: "ARCH_05_HAGGLING",
    title: "Client Marchandage / Négociation Tarifaire",
    description: "Le client tente de négocier le tarif ou demande une réduction.",
    clientName: "Souleymane Traoré",
    phone: "+22670112233",
    country: "Burkina Faso (+226)",
    turns: [
      "Bonjour puis-je en savoir plus ?",
      "Chanson d'anniversaire pour ma fiancée Amina le 30 novembre, offert par Souley",
      "C'est une femme douce et patiente",
      "J'ai compris le vocal",
      "Mais 1200 F c'est trop cher, tu peux me laisser ça à 1000 F CFA ?",
      "D'accord ça marche, je prends la formule Découverte à 1200 F"
    ]
  },
  {
    id: "ARCH_06_PRICE_FIRST",
    title: "Client 'Tarif d'Abord' (Demande de prix immédiat)",
    description: "Le client refuse de donner les détails tant qu'il ne connaît pas le prix.",
    clientName: "Ibrahim",
    phone: "+2250744556677",
    country: "Côte d'Ivoire (+225)",
    turns: [
      "C'est combien la chanson ?",
      "D'accord, c'est pour un anniversaire",
      "Mon ami d'enfance Boris, pour le 5 décembre, de la part d'Ibrahim",
      "On se connaît depuis le lycée à Bouaké",
      "C'est noté pour le vocal",
      "La formule Prestige à 3000 F"
    ]
  },
  {
    id: "ARCH_07_RETURNING",
    title: "Client Fidèle (Ancienne cliente qui revient pour sa 5e commande)",
    description: "La cliente connaît déjà le principe et veut commander rapidement.",
    clientName: "Mme Sawadogo",
    phone: "+22675998877",
    country: "Burkina Faso (+226)",
    turns: [
      "Bonjour Velaris, c'est encore moi Mme Sawadogo pour une nouvelle commande !",
      "Cette fois c'est pour l'anniversaire de ma petite sœur Salimata le 20 décembre",
      "C'est de la part de sa grande sœur José",
      "Pas besoin de réexpliquer, je connais déjà le principe",
      "Prestige à 3000 F directement"
    ]
  },
  {
    id: "ARCH_08_GOSPEL_FAITH",
    title: "Chant Chrétien / Gospel / Hommage Spirituel",
    description: "Demande de style chrétien doux avec paroles de bénédiction.",
    clientName: "Razben",
    phone: "+2250733221100",
    country: "Côte d'Ivoire (+225)",
    turns: [
      "Bonjour, je veux une chanson personnelle pour moi-même intitulée 'Mon message à l'Éternel'",
      "C'est un chant de reconnaissance à Dieu pour ses bienfaits dans ma vie, style Gospel doux",
      "Mon prénom c'est Razben",
      "Prévu pour ce dimanche",
      "J'ai bien écouté la démarche",
      "La formule Prestige"
    ]
  }
];

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

async function runArchetypeBenchmark() {
  const apiKey = loadApiKey();
  console.log(`🔑 Clé API Kie.ai chargée.`);
  console.log(`🚀 Démarrage du Banc d'Essai des 8 Archétypes Clients Réels (DeepSeek Flash)...`);
  console.log(`================================================================================`);

  const provider = new DeepSeekProvider({
    apiKey,
    baseUrl: 'https://api.kie.ai',
  });

  const results: any[] = [];

  for (const arch of ARCHETYPES) {
    console.log(`\n▶️  [${arch.id}] ${arch.title} (${arch.clientName} - ${arch.country})`);

    const recentHistory: Array<{ who: 'client' | 'gérant' | 'studio'; text: string }> = [];
    let procedureVoiceReceived = false;
    let videoSampleReceived = false;
    let formulaChosen = false;

    const orders: OrderSnapshot[] = [
      {
        id: `ord_${arch.id}`,
        version: 1,
        stage: 'collecting_brief',
        paymentStatus: 'unpaid',
        catalogueCode: null,
        priceXof: null,
        deliverable: null,
        paymentPolicy: null,
        occasion: null,
        recipientName: null,
        recipientNameConfirmed: false,
        recipientRelation: null,
        senderName: null,
        style: null,
        voice: null,
        language: null,
        memoriesCount: 0,
        memories: [],
        lyrics: null,
        photosCount: 0,
        revisionCount: 0,
        paymentInstructionsCount: 0,
        hasPaymentDeferral: false,
      },
    ];

    const turnsLog: any[] = [];
    let archViolations = 0;

    for (let tIdx = 0; tIdx < arch.turns.length; tIdx++) {
      const clientMsg = arch.turns[tIdx];
      const tStart = Date.now();

      const input: SalesBrainInput = {
        turnText: clientMsg,
        recent: recentHistory,
        contact: {
          phone: arch.phone,
          name: arch.clientName,
          wa_jid: `${arch.phone.replace(/\D/g, '')}@c.us`,
          procedureVoiceReceived,
          videoSampleReceived,
        },
        persona: {
          studio_name: 'Velaris Studio',
          agent_name: 'Alex',
          manager_first_name: 'Anicet',
        },
        orders,
      };

      const reply = await generateSalesReply(provider, input);
      const durationMs = Date.now() - tStart;

      // Détection des violations
      const violations: string[] = [];

      // V1: Emojis
      for (const b of reply.bubbles) {
        if (EMOJI_REGEX.test(b)) {
          violations.push(`Emoji détecté: "${b}"`);
        }
      }

      // V2: Fuite paiement prématuré
      for (const b of reply.bubbles) {
        if (/05\s*77\s*73\s*08|07\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}|Wave\s*:|Orange\s*Money\s*:/i.test(b)) {
          if (!formulaChosen && !reply.formulaChosen) {
            violations.push(`Paiement prématuré: "${b}"`);
          }
        }
      }

      // V3: Fausse détection vidéo sur lien externe
      if (clientMsg.includes('tiktok') && reply.videoSampleDue) {
        violations.push(`Faux positif vidéo démo sur lien TikTok externe`);
      }

      // V4: Plusieurs questions
      let qCount = 0;
      for (const b of reply.bubbles) {
        const matches = b.match(/\?/g);
        if (matches) qCount += matches.length;
      }
      if (qCount > 1) {
        violations.push(`Multiples questions (${qCount})`);
      }

      if (violations.length > 0) archViolations++;

      // Mise à jour de l'état
      if (reply.procedureVoiceDue) procedureVoiceReceived = true;
      if (reply.videoSampleDue) videoSampleReceived = true;
      if (reply.formulaChosen) {
        formulaChosen = true;
        orders[0]!.catalogueCode = reply.chosenFormula as any;
      }

      // Ajout à l'historique récent
      recentHistory.push({ who: 'client', text: clientMsg });
      recentHistory.push({ who: 'studio', text: reply.bubbles.join('\n\n') });

      turnsLog.push({
        turnIndex: tIdx + 1,
        client: clientMsg,
        assistant: reply.bubbles,
        procedureVoiceDue: reply.procedureVoiceDue,
        videoSampleDue: reply.videoSampleDue,
        formulaChosen: reply.formulaChosen,
        chosenFormula: reply.chosenFormula,
        durationMs,
        violations,
      });

      console.log(`   Tour ${tIdx + 1} (${durationMs}ms) : ${violations.length === 0 ? '✅ Parfait' : '⚠️ ' + violations.join(', ')}`);
      for (const b of reply.bubbles) {
        console.log(`      🤖 "${b.replace(/\n/g, ' ')}"`);
      }
      if (reply.procedureVoiceDue) console.log(`      🎙️ [Vocal de procédure déclenché]`);
      if (reply.videoSampleDue) console.log(`      📹 [Vidéo démo déclenchée]`);
      if (reply.formulaChosen) console.log(`      🎉 [Formule choisie : ${reply.chosenFormula} -> Passage au gérant]`);
    }

    results.push({
      archetypeId: arch.id,
      title: arch.title,
      turnsCount: arch.turns.length,
      clean: archViolations === 0,
      violationsCount: archViolations,
      turns: turnsLog,
    });
  }

  const cleanArchetypes = results.filter(r => r.clean).length;
  const perfectionRate = ((cleanArchetypes / results.length) * 100).toFixed(1);

  console.log(`\n================================================================================`);
  console.log(`📊 BILAN DU BANC D'ESSAI DES 8 ARCHÉTYPES :`);
  console.log(`   - Archétypes testés        : ${results.length}`);
  console.log(`   - Archétypes 100% parfaits : ${cleanArchetypes} / ${results.length} (${perfectionRate}%)`);
  console.log(`================================================================================`);

  writeFileSync(
    'benchmark_archetypes_report.json',
    JSON.stringify({ timestamp: new Date().toISOString(), perfectionRate, results }, null, 2),
    'utf8'
  );
  console.log(`📁 Rapport détaillé sauvegardé dans benchmark_archetypes_report.json`);
}

runArchetypeBenchmark().catch(err => {
  console.error("Erreur d'exécution du banc d'essai :", err);
  process.exit(1);
});
