/**
 * Moteur FSM Déterministe pour le Simulateur WhatsApp Velaris
 * Implémente le protocole officiel des 2 vocaux, les 4 invariants,
 * les verrous matériels d'unicité et le séquençage réaliste des bulles.
 */

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

// ---------------------------------------------------------------------------
// Détection déterministe d'intentions et extraction des 4 repères
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function cleanExtractedName(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^[,\.\-;:\s]+|[,\.\-;:\s]+$/g, '');
  s = s.replace(/^(?:c'est|il s'appelle|elle s'appelle|son prenom c'est|son nom c'est|prenom|nom|le|la|mon|ma|pour|offert|offerte|de)\s+/i, '');
  s = s.replace(/\s+(?:offert|offerte|de|pour)$/i, '');
  s = s.trim();
  const stopWords = ['qui', 'quoi', 'son', 'sa', 'ses', 'lui', 'elle', 'mon', 'ma', 'mes', 'un', 'une', 'des', 'le', 'la', 'les', 'pour', 'chanson', 'studio', 'bonjour', 'merci', 'oui', 'non', 'ok', 'offert', 'offerte', 'de'];
  if (stopWords.includes(s.toLowerCase())) return null;
  if (s.length < 2) return null;
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function extractPillarsFromText(rawText: string, current: BriefPillars): BriefPillars {
  // Remplacer apostrophes courbes par apostrophes droites pour uniformité
  const text = rawText.replace(/[\u2018\u2019]/g, "'");
  const norm = normalizeText(text);
  const updated: BriefPillars = { ...current };

  // 1. Détection de l'Occasion
  if (!updated.occasion) {
    if (norm.includes('anniversaire') || norm.includes('anniv') || norm.includes('aniv') || /\b(?:\d{1,2}|ans)\s*(?:ans|bougies)\b/i.test(text)) {
      updated.occasion = 'Anniversaire';
    } else if (norm.includes('mariage') || norm.includes('dote') || norm.includes('dot') || norm.includes('fiancaille')) {
      updated.occasion = 'Mariage';
    } else if (norm.includes('deuil') || norm.includes('hommage') || norm.includes('decede') || norm.includes('obseques') || norm.includes('deces') || norm.includes('enterrement')) {
      updated.occasion = 'Hommage / Deuil';
    } else if (norm.includes('amour') || norm.includes('saint valentin') || norm.includes('reconciliation') || norm.includes('je t aime') || norm.includes('pardon')) {
      updated.occasion = 'Déclaration d’amour';
    } else if (norm.includes('bapteme') || norm.includes('naissance') || norm.includes('bebe')) {
      updated.occasion = 'Baptême / Naissance';
    } else if (norm.includes('diplome') || norm.includes('soutenance') || norm.includes('reussite') || norm.includes('bac') || norm.includes('licence') || norm.includes('master')) {
      updated.occasion = 'Félicitations / Diplôme';
    } else if (norm.includes('merci') || norm.includes('remerciement') || norm.includes('gratitude')) {
      updated.occasion = 'Remerciement';
    }
  }

  // 2. Détection de l'Expéditeur
  const senderPattern = /(?:c'est de la part de\s+|c'est de la part d'|de la part de\s+|de la part d'|offert par\s+|et moi c'est\s+|moi c'est\s+|mon prenom c'est\s+|mon nom c'est\s+|signe\s+|et moi\s+|par\s+)([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i;
  const matchSender = text.match(senderPattern);
  if (matchSender && matchSender[1]) {
    const s = cleanExtractedName(matchSender[1]);
    if (s && !['qui', 'quoi', 'son', 'sa', 'lui'].includes(s.toLowerCase())) {
      if (!updated.senderName) updated.senderName = s;
    }
  } else if (!updated.senderName && (norm.includes('de ma part') || norm.includes('de moi') || norm.includes('c est moi'))) {
    updated.senderName = 'Le client';
  }

  // 3. Préparation du texte pour le Destinataire (on retire la clause expéditeur pour éviter toute confusion)
  let textForRecipient = text;
  if (matchSender && matchSender[0]) {
    textForRecipient = textForRecipient.replace(matchSender[0], ' ');
  }

  // 4. Détection du Destinataire
  if (!updated.recipientName) {
    const matchRelative = textForRecipient.match(/(?:mon mari|mon homme|mon époux|mon conjoint)\s+([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i);
    const matchWife = textForRecipient.match(/(?:ma femme|mon épouse|ma chérie|ma conjointe)\s+([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i);
    const matchMother = textForRecipient.match(/(?:ma mère|ma maman|maman)\s+([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i);
    const matchFather = textForRecipient.match(/(?:mon père|mon papa|papa)\s+([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i);
    const matchOtherRel = textForRecipient.match(/(?:mon ami|mon amie|mon frère|ma sœur|mon fils|ma fille|mon bébé|mon amour)\s+([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i);

    if (matchRelative && matchRelative[1]) {
      const c = cleanExtractedName(matchRelative[1]);
      if (c) updated.recipientName = `Son mari ${c}`;
    } else if (matchWife && matchWife[1]) {
      const c = cleanExtractedName(matchWife[1]);
      if (c) updated.recipientName = `Sa femme ${c}`;
    } else if (matchMother && matchMother[1]) {
      const c = cleanExtractedName(matchMother[1]);
      if (c) updated.recipientName = `Sa maman ${c}`;
    } else if (matchFather && matchFather[1]) {
      const c = cleanExtractedName(matchFather[1]);
      if (c) updated.recipientName = `Son papa ${c}`;
    } else if (matchOtherRel && matchOtherRel[1]) {
      const c = cleanExtractedName(matchOtherRel[1]);
      if (c) updated.recipientName = c;
    } else {
      const matchFor = textForRecipient.match(/(?:pour|célébrer|honorer|offrir à|dédié à|dédiée à|destiné à|destinée à|il s'appelle|elle s'appelle|son prénom c'est|son nom c'est|nommé|nommée)\s+([A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+)?)/i);
      if (matchFor && matchFor[1]) {
        const c = cleanExtractedName(matchFor[1]);
        if (c && c !== updated.senderName) updated.recipientName = c;
      } else if (norm.includes('pour moi') || norm.includes('mon propre') || norm.includes('pour moi-même')) {
        updated.recipientName = 'Le client lui-même';
      } else {
        // Phrase courte ou prénom direct (ex: "Alassane", "C'est Alassane", "Alassane Traoré")
        let stripped = textForRecipient;
        stripped = stripped.replace(/(?:pour\s+son\s+anniversaire|anniversaire|mariage|pour\s+ce\s+samedi|samedi|dimanche)/gi, ' ');
        stripped = stripped.replace(/^(?:c'est|il s'appelle|elle s'appelle|prenom|nom|pour)\s+/i, ' ');
        stripped = stripped.replace(/[,;\.\-\/]/g, ' ').trim();

        const words = stripped
          .split(/\s+/)
          .filter((w) => w.length > 1 && !['et', 'de', 'la', 'part', 'pour', 'offert', 'moi', 'cest', "c'est"].includes(w.toLowerCase()));
        if (words.length >= 1 && words.length <= 3) {
          const candidate = cleanExtractedName(words.join(' '));
          if (candidate && candidate !== updated.senderName) {
            updated.recipientName = candidate;
          }
        }
      }
    }
  }

  // 5. Détection de l'Âme des Paroles / Anecdotes / Carte blanche
  if (!updated.storyAndMemories) {
    if (
      norm.includes('anecdote') ||
      norm.includes('souvenir') ||
      norm.includes('rencontre') ||
      norm.includes('qualite') ||
      norm.includes('homme genereux') ||
      norm.includes('toujours la') ||
      norm.includes('gentil') ||
      norm.includes('aimant') ||
      norm.includes('courageuse') ||
      norm.includes('pas danecdote') ||
      norm.includes('pas d’anecdote') ||
      norm.includes('rien de special') ||
      norm.includes('rien a ajouter') ||
      norm.includes('aucune anecdote') ||
      norm.includes('pas grand chose') ||
      norm.includes('vous avez carte blanche') ||
      norm.includes('carte blanche') ||
      norm.includes('laisse libre') ||
      norm.includes('faites de belles paroles') ||
      norm.includes('faites comme vous voulez') ||
      norm.includes('je vous fais confiance') ||
      norm.includes('inspirez-vous') ||
      norm.includes('inspirez vous') ||
      norm.includes('pas d idee') ||
      norm.includes('pas d’idee')
    ) {
      updated.storyAndMemories = text.length > 25 ? text.slice(0, 150) : 'Carte blanche confiée au Studio';
    } else if (text.length > 80 && (updated.recipientName || updated.occasion)) {
      updated.storyAndMemories = text.slice(0, 150) + '...';
    }
  }

  return updated;
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
// Exécution d'un tour de FSM
// ---------------------------------------------------------------------------

export function processSimulationTurn(
  inboundText: string,
  state: SimulationState,
  hasImageAttachment = false,
  imageType?: 'photo' | 'receipt'
): GeneratedTurnReply {
  const norm = normalizeText(inboundText);
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

  // 1. GESTION DES REÇUS ET IMAGES
  if (hasImageAttachment || imageType === 'receipt' || norm.includes('reçu') || norm.includes('recu') || norm.includes('capture de paiement')) {
    if (imageType === 'receipt' || norm.includes('recu') || norm.includes('reçu') || norm.includes('transfert')) {
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
        fsmExplanation: 'Reçu de paiement détecté ➔ Passage en attente de validation comptable et lancement studio.',
      };
    }

    if (imageType === 'photo' || norm.includes('photo') || norm.includes('voici les photos')) {
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
        fsmExplanation: 'Photos de montage vidéo reçues et sécurisées.',
      };
    }
  }

  // 2. DEMANDE D’EXEMPLE / EXTRAIT VIDÉO
  if (
    (norm.includes('video') || norm.includes('montage') || norm.includes('exemple') || norm.includes('apercu') || norm.includes('voir')) &&
    (norm.includes('montre') || norm.includes('comment') || norm.includes('ressemble') || norm.includes('extrait') || norm.includes('apercu')) &&
    !newState.locks.videoSampleSent
  ) {
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

  // 3. DEMANDE DE TARIFS EN COURS DE ROUTE
  if (norm.includes('combien') || norm.includes('prix') || norm.includes('tarif') || norm.includes('coute')) {
    const priceText = 'Nous proposons deux formules pour la création de votre chanson :\n— La formule Découverte à 1 200 F CFA : la chanson personnalisée complète livrée en 2 versions audio HD.\n— La formule Prestige à 3 000 F CFA : la chanson complète accompagnée de son montage vidéo personnalisé avec vos photos.';
    
    // Pont vers le brief
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
      fsmExplanation: 'Question tarifaire ➔ Présentation transparente des prix + pont immédiat vers le recueil du brief.',
    };
  }

  // 4. CHOIX DE FORMULE (1 200 F ou 3 000 F)
  if (norm.includes('1 200') || norm.includes('1200') || norm.includes('decouverte')) {
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
      fsmExplanation: 'Choix formule Découverte (1 200 F) validé ➔ Engagement du délai de rédaction (15 minutes).',
    };
  }

  if (norm.includes('3 000') || norm.includes('3000') || norm.includes('prestige') || norm.includes('video')) {
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
      fsmExplanation: 'Choix formule Prestige (3 000 F) validé ➔ Rédaction en cours, photos annoncées post-validation.',
    };
  }

  // 4b. PRÉSENTATION DES PAROLES RÉDIGÉES (PASSAGE EN LYRICS_VALIDATION)
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

  // 5. VALIDATION DU TEXTE (LIVRAISON DES COORDONNÉES DE PAIEMENT)
  if (
    (norm.includes('valide') ||
      norm.includes('parfait') ||
      norm.includes('magnifique') ||
      norm.includes('j aime') ||
      norm.includes('tres beau') ||
      norm.includes('c est bon') ||
      norm.includes('daccord pour le texte') ||
      norm.includes('enregistrez')) &&
    (newState.stage === 'LYRICS_VALIDATION' || newState.selectedOffer !== null)
  ) {
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
      fsmExplanation: 'Validation des paroles par le client ➔ Déclenchement déterministe des coordonnées de paiement selon l’indicatif pays.',
    };
  }

  // 6. EXTRACTION DES 4 INVARIANTS DU BRIEF
  const updatedPillars = extractPillarsFromText(inboundText, newState.pillars);
  newState.pillars = updatedPillars;
  const allComplete = areAllPillarsComplete(updatedPillars);

  // 7. SI BRIEF COMPLET ET VOCAL 2 PAS ENCORE ENVOYÉ ➔ ENVOI DU VOCAL 2 (33S)
  if (allComplete && !newState.locks.vocal2Sent && newState.clientProfile === 'new') {
    newState.locks.vocal2Sent = true;
    newState.stage = 'VOCAL_2_DUE';

    return {
      bubbles: [
        {
          content: `C'est bien noté pour ${updatedPillars.recipientName}. Nous avons tous les éléments nécessaires.`,
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
      fsmExplanation: 'Les 4 invariants sont complets ➔ Déclenchement automatique du Vocal 2 de procédure (33s OGG WhatsApp natif).',
    };
  }

  // Si le client répond au Vocal 2 (ou après sa diffusion), on présente les offres (strictement en étape VOCAL_2_DUE)
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

  // 8. VOCAL 1 : PREMIER CONTACT D'UN NOUVEAU CLIENT
  if (!newState.locks.vocal1Sent && newState.clientProfile === 'new') {
    newState.locks.vocal1Sent = true;
    newState.stage = 'COLLECTING_PILLARS';

    const hasAnyPillar = Boolean(updatedPillars.recipientName || updatedPillars.occasion);
    let vocal1Text = '';
    if (hasAnyPillar) {
      const ackParts: string[] = [];
      if (updatedPillars.recipientName) ackParts.push(`pour ${updatedPillars.recipientName}`);
      if (updatedPillars.occasion) ackParts.push(`à l'occasion de son ${updatedPillars.occasion.toLowerCase()}`);
      vocal1Text = `Bonjour et bienvenue au Studio Velaris ! C’est un magnifique projet ${ackParts.join(' ')}.\n\nPour que notre équipe compose sa chanson sur-mesure, il nous manque juste quelques précisions :\n`;
      if (!updatedPillars.senderName) vocal1Text += `— De la part de qui est offert ce beau cadeau ?\n`;
      if (!updatedPillars.storyAndMemories) vocal1Text += `— Avez-vous de petits souvenirs, anecdotes ou mots doux à glisser dans les paroles ?\n`;
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
      fsmExplanation: 'Premier contact client ➔ Envoi du Vocal 1 de cadrage global adapté aux éléments reçus.',
    };
  }

  // 9. RELANCE CIBLÉE SUR L'INVARIANT MANQUANT
  newState.stage = 'COLLECTING_PILLARS';
  let missingPrompt = '';
  if (!updatedPillars.recipientName) {
    missingPrompt = 'Quel est le prénom de la personne à qui vous souhaitez dédier cette chanson ?';
  } else if (!updatedPillars.occasion) {
    missingPrompt = `C’est bien noté pour ${updatedPillars.recipientName}. Pour quelle occasion ou à quelle date est prévue cette célébration ?`;
  } else if (!updatedPillars.senderName) {
    missingPrompt = `C’est bien noté pour ${updatedPillars.recipientName}. Et de la part de qui est offert ce beau cadeau ?`;
  } else if (!updatedPillars.storyAndMemories) {
    missingPrompt = 'Avez-vous des anecdotes, des souvenirs particuliers ou un message à lui transmettre dans les paroles ? (Si vous n’avez pas d’idée précise, notre équipe se chargera de composer de très belles paroles).';
  }

  return {
    bubbles: [{ content: missingPrompt }],
    presenceState: 'typing',
    presenceDurationMs: 2500,
    interBubbleDelayMs: 1000,
    newState,
    fsmExplanation: `Brief partiel (${[
      updatedPillars.recipientName ? 'Prénom OK' : 'Prénom manquant',
      updatedPillars.occasion ? 'Occasion OK' : 'Occasion manquante',
      updatedPillars.senderName ? 'Expéditeur OK' : 'Expéditeur manquant',
      updatedPillars.storyAndMemories ? 'Histoire OK' : 'Histoire manquante',
    ].join(' • ')}) ➔ Question unique ciblée.`,
  };
}
