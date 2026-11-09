/**
 * Moteur FSM Déterministe ZÉRO-REGEX pour le Simulateur WhatsApp Velaris
 * 
 * Conforme au Contrat d'Ingénierie IA (Règle 5 de /root/AGENTS.md) :
 * - Aucune regex d'intention, de prix ou d'extraction fragile.
 * - Réception d'un objet sémantique structuré (SemanticTurnExtraction).
 * - Machine à états mathématique avec verrous d'unicité matériels étanches.
 */

import type { SemanticTurnExtraction } from './semantic-extractor';

export interface BriefPillars {
  recipientName: string | null;
  occasion: string | null;
  senderName: string | null;
  storyAndMemories: string | null;
}

export type FsmStage =
  | 'GREETING'            // Nouveau contact, envoi du Vocal 1 (cadrage global)
  | 'COLLECTING_PILLARS'  // En attente ou recueil des 4 repères
  | 'VOCAL_2_DUE'         // Brief complet, envoi du Vocal 2 (33s procédure)
  | 'OFFER_PITCH'         // Présentation des 2 formules (1 200 F / 3 000 F)
  | 'DRAFTING_LYRICS'     // Rédaction des paroles
  | 'LYRICS_VALIDATION'   // Validation des paroles
  | 'PAYMENT_PENDING'     // Coordonnées Mobile Money envoyées
  | 'PAYMENT_VERIFYING'   // Reçu reçu, en attente de validation comptable
  | 'HUMAN_TAKEOVER';     // Commerçant aux commandes, IA en veille

export interface UniqueLocks {
  vocal1Sent: boolean;
  vocal2Sent: boolean;
  videoSampleSent: boolean;
  paymentBlockSent: boolean;
}

export interface SimulationState {
  stage: FsmStage;
  pillars: BriefPillars;
  locks: UniqueLocks;
  country: 'CI' | 'BF' | 'SN' | 'OTHER';
  clientProfile: 'new' | 'returning';
  selectedOffer: 'decouverte' | 'prestige' | null;
  isHumanTakeover: boolean;
  lastTurnAt: number;
}

export interface GeneratedTurnReply {
  bubbles: {
    content: string;
    mediaKind?: 'audio' | 'image' | 'sample' | 'video';
    mediaUrl?: string;
    mediaDurationSec?: number;
    isProcedureVoice?: boolean;
    isPaymentBlock?: boolean;
    isLyricsCard?: boolean;
    lyricsData?: {
      title?: string;
      lyrics?: string;
    };
  }[];
  presenceState: 'typing' | 'recording_audio';
  presenceDurationMs: number;
  interBubbleDelayMs: number;
  newState: SimulationState;
  fsmExplanation: string;
}

export function areAllPillarsComplete(p: BriefPillars): boolean {
  return Boolean(p.recipientName && p.occasion && p.senderName && p.storyAndMemories);
}

// ---------------------------------------------------------------------------
// Coordonnées de Paiement Officielles par Pays
// ---------------------------------------------------------------------------

export function getPaymentCoordinates(country: 'CI' | 'BF' | 'SN' | 'OTHER', offerLabel: string, priceXof: string): string {
  if (country === 'BF') {
    return `Coordonnées de validation Studio (${offerLabel} : ${priceXof} F CFA) :\n\n🇧🇫 Burkina Faso — Orange Money :\nNuméro : +226 05 77 73 08\nNom du compte : Wendyam Anicet junior Sekongo\n\nMerci de nous faire parvenir la capture d’écran du reçu de transfert dès l'envoi pour validation comptable.`;
  }
  if (country === 'CI') {
    return `Coordonnées de validation Studio (${offerLabel} : ${priceXof} F CFA) :\n\n🇨🇮 Côte d'Ivoire — Wave :\nNuméro : +226 05 77 73 08\nNom du compte : Sekongo Anicet\n\nMerci de nous transmettre la capture d'écran du reçu Wave dès confirmation.`;
  }
  // Diaspora / International
  return `Coordonnées de règlement sécurisé (${offerLabel} : ${priceXof} F CFA) :\n\n🌍 Règlement sécurisé par Carte Bancaire ou Wave International via notre guichet officiel :\nhttps://chansons-perso.mychariow.shop/digital-starter/checkout\n\nMerci de nous transmettre la capture de validation une fois le paiement effectué.`;
}

// ---------------------------------------------------------------------------
// Exécution Déterministe d'un Tour de FSM (100% ZÉRO-REGEX)
// ---------------------------------------------------------------------------

export function processSimulationTurn(
  inboundText: string,
  state: SimulationState,
  semantic: SemanticTurnExtraction,
  hasImageAttachment = false,
  imageType?: 'photo' | 'receipt'
): GeneratedTurnReply {
  let newState: SimulationState = {
    ...state,
    pillars: { ...state.pillars },
    locks: { ...state.locks },
    lastTurnAt: Date.now(),
  };

  // 0. SIGNAUX MARCHAND DE PRISE / REPRISE DE LA MAIN
  if (inboundText.includes('✨')) {
    newState.isHumanTakeover = false;
    return {
      bubbles: [
        {
          content: 'Bien reçu, je reprends la suite du dossier avec le client.',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 1200,
      interBubbleDelayMs: 800,
      newState,
      fsmExplanation: 'Signal ✨ reçu : Reprise immédiate du dossier par l’agent.',
    };
  }

  if (inboundText.includes('😊')) {
    newState.isHumanTakeover = false;
    newState.clientProfile = 'returning';
    newState.locks.vocal2Sent = true; // Ancien client ne reçoit jamais le vocal de procédure
    return {
      bubbles: [
        {
          content: 'Bien reçu. Dossier identifié comme client fidèle — procédure et vocal omis.',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 1200,
      interBubbleDelayMs: 800,
      newState,
      fsmExplanation: 'Signal 😊 reçu : Contact marqué Ancien Client, vocal de procédure désactivé.',
    };
  }

  // Si l'intervention humaine est active, silence strict
  if (newState.isHumanTakeover) {
    return {
      bubbles: [],
      presenceState: 'typing',
      presenceDurationMs: 500,
      interBubbleDelayMs: 0,
      newState,
      fsmExplanation: 'Conseiller humain aux commandes (fromMe). L’agent reste silencieux.',
    };
  }

  // 1. GESTION DES REÇUS ET PREUVES DE PAIEMENT
  if (hasImageAttachment && imageType === 'receipt' || semantic.isReceiptProof) {
    newState.stage = 'PAYMENT_VERIFYING';
    return {
      bubbles: [
        {
          content: 'Bien reçu votre confirmation de transfert. Notre service comptable vérifie la transaction et notre équipe musicale lance immédiatement l’enregistrement en studio.',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 2400,
      interBubbleDelayMs: 1000,
      newState,
      fsmExplanation: 'Preuve de paiement reçue ➔ Passage en validation comptable et lancement studio.',
    };
  }

  // 2. GESTION DES PHOTOS SOUVENIRS (MONTAGE VIDÉO)
  if (hasImageAttachment && imageType === 'photo') {
    return {
      bubbles: [
        {
          content: 'Bien reçu vos photos souvenirs. Elles sont précieusement conservées pour le montage de votre vidéo.',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 2000,
      interBubbleDelayMs: 1000,
      newState,
      fsmExplanation: 'Photos pour montage vidéo reçues et sécurisées.',
    };
  }

  // 3. DEMANDE D’EXEMPLE / EXTRAIT VIDÉO
  if (semantic.wantsVideoDemo && !newState.locks.videoSampleSent) {
    newState.locks.videoSampleSent = true;
    return {
      bubbles: [
        {
          content: 'Voici un aperçu du montage vidéo avec photos souvenirs :',
          mediaKind: 'video',
          mediaUrl: '/assets/montage_sample.mp4',
        },
        {
          content: newState.pillars.recipientName
            ? `C’est ce même niveau de finition qui sera appliqué pour ${newState.pillars.recipientName}. Souhaitez-vous partir sur cette formule à 3 000 F CFA ?`
            : 'Pour commencer la composition de vos paroles, quel est le prénom de la personne à célébrer ?',
        },
      ],
      presenceState: 'recording_audio',
      presenceDurationMs: 2800,
      interBubbleDelayMs: 1200,
      newState,
      fsmExplanation: 'Demande d’aperçu vidéo ➔ Envoi de l’extrait montage_sample.mp4 avec pont conversationnel.',
    };
  }

  // 4. DEMANDE DE TARIFS
  if (semantic.asksPricing && newState.stage !== 'OFFER_PITCH') {
    const priceText = 'Nous proposons deux formules pour la création de votre chanson :\n— La formule Découverte à 1 200 F CFA : la chanson personnalisée complète livrée en 2 versions audio HD.\n— La formule Prestige à 3 000 F CFA : la chanson complète accompagnée de son montage vidéo personnalisé avec vos photos.';
    
    // Pont vers le brief en cours
    const nextQuestion = !newState.pillars.occasion
      ? 'Pour quel événement ou quelle occasion souhaitez-vous offrir cette chanson ?'
      : !newState.pillars.recipientName
      ? 'Quel est le prénom de la personne que vous souhaitez célébrer ?'
      : 'Quel message ou anecdotes aimeriez-vous faire passer dans les paroles ?';

    return {
      bubbles: [
        { content: priceText },
        { content: nextQuestion },
      ],
      presenceState: 'typing',
      presenceDurationMs: 3200,
      interBubbleDelayMs: 1200,
      newState,
      fsmExplanation: 'Demande de tarif ➔ Présentation transparente des 2 prix + relance du brief en cours.',
    };
  }

  // 5. CHOIX DE FORMULE (DÉCOUVERTE OU PRESTIGE)
  if (semantic.formulaChoice === 'decouverte' && newState.selectedOffer !== 'decouverte') {
    newState.selectedOffer = 'decouverte';
    newState.stage = 'DRAFTING_LYRICS';
    return {
      bubbles: [
        {
          content: 'C’est bien noté pour la formule Découverte à 1 200 F CFA.',
        },
        {
          content: 'Notre équipe studio commence la rédaction de vos paroles. Votre texte vous sera envoyé ici dans un délai de 15 minutes pour votre validation.',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 2800,
      interBubbleDelayMs: 1200,
      newState,
      fsmExplanation: 'Choix formule Découverte (1 200 F) validé sémantiquement ➔ Engagement du délai de rédaction (15 minutes).',
    };
  }

  if (semantic.formulaChoice === 'prestige' && newState.selectedOffer !== 'prestige') {
    newState.selectedOffer = 'prestige';
    newState.stage = 'DRAFTING_LYRICS';
    return {
      bubbles: [
        {
          content: 'C’est bien noté pour la formule Prestige à 3 000 F CFA avec la vidéo souvenir.',
        },
        {
          content: 'Notre équipe studio commence la rédaction de vos paroles. Votre texte vous sera envoyé ici dans un délai de 15 minutes pour validation. Vous pourrez ensuite nous transmettre les photos pour le montage.',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 2800,
      interBubbleDelayMs: 1200,
      newState,
      fsmExplanation: 'Choix formule Prestige (3 000 F) validé sémantiquement ➔ Rédaction en cours, photos annoncées post-validation.',
    };
  }

  // 6. VALIDATION DES PAROLES ➔ TRANSMISSION DES COORDONNÉES DE PAIEMENT
  if (semantic.lyricsFeedback === 'approved' && (newState.stage === 'LYRICS_VALIDATION' || newState.stage === 'DRAFTING_LYRICS' || newState.selectedOffer !== null)) {
    newState.stage = 'PAYMENT_PENDING';
    newState.locks.paymentBlockSent = true;
    const offerLabel = newState.selectedOffer === 'prestige' ? 'Formule Prestige avec Vidéo' : 'Formule Découverte';
    const priceStr = newState.selectedOffer === 'prestige' ? '3 000' : '1 200';
    const paymentText = getPaymentCoordinates(newState.country, offerLabel, priceStr);

    return {
      bubbles: [
        {
          content: 'Ravi que le texte vous plaise autant ! Nous passons à l’étape du règlement pour lancer l’enregistrement musical en studio.',
        },
        {
          content: paymentText,
          isPaymentBlock: true,
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 3400,
      interBubbleDelayMs: 1400,
      newState,
      fsmExplanation: 'Validation sémantique des paroles par le client ➔ Déclenchement des coordonnées de règlement selon l’indicatif.',
    };
  }

  // 7. PRÉSENTATION DES PAROLES RÉDIGÉES
  if (newState.stage === 'DRAFTING_LYRICS') {
    newState.stage = 'LYRICS_VALIDATION';
    const recipient = newState.pillars.recipientName || 'votre proche';
    const occasion = newState.pillars.occasion || 'cet événement précieux';
    const sender = newState.pillars.senderName ? `de la part de ${newState.pillars.senderName}` : '';
    const anecdote = newState.pillars.storyAndMemories ? `— ${newState.pillars.storyAndMemories}` : '';

    const proposal = `Voici la proposition de texte composée par notre studio pour ${recipient} (${occasion}) :\n\n[Couplet 1]\nDans le secret des jours et la douceur du temps,\nTon sourire éclaire nos vies à chaque instant.\nUn cœur si généreux, une présence si précieuse,\nQue cette mélodie te rende l'âme heureuse.\n\n[Refrain]\nJoyeux ${occasion} pour toi, ${recipient},\nCes mots gravés d'amour te sont dédiés ${sender}.\nQue la paix et la joie t'accompagnent pour toujours,\nAu rythme de nos cœurs et de nos plus beaux jours.\n\n[Couplet 2]\n${anecdote || 'Que la grâce divine veille sur tes pas,\nEt que chaque prière veille sur toi.'}\n\nDites-nous si ces paroles vous touchent ou si vous souhaitez ajuster un passage avant l’enregistrement en studio ?`;

    return {
      bubbles: [{ content: proposal }],
      presenceState: 'typing',
      presenceDurationMs: 3200,
      interBubbleDelayMs: 1200,
      newState,
      fsmExplanation: 'Paroles rédigées et soumises au client pour validation avant enregistrement studio.',
    };
  }

  // 8. MISE À JOUR DES 4 INVARIANTS DU BRIEF (SÉMANTIQUE PURE)
  if (semantic.recipientName && !newState.pillars.recipientName) {
    newState.pillars.recipientName = semantic.recipientName;
  }
  if (semantic.occasion && !newState.pillars.occasion) {
    newState.pillars.occasion = semantic.occasion;
  }
  if (semantic.senderName && !newState.pillars.senderName) {
    newState.pillars.senderName = semantic.senderName;
  }
  if (semantic.storyAndMemories && !newState.pillars.storyAndMemories) {
    newState.pillars.storyAndMemories = semantic.storyAndMemories;
  }

  const allComplete = areAllPillarsComplete(newState.pillars);

  // 9. BRIEF COMPLET & VOCAL 2 PAS ENCORE ENVOYÉ ➔ ENVOI DU VOCAL 2 (33S)
  if (allComplete && !newState.locks.vocal2Sent && newState.clientProfile === 'new') {
    newState.locks.vocal2Sent = true;
    newState.stage = 'VOCAL_2_DUE';

    return {
      bubbles: [
        {
          content: `C'est bien noté pour ${newState.pillars.recipientName}. Nous avons tous les éléments nécessaires.`,
        },
        {
          content: 'Voici une courte note vocale expliquant notre démarche de création :',
          mediaKind: 'audio',
          mediaUrl: '/assets/procedure_voice.ogg',
          mediaDurationSec: 33,
          isProcedureVoice: true,
        },
      ],
      presenceState: 'recording_audio',
      presenceDurationMs: 3800,
      interBubbleDelayMs: 1400,
      newState,
      fsmExplanation: 'Les 4 invariants sont validés ➔ Déclenchement automatique du Vocal 2 de procédure (33s OGG WhatsApp natif).',
    };
  }

  // 10. CLIENT EN ÉTAPE VOCAL_2_DUE ➔ PRÉSENTATION DES OFFRES
  if (newState.locks.vocal2Sent && newState.stage === 'VOCAL_2_DUE') {
    newState.stage = 'OFFER_PITCH';
    return {
      bubbles: [
        {
          content: 'Parfait ! Pour donner vie à cette chanson, nous proposons deux formules :\n\n— Formule Découverte (1 200 F CFA) : la chanson personnalisée complète prête en 18 minutes, avec 2 versions musicales au choix.\n\n— Formule Prestige (3 000 F CFA) : la chanson personnalisée complète accompagnée de son montage vidéo souvenir synchronisé avec vos photos.\n\nQuelle formule souhaitez-vous retenir pour célébrer cette occasion ?',
        },
      ],
      presenceState: 'typing',
      presenceDurationMs: 3600,
      interBubbleDelayMs: 1200,
      newState,
      fsmExplanation: 'Vocal 2 assimilé ➔ Présentation claire des 2 offres Découverte (1 200 F) et Prestige (3 000 F).',
    };
  }

  // 11. VOCAL 1 : PREMIER CONTACT D'UN NOUVEAU CLIENT
  if (!newState.locks.vocal1Sent && newState.clientProfile === 'new') {
    newState.locks.vocal1Sent = true;
    newState.stage = 'COLLECTING_PILLARS';

    const hasAnyPillar = Boolean(newState.pillars.recipientName || newState.pillars.occasion);
    let vocal1Text = '';
    if (hasAnyPillar) {
      const ackParts: string[] = [];
      if (newState.pillars.recipientName) ackParts.push(`pour ${newState.pillars.recipientName}`);
      if (newState.pillars.occasion) ackParts.push(`à l'occasion de son ${newState.pillars.occasion.toLowerCase()}`);
      vocal1Text = `Bonjour et bienvenue au Studio Velaris ! C’est un magnifique projet ${ackParts.join(' ')}.\n\nPour que notre équipe compose sa chanson sur-mesure, il nous manque juste quelques précisions :\n`;
      if (!newState.pillars.senderName) vocal1Text += `— De la part de qui est offert ce beau cadeau ?\n`;
      if (!newState.pillars.storyAndMemories) vocal1Text += `— Avez-vous de petits souvenirs, anecdotes ou mots doux à glisser dans les paroles ?\n`;
      vocal1Text += `\nVous pouvez nous expliquer cela par message ou par note vocale selon ce qui est le plus confortable pour vous !`;
    } else {
      vocal1Text = "Bonjour et bienvenue au Studio Velaris ! Pour composer une chanson sur-mesure d'exception, nous avons simplement besoin de connaître :\n1. Le prénom de la personne à célébrer\n2. L'occasion ou la date de l'événement\n3. De la part de qui est offert ce cadeau\n4. Vos anecdotes, souvenirs ou mots doux à glisser dans les paroles.\n\nVous pouvez nous expliquer tout cela d'un coup, par message texte ou par note vocale selon ce qui est le plus confortable pour vous !";
    }

    return {
      bubbles: [
        {
          content: vocal1Text,
          mediaKind: 'audio',
          mediaDurationSec: 24,
          mediaUrl: '/assets/vocal_1_accueil.ogg',
        },
      ],
      presenceState: 'recording_audio',
      presenceDurationMs: 4200,
      interBubbleDelayMs: 1000,
      newState,
      fsmExplanation: 'Premier contact client ➔ Envoi du Vocal 1 de cadrage adapté aux éléments sémantiques reçus.',
    };
  }

  // 12. RELANCE CIBLÉE SUR LE SEUL INVARIANT MANQUANT
  newState.stage = 'COLLECTING_PILLARS';
  let missingPrompt = '';
  if (!newState.pillars.recipientName) {
    missingPrompt = 'Quel est le prénom de la personne à qui vous souhaitez dédier cette chanson ?';
  } else if (!newState.pillars.occasion) {
    missingPrompt = `C’est bien noté pour ${newState.pillars.recipientName}. Pour quelle occasion ou à quelle date est prévue cette célébration ?`;
  } else if (!newState.pillars.senderName) {
    missingPrompt = `C’est bien noté pour ${newState.pillars.recipientName}. Et de la part de qui est offert ce beau cadeau ?`;
  } else if (!newState.pillars.storyAndMemories) {
    missingPrompt = 'Avez-vous des anecdotes, des souvenirs particuliers ou un message à lui transmettre dans les paroles ? (Si vous n’avez pas d’idée précise, notre équipe se chargera de composer de très belles paroles).';
  }

  return {
    bubbles: [{ content: missingPrompt }],
    presenceState: 'typing',
    presenceDurationMs: 2500,
    interBubbleDelayMs: 1000,
    newState,
    fsmExplanation: `Brief partiel (${[
      newState.pillars.recipientName ? 'Prénom OK' : 'Prénom manquant',
      newState.pillars.occasion ? 'Occasion OK' : 'Occasion manquante',
      newState.pillars.senderName ? 'Expéditeur OK' : 'Expéditeur manquant',
      newState.pillars.storyAndMemories ? 'Histoire OK' : 'Histoire manquante',
    ].join(' • ')}) ➔ Question unique ciblée sans répétition.`,
  };
}
