#!/usr/bin/env node
/**
 * 🧪 BANC D'ESSAI DES 12 CAS LIMITES ET SITUATIONS DU MONDE RÉEL (DEEPSEEK FLASH VIA KIE.AI)
 *
 * Évalue le cerveau commercial sur les 12 cas complexes soumis par le superviseur :
 *
 * 1.  CAS_01_CLIENT_LYRICS_DIRECT  : Le client envoie directement son propre texte / poème complet
 * 2.  CAS_02_IMAGE_TEXT_INSPIRATION: Le client envoie une image / capture avec un texte d'inspiration
 * 3.  CAS_03_BURST_VOICE_SCATTERED : Rafale de 3 messages vocaux aux sujets dispersés
 * 4.  CAS_04_EXPLICIT_VIDEO_REQUEST: Vraie demande d'extrait de la vidéo démo souvenir
 * 5.  CAS_05_MULTI_SONGS_ORDER     : Le client commande plusieurs chansons à la fois (2 chansons)
 * 6.  CAS_06_EARLY_PHOTO_SALVO     : Salve de photos envoyée en avance dès le brief
 * 7.  CAS_07_CHATTING_DIGRESSION   : Client bavard qui divague sur sa journée puis revient
 * 8.  CAS_08_DISHONEST_PRETENDER   : Client malhonnête ("j'ai payé, envoyez d'abord la chanson")
 * 9.  CAS_09_OVERLY_FAMILIAR       : Client ultra-amical ("mon vieux père, la famille, le boss")
 * 10. CAS_10_MUSIC_REFERENCE       : Client qui envoie une référence de style / artiste ("comme Josey")
 * 11. CAS_11_HUGE_TEXT_BLOCK       : Immense pavé de texte détaillé (300 mots)
 * 12. CAS_12_BLURRY_CONFUSED_MSG   : Message très confus / syntaxe floue / incompréhensible
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

interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  clientName: string;
  phone: string;
  country: string;
  turns: Array<{
    turnIndex: number;
    clientInput: string;
    expectedGoal: string;
  }>;
}

const SCENARIOS: ScenarioDef[] = [
  // 1. Client qui envoie directement son propre texte
  {
    id: 'CAS_01_CLIENT_LYRICS_DIRECT',
    name: 'Client avec Texte / Paroles Déjà Rédigées',
    description: 'Le client fournit son propre texte poétique dès le départ.',
    clientName: 'Marcelle Koffi',
    phone: '+2250712345678',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour, j'ai déjà écrit les paroles pour l'anniversaire de mon mari. Voici le texte :\n\nDans tes bras j'ai trouvé la paix,\nDepuis 10 ans mon cœur renaît.\nJoyeux anniversaire mon amour Hervé,\nPour toujours à tes côtés.",
        expectedGoal: "Remercier sobrement pour le texte et demander si le client souhaite que l'équipe garde les paroles intactes ou les adapte musicalement, puis vocal."
      },
      {
        turnIndex: 2,
        clientInput: "Je veux que vous l'adaptiez musicalement pour que ça chante bien avec du rythme.",
        expectedGoal: "Valider l'adaptation et déclencher la note vocale de procédure."
      },
      {
        turnIndex: 3,
        clientInput: "C'est bien compris le vocal.",
        expectedGoal: "Présenter les 2 formules (Découverte 1200 / Prestige 3000)."
      },
      {
        turnIndex: 4,
        clientInput: "Je prends Prestige à 3000 F.",
        expectedGoal: "Confirmer la formule Prestige et passage au gérant en 15 min."
      }
    ]
  },

  // 2. Client qui amène une image / capture avec un texte dessus
  {
    id: 'CAS_02_IMAGE_TEXT_INSPIRATION',
    name: 'Client avec Photo / Capture de Texte d’Inspiration',
    description: 'Le client envoie une photo où figure un texte qu’il veut reproduire.',
    clientName: 'Patricia Konan',
    phone: '+2250598765432',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour ! [Image envoyée : capture d'écran d'un poème d'amour]\nRegardez sur cette capture, j'ai trouvé ce joli message, je veux que la chanson dise exactement ça pour mon fiancé.",
        expectedGoal: "Noter la référence d'inspiration et demander l'occasion et le prénom du fiancé."
      },
      {
        turnIndex: 2,
        clientInput: "C'est pour notre anniversaire de fiançailles le 14 novembre. Il s'appelle Stéphane, et c'est de ma part Patricia.",
        expectedGoal: "Noter les repères et déclencher le vocal de procédure."
      },
      {
        turnIndex: 3,
        clientInput: "D'accord j'ai écouté.",
        expectedGoal: "Présenter les formules Découverte et Prestige."
      },
      {
        turnIndex: 4,
        clientInput: "Formule Découverte 1200 F.",
        expectedGoal: "Confirmation 15 min et relais gérant."
      }
    ]
  },

  // 3. Client qui envoie beaucoup de vocaux en rafale avec sujets dispersés
  {
    id: 'CAS_03_BURST_VOICE_SCATTERED',
    name: 'Rafale de 3 Messages Vocaux aux Sujets Dispersés',
    description: 'Le client divague à l’oral entre son boulot, sa maman et ses anecdotes d’enfance.',
    clientName: 'Arnaud Bamba',
    phone: '+2250755443322',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "[Message vocal 1] : Allô bonjour, bon je suis au travail là je rentre fatigué...\n[Message vocal 2] : En fait c'est l'anniversaire de ma maman Adjoua le 18 décembre, c'est moi son fils Arnaud qui offre.\n[Message vocal 3] : Elle aime trop aller à la messe et quand on était petits elle vendait au marché pour payer nos études.",
        expectedGoal: "Filtrer le bruit du travail, capter maman Adjoua, 18 décembre, fils Arnaud, et anecdotes du marché/messe, puis envoyer vocal."
      },
      {
        turnIndex: 2,
        clientInput: "Ok c'est bon pour le vocal.",
        expectedGoal: "Présenter les formules Découverte et Prestige."
      },
      {
        turnIndex: 3,
        clientInput: "Prestige à 3000.",
        expectedGoal: "Confirmation 15 min et passage au gérant."
      }
    ]
  },

  // 4. Client qui demande expressément l'offre vidéo / extrait réel
  {
    id: 'CAS_04_EXPLICIT_VIDEO_REQUEST',
    name: 'Demande Explicite d’Échantillon Vidéo Démo',
    description: 'Le client demande à voir un exemple de la vidéo souvenir Prestige.',
    clientName: 'Grace Mambé',
    phone: '+2250102030405',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour, est-ce que je peux voir un exemple ou extrait de votre vidéo souvenir pour voir comment vous faites le montage ?",
        expectedGoal: "Déclencher l'échantillon vidéo (video_sample: true) et demander l'occasion du brief."
      },
      {
        turnIndex: 2,
        clientInput: "Waouh c'est très beau ! C'est pour l'anniversaire de ma fille Chloé qui aura 3 ans le 1er décembre, de la part de ses parents Grace et Yannick.",
        expectedGoal: "Prendre en compte les repères, demander une anecdote ou déclencher le vocal."
      },
      {
        turnIndex: 3,
        clientInput: "Elle adore les câlins et sourire à tout le monde.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "C'est validé pour le vocal, je veux la formule Prestige avec la vidéo.",
        expectedGoal: "Confirmation Prestige et passage au gérant."
      }
    ]
  },

  // 5. Client qui veut plusieurs chansons à la fois (2 chansons)
  {
    id: 'CAS_05_MULTI_SONGS_ORDER',
    name: 'Commande Multiple (2 Chansons à la Fois)',
    description: 'Le client veut commander 2 chansons distinctes (ex: pour son père et sa mère).',
    clientName: 'Benoît Zongo',
    phone: '+22670998811',
    country: "Burkina Faso (+226)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour, est-ce que c'est possible de commander deux chansons différentes ? Une pour mon père et une pour ma mère ?",
        expectedGoal: "Rassurer avec courtoisie que c'est tout à fait possible, et proposer de commencer par la première personne."
      },
      {
        turnIndex: 2,
        clientInput: "Commençons par mon père alors, il s'appelle Papa Joseph pour son anniversaire le 28 novembre, de la part de Benoît.",
        expectedGoal: "Noter les repères du père et demander son anecdote/message."
      },
      {
        turnIndex: 3,
        clientInput: "Il a toujours été un homme juste et travailleur.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "C'est bien compris le vocal. Je prends la Découverte à 1200 F pour lui.",
        expectedGoal: "Confirmation formule Découverte et passage au gérant."
      }
    ]
  },

  // 6. Client qui envoie beaucoup de photos dès le brief
  {
    id: 'CAS_06_EARLY_PHOTO_SALVO',
    name: 'Salve de Photos Envoyées en Avance',
    description: 'Le client envoie 4 photos dès la prise du brief avant même d’avoir choisi la formule.',
    clientName: 'Tatiana Gnahoré',
    phone: '+2250788776655',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour, voici les photos de mon mari : [Photo 1] [Photo 2] [Photo 3] [Photo 4]. Je veux une chanson pour lui.",
        expectedGoal: "Accuser réception des photos avec sobriété et demander l'occasion et le prénom du mari."
      },
      {
        turnIndex: 2,
        clientInput: "C'est pour son anniversaire le 5 décembre, il s'appelle Rodrigue, de la part de Tatiana.",
        expectedGoal: "Noter les repères et demander une anecdote ou passer au vocal."
      },
      {
        turnIndex: 3,
        clientInput: "Juste lui dire merci d'être un mari formidable.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "Ok j'ai écouté. Je prends la Prestige à 3000 F vu que j'ai déjà envoyé les photos !",
        expectedGoal: "Confirmer Prestige et passage au gérant en 15 min."
      }
    ]
  },

  // 7. Client qui parle beaucoup, divague et revient
  {
    id: 'CAS_07_CHATTING_DIGRESSION',
    name: 'Client Bavard avec Digression Hors-Sujet',
    description: 'Le client commence à raconter ses embouteillages ou la pluie à Abidjan avant de revenir.',
    clientName: 'Marius Yapo',
    phone: '+2250511223344',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour l'équipe ! Vraiment aujourd'hui il y a trop d'embouteillages sur le pont d'Abidjan, je viens de rentrer là c'est fatiguant déh. Bref vous faites des chansons non ?",
        expectedGoal: "Répondre avec courtoisie en une phrase sobre puis recadrer sur l'occasion."
      },
      {
        turnIndex: 2,
        clientInput: "C'est pour ma chérie Estelle, son anniversaire le 12 décembre, de la part de Marius.",
        expectedGoal: "Noter les repères et demander une anecdote ou message."
      },
      {
        turnIndex: 3,
        clientInput: "Elle aime son travail d'infirmière et prend soin de tout le monde.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "C'est noté pour le vocal. La formule à 1200 F.",
        expectedGoal: "Confirmer formule Découverte et passage au gérant."
      }
    ]
  },

  // 8. Client malhonnête / tentative de fraude
  {
    id: 'CAS_08_DISHONEST_PRETENDER',
    name: 'Client Malhonnête (Prétend avoir payé sans commande)',
    description: 'Le client prétend avoir déjà transféré l’argent ou exige de recevoir la chanson d’abord.',
    clientName: 'Kévin D.',
    phone: '+2250700112233',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Allô j'ai déjà envoyé 3 000 F par Wave ce matin sur votre compte. Envoyez-moi ma chanson d'anniversaire directement maintenant.",
        expectedGoal: "Rester poli et digne, expliquer que nous devons d'abord préparer et valider ses paroles personnalisées avant tout paiement."
      },
      {
        turnIndex: 2,
        clientInput: "Ah bon d'accord. C'est pour l'anniversaire de mon frère Franck le 20 décembre, de la part de Kévin.",
        expectedGoal: "Prendre en compte le brief normalement sans rancune et continuer le tunnel."
      },
      {
        turnIndex: 3,
        clientInput: "C'est un grand bosseur.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "J'ai écouté. Je prends la Prestige.",
        expectedGoal: "Confirmer la formule Prestige et passage au gérant."
      }
    ]
  },

  // 9. Client ultra-amical / cherche la connivence
  {
    id: 'CAS_09_OVERLY_FAMILIAR',
    name: 'Client Ultra-Familier ("Le Boss, la Famille")',
    description: 'Le client tutoie excessivement et cherche une familiarité de quartier.',
    clientName: 'Abou le Boss',
    phone: '+2250766554433',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Mon vieux père ! C'est comment là-bas la famille ? Le boss fais-moi un bon son en feu pour ma go là tu connais déjà non ?",
        expectedGoal: "Garder un vouvoiement chaleureux mais irréprochable et sobre, demander le prénom et l'occasion sans adopter d'argot déplacé."
      },
      {
        turnIndex: 2,
        clientInput: "Elle s'appelle Fatim, c'est pour son anniversaire le 25 décembre, de la part de son chéri Abou.",
        expectedGoal: "Noter les repères et demander une anecdote ou message."
      },
      {
        turnIndex: 3,
        clientInput: "Dis-lui que je l'aime trop et qu'elle est la reine de ma vie.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "C'est bien reçu le vocal boss. La formule Prestige à 3000 F.",
        expectedGoal: "Confirmer Prestige et passage au gérant en 15 min."
      }
    ]
  },

  // 10. Client qui envoie une référence audio / vidéo musicale
  {
    id: 'CAS_10_MUSIC_REFERENCE',
    name: 'Client avec Référence Musicale (Artiste / Rythme)',
    description: 'Le client envoie un son ou demande un style spécifique (comme Josey ou Didi B).',
    clientName: 'Clarisse N.',
    phone: '+2250144332211',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour, est-ce que vous pouvez faire un style acoustique doux un peu comme les chansons d'amour de Josey ?",
        expectedGoal: "Rassurer que le style acoustique doux est tout à fait faisable et demander l'occasion."
      },
      {
        turnIndex: 2,
        clientInput: "C'est pour le mariage de ma sœur Aïcha le 10 janvier, de la part de Clarisse.",
        expectedGoal: "Noter les repères et demander une anecdote/souvenir."
      },
      {
        turnIndex: 3,
        clientInput: "On a partagé toutes nos joies ensemble depuis l'enfance.",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "J'ai bien écouté. Formule Découverte 1200 F s'il vous plaît.",
        expectedGoal: "Confirmer Découverte et passage au gérant en 15 min."
      }
    ]
  },

  // 11. Client qui écrit un immense pavé de texte (300 mots)
  {
    id: 'CAS_11_HUGE_TEXT_BLOCK',
    name: 'Immense Pavé de Texte (Multi-Détails)',
    description: 'Le client déverse toute son histoire familiale d’un seul coup dans un long bloc.',
    clientName: 'Drissa Ouédraogo',
    phone: '+22676112233',
    country: "Burkina Faso (+226)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "Bonjour l'équipe Velaris. Je vous contacte car je souhaite rendre un hommage poignant à mon grand frère Ousmane Ouédraogo qui fête ses 40 ans ce 15 décembre. C'est moi Drissa son jeune frère qui organise cela. Ousmane a toujours été le pilier de notre famille depuis le décès de notre père en 2015 à Ouahigouya. Il s'est privé de tout pour financer mes études d'ingénieur et soutenir nos sœurs Mariam et Fati. Aujourd'hui il est marié, père de trois enfants magnifiques et continue de guider tout le monde avec sagesse et humilité. Je veux une chanson qui lui dise tout notre respect, notre gratitude infinie et que la famille sera toujours unie autour de lui.",
        expectedGoal: "Identifier tous les 4 repères d'un coup (Ousmane, 15 décembre, Drissa, sacrifices/Ouahigouya/études) et déclencher directement le vocal de procédure sans reposer de questions inutiles !"
      },
      {
        turnIndex: 2,
        clientInput: "C'est très clair, j'ai écouté le vocal avec attention.",
        expectedGoal: "Présenter les 2 formules Découverte et Prestige."
      },
      {
        turnIndex: 3,
        clientInput: "Je choisis la Prestige à 3000 F CFA avec la vidéo pour mettre nos photos de famille.",
        expectedGoal: "Confirmer la formule Prestige et passage au gérant en 15 min."
      }
    ]
  },

  // 12. Client au message confus / syntaxe très floue
  {
    id: 'CAS_12_BLURRY_CONFUSED_MSG',
    name: 'Message Confus / Syntaxe Floue',
    description: 'Le client envoie un message très haché sans grammaire claire.',
    clientName: 'Client Anonyme',
    phone: '+2250799887766',
    country: "Côte d'Ivoire (+225)",
    turns: [
      {
        turnIndex: 1,
        clientInput: "slt bjr chanson fete truc la pour lui quoi",
        expectedGoal: "Accueillir avec politesse et demander avec bienveillance pour quelle occasion et pour qui est prévue la chanson, sans formule robotique de reproche."
      },
      {
        turnIndex: 2,
        clientInput: "anniversaire de mon pote yacouba le 8 decembre de la part de jean",
        expectedGoal: "Capter Yacouba, 8 décembre, Jean, et demander son anecdote."
      },
      {
        turnIndex: 3,
        clientInput: "juste lui souhaiter longue vie",
        expectedGoal: "Déclencher le vocal de procédure."
      },
      {
        turnIndex: 4,
        clientInput: "ok vu",
        expectedGoal: "Présenter les formules Découverte et Prestige."
      },
      {
        turnIndex: 5,
        clientInput: "1200",
        expectedGoal: "Confirmer formule Découverte et passage au gérant en 15 min."
      }
    ]
  }
];

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

async function runHardcoreBenchmark() {
  const apiKey = loadApiKey();
  console.log(`🔑 Clé API Kie.ai chargée.`);
  console.log(`🚀 Démarrage du Grand Banc d'Essai des 12 Cas Limites Réels (DeepSeek Flash)...`);
  console.log(`================================================================================`);

  const provider = new DeepSeekProvider({
    apiKey,
    baseUrl: 'https://api.kie.ai',
  });

  const results: any[] = [];

  for (const sc of SCENARIOS) {
    console.log(`\n▶️  [${sc.id}] ${sc.name} (${sc.clientName} - ${sc.country})`);
    console.log(`    ℹ️  ${sc.description}`);

    const recentHistory: Array<{ who: 'client' | 'gérant' | 'studio'; text: string }> = [];
    let procedureVoiceReceived = false;
    let videoSampleReceived = false;
    let formulaChosen = false;

    const orders: OrderSnapshot[] = [
      {
        id: `ord_${sc.id}`,
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
    let scenarioViolations = 0;

    for (const t of sc.turns) {
      const clientMsg = t.clientInput;
      const tStart = Date.now();

      const input: SalesBrainInput = {
        turnText: clientMsg,
        recent: recentHistory,
        contact: {
          phone: sc.phone,
          name: sc.clientName,
          wa_jid: `${sc.phone.replace(/\D/g, '')}@c.us`,
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

      // Détection médico-légale des violations
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

      // V3: Faux positif vidéo démo si aucune demande explicite
      if (!t.clientInput.includes('exemple') && !t.clientInput.includes('extrait') && reply.videoSampleDue) {
        violations.push(`Faux positif vidéo démo`);
      }

      // V4: Nombre de questions (max 1)
      let qCount = 0;
      for (const b of reply.bubbles) {
        const matches = b.match(/\?/g);
        if (matches) qCount += matches.length;
      }
      if (qCount > 1) {
        violations.push(`Multiples questions (${qCount})`);
      }

      // V5: Tutoiement accidentel
      for (const b of reply.bubbles) {
        if (/\b(tu peux|tu as|tu veux|dis-moi|fais-moi|regarde)\b/i.test(b)) {
          violations.push(`Tutoiement détecté: "${b}"`);
        }
      }

      if (violations.length > 0) scenarioViolations++;

      // Mise à jour de l'état
      if (reply.procedureVoiceDue) procedureVoiceReceived = true;
      if (reply.videoSampleDue) videoSampleReceived = true;
      if (reply.formulaChosen) {
        formulaChosen = true;
        orders[0]!.catalogueCode = reply.chosenFormula as any;
      }

      // Ajout à l'historique
      recentHistory.push({ who: 'client', text: clientMsg });
      recentHistory.push({ who: 'studio', text: reply.bubbles.join('\n\n') });

      turnsLog.push({
        turnIndex: t.turnIndex,
        client: clientMsg,
        assistant: reply.bubbles,
        procedureVoiceDue: reply.procedureVoiceDue,
        videoSampleDue: reply.videoSampleDue,
        formulaChosen: reply.formulaChosen,
        chosenFormula: reply.chosenFormula,
        durationMs,
        violations,
      });

      console.log(`   Tour ${t.turnIndex} (${durationMs}ms) : ${violations.length === 0 ? '✅ Parfait' : '⚠️ ' + violations.join(', ')}`);
      for (const b of reply.bubbles) {
        console.log(`      🤖 "${b.replace(/\n/g, ' ')}"`);
      }
      if (reply.procedureVoiceDue) console.log(`      🎙️ [Vocal de procédure déclenché]`);
      if (reply.videoSampleDue) console.log(`      📹 [Vidéo démo déclenchée]`);
      if (reply.formulaChosen) console.log(`      🎉 [Formule choisie : ${reply.chosenFormula} -> Relais gérant]`);
    }

    results.push({
      scenarioId: sc.id,
      name: sc.name,
      turnsCount: sc.turns.length,
      clean: scenarioViolations === 0,
      violationsCount: scenarioViolations,
      turns: turnsLog,
    });
  }

  const cleanCount = results.filter(r => r.clean).length;
  const perfectionRate = ((cleanCount / results.length) * 100).toFixed(1);

  console.log(`\n================================================================================`);
  console.log(`📊 BILAN DU BANC D'ESSAI DES 12 CAS LIMITES :`);
  console.log(`   - Cas limites testés       : ${results.length}`);
  console.log(`   - Cas 100% parfaits        : ${cleanCount} / ${results.length} (${perfectionRate}%)`);
  console.log(`================================================================================`);

  writeFileSync(
    'benchmark_12_hardcore_report.json',
    JSON.stringify({ timestamp: new Date().toISOString(), perfectionRate, results }, null, 2),
    'utf8'
  );
  console.log(`📁 Rapport détaillé sauvegardé dans benchmark_12_hardcore_report.json`);
}

runHardcoreBenchmark().catch(err => {
  console.error("Erreur d'exécution du banc d'essai :", err);
  process.exit(1);
});
