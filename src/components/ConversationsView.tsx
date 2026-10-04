import { useEffect, useMemo, useRef, useState, type CSSProperties, type FC, type MouseEvent } from 'react';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MailOpen,
  MessageCircle,
  Mic,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Video,
  WandSparkles,
  X,
  type LucideIcon
} from 'lucide-react';
import type { ConversationItem } from '../types';
import {
  REAL_CONVERSATIONS,
  REAL_CONVERSATION_MESSAGES
} from '../data/realProductionData';
import {
  WAHA_CONFIG,
  fetchWahaMessageAcks,
  markWahaChatSeen,
  setWahaChatArchived,
  sendWahaTextMessage,
  sendWahaVoiceMessage,
  sendWahaFileMessage,
  wahaSessionNameFor,
  type WahaAck,
  type WahaLinkState
} from '../services/waha';
import { useAuth } from '../hooks/useAuth';
import { useStudioLive } from '../hooks/useStudioLive';
import { useWahaHeartbeat } from '../hooks/useWaha';
import {
  getLiveConversations,
  getLiveMessages,
  recordDirectPayment,
  recordOutboundMessage,
  updateConversationArchiveStatus,
  updateConversationReadStatus
} from '../services/supabase';
import { applyReadState, setConversationUnread, setConversationArchived, useReadState } from '../services/readState';
import { generateHouseStyleSong } from '../services/lyricsCorpus';
import { WaveformPlayer } from './WaveformPlayer';
import { VoiceNoteRecorder, type VoiceRecording } from './VoiceNoteRecorder';

interface ConversationsViewProps {
  onOpenOrderForStudio?: (name: string) => void;
}

type InboxSection = 'discussions' | 'archived';


/* Les notes vocales arrivent préfixées d'un micro dans les données WAHA */
const VOICE_PREFIX = /^\s*\u{1F399}\u{FE0F}?\s*/u;
const isVoice = (body?: string) => !!body && VOICE_PREFIX.test(body);
const stripVoice = (body: string) => body.replace(VOICE_PREFIX, '');

const initials = (name: string) => {
  const clean = name.normalize('NFKD').replace(/[^\p{L}\s]/gu, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '#';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
};

/* '30 sept. 10:38' : même format pour l'historique démo, Supabase et les envois locaux */
const stampOf = (d: Date) =>
  `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
const dayOf = (createdAt: string) => createdAt.replace(/,?\s*\d{1,2}:\d{2}$/, '').trim();
const timeOf = (createdAt: string) => createdAt.match(/\d{1,2}:\d{2}$/)?.[0] ?? createdAt;

const Monogram: FC<{ name: string; unread?: boolean; size?: 'sm' | 'md' }> = ({ name, unread, size = 'md' }) => (
  <span
    className={`relative flex shrink-0 items-center justify-center rounded-full border font-heading font-semibold tracking-tight ${
      size === 'sm' ? 'h-9 w-9 text-[12.5px]' : 'h-10 w-10 text-[13px]'
    } ${unread ? 'border-[#E5B54F]/50 bg-[#E5B54F]/[0.08] text-[#F1DDB4]' : 'border-white/[0.12] bg-white/[0.03] text-neutral-300'}`}
  >
    {initials(name)}
    {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0B0C10] bg-emerald-400" />}
  </span>
);

/* ------------------------------------------------------------------ */
/* Accusés de lecture WhatsApp                                        */
/* ------------------------------------------------------------------ */

type ReceiptState = 'pending' | 'sent' | 'delivered' | 'read' | 'played' | 'failed';

const RECEIPT_FROM_ACK: Record<WahaAck, ReceiptState> = { [-1]: 'failed', 0: 'pending', 1: 'sent', 2: 'delivered', 3: 'read', 4: 'played' };
const RECEIPT_RANK: Record<ReceiptState, number> = { failed: -1, pending: 0, sent: 1, delivered: 2, read: 3, played: 4 };

const RECEIPT_LABEL: Record<ReceiptState, string> = {
  pending: 'En cours d’envoi',
  sent: 'Envoyé',
  delivered: 'Remis',
  read: 'Lu',
  played: 'Écouté',
  failed: 'Échec de l’envoi',
};

const Ticks: FC<{ receipt: ReceiptState }> = ({ receipt }) => {
  const label = RECEIPT_LABEL[receipt];
  const common = 'h-3.5 w-3.5 shrink-0';
  const icon =
    receipt === 'pending' ? <Clock3 className={`${common} text-neutral-400`} strokeWidth={2} />
    : receipt === 'sent' ? <Check className={`${common} text-neutral-400`} strokeWidth={2.2} />
    : receipt === 'delivered' ? <CheckCheck className={`${common} text-neutral-400`} strokeWidth={2.2} />
    : receipt === 'failed' ? <AlertCircle className={`${common} text-rose-500`} strokeWidth={2} />
    : <CheckCheck className={`${common} text-sky-500`} strokeWidth={2.2} />;
  return (
    <span title={label} className="inline-flex">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* État du flux WAHA                                                  */
/* ------------------------------------------------------------------ */

const LINK_META: Record<WahaLinkState, { label: string; dot: string }> = {
  connecting: { label: 'Connexion au flux', dot: 'bg-neutral-500' },
  online: { label: 'Flux WhatsApp actif', dot: 'bg-emerald-400 vx-breathe' },
  scan: { label: 'Scan QR requis', dot: 'bg-[#E5B54F]' },
  reconnecting: { label: 'Reconnexion', dot: 'bg-[#E5B54F] vx-breathe' },
  offline: { label: 'Flux interrompu', dot: 'bg-rose-500' },
};

/* ------------------------------------------------------------------ */
/* Fil                                                                */
/* ------------------------------------------------------------------ */

interface ThreadMessage {
  id: string;
  inbound: boolean;
  body: string;
  createdAt: string;
  receipt?: ReceiptState;
  voice?: { url?: string; durationSec?: number; peaks?: number[] };
}

interface OutgoingMessage extends ThreadMessage {
  waId?: string;
  sentAt: number;
}

interface QuickShortcut {
  id: string;
  label: string;
  icon?: LucideIcon;
  category?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'audio' | 'video';
  mediaFilename?: string;
}

const PRIMARY_SHORTCUTS: QuickShortcut[] = [
  {
    id: 'procedure_voice',
    label: 'Vocal procédure',
    icon: Mic,
    text: "https://wueqerxytasbcebopjaf.supabase.co/storage/v1/object/public/audio-assets/procedure-vocal.mp3",
    mediaUrl: 'https://wueqerxytasbcebopjaf.supabase.co/storage/v1/object/public/audio-assets/procedure-vocal.mp3',
    mediaType: 'audio',
    mediaFilename: 'procedure-vocal.mp3',
  },
  {
    id: 'video_demo',
    label: 'Exemple vidéo',
    icon: Video,
    text: "https://wueqerxytasbcebopjaf.supabase.co/storage/v1/object/public/audio-assets/video-demo.mp4",
    mediaUrl: 'https://wueqerxytasbcebopjaf.supabase.co/storage/v1/object/public/audio-assets/video-demo.mp4',
    mediaType: 'video',
    mediaFilename: 'video-demo.mp4',
  },
  {
    id: 'brief',
    label: 'Brief',
    icon: FileText,
    text: "Pour composer votre chanson sur-mesure : quel est le prénom du destinataire, l'occasion (anniversaire, mariage, amour...) et 2 ou 3 souvenirs marquants ?",
  },
  {
    id: 'tarifs',
    label: 'Tarifs (1200 / 3000)',
    icon: Tag,
    text: "Nous faisons la chanson à 1 200 F (texte seul). On a aussi un autre modèle vidéo avec photos à 3 000 F. Tout dépend de vous !",
  },
  {
    id: 'paiement_om',
    label: 'Paiement Wave/OM',
    icon: Receipt,
    text: "Vous pouvez donc passer au paiement +226 05 77 73 08 Wendyam Anicet junior Sekongo svp une capture pour vérifier le paiement !",
  },
];

const MORE_SHORTCUTS: QuickShortcut[] = [
  {
    id: 'paiement_wave',
    label: 'Paiement Wave direct',
    category: 'Paiement',
    text: "Vous pouvez donc passer au paiement Wave +226 05 77 73 08 svp une capture pour vérifier le paiement !",
  },
  {
    id: 'wave_ci',
    label: 'Paiement Wave Côte d\'Ivoire',
    category: 'Paiement',
    text: "Nos clients issus de la Côte d'Ivoire nous payent par Wave au +226 05 77 73 08 sans problème !",
  },
  {
    id: 'style_choix',
    label: 'Style doux ou dansant ?',
    category: 'Brief & Style',
    text: "Voulez-vous un style doux ou dansant ?",
  },
  {
    id: 'anecdote_demande',
    label: 'Message particulier ?',
    category: 'Brief & Style',
    text: "Y a-t-il un message particulier que vous aimeriez transmettre à travers la chanson ?",
  },
  {
    id: 'validation_texte',
    label: 'Avis & Validation définitive texte',
    category: 'Validation',
    text: "Merci de me donner votre avis sur le texte. Aucune modification ne pourra être faite une fois la chanson validée !",
  },
  {
    id: 'delai_20m',
    label: 'Délai maximum 20 min',
    category: 'Délais',
    text: "Vous serez livré dans maximum 20 minutes !",
  },
  {
    id: 'deux_versions',
    label: 'Règle des 2 versions',
    category: 'Studio',
    text: "Malheureusement, nous envoyons deux versions que du même style. Vous devez cependant faire un choix.",
  },
  {
    id: 'mix_en_cours',
    label: 'Mixage studio en cours',
    category: 'Studio',
    text: "Votre chanson est actuellement en plein mixage et mastering au studio ! Ça sort d'ici quelques minutes.",
  },
  {
    id: 'livraison_prete',
    label: 'Livraison chanson prête',
    category: 'Livraison',
    text: "Votre chanson personnalisée est prête ! Écoutez-la et dites-moi ce que vous en pensez. Merci pour votre confiance !",
  },
  {
    id: 'avis_temoignage',
    label: 'Demande d\'avis client',
    category: 'Confiance',
    text: "N'hésitez pas à nous laisser un commentaire pour rassurer ceux qui souvent doutent !",
  },
  {
    id: 'accueil_bonjour',
    label: 'Bonjour / Nouvelle demande',
    category: 'Accueil',
    text: "Bonjour, voulez-vous une chanson personnalisée ?",
  },
];

export interface ActiveOrderScope {
  activeMessages: ThreadMessage[];
  allInboundText: string;
  detectedOccasion: string;
  recipientName: string;
  memories: string[];
  isRepeatCustomer: boolean;
}

export function extractActiveOrderScope(thread: ThreadMessage[], clientName: string): ActiveOrderScope {
  if (!thread || thread.length === 0) {
    return {
      activeMessages: [],
      allInboundText: '',
      detectedOccasion: 'Anniversaire',
      recipientName: '',
      memories: [],
      isRepeatCustomer: false,
    };
  }

  // Détection du point de coupure de l'ancienne commande (si ancien client récurrent)
  let boundaryIdx = 0;
  let hasPastDelivery = false;

  for (let i = thread.length - 1; i >= 0; i--) {
    const m = thread[i];
    const prev = thread[i - 1];

    // Clôture d'une ancienne commande par le studio
    const isDeliveryMsg = !m.inbound && /\b(votre chanson est prête|chanson est prête|voici votre chanson|chanson personnalisée est prête|merci pour votre confiance|livraison de vos versions|voici le lien de téléchargement)\b/i.test(m.body || '');
    if (isDeliveryMsg && i < thread.length - 1) {
      boundaryIdx = i + 1;
      hasPastDelivery = true;
      break;
    }

    // Écart temporel important (> 48 heures) entre deux messages
    if (prev && m.createdAt && prev.createdAt) {
      const diffMs = Math.abs(new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime());
      if (diffMs > 48 * 3600 * 1000 && i < thread.length - 1) {
        boundaryIdx = i;
        hasPastDelivery = true;
        break;
      }
    }
  }

  // Messages appartenant STRICTEMENT à la commande active
  const activeMessages = thread.slice(boundaryIdx);
  const activeInbounds = activeMessages.filter((m) => m.inbound);

  const allInboundText = activeInbounds
    .map((m) => (m.body || '').replace(/[’‘`]/g, "'"))
    .join(' ')
    .toLowerCase();

  // Détection d'occasion sur la commande active
  let detectedOccasion = 'Anniversaire';
  if (/\b(mariages?|marier|fianc\w*|dots?|époux|epoux|épouse?s?|epouses?|mariés?|maries?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Mariage';
  } else if (/\b(hommages?|deuils?|décès|deces|rip|mémoires?|memoires?|funérailles|funerailles|enterrements?|défunts?|defunts?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Hommage';
  } else if (/\b(amours?|amoureux|amoureuse|chéris?|cheris?|chérie?s?|cherie?s?|cœurs?|coeurs?|bébés?|bebes?|couples?|saint-valentin|st valentin)\b/i.test(allInboundText)) {
    detectedOccasion = 'Amour';
  } else if (/\b(naissances?|baptêmes?|baptemes?|nouveau-nés?|nouveau nes?|accouchements?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Naissance & Baptême';
  } else if (/\b(mères?|meres?|mamans?|fête des mères|fete des meres)\b/i.test(allInboundText)) {
    detectedOccasion = 'Fête des mères';
  } else if (/\b(pères?|peres?|papas?|fête des pères|fete des peres)\b/i.test(allInboundText)) {
    detectedOccasion = 'Fête des pères';
  } else if (/\b(entreprises?|sociétés?|societes?|boutiques?|magasins?|commerces?|publicités?|publicites?|pubs?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Entreprise & Publicité';
  }

  // Détection du prénom sur la commande active
  let recipientName = '';
  const pourMatch = allInboundText.match(/\bpour\s+(?:un|une|mon|ma|mes|son|sa)?\s*([a-zà-ÿ-]{2,18})/i);
  const nomMatch = allInboundText.match(/\b(noms?|prénoms?|prenoms?)\s*(?:sont|c'est|est|:)?\s*([a-zà-ÿ-]{2,18})/i);
  const appelleMatch = allInboundText.match(/\bs'appelle\s+([a-zà-ÿ-]{2,18})/i);
  const cestMatch = allInboundText.match(/\bc'est\s+([a-zà-ÿ-]{2,18})/i);
  const destinataireMatch = allInboundText.match(/\bdestinataire\s*[:=]?\s*([a-zà-ÿ-]{2,18})/i);

  const stopWords = [
    'pour', 'une', 'un', 'des', 'du', 'de', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'lui', 'elle', 'moi', 'nous', 'vous', 'eux',
    'ce', 'cet', 'cette', 'faire', 'avoir', 'le', 'la', 'les', 'qui', 'quoi', 'comment', 'bien', 'bon', 'super', 'vrai', 'vraiment',
    'trop', 'parti', 'feter', 'fêter', 'celebrer', 'célébrer', 'notre', 'votre', 'leur', 'aussi', 'dot', 'mariage', 'rendre', 'hommage',
    'anniversaire', 'danniversaire', 'chanson', 'musique', 'titre', 'texte', 'projet', 'surprise', 'cadeau', 'ami', 'amie', 'amis',
    'amies', 'pote', 'potes', 'copain', 'copine', 'frere', 'frère', 'soeur', 'sœur', 'pere', 'père', 'mere', 'mère', 'papa', 'maman',
    'collègue', 'collegue', 'patron', 'mari', 'femme', 'epoux', 'époux', 'epouse', 'épouse', 'personne', 'quelqu'
  ];

  const testNameCandidate = (candidate?: string) => {
    if (!candidate) return '';
    const clean = candidate.trim().toLowerCase();
    if (stopWords.includes(clean)) return '';
    return candidate.trim().charAt(0).toUpperCase() + candidate.trim().slice(1);
  };

  if (appelleMatch && testNameCandidate(appelleMatch[1])) {
    recipientName = testNameCandidate(appelleMatch[1]);
  } else if (destinataireMatch && testNameCandidate(destinataireMatch[1])) {
    recipientName = testNameCandidate(destinataireMatch[1]);
  } else if (nomMatch && testNameCandidate(nomMatch[2] || nomMatch[3])) {
    recipientName = testNameCandidate(nomMatch[2] || nomMatch[3]);
  } else if (pourMatch && testNameCandidate(pourMatch[1])) {
    recipientName = testNameCandidate(pourMatch[1]);
  } else if (cestMatch && testNameCandidate(cestMatch[1])) {
    recipientName = testNameCandidate(cestMatch[1]);
  }

  const isForSelf = /\b(pour moi|mon propre|c'est moi|pour mon anniversaire)\b/i.test(allInboundText);
  if (!recipientName && isForSelf && clientName && !clientName.startsWith('+') && !clientName.toLowerCase().includes('client')) {
    recipientName = clientName.split(' ')[0];
  }

  // Extraction des souvenirs & anecdotes réelles du client
  const memories: string[] = [];
  for (const m of activeInbounds) {
    const raw = (m.body || '').trim();
    if (raw.length > 15 && !raw.startsWith('/') && !/^(bonjour|salut|merci|ok|d'accord|bonsoir)/i.test(raw)) {
      const cleaned = raw.replace(/\b(je veux|j'aimerais|on veut|faites|merci)\b/gi, '').trim();
      if (cleaned.length > 12) {
        memories.push(cleaned.slice(0, 100));
      }
    }
  }

  return {
    activeMessages,
    allInboundText,
    detectedOccasion,
    recipientName: recipientName || (clientName.startsWith('+') ? 'Destinataire' : clientName.split(' ')[0]),
    memories: memories.slice(0, 3),
    isRepeatCustomer: hasPastDelivery,
  };
}

interface NextStepData {
  stageKey:
    | 'accueil'
    | 'brief_incomplet'
    | 'brief_complet'
    | 'vocal_recu'
    | 'faisabilite'
    | 'styles'
    | 'photos'
    | 'extrait'
    | 'delai'
    | 'suivi_production'
    | 'validation_texte'
    | 'paiement_demande'
    | 'paiement_recu'
    | 'retouches';
  stageBadge: string;
  detectedIntent: string;
  detectedOccasion: string;
  recipientName: string;
  recommendedReply: string;
  actionKind?: 'cash' | 'lyrics' | 'reply';
}

function analyzeNextStep(conv: ConversationItem, messages: ThreadMessage[]): NextStepData | null {
  if (!messages || messages.length === 0) return null;

  const lastMsg = messages[messages.length - 1];

  // 1. RÈGLE MAÎTRESSE : Si le dernier message vient du studio, silence absolu
  // Le studio a déjà répondu. On attend le client en silence. Zéro spam robotique.
  if (lastMsg && !lastMsg.inbound) {
    return null;
  }

  const inbounds = messages.filter((m) => m.inbound);
  const lastInbound = inbounds[inbounds.length - 1];
  if (!lastInbound || (!lastInbound.body && !lastInbound.voice)) return null;

  // Normalisation des apostrophes typographiques pour robustesse mobile/WhatsApp
  const rawLastText = (lastInbound.body || '').trim().toLowerCase();
  const lastText = rawLastText.replace(/[’‘`]/g, "'");

  // 2. RÈGLE DE CLÔTURE POLIE : Silence d'or sur formules de politesse sans question ouverte
  const isPoliteClosing = /^(merci|d'accord|daccord|dac|ok|okay|super|parfait|c'est noté|c est note|bien reçu|bien recu|bonne nuit|bonne journée|bonsoir|amen|que dieu|top\b)/i.test(lastText) &&
    !/\b(mais|combien|prix|retouche|changer|retoucher|quand|delai|délai|numero|numéro|wave|orange|moov|envoyez|transfert|prêt|pret)\b/i.test(lastText) &&
    lastText.length < 80;

  if (isPoliteClosing && inbounds.length > 1) {
    return null;
  }

  // Extraction du périmètre de la commande active (isole les anciennes commandes pour les clients réguliers)
  const orderScope = extractActiveOrderScope(messages, conv.name);
  const detectedOccasion = orderScope.detectedOccasion;
  const recipientName = orderScope.recipientName;
  const allInboundText = orderScope.allInboundText;


  // 1. Paiement signalé / Justificatif reçu (Cash is King !)
  const isPendingCoords = /\b(envoyez|donnez|partagez|sur quel|quel|ou payer|où payer)\s*(le|votre|un)?\s*(numéro|numero|compte)?\b/i.test(lastText) ||
    /\b(je fais|je vais faire|vais faire|je ferai|je vais transférer|vais transferer|je transfère|je transfere)\b/i.test(lastText);

  const isPaymentClaim = !isPendingCoords && (
    /\b(payé|paye|dépot fait|depot fait|transfert fait|transfert effectué|capture|quittance|reçu wave|recu wave)\b/i.test(lastText) ||
    (/\b(j'ai|jai|je viens de|vient de|déjà|deja|voici|voila)\b.*\b(payé|paye|dépot|depot|versement|transfert|capture|envoyé|envoye|recu|reçu)\b/i.test(lastText))
  );

  if (isPaymentClaim) {
    return {
      stageKey: 'paiement_recu',
      stageBadge: 'Dépôt signalé',
      detectedIntent: 'Paiement effectué',
      detectedOccasion,
      recipientName,
      recommendedReply: `Paiement bien reçu, merci ! Le studio démarre immédiatement la composition, c'est prêt dans 18 minutes chrono.`,
      actionKind: 'cash',
    };
  }

  // 2. Statut de production / Suivi de commande ("C'est prêt ?", "Où en est la chanson ?")
  const isDeliveryStatusInquiry = /\b(c'est prêt|c est pret|c'est pret|c est prêt|ou en est|où en est|quand est-ce que|quand est ce que|vous en êtes où|vous en etes ou|avancement)\b/i.test(lastText);
  if (isDeliveryStatusInquiry) {
    return {
      stageKey: 'suivi_production',
      stageBadge: 'Suivi studio',
      detectedIntent: 'Demande de statut de commande',
      detectedOccasion,
      recipientName,
      recommendedReply: `C'est en plein mixage au studio, ça sort d'ici quelques minutes !`,
      actionKind: 'reply',
    };
  }

  // 3. Validation des paroles / Choix de version
  const isLyricsValidation = /\b(valide|validé|validee|valider|je prends le|je prends la|le premier|le 1er|la première|la 1ere|texte me va|paroles me va|c'est bon pour le texte|c'est bon pour les paroles|parfait pour le texte|on lance|lancez l'audio|lancer l'audio|lancez la musique|lancer la musique)\b/i.test(lastText);
  if (isLyricsValidation) {
    return {
      stageKey: 'validation_texte',
      stageBadge: 'Paroles validées',
      detectedIntent: 'Validation du texte par le client',
      detectedOccasion,
      recipientName,
      recommendedReply: `Super, texte validé ! Vous pouvez faire le dépôt de 3 000 F sur Wave ou Orange Money (+226 05 77 73 08) et on vous livre les 2 versions audio en 18 min.`,
      actionKind: 'cash',
    };
  }

  // 4. Demande de retouches
  const isRevisionRequest = /\b(retouche|retouches|modifier|modification|changer|changement|corriger|correction|faute|erreur|trompé|trompe|rajouter|ajouter un prenom)\b/i.test(lastText);
  if (isRevisionRequest) {
    return {
      stageKey: 'retouches',
      stageBadge: 'Retouches',
      detectedIntent: 'Demande d\'ajustement du texte',
      detectedOccasion,
      recipientName,
      recommendedReply: `C'est noté, je modifie ça tout de suite ! Dites-moi s'il y a d'autres petits détails à ajuster.`,
      actionKind: 'reply',
    };
  }

  // 5. Demande de délai / Urgence
  const isDelayInquiry = /\b(delai|délai|combien de temps|combien d'heure|combien de jour|combien de minute|livrer quand|livraison quand|temps de|urgent|urgence|aujourd'hui|ce soir|ce matin)\b/i.test(lastText);
  if (isDelayInquiry) {
    return {
      stageKey: 'delai',
      stageBadge: 'Délai 18 min',
      detectedIntent: 'Demande de délai de livraison ou urgence',
      detectedOccasion,
      recipientName,
      recommendedReply: `C'est prêt en 18 minutes chrono dès validation du texte et du dépôt. C'est pour quelle date de votre côté ?`,
      actionKind: 'reply',
    };
  }

  // 6. Demande de tarif & coordonnées de dépôt (Moov, Wave, OM)
  const isPriceInquiry = /\b(combien|prix|tarif|tarifs|cout|coût|payer|paiement|moyen|numero|numéro|compte|wave|orange money|moov|modalite|modalités)\b/i.test(lastText) || isPendingCoords;
  if (isPriceInquiry) {
    const asksMoov = /\bmoov\b/i.test(lastText);
    const asksWave = /\bwave\b/i.test(lastText);
    const asksOM = /\b(orange|om)\b/i.test(lastText);

    let paymentDetails = `Wave / Orange Money / Moov : +226 05 77 73 08`;
    if (asksMoov) {
      paymentDetails = `Moov Money : +226 05 77 73 08 (Wendyam Anicet junior)`;
    } else if (asksWave) {
      paymentDetails = `Wave : +226 05 77 73 08 (Wendyam Anicet junior)`;
    } else if (asksOM) {
      paymentDetails = `Orange Money : +226 05 77 73 08 (Wendyam Anicet junior)`;
    }

    return {
      stageKey: 'paiement_demande',
      stageBadge: 'Tarifs & Dépôt',
      detectedIntent: 'Demande de tarif ou de coordonnées',
      detectedOccasion,
      recipientName,
      recommendedReply: `La formule complète est à 3 000 F (chanson sur-mesure + 2 versions audio en 18 min).\nVous pouvez faire le dépôt sur ${paymentDetails}. Dès que vous avez la capture, envoyez-la ici !`,
      actionKind: 'reply',
    };
  }

  // 7. Demande d'extrait / exemple / comment ça se passe
  const isSampleRequest = /\b(extrait|extraits|exemple|exemples|echantillon|échantillon|écouter|ecouter|demo|démo|comment ça sonne|voir un modèle|comment ca se passe|comment ça se passe|comment fonctionne)\b/i.test(lastText);
  if (isSampleRequest) {
    return {
      stageKey: 'extrait',
      stageBadge: 'Échantillon démo',
      detectedIntent: 'Demande d\'écoute ou de démonstration',
      detectedOccasion,
      recipientName,
      recommendedReply: `Voici un extrait pour vous donner une idée : https://waha.velarisagent.life/demo/sample-afro.mp3\nDites-moi ce que vous en pensez !`,
      actionKind: 'reply',
    };
  }

  // 8. Demande de photos / vidéo
  const isPhotoInquiry = /\b(photo|photos|video|vidéo|montage|diaporama|clip|visuel)\b/i.test(lastText);
  if (isPhotoInquiry) {
    return {
      stageKey: 'photos',
      stageBadge: 'Photos & Vidéo',
      detectedIntent: 'Question sur les photos ou le montage vidéo',
      detectedOccasion,
      recipientName,
      recommendedReply: `Oui tout à fait ! Vous pouvez m'envoyer 3 à 5 photos directement ici pour le montage vidéo.`,
      actionKind: 'reply',
    };
  }

  // 9. Demande de styles musicaux / voix / langue
  const isStyleInquiry = /\b(style|styles|genre|genres|rythme|rythmes|afro|rumba|gospel|acoustique|zouglou|reggae|rap|voix homme|voix femme|voix masculine|voix feminine|voix féminine|moore|mooré|dioula)\b/i.test(lastText);
  if (isStyleInquiry) {
    return {
      stageKey: 'styles',
      stageBadge: 'Styles & Voix',
      detectedIntent: 'Question sur les genres musicaux et voix',
      detectedOccasion,
      recipientName,
      recommendedReply: `On compose dans tous les styles (Afro-love, Rumba, Gospel, Acoustique guitare/piano...) avec voix homme ou femme. Quel genre vous ferait plaisir ?`,
      actionKind: 'reply',
    };
  }

  // 10. Note vocale brute reçue (sans texte ou courte)
  const isPureVoice = (/^\s*(🎙️|\u{1F399})/u.test(lastInbound.body || '') || !!lastInbound.voice) && lastText.length < 15;
  if (isPureVoice) {
    return {
      stageKey: 'vocal_recu',
      stageBadge: 'Note vocale',
      detectedIntent: 'Note vocale reçue',
      detectedOccasion,
      recipientName,
      recommendedReply: `Bien reçu, j'écoute votre vocal tout de suite !`,
      actionKind: 'reply',
    };
  }

  // 11. Demande de faisabilité par occasion spécifique (ex: Baptême, Entreprise, etc.)
  const isFeasibilityQuestion = /\b(est-ce que|est ce que|vous faites|faites-vous|possible de|est-il possible|y a-t-il moyen)\b/i.test(lastText) || /\?$/.test(lastText);
  if (isFeasibilityQuestion && detectedOccasion !== 'Anniversaire') {
    return {
      stageKey: 'faisabilite',
      stageBadge: 'Faisabilité',
      detectedIntent: `Faisabilité pour ${detectedOccasion}`,
      detectedOccasion,
      recipientName,
      recommendedReply: `Oui tout à fait, on en fait très souvent ! C'est pour qui et pour quelle date ?`,
      actionKind: 'reply',
    };
  }

  // 12. Brief complet (prénom + occasion ou détails fournis)
  const isBriefComplete = !!recipientName && (allInboundText.length > 25 || inbounds.length >= 2);
  if (isBriefComplete) {
    return {
      stageKey: 'brief_complet',
      stageBadge: 'Brief prêt',
      detectedIntent: `Prêt pour l'écriture pour ${recipientName} (${detectedOccasion})`,
      detectedOccasion,
      recipientName,
      recommendedReply: `C'est parfait pour ${recipientName} ! J'ai toutes les infos, je vous prépare le texte tout de suite.`,
      actionKind: 'lyrics',
    };
  }

  // 13. Brief partiel (occasion détectée mais prénom ou détails requis)
  const hasOccasionSignal = /\b(anniversaire|danniversaire|mariage|hommage|amour|naissance|bapteme|baptême|fête|fete|mere|mère|pere|père|entreprise|societe)\b/i.test(allInboundText);
  if (hasOccasionSignal) {
    let questionText = `C'est noté pour l'anniversaire ! Comment s'appelle la personne et c'est pour quel jour ?`;

    if (detectedOccasion === 'Anniversaire') {
      if (/\b(ami|amie|pote|copain|copine)\b/i.test(allInboundText)) {
        questionText = `Super idée pour votre ami ! Il s'appelle comment et c'est prévu pour quel jour ?`;
      } else if (/\b(frère|frere|soeur|sœur)\b/i.test(allInboundText)) {
        questionText = `Superbe attention ! Comment il/elle s'appelle et c'est pour quel jour ?`;
      } else if (/\b(maman|mère|mere|papa|père|pere)\b/i.test(allInboundText)) {
        questionText = `Merveilleux cadeau ! Comment il/elle s'appelle et c'est pour quelle date ?`;
      }
    } else if (detectedOccasion === 'Mariage') {
      questionText = `Félicitations pour le mariage ! Comment s'appellent les mariés et c'est prévu pour quand ?`;
    } else if (detectedOccasion === 'Hommage') {
      questionText = `Toutes nos pensées. Quel est le nom de la personne et les souvenirs à célébrer ?`;
    } else if (detectedOccasion === 'Amour') {
      questionText = `Super ! Quel est le prénom de votre chéri(e) et c'est pour quelle date ?`;
    } else if (detectedOccasion === 'Naissance & Baptême') {
      questionText = `Félicitations ! Quel est le prénom de l'enfant et la date de la fête ?`;
    } else if (detectedOccasion === 'Fête des mères') {
      questionText = `Magnifique pour maman ! Quel est son prénom ou surnom ?`;
    } else if (detectedOccasion === 'Fête des pères') {
      questionText = `Superbe pour papa ! Quel est son prénom ?`;
    } else if (detectedOccasion === 'Entreprise & Publicité') {
      questionText = `Excellente idée ! Quel est le nom de votre entreprise et votre activité ?`;
    }

    return {
      stageKey: 'brief_incomplet',
      stageBadge: 'Prénom & Détails',
      detectedIntent: 'Précisions nécessaires pour le brief',
      detectedOccasion,
      recipientName,
      recommendedReply: questionText,
      actionKind: 'reply',
    };
  }

  // 14. Accueil (Uniquement si premier message)
  if (inbounds.length <= 1) {
    const isEvening = /bonsoir/i.test(lastText);
    const greetingText = isEvening
      ? `Bonsoir ! Comment allez-vous ? Comment pouvons-nous vous aider aujourd'hui ?`
      : `Bonjour ! Comment allez-vous ? Comment pouvons-nous vous aider aujourd'hui ?`;

    return {
      stageKey: 'accueil',
      stageBadge: 'Accueil',
      detectedIntent: 'Nouveau contact',
      detectedOccasion,
      recipientName,
      recommendedReply: greetingText,
      actionKind: 'reply',
    };
  }

  return null;
}

interface CashOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
  defaultOccasion?: string;
  defaultRecipient?: string;
  onConfirm: (data: {
    amount: number;
    paymentMethod: string;
    recipientName: string;
    occasion: string;
    sendConfirmWhatsApp: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

const PRESET_AMOUNTS = [
  { value: 1200, label: '1 200 F', desc: 'Texte seul' },
  { value: 3000, label: '3 000 F', desc: 'Standard (2 Masters HD)', badge: 'Recommandé' },
  { value: 5000, label: '5 000 F', desc: 'Pack VIP (Vidéo & Audio)' },
];

const PAYMENT_METHODS = ['Wave', 'Orange Money', 'Moov', 'Espèces'];

const CashOrderModal: FC<CashOrderModalProps> = ({
  isOpen,
  onClose,
  clientName,
  clientPhone,
  defaultOccasion = 'Anniversaire',
  defaultRecipient = '',
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(3000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [method, setMethod] = useState<string>('Wave');
  const [recipient, setRecipient] = useState<string>(defaultRecipient || clientName);
  const [occasion, setOccasion] = useState<string>(defaultOccasion || 'Anniversaire');
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setRecipient(defaultRecipient || clientName);
      setOccasion(defaultOccasion || 'Anniversaire');
      setSelectedAmount(3000);
      setIsCustom(false);
      setCustomAmount('');
    }
  }, [isOpen, defaultRecipient, clientName, defaultOccasion]);

  if (!isOpen) return null;

  const finalAmount = isCustom ? Number(customAmount) || 0 : selectedAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finalAmount <= 0) return;
    onConfirm({
      amount: finalAmount,
      paymentMethod: method,
      recipientName: recipient || clientName,
      occasion: occasion || 'Commande personnalisée',
      sendConfirmWhatsApp: sendWhatsApp,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm vx-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-modal-title"
        className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#0E1015] p-5 sm:p-6 space-y-5 text-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                <Receipt className="h-4 w-4" />
              </span>
              <h2 id="cash-modal-title" className="font-heading text-lg font-semibold text-white">
                Encaisser la commande
              </h2>
            </div>
            <p className="text-[13px] text-neutral-400 mt-1">
              Client : <span className="font-semibold text-neutral-200">{clientName}</span> ({clientPhone})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12.5px] font-medium text-neutral-300 mb-2">
              Montant de la transaction
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((p) => {
                const active = !isCustom && selectedAmount === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(p.value);
                      setIsCustom(false);
                    }}
                    className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      active
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-white'
                        : 'border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:border-white/20'
                    }`}
                  >
                    <span className="text-sm font-bold">{p.label}</span>
                    <span className="text-[10.5px] text-neutral-400 mt-0.5">{p.desc}</span>
                    {p.badge && (
                      <span className="absolute -top-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[9px] font-bold text-black uppercase tracking-wider">
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className={`text-[11.5px] underline transition-colors cursor-pointer ${
                  isCustom ? 'text-emerald-300' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {isCustom ? 'Utiliser un forfait prédéfini' : 'Saisir un autre montant (montant libre)'}
              </button>
              {isCustom && (
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    step="100"
                    placeholder="Montant en F CFA (ex: 7500)"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="flex-1 rounded-xl border border-white/[0.12] bg-[#07080B] px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/40"
                  />
                  <span className="font-mono text-xs text-neutral-400">F CFA</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-neutral-300 mb-2">
              Moyen de règlement reçu
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const active = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                      active
                        ? 'border-amber-400/50 bg-amber-400/10 text-[#F1DDB4]'
                        : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-neutral-400 mb-1">Prénom destinataire</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Ex: Marc, Aminata"
                className="w-full rounded-xl border border-white/[0.08] bg-[#07080B] px-3 py-2 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="block text-[12px] text-neutral-400 mb-1">Occasion</label>
              <input
                type="text"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Ex: Anniversaire, Mariage"
                className="w-full rounded-xl border border-white/[0.08] bg-[#07080B] px-3 py-2 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0 cursor-pointer"
            />
            <span className="text-[12.5px] text-neutral-300">
              Envoyer la confirmation automatique au client sur WhatsApp
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || finalAmount <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Valider l'encaissement ({finalAmount.toLocaleString('fr-FR')} F)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ACK_POLL_MS = 5000;
const ACK_WATCH_MS = 3 * 60 * 1000;

export const ConversationsView: FC<ConversationsViewProps> = ({ onOpenOrderForStudio }) => {
  const { user } = useAuth();
  const sessionName = wahaSessionNameFor(user?.id);

  const { data: rawConversations, syncedAt } = useStudioLive<ConversationItem[]>(
    getLiveConversations,
    user ? [] : REAL_CONVERSATIONS,
    ['conversations', 'messages'],
    [user?.id]
  );
  const readState = useReadState();
  const conversations = useMemo(
    () => applyReadState(rawConversations, readState.readOverrides, readState.archiveOverrides),
    [rawConversations, readState]
  );

  const [selectedId, setSelectedId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [section, setSection] = useState<InboxSection>('discussions');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [outgoing, setOutgoing] = useState<Record<string, OutgoingMessage[]>>({});
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [isCashing, setIsCashing] = useState(false);
  const [moreShortcutsOpen, setMoreShortcutsOpen] = useState(false);

  const link = useWahaHeartbeat(sessionName, { autoReconnect: !!user });

  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const moreShortcutsRef = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | globalThis.MouseEvent | TouchEvent) => {
      if (moreShortcutsRef.current && !moreShortcutsRef.current.contains(e.target as Node)) {
        setMoreShortcutsOpen(false);
      }
    };
    if (moreShortcutsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [moreShortcutsOpen]);

  const term = searchTerm.toLowerCase();
  const searched = conversations.filter(c =>
    c.name.toLowerCase().includes(term) || c.phone.includes(searchTerm) || c.preview.toLowerCase().includes(term)
  );
  const activeConversations = searched.filter(c => !c.isArchived);
  const archivedConversations = searched.filter(c => !!c.isArchived);
  const unreadTotal = activeConversations.filter(c => c.unread).length;

  const filteredConversations = useMemo(() => {
    if (section === 'archived') {
      return archivedConversations;
    }
    if (onlyUnread) {
      return activeConversations.filter(c => c.unread);
    }
    return activeConversations;
  }, [section, onlyUnread, activeConversations, archivedConversations]);

  const selectedConv = (selectedId ? conversations.find(c => c.id === selectedId) : null) || filteredConversations[0] || conversations[0] || null;
  const activeId = selectedConv?.id ?? '';

  /* Historique réel du studio connecté (Realtime + polling) */
  const { data: liveMessages } = useStudioLive<any[]>(
    () => getLiveMessages(activeId),
    [],
    ['messages'],
    [activeId],
    { enabled: !!user && !!activeId, pollMs: 15000 }
  );

  const history: ThreadMessage[] = useMemo(() => {
    if (!selectedConv) return [];
    if (user && liveMessages.length > 0) {
      return liveMessages.map((m) => ({
        id: m.id,
        inbound: m.direction === 'inbound',
        body: m.body || '',
        createdAt: m.created_at ? stampOf(new Date(m.created_at)) : 'Récent',
        receipt: m.direction === 'inbound' ? undefined : 'delivered',
      }));
    }
    const seed = REAL_CONVERSATION_MESSAGES[selectedConv.id];
    if (seed) {
      return seed.map((m, i) => {
        const inbound = m.role === 'user' || m.direction === 'inbound';
        return { id: m.id || `m${i}`, inbound, body: m.body, createdAt: m.createdAt, receipt: inbound ? undefined : 'read' };
      });
    }
    return [{ id: 'default-1', inbound: true, body: selectedConv.fullMessage || selectedConv.preview, createdAt: selectedConv.lastExchange }];
  }, [selectedConv, user, liveMessages]);

  /* Un envoi local disparaît dès que Supabase le renvoie (même corps sortant) */
  const pending = (outgoing[activeId] || []).filter(
    o => o.voice || !history.some(h => !h.inbound && h.body === o.body)
  );
  const thread = [...history, ...pending];

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [activeId, thread.length]);

  /* Accusés WhatsApp des messages envoyés depuis cette vue : polling tant qu'ils ne sont pas lus */
  const watched = (outgoing[activeId] || []).filter(
    o => o.waId && RECEIPT_RANK[o.receipt ?? 'pending'] < RECEIPT_RANK.read && Date.now() - o.sentAt < ACK_WATCH_MS
  );
  const watchKey = watched.map(o => `${o.waId}:${o.receipt}`).join('|');
  const phone = selectedConv?.phone ?? '';

  useEffect(() => {
    if (!watchKey || !phone) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const acks = await fetchWahaMessageAcks(phone, sessionName);
      if (cancelled || Object.keys(acks).length === 0) return;
      setOutgoing(prev => {
        const list = prev[activeId];
        if (!list) return prev;
        let changed = false;
        const next = list.map(o => {
          const ack = o.waId ? acks[o.waId] : undefined;
          if (ack === undefined) return o;
          const receipt = RECEIPT_FROM_ACK[ack];
          if (RECEIPT_RANK[receipt] <= RECEIPT_RANK[o.receipt ?? 'pending'] && receipt !== 'failed') return o;
          changed = true;
          return { ...o, receipt };
        });
        return changed ? { ...prev, [activeId]: next } : prev;
      });
    }, ACK_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watchKey, phone, sessionName, activeId]);

  const showFeedback = (fb: { success: boolean; message: string }) => {
    setSendFeedback(fb);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setSendFeedback(null), 5000);
  };
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const markRead = (conv: ConversationItem) => {
    if (!conv.unread) return;
    setConversationUnread(conv, false);
    if (user) {
      updateConversationReadStatus(conv.id, false);
      if (conv.phone) markWahaChatSeen(conv.phone, sessionName);
    }
  };

  const toggleUnread = (conv: ConversationItem, e?: MouseEvent) => {
    e?.stopPropagation();
    const nextUnread = !conv.unread;
    setConversationUnread(conv, nextUnread);
    if (user) {
      updateConversationReadStatus(conv.id, nextUnread);
      if (!nextUnread && conv.phone) {
        markWahaChatSeen(conv.phone, sessionName);
      }
    }
  };

  const toggleArchive = async (conv: ConversationItem, e?: MouseEvent) => {
    e?.stopPropagation();
    const nextArchived = !conv.isArchived;
    setConversationArchived(conv, nextArchived);

    if (user) {
      updateConversationArchiveStatus(conv.id, nextArchived);
      if (conv.phone) {
        setWahaChatArchived(conv.phone, nextArchived, sessionName);
      }
    }

    showFeedback({
      success: true,
      message: nextArchived
        ? `Discussion avec ${conv.name} archivée.`
        : `Discussion avec ${conv.name} désarchivée.`,
    });
  };

  const selectConversation = (conv: ConversationItem) => {
    setSelectedId(conv.id);
    setMobileThreadOpen(true);
    setRecorderOpen(false);
    markRead(conv);
  };

  const patchOutgoing = (convId: string, localId: string, patch: Partial<OutgoingMessage>) =>
    setOutgoing(prev => ({
      ...prev,
      [convId]: (prev[convId] || []).map(o => (o.id === localId ? { ...o, ...patch } : o)),
    }));

  const pushOutgoing = (convId: string, msg: OutgoingMessage) =>
    setOutgoing(prev => ({ ...prev, [convId]: [...(prev[convId] || []), msg] }));

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || isSending || !selectedConv) return;
    const conv = selectedConv;
    const localId = `out-${Date.now()}`;
    pushOutgoing(conv.id, { id: localId, inbound: false, body: text, createdAt: stampOf(new Date()), receipt: 'pending', sentAt: Date.now() });
    setReplyText('');
    setIsSending(true);
    setSendFeedback(null);

    if (!user) {
      // Sécurité Mode Démo : simule l'envoi sans solliciter le numéro réel du client
      setTimeout(() => patchOutgoing(conv.id, localId, { receipt: 'delivered', sentAt: Date.now() }), 700);
      setIsSending(false);
      showFeedback({ success: true, message: `[Mode Démo] Message simulé avec succès pour ${conv.phone}. Connectez-vous pour émettre sur votre ligne réelle.` });
      return;
    }

    const res = await sendWahaTextMessage(conv.phone, text, sessionName);
    patchOutgoing(conv.id, localId, { receipt: res.success ? 'sent' : 'failed', waId: res.messageId, sentAt: Date.now() });
    if (res.success) recordOutboundMessage(conv.id, text);
    if (!res.success) {
      showFeedback({ success: false, message: res.error || 'La passerelle WAHA ne répond pas. Ouvrez WhatsApp pour envoyer manuellement.' });
    }
    setIsSending(false);
  };

  const sendVoice = async (rec: VoiceRecording) => {
    if (!selectedConv) return;
    const conv = selectedConv;
    const localId = `voice-${Date.now()}`;
    pushOutgoing(conv.id, {
      id: localId,
      inbound: false,
      body: 'Note vocale',
      createdAt: stampOf(new Date()),
      receipt: 'pending',
      sentAt: Date.now(),
      voice: { url: rec.url, durationSec: rec.durationSec, peaks: rec.peaks },
    });
    setRecorderOpen(false);

    if (!user) {
      setTimeout(() => patchOutgoing(conv.id, localId, { receipt: 'delivered', sentAt: Date.now() }), 700);
      showFeedback({ success: true, message: `[Mode Démo] Note vocale simulée avec succès pour ${conv.phone}. Connectez-vous pour émettre sur votre ligne réelle.` });
      return;
    }

    const res = await sendWahaVoiceMessage(conv.phone, rec.blob, sessionName);
    patchOutgoing(conv.id, localId, { receipt: res.success ? 'sent' : 'failed', waId: res.messageId, sentAt: Date.now() });
    showFeedback(
      res.success
        ? { success: true, message: `Note vocale envoyée à ${conv.phone}.` }
        : { success: false, message: res.error || "La note vocale n'a pas pu partir. Vérifiez la session WAHA." }
    );
  };

  const sendFileMedia = async (url: string, mimetype?: string, filename?: string) => {
    if (!selectedConv || isSending) return;
    const conv = selectedConv;
    const localId = `media-${Date.now()}`;
    const displayLabel = filename?.includes('video') ? 'Exemple vidéo' : filename?.includes('vocal') ? 'Vocal procédure' : 'Fichier';
    pushOutgoing(conv.id, {
      id: localId,
      inbound: false,
      body: displayLabel,
      createdAt: stampOf(new Date()),
      receipt: 'pending',
      sentAt: Date.now(),
    });
    setIsSending(true);
    setSendFeedback(null);

    if (!user) {
      setTimeout(() => patchOutgoing(conv.id, localId, { receipt: 'delivered', sentAt: Date.now() }), 700);
      setIsSending(false);
      showFeedback({ success: true, message: `[Mode Démo] ${displayLabel} simulé pour ${conv.phone}.` });
      return;
    }

    try {
      // Envoi du fichier brut sans aucun titre ni légende
      const res = await sendWahaFileMessage(conv.phone, url, sessionName, { mimetype, filename });
      patchOutgoing(conv.id, localId, { receipt: res.success ? 'sent' : 'failed', waId: res.messageId, sentAt: Date.now() });
      if (res.success) {
        recordOutboundMessage(conv.id, url);
        showFeedback({ success: true, message: `${displayLabel} envoyé à ${conv.phone}.` });
      } else {
        // En cas de repli : lien pur sans aucun texte introductif
        const textRes = await sendWahaTextMessage(conv.phone, url, sessionName);
        patchOutgoing(conv.id, localId, { receipt: textRes.success ? 'sent' : 'failed', waId: textRes.messageId, sentAt: Date.now() });
        showFeedback({
          success: textRes.success,
          message: textRes.success ? `${displayLabel} envoyé à ${conv.phone}.` : "Erreur d'envoi du média.",
        });
      }
    } catch {
      showFeedback({ success: false, message: "Erreur d'envoi du média vers WhatsApp." });
    } finally {
      setIsSending(false);
    }
  };

  const handleShortcutClick = (shortcut: QuickShortcut, isShift: boolean) => {
    if (isShift) {
      insertSnippet(shortcut.text);
      return;
    }
    if (shortcut.mediaUrl) {
      // Envoi strict du fichier pur : AUCUN titre ni légende
      sendFileMedia(
        shortcut.mediaUrl,
        shortcut.mediaType === 'audio' ? 'audio/mpeg' : 'video/mp4',
        shortcut.mediaFilename
      );
      return;
    }
    sendText(shortcut.text);
  };

  /* Insère le snippet au curseur ; Maj+clic l'envoie directement */
  const insertSnippet = (text: string, sendNow = false) => {
    if (sendNow) return sendText(text);
    const el = composerRef.current;
    if (!el || !replyText) {
      setReplyText(text);
    } else {
      const start = el.selectionStart ?? replyText.length;
      const end = el.selectionEnd ?? replyText.length;
      const before = replyText.slice(0, start);
      const sep = before && !/\s$/.test(before) ? ' ' : '';
      setReplyText(before + sep + text + replyText.slice(end));
    }
    requestAnimationFrame(() => {
      const box = composerRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    });
  };

  /* Alt+1…5 : raccourcis primaires depuis n'importe où dans la vue */
  const insertRef = useRef(insertSnippet);
  insertRef.current = insertSnippet;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const idx = Number(e.code.replace('Digit', '')) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < PRIMARY_SHORTCUTS.length) {
        e.preventDefault();
        insertRef.current(PRIMARY_SHORTCUTS[idx].text);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Les URLs de prévisualisation des vocaux envoyés sont libérées en quittant la vue */
  const outgoingRef = useRef(outgoing);
  outgoingRef.current = outgoing;
  useEffect(() => () => {
    Object.values(outgoingRef.current).flat().forEach(o => o.voice?.url && URL.revokeObjectURL(o.voice.url));
  }, []);

  const handleExport = () => {
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velaris_conversations_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nextStep = useMemo(() => {
    if (!selectedConv) return null;
    return analyzeNextStep(selectedConv, thread);
  }, [selectedConv, thread]);

  const handleGenerateLyricsForChat = () => {
    if (!selectedConv) return;
    const orderScope = extractActiveOrderScope(thread, selectedConv.name);
    const occ = orderScope.detectedOccasion || nextStep?.detectedOccasion || 'Anniversaire';
    const rawName = orderScope.recipientName || nextStep?.recipientName || (selectedConv.name.startsWith('+') ? 'Destinataire' : selectedConv.name.split(' ')[0]);
    const name = rawName || 'Destinataire';
    const song = generateHouseStyleSong({
      recipient: name,
      occasion: occ,
      memories: orderScope.memories,
    });
    const formatted = `*${song.title}*\n\n${song.lyrics}`;
    setReplyText(formatted);
    if (composerRef.current) {
      composerRef.current.focus();
    }
    showFeedback({
      success: true,
      message: `Texte généré pour ${name} (${occ}${orderScope.isRepeatCustomer ? ' - Nouvelle commande isolée' : ''}) ! Vous avez juste à relire et cliquer sur Envoyer.`,
    });
  };

  const handleConfirmCashOrder = async (data: {
    amount: number;
    paymentMethod: string;
    recipientName: string;
    occasion: string;
    sendConfirmWhatsApp: boolean;
  }) => {
    if (!selectedConv) return;
    setIsCashing(true);
    try {
      const res = await recordDirectPayment({
        clientName: selectedConv.name,
        clientPhone: selectedConv.phone,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        recipientName: data.recipientName,
        occasion: data.occasion,
        notes: `Encaissé via Cockpit Discussions (${data.paymentMethod})`,
      });

      if (res?.id) {
        if (data.sendConfirmWhatsApp) {
          await sendText(
            `Paiement de ${data.amount.toLocaleString('fr-FR')} F CFA bien reçu par ${data.paymentMethod}, merci beaucoup ! Votre commande passe immédiatement en production studio. Livraison de vos versions audio master d'ici 18 minutes.`
          );
        }
        showFeedback({
          success: true,
          message: `Vente de ${data.amount.toLocaleString('fr-FR')} F CFA enregistrée avec succès dans la caisse (${data.paymentMethod}).`,
        });
        setCashModalOpen(false);
      } else {
        showFeedback({
          success: false,
          message: "Impossible d'enregistrer le paiement en base. Veuillez réessayer.",
        });
      }
    } catch (err: any) {
      showFeedback({
        success: false,
        message: `Erreur d'encaissement : ${err.message || 'Erreur réseau'}`,
      });
    } finally {
      setIsCashing(false);
    }
  };

  const cleanPhone = selectedConv ? selectedConv.phone.replace(/[^0-9]/g, '') : '';
  const whatsappDirectUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(replyText || '')}` : '#';
  const linkMeta = LINK_META[link.state];
  const secure = WAHA_CONFIG.baseUrl.startsWith('https://');
  const beatTitle = [
    `Session ${sessionName}`,
    link.sessionStatus ? `statut WAHA ${link.sessionStatus}` : null,
    link.lastBeatAt ? `dernier battement ${new Date(link.lastBeatAt).toLocaleTimeString('fr-FR')}` : null,
    secure ? 'transport chiffré TLS' : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5 vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Discussions WhatsApp</h1>
          <p className="text-sm sm:text-base text-[#A3A3A3] mt-2 leading-relaxed max-w-xl">
            Répondez aux prospects de vos publicités et suivez les relances de l'IA, au même endroit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span
            title={beatTitle}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-[#A3A3A3]"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${linkMeta.dot}`} />
            <span className="text-neutral-200">{linkMeta.label}</span>
            {link.state === 'online' && link.latencyMs !== null && (
              <span className="font-mono tabular-nums text-neutral-500">{link.latencyMs} ms</span>
            )}
            {secure && <ShieldCheck className="h-3 w-3 text-neutral-500" strokeWidth={1.75} aria-label="Transport chiffré" />}
          </span>
          {user && (link.state === 'offline' || link.state === 'scan') && (
            <button
              type="button"
              onClick={link.reconnect}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" strokeWidth={2} />
              Reconnecter
            </button>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-[#A3A3A3]">
            <span className="font-mono tabular-nums text-white">{unreadTotal}</span> non lu{unreadTotal > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-neutral-300 hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* Boîte double panneau */}
      <div className="vx-hairline rounded-2xl border border-white/[0.08] bg-[#0B0C10] overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] lg:h-[calc(100dvh-13rem)] lg:min-h-[620px]">
        {/* Liste */}
        <div className={`flex-col min-h-0 border-r border-white/[0.08] ${mobileThreadOpen ? 'hidden lg:flex' : 'flex'}`}>
          {/* Les 2 sections maîtresses : Discussions & Archivées */}
          <div className="flex border-b border-white/[0.08] p-1.5 gap-1 bg-[#07080B]">
            <button
              type="button"
              onClick={() => setSection('discussions')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                section === 'discussions'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Discussions</span>
              {unreadTotal > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black">
                  {unreadTotal}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSection('archived')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                section === 'archived'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archivées</span>
              {archivedConversations.length > 0 && (
                <span className="font-mono text-[11px] text-neutral-400">
                  ({archivedConversations.length})
                </span>
              )}
            </button>
          </div>

          {/* Recherche & Filtre rapide "Non lus" style WhatsApp */}
          <div className="p-3 border-b border-white/[0.08] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder={section === 'archived' ? "Chercher dans les archives..." : "Nom, numéro, message..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-neutral-500 outline-none focus:border-white/20 transition-colors"
              />
            </div>
            {section === 'discussions' && (
              <button
                type="button"
                onClick={() => setOnlyUnread(!onlyUnread)}
                title={onlyUnread ? "Afficher toutes les discussions" : "Filtrer uniquement les messages non lus"}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  onlyUnread
                    ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                    : 'border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:text-white hover:border-white/20'
                }`}
              >
                <span>Non lus</span>
                {unreadTotal > 0 && (
                  <span className={`h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    onlyUnread ? 'bg-black text-emerald-400' : 'bg-emerald-500 text-black'
                  }`}>
                    {unreadTotal}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[60vh] lg:max-h-none">
            {filteredConversations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                {section === 'archived' ? (
                  <>
                    <Archive className="h-6 w-6 text-neutral-600 mx-auto" strokeWidth={1.5} />
                    <p className="text-[13px] font-medium text-neutral-300">Aucune discussion archivée</p>
                    <p className="text-[12.5px] text-neutral-500 max-w-[220px] mx-auto leading-relaxed">
                      Les discussions que vous archivez apparaîtront ici sans encombrer votre boîte principale.
                    </p>
                  </>
                ) : onlyUnread ? (
                  <>
                    <CheckCheck className="h-6 w-6 text-emerald-400 mx-auto" strokeWidth={1.5} />
                    <p className="text-[13px] font-medium text-neutral-300">Tous les messages sont lus</p>
                    <p className="text-[12.5px] text-neutral-500 max-w-[220px] mx-auto leading-relaxed">
                      Aucun message non lu en attente.
                    </p>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-6 w-6 text-neutral-600 mx-auto" strokeWidth={1.5} />
                    <p className="text-[13px] font-medium text-neutral-300">Aucune discussion ici</p>
                    <p className="text-[12.5px] text-neutral-500 max-w-[220px] mx-auto leading-relaxed">
                      Dès qu'un client écrit sur votre numéro WhatsApp Studio, sa conversation apparaît dans cette liste.
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredConversations.map((conv, i) => {
                const isSelected = conv.id === selectedConv?.id;
                const voice = isVoice(conv.fullMessage);
                return (
                  <div
                    key={conv.id}
                    style={{ '--i': Math.min(i, 8) } as CSSProperties}
                    className={`vx-stagger group relative border-b border-white/[0.05] transition-colors duration-200 ${
                      isSelected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectConversation(conv)}
                      className="w-full text-left flex gap-3 px-3.5 py-3 cursor-pointer"
                    >
                      {isSelected && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-white" />}
                      <Monogram name={conv.name} unread={conv.unread} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm ${conv.unread ? 'font-semibold text-white' : 'font-medium text-neutral-200'}`}>
                            {conv.name}
                          </span>
                          <span className={`font-mono text-[11.5px] shrink-0 ${conv.unread ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}`}>{conv.lastExchange}</span>
                        </span>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[13px] text-[#A3A3A3] truncate min-w-0">
                            {voice && <Mic className="h-3 w-3 shrink-0 text-[#E5B54F]" strokeWidth={1.75} />}
                            <span className={`truncate ${conv.unread ? 'text-neutral-100 font-medium' : ''}`}>{voice ? 'Note vocale' : conv.preview}</span>
                          </span>
                          {conv.unread && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-black shadow-sm shrink-0">
                              1
                            </span>
                          )}
                        </div>
                      </span>
                    </button>
                    <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                      <button
                        type="button"
                        onClick={(e) => toggleArchive(conv, e)}
                        title={conv.isArchived ? 'Désarchiver la discussion' : 'Archiver la discussion'}
                        aria-label={conv.isArchived ? `Désarchiver ${conv.name}` : `Archiver ${conv.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors"
                      >
                        {conv.isArchived ? (
                          <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.6} />
                        ) : (
                          <Archive className="h-3.5 w-3.5" strokeWidth={1.6} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => toggleUnread(conv, e)}
                        title={conv.unread ? 'Marquer comme lu' : 'Marquer comme non lu'}
                        aria-label={conv.unread ? `Marquer ${conv.name} comme lu` : `Marquer ${conv.name} comme non lu`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors"
                      >
                        {conv.unread ? <MailOpen className="h-3.5 w-3.5" strokeWidth={1.6} /> : <Mail className="h-3.5 w-3.5" strokeWidth={1.6} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {syncedAt && (
            <div className="hidden lg:flex items-center gap-1.5 border-t border-white/[0.08] px-3.5 py-2 font-mono text-[11px] text-neutral-600">
              <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
              Synchro {syncedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>

        {/* Fil */}
        <div className={`flex-col min-h-0 ${mobileThreadOpen ? 'flex' : 'hidden lg:flex'}`}>
          {selectedConv ? (
            <>
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/[0.08] bg-[#0B0C10]">
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  aria-label="Retour à la liste"
                  className="lg:hidden -ml-1 p-1.5 rounded-lg text-[#A3A3A3] hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Monogram name={selectedConv.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{selectedConv.name}</div>
                  <div className="font-mono text-[12.5px] text-neutral-500">{selectedConv.phone}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleArchive(selectedConv)}
                    title={selectedConv.isArchived ? 'Désarchiver la discussion' : 'Archiver la discussion'}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12.5px] text-neutral-300 hover:text-white hover:border-white/25 transition-colors duration-200 cursor-pointer"
                  >
                    {selectedConv.isArchived ? (
                      <ArchiveRestore className="h-3 w-3" strokeWidth={1.5} />
                    ) : (
                      <Archive className="h-3 w-3" strokeWidth={1.5} />
                    )}
                    <span className="hidden md:inline">{selectedConv.isArchived ? 'Désarchiver' : 'Archiver'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleUnread(selectedConv)}
                    title={selectedConv.unread ? 'Marquer comme lu' : 'Marquer comme non lu'}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12.5px] text-neutral-300 hover:text-white hover:border-white/25 transition-colors duration-200 cursor-pointer"
                  >
                    {selectedConv.unread ? <MailOpen className="h-3 w-3" strokeWidth={1.5} /> : <Mail className="h-3 w-3" strokeWidth={1.5} />}
                    <span className="hidden md:inline">{selectedConv.unread ? 'Marquer lu' : 'Non lu'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashModalOpen(true)}
                    title="Encaisser la commande (Caisse & Trésorerie)"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-300 hover:bg-emerald-400/20 hover:border-emerald-400/40 transition-colors duration-200 cursor-pointer"
                  >
                    <Receipt className="h-3 w-3" strokeWidth={1.5} />
                    <span>Encaisser</span>
                  </button>
                  {onOpenOrderForStudio && (
                    <button
                      type="button"
                      onClick={() => onOpenOrderForStudio(selectedConv.name)}
                      className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                    >
                      <WandSparkles className="h-3 w-3" />
                      Ouvrir dans l'Atelier
                    </button>
                  )}
                  <a
                    href={whatsappDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir dans WhatsApp"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12.5px] text-neutral-300 hover:text-white hover:border-white/25 transition-colors duration-200"
                  >
                    <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>

              {selectedConv.isArchived && (
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2 border-b border-white/[0.08] bg-white/[0.02] text-[12px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5 text-neutral-500" strokeWidth={1.5} />
                    Discussion archivée (masquée de la boîte principale)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleArchive(selectedConv)}
                    className="text-white hover:underline cursor-pointer font-medium"
                  >
                    Désarchiver
                  </button>
                </div>
              )}

              {selectedConv.facts && (
                <div className="flex gap-2.5 px-4 sm:px-5 py-2.5 border-b border-white/[0.08] bg-[#E5B54F]/[0.03]">
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#E5B54F]" strokeWidth={1.5} />
                  <p className="text-[13px] leading-relaxed text-neutral-300 line-clamp-2">
                    <span className="text-[#F3CA75]">Brief extrait</span>
                    <span className="text-neutral-600 mx-1.5">/</span>
                    {selectedConv.facts}
                  </p>
                </div>
              )}

              <div
                ref={threadRef}
                key={selectedConv.id}
                className="vx-fade-in flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-2.5 min-h-[320px] max-h-[56vh] lg:max-h-none bg-[radial-gradient(40rem_20rem_at_100%_0%,rgba(255,255,255,0.025),transparent_70%)]"
              >
                {thread.map((m, idx, all) => {
                  const voiceIn = m.inbound && isVoice(m.body);
                  const day = dayOf(m.createdAt);
                  const showDay = idx === 0 || day !== dayOf(all[idx - 1].createdAt);
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="flex items-center gap-3 py-3">
                          <span className="h-px flex-1 bg-white/[0.06]" />
                          <span className="font-mono text-[11.5px] text-neutral-500">{day}</span>
                          <span className="h-px flex-1 bg-white/[0.06]" />
                        </div>
                      )}
                      <div className={`flex ${m.inbound ? 'justify-start' : 'justify-end'} ${idx >= history.length ? 'vx-view-enter' : ''}`}>
                        <div
                          className={`max-w-[86%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 ${
                            m.inbound
                              ? `rounded-bl-md border bg-[#0E1015] text-neutral-200 ${voiceIn ? 'border-[#E5B54F]/20 w-[300px] sm:w-[340px]' : 'border-white/[0.08]'}`
                              : `rounded-br-md bg-white text-black shadow-[0_8px_24px_-12px_rgba(255,255,255,0.25)] ${m.voice ? 'w-[280px] sm:w-[320px]' : ''}`
                          }`}
                        >
                          {voiceIn ? (
                            <div className="space-y-2.5">
                              <WaveformPlayer seed={m.id + m.body} durationHint={Math.min(58, Math.max(9, Math.round(stripVoice(m.body).length / 4.5)))} />
                              <div className="flex gap-2 border-t border-white/[0.08] pt-2">
                                <FileText className="h-3 w-3 mt-[3px] shrink-0 text-neutral-500" strokeWidth={1.5} />
                                <p className="text-[12.5px] leading-relaxed text-neutral-300">
                                  <span className="sr-only">Transcription : </span>
                                  {stripVoice(m.body)}
                                </p>
                              </div>
                            </div>
                          ) : m.voice ? (
                            <WaveformPlayer seed={m.id} src={m.voice.url} peaks={m.voice.peaks} durationHint={m.voice.durationSec} tone="light" />
                          ) : (
                            <p className="whitespace-pre-line text-sm leading-relaxed">{m.body}</p>
                          )}
                          <div className="mt-1.5 flex items-center justify-end gap-1 font-mono text-[11.5px] text-neutral-500">
                            {(voiceIn || m.voice) && (
                              <span className={`mr-auto inline-flex items-center gap-1 ${m.inbound ? 'text-[#E5B54F]' : 'text-[#8A6420]'}`}>
                                <Mic className="h-2.5 w-2.5" />Note vocale
                              </span>
                            )}
                            <span>{timeOf(m.createdAt)}</span>
                            {!m.inbound && m.receipt && <Ticks receipt={m.receipt} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Retour d'envoi */}
              {sendFeedback && (
                <div
                  role="status"
                  className={`vx-fade-in mx-4 sm:mx-5 mb-2 rounded-xl px-3 py-2 text-[12.5px] flex items-center gap-2 border ${
                    sendFeedback.success
                      ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300'
                      : 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300'
                  }`}
                >
                  {sendFeedback.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                  <span>{sendFeedback.message}</span>
                </div>
              )}

              {/* Dock de réponses rapides + compositeur */}
              <div className="border-t border-white/[0.08] bg-[#08090C] p-3 sm:p-4 space-y-2.5">
                {/* ⚡ Raccourcis WhatsApp & Actions Clés */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 relative">
                  <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                    {/* Défilement horizontal des 5 raccourcis prioritaires */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {PRIMARY_SHORTCUTS.map((snip, i) => {
                        const Icon = snip.icon;
                        return (
                          <button
                            key={snip.id}
                            type="button"
                            onClick={(e) => handleShortcutClick(snip, e.shiftKey)}
                            title={`${snip.text}\n\n• Clic : Envoyer directement sur WhatsApp\n• Maj+Clic (ou Alt+${i + 1}) : Insérer dans le champ pour modifier`}
                            className="group/snip inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] font-medium text-neutral-300 hover:text-white hover:border-white/20 hover:bg-white/[0.07] active:scale-95 transition-all cursor-pointer"
                          >
                            {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400 group-hover/snip:text-white" strokeWidth={1.5} />}
                            <span>{snip.label}</span>
                            <span className="hidden xl:inline font-mono text-[10px] text-neutral-600 group-hover/snip:text-neutral-400">{i + 1}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Menu déroulant compact "Autres ▾" - PLACÉ HORS DU CONTENEUR overflow-x-auto */}
                    <div className="relative shrink-0" ref={moreShortcutsRef}>
                      <button
                        type="button"
                        onClick={() => setMoreShortcutsOpen((prev) => !prev)}
                        title="Autres réponses fréquentes & messages types"
                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-all cursor-pointer ${
                          moreShortcutsOpen
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:text-neutral-200 hover:border-white/20 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>Autres</span>
                        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${moreShortcutsOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {moreShortcutsOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 rounded-xl border border-white/[0.12] bg-[#0E1015] p-1.5 shadow-2xl z-[70] vx-fade-in space-y-0.5 max-h-72 overflow-y-auto no-scrollbar">
                          <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-white/[0.06] mb-1">
                            Raccourcis Fréquents (Clic = Envoi direct)
                          </div>
                          {MORE_SHORTCUTS.map((snip) => (
                            <button
                              key={snip.id}
                              type="button"
                              onClick={(e) => {
                                handleShortcutClick(snip, e.shiftKey);
                                setMoreShortcutsOpen(false);
                              }}
                              title={`${snip.text}\n\n• Clic : Envoyer\n• Maj+Clic : Insérer dans le champ`}
                              className="w-full text-left flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer group"
                            >
                              <div className="flex-1 truncate">
                                <span className="font-medium text-neutral-200 group-hover:text-white">{snip.label}</span>
                                <p className="text-[11px] text-neutral-500 truncate group-hover:text-neutral-400">{snip.text}</p>
                              </div>
                              {snip.category && (
                                <span className="text-[9.5px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-500 shrink-0">
                                  {snip.category}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={handleGenerateLyricsForChat}
                      title="Générer automatiquement le texte des paroles et le placer dans la boîte de saisie"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5B54F]/30 bg-[#E5B54F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#F1DDB4] hover:bg-[#E5B54F]/20 hover:border-[#E5B54F]/50 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#E5B54F]" strokeWidth={2} />
                      <span>Générer le texte</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCashModalOpen(true)}
                      title="Encaisser la commande (Caisse Wave / Orange Money / Moov)"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300 hover:bg-emerald-400/20 hover:border-emerald-400/50 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>Encaisser</span>
                    </button>
                  </div>
                </div>

                {recorderOpen ? (
                  <VoiceNoteRecorder
                    autoStart
                    confirmLabel="Envoyer le vocal"
                    onComplete={sendVoice}
                    onCancel={() => setRecorderOpen(false)}
                  />
                ) : (
                  <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-1.5 pl-4 focus-within:border-white/25 transition-colors duration-200">
                    <textarea
                      ref={composerRef}
                      rows={1}
                      placeholder={`Répondre à ${selectedConv.name}`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendText(replyText);
                        }
                      }}
                      aria-label="Rédiger une réponse"
                      className="flex-1 resize-none bg-transparent py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none max-h-28"
                    />
                    {replyText.trim() ? (
                      <button
                        type="button"
                        onClick={() => sendText(replyText)}
                        disabled={isSending}
                        aria-label="Envoyer le message"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all duration-150 ease-press cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRecorderOpen(true)}
                        aria-label="Enregistrer une note vocale WhatsApp"
                        title="Note vocale WhatsApp"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5B54F] text-[#050608] hover:bg-[#F0C068] active:scale-95 transition-all duration-150 ease-press cursor-pointer"
                      >
                        <Mic className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <MessageCircle className="h-7 w-7 text-neutral-600 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-neutral-300">Choisissez une discussion</p>
              <p className="text-[13px] text-neutral-500 mt-1">Le fil complet et le brief extrait s'affichent ici.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'Encaissement Direct (Caisse & Trésorerie) */}
      <CashOrderModal
        isOpen={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        clientName={selectedConv?.name || 'Client WhatsApp'}
        clientPhone={selectedConv?.phone || ''}
        defaultOccasion={nextStep?.detectedOccasion || 'Anniversaire'}
        defaultRecipient={nextStep?.recipientName || selectedConv?.name || ''}
        onConfirm={handleConfirmCashOrder}
        isSubmitting={isCashing}
      />
    </div>
  );
};
