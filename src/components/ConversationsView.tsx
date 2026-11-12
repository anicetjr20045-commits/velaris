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
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MailOpen,
  Maximize2,
  MessageCircle,
  Mic,
  Minimize2,
  Receipt,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Tag,
  Video,
  WandSparkles,
  X,
  type LucideIcon
} from 'lucide-react';
import type { ConversationItem } from '../types';
import { REAL_CONVERSATION_MESSAGES } from '../data/realProductionData';
import { supabase } from '../services/supabase';
import {
  resolvePaymentInfoByPhone,
  updateConversationAiMode,
  fetchConversationAiMode,
  savePrivateContactNote,
} from '../services/realtime-chat';
import {
  generateGhostwriterVariants,
  shiftTextTone,
} from '../services/ghostwriter';
import {
  analyzeReceiptText,
  type ReceiptAnalysisResult,
} from '../services/receipt-ocr';

const EMPTY_CONVERSATIONS: ConversationItem[] = [];
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
  normalizeMediaUrl,
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
  mediaUrl?: string;
  mediaKind?: 'audio' | 'image' | 'video' | 'document' | string;
  transcript?: string;
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
    label: 'Avis & Validation définitive texte (1er envoi)',
    category: 'Validation',
    text: "Merci de me donner votre avis sur le texte. Aucune modification ne pourra être faite une fois la chanson validée 🙏",
  },
  {
    id: 'validation_texte_revision',
    label: 'Avis texte modifié (retouche)',
    category: 'Validation',
    text: "Qu'en pensez-vous ? 🙏",
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
  const relationTargetMatch = allInboundText.match(/\bpour\s+(?:mon|ma|son|sa|notre)?\s*(?:femme|mari|mère|mere|maman|père|pere|papa|fille|fils|frère|frere|soeur|sœur|chéri|chérie|ami|amie|collègue|collegue)\s+([a-zà-ÿ-]{2,18})/i);
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

  if (relationTargetMatch && testNameCandidate(relationTargetMatch[1])) {
    recipientName = testNameCandidate(relationTargetMatch[1]);
  } else if (appelleMatch && testNameCandidate(appelleMatch[1])) {
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
    | 'presentation_offres'
    | 'choix_offre'
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

  // Extraction du périmètre de la commande active (isole les anciennes commandes pour les clients réguliers)
  const orderScope = extractActiveOrderScope(messages, conv.name);
  const detectedOccasion = orderScope.detectedOccasion;
  const recipientName = orderScope.recipientName;
  const allInboundText = orderScope.allInboundText;

  // Analyse des jalons franchis dans la commande active
  const activeMessages = orderScope.activeMessages;
  const activeOutbounds = activeMessages.filter((m) => !m.inbound);
  const procedureVoiceSent = activeOutbounds.some(
    (m) => (m.body && (m.body.includes('procedure-vocal') || /procédure|procedure/i.test(m.body))) || !!m.voice
  );
  const offersPresented = activeOutbounds.some(
    (m) => m.body && (m.body.includes('1 200 F') || m.body.includes('1200 f') || m.body.includes('modèle vidéo') || m.body.includes('autre modèle'))
  );
  const lyricsSent = activeOutbounds.some(
    (m) =>
      m.body &&
      (m.body.includes('[Refrain]') ||
        m.body.includes('[Couplet') ||
        m.body.includes('avis sur le texte') ||
        m.body.includes('Aucune modification ne pourra') ||
        m.body.includes('Voici votre texte') ||
        m.body.includes('Voici les paroles'))
  );

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

  // 3. Demande de retouches (si texte déjà envoyé ou en cours)
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

  // 4. VALIDATION DU TEXTE PAR LE CLIENT (SEULEMENT ICI DÉCLENCHE LE PAIEMENT !)
  const isTextValidationExplicit = /\b(valide|validé|validee|valider|texte me va|paroles me va|c'est bon pour le texte|c'est bon pour les paroles|parfait pour le texte|on lance l'audio|lancez l'audio|lancer l'audio|lancez la musique|lancer la musique|j'aime beaucoup le texte|le texte est bon)\b/i.test(lastText);
  const isTextValidationImplicit = lyricsSent && /\b(c'est bon|c est bon|parfait|super|magnifique|j'adore|jadore|on garde ça|on garde ca|on valide|validé)\b/i.test(lastText);

  if (isTextValidationExplicit || isTextValidationImplicit) {
    return {
      stageKey: 'validation_texte',
      stageBadge: 'Texte validé',
      detectedIntent: 'Validation du texte par le client',
      detectedOccasion,
      recipientName,
      recommendedReply: `Super, merci pour votre validation ! Vous pouvez donc passer au paiement +226 05 77 73 08 Wendyam Anicet junior Sekongo (Wave ou Orange Money) svp une capture pour vérifier le paiement 🙏`,
      actionKind: 'cash',
    };
  }

  // 5. CHOIX DE L'OFFRE / FORMULE (1200 F texte seul vs 3000 F vidéo)
  // RÈGLE ABSOLUE : ZÉRO DEMANDE DE PAIEMENT ICI ! Le client ne passe au paiement qu'APRÈS validation du texte.
  const isOfferSelection =
    /\b(1\s*200|3\s*000|mille deux|trois mille|celle de 1200|celle de 3000|modèle vidéo|modele video|formule vidéo|formule video|texte seul|simple chanson|chanson seule|je prends le|je prends la|je choisis)\b/i.test(lastText) &&
    !lyricsSent;
  if (isOfferSelection) {
    return {
      stageKey: 'choix_offre',
      stageBadge: 'Formule choisie',
      detectedIntent: 'Choix de formule par le client',
      detectedOccasion,
      recipientName,
      recommendedReply: `Parfait, notre studio prépare votre texte tout de suite ! Je vous l'envoie dès qu'il est prêt pour recueillir votre avis 🙏`,
      actionKind: 'lyrics',
    };
  }

  // 6. VALIDATION DU VOCAL DE PROCÉDURE PAR LE CLIENT
  // Si le vocal a été envoyé et que le client accuse écoute ou valide la démarche
  const isProcedureVoiceAck =
    procedureVoiceSent &&
    !offersPresented &&
    !lyricsSent &&
    /\b(d'accord|daccord|dac|ok|okay|j'ai écouté|jai ecoute|bien reçu|bien recu|compris|c'est compris|c est compris|super|très bien|tres bien|pas de souci|pas de soucis|on fait comment|ça marche|ca marche)\b/i.test(lastText);

  if (isProcedureVoiceAck) {
    return {
      stageKey: 'presentation_offres',
      stageBadge: 'Présentation offres',
      detectedIntent: 'Procédure validée par le client',
      detectedOccasion,
      recipientName,
      recommendedReply: `Nous faisons la chanson à 1 200 F (texte seul). On a aussi un autre modèle vidéo avec photos à 3 000 F. Tout dépend de vous 😊`,
      actionKind: 'reply',
    };
  }

  // 7. RÈGLE DE CLÔTURE POLIE (Silence si formule de politesse sans enjeu d'étape active)
  const isPoliteClosing =
    /^(merci|bonne nuit|bonne journée|bonsoir|amen|que dieu|top\b)/i.test(lastText) &&
    !/\b(mais|combien|prix|retouche|changer|retoucher|quand|delai|délai|numero|numéro|wave|orange|moov|envoyez|transfert|prêt|pret)\b/i.test(lastText) &&
    lastText.length < 80;

  if (isPoliteClosing && inbounds.length > 1) {
    return null;
  }

  // 8. Demande de délai / Urgence
  const isDelayInquiry = /\b(delai|délai|combien de temps|combien d'heure|combien de jour|combien de minute|livrer quand|livraison quand|temps de|urgent|urgence|aujourd'hui|ce soir|ce matin)\b/i.test(lastText);
  if (isDelayInquiry) {
    return {
      stageKey: 'delai',
      stageBadge: 'Délai 20 min',
      detectedIntent: 'Demande de délai de livraison ou urgence',
      detectedOccasion,
      recipientName,
      recommendedReply: `C'est prêt en 18 à 20 minutes chrono dès validation de votre texte. C'est pour quelle date de votre côté ?`,
      actionKind: 'reply',
    };
  }

  // 9. Demande de tarif & coordonnées de dépôt (Moov, Wave, OM)
  // Gestion intelligente : prix en début de brief, coordonnées de paiement uniquement post-texte
  const isPriceInquiry = /\b(combien|prix|tarif|tarifs|cout|coût|payer|paiement|moyen|numero|numéro|compte|wave|orange money|moov|modalite|modalités)\b/i.test(lastText) || isPendingCoords;
  if (isPriceInquiry) {
    // Si les paroles sont déjà validées ou envoyées, donner le paiement
    if (lyricsSent) {
      return {
        stageKey: 'paiement_demande',
        stageBadge: 'Paiement Wave/OM',
        detectedIntent: 'Demande de coordonnées pour régler le texte',
        detectedOccasion,
        recipientName,
        recommendedReply: `Vous pouvez passer au paiement Wave / Orange Money au +226 05 77 73 08 (Wendyam Anicet junior Sekongo). Dès que vous avez la capture, envoyez-la ici !`,
        actionKind: 'cash',
      };
    }

    // Si on est en amont et que le client demande spécifiquement les coordonnées
    if (isPendingCoords || /\b(sur quel|quel numéro|quel numero|ou payer|où payer)\b/i.test(lastText)) {
      return {
        stageKey: 'paiement_demande',
        stageBadge: 'Paiement post-texte',
        detectedIntent: 'Demande de moyen de paiement avant texte',
        detectedOccasion,
        recipientName,
        recommendedReply: `Le paiement se fait par Wave ou Orange Money (+226 05 77 73 08), mais vous ne réglez qu'après avoir validé le texte de votre chanson 😊. Pour commencer, c'est pour quelle occasion ou pour qui ?`,
        actionKind: 'reply',
      };
    }

    // Demande de tarif classique au début ou en cours de brief
    return {
      stageKey: 'paiement_demande',
      stageBadge: 'Tarifs (1200 / 3000)',
      detectedIntent: 'Demande de tarifs en début de prise de commande',
      detectedOccasion,
      recipientName,
      recommendedReply: `Nous faisons la chanson à 1 200 F (texte seul). On a aussi un autre modèle vidéo avec photos à 3 000 F 😊. C'est pour quelle occasion ou pour qui ?`,
      actionKind: 'reply',
    };
  }

  // 10. Demande d'extrait / exemple / comment ça se passe
  const isSampleRequest = /\b(extrait|extraits|exemple|exemples|echantillon|échantillon|écouter|ecouter|demo|démo|comment ça sonne|voir un modèle|comment ca se passe|comment ça se passe|comment fonctionne)\b/i.test(lastText);
  if (isSampleRequest) {
    return {
      stageKey: 'extrait',
      stageBadge: 'Échantillon démo',
      detectedIntent: 'Demande d\'écoute ou de démonstration',
      detectedOccasion,
      recipientName,
      recommendedReply: `Voici un extrait pour vous donner une idée : https://wueqerxytasbcebopjaf.supabase.co/storage/v1/object/public/audio-assets/video-demo.mp4\nDites-moi ce que vous en pensez !`,
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
    if (!procedureVoiceSent) {
      return {
        stageKey: 'brief_complet',
        stageBadge: 'Vocal procédure',
        detectedIntent: `Brief complété pour ${recipientName} (${detectedOccasion})`,
        detectedOccasion,
        recipientName,
        recommendedReply: `C'est bien noté pour ${recipientName} ! Je vous envoie une note vocale d'une minute qui vous explique exactement notre démarche.`,
        actionKind: 'reply',
      };
    }

    if (!offersPresented) {
      return {
        stageKey: 'presentation_offres',
        stageBadge: 'Présentation offres',
        detectedIntent: 'Procédure validée - Présentation des offres',
        detectedOccasion,
        recipientName,
        recommendedReply: `Nous faisons la chanson à 1 200 F (texte seul). On a aussi un autre modèle vidéo avec photos à 3 000 F. Tout dépend de vous 😊`,
        actionKind: 'reply',
      };
    }

    return {
      stageKey: 'choix_offre',
      stageBadge: 'Prêt pour texte',
      detectedIntent: `Prêt pour l'écriture pour ${recipientName} (${detectedOccasion})`,
      detectedOccasion,
      recipientName,
      recommendedReply: `Parfait, notre studio prépare votre texte tout de suite ! Je vous l'envoie dès qu'il est prêt pour recueillir votre avis 🙏`,
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

export const ConversationsView: FC<ConversationsViewProps> = ({ onOpenOrderForStudio: _onOpenOrderForStudio }) => {
  const { user } = useAuth();
  const sessionName = wahaSessionNameFor(user?.id);

  const { data: rawConversations, syncedAt } = useStudioLive<ConversationItem[]>(
    getLiveConversations,
    EMPTY_CONVERSATIONS,
    ['conversations', 'messages'],
    []
  );
  const readState = useReadState();
  const [conversationPatches, setConversationPatches] = useState<Record<string, { preview?: string; lastExchange?: string; unread?: boolean; timestamp?: number }>>({});
  const conversations = useMemo(() => {
    const list = applyReadState(rawConversations, readState.readOverrides, readState.archiveOverrides);
    if (Object.keys(conversationPatches).length === 0) return list;
    const patched = list.map(c => {
      const patch = conversationPatches[c.id];
      if (!patch) return c;
      return {
        ...c,
        preview: patch.preview ?? c.preview,
        lastExchange: patch.lastExchange ?? c.lastExchange,
        unread: patch.unread !== undefined ? patch.unread : c.unread,
      };
    });
    return patched.sort((a, b) => {
      const aTime = conversationPatches[a.id]?.timestamp ?? 0;
      const bTime = conversationPatches[b.id]?.timestamp ?? 0;
      return bTime - aTime;
    });
  }, [rawConversations, readState, conversationPatches]);

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

  // Super Cockpit & Temps Réel Sub-50ms
  const [instantStreamedMessages, setInstantStreamedMessages] = useState<ThreadMessage[]>([]);
  const [isImmersiveFullScreen, setIsImmersiveFullScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const h = window.location.hash.toLowerCase();
    return h === '#chat' || h === '#whatsapp-web' || h === '#cockpit-chat';
  });
  const [isSuperCockpitOpen, setIsSuperCockpitOpen] = useState<boolean>(true);
  const [cockpitTab, setCockpitTab] = useState<'ghostwriter' | 'crm' | 'actions' | 'ocr'>('ghostwriter');
  const [aiPilotEnabled, setAiPilotEnabled] = useState<boolean>(true);
  const [isLoadingAiMode, setIsLoadingAiMode] = useState<boolean>(false);
  const [privateNote, setPrivateNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [receiptAnalysis, setReceiptAnalysis] = useState<ReceiptAnalysisResult | null>(null);

  const link = useWahaHeartbeat(sessionName, { autoReconnect: true });

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

  /* Historique réel du studio connecté (Realtime + polling accéléré 4s) */
  const { data: liveMessages } = useStudioLive<any[]>(
    () => getLiveMessages(activeId),
    [],
    ['messages'],
    [activeId],
    { enabled: !!activeId, pollMs: 4000 }
  );

  // Réinitialise le stream direct et l'analyse de reçu au changement de chat
  useEffect(() => {
    setInstantStreamedMessages([]);
    setReceiptAnalysis(null);
  }, [activeId]);

  // Détection du mode de pilotage IA (Pilote Auto vs Manuel)
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    fetchConversationAiMode(activeId).then((res) => {
      if (!cancelled) {
        setAiPilotEnabled(!res.isPaused && res.controlMode === 'ai');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const handleToggleAiPilot = async () => {
    if (!activeId || isLoadingAiMode) return;
    setIsLoadingAiMode(true);
    const nextMode = !aiPilotEnabled;
    setAiPilotEnabled(nextMode);
    const ok = await updateConversationAiMode(activeId, nextMode);
    setIsLoadingAiMode(false);
    showFeedback({
      success: ok,
      message: nextMode
        ? "Pilote Automatique IA activé : l'agent répondra en toute autonomie."
        : "Mode Manuel activé : l'IA est en veille, vous avez le contrôle total.",
    });
  };

  const mapRawMessageToThreadMessage = (m: any): ThreadMessage => {
    const cleanUrl = normalizeMediaUrl(m.media_path || m.media_url);
    const isAudio = m.media_kind === 'audio' || (m.body && /\.(m4a|mp3|ogg|wav)$/i.test(m.body.trim()));
    const isImage = m.media_kind === 'image' || (m.body && /\.(jpe?g|png|webp)$/i.test(m.body.trim()));
    const isVideo = m.media_kind === 'video' || (m.body && /\.(mp4|mov)$/i.test(m.body.trim()));

    let bodyText = m.body || m.transcript || '';
    if (!bodyText) {
      if (isAudio) bodyText = 'Note vocale';
      else if (isImage) bodyText = 'Photo';
      else if (isVideo) bodyText = 'Vidéo';
    }

    return {
      id: m.id,
      inbound: m.direction === 'inbound',
      body: bodyText,
      createdAt: m.created_at ? stampOf(new Date(m.created_at)) : 'Récent',
      receipt: (m.direction === 'inbound' ? undefined : 'delivered') as ReceiptState,
      voice: isAudio && cleanUrl ? { url: cleanUrl, durationSec: 30 } : undefined,
      mediaUrl: cleanUrl || undefined,
      mediaKind: m.media_kind || (isAudio ? 'audio' : isImage ? 'image' : isVideo ? 'video' : undefined),
      transcript: m.transcript || undefined,
    };
  };

  // Canal Supabase Realtime GLOBAL pour tout le studio (zéro délai, synchro instantanée de toutes les discussions)
  useEffect(() => {
    const channel = supabase.channel(`studio-global-stream-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const m = payload.new as any;
          if (!m || !m.id) return;
          const msgConvId = m.conversation_id;

          // 1. Si ce message concerne la discussion actuellement affichée, l'injecter immédiatement dans le fil
          if (msgConvId === activeId) {
            const newMsg = mapRawMessageToThreadMessage(m);
            setInstantStreamedMessages((prev) => {
              if (prev.some((x) => x.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (m.direction === 'inbound' && selectedConv?.phone) {
              markWahaChatSeen(selectedConv.phone, sessionName);
            }
          }

          // 2. Mettre à jour en temps réel l'aperçu et remonter la discussion en tête de liste à gauche
          const prefix = m.direction === 'outbound' ? 'Vous : ' : '';
          let textPreview = m.body || '';
          if (!textPreview) {
            if (m.transcript) textPreview = 'Note vocale : ' + m.transcript.slice(0, 50);
            else if (m.media_kind === 'audio') textPreview = 'Note vocale';
            else if (m.media_kind === 'image') textPreview = 'Photo';
            else if (m.media_kind === 'video') textPreview = 'Vidéo';
            else textPreview = 'Nouveau message';
          }
          const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setConversationPatches((prev) => ({
            ...prev,
            [msgConvId]: {
              preview: prefix + (textPreview.length > 70 ? textPreview.slice(0, 70) + '...' : textPreview),
              lastExchange: nowStr,
              unread: msgConvId === activeId ? false : m.direction === 'inbound',
              timestamp: Date.now(),
            },
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const m = payload.new as any;
          if (!m || !m.id) return;
          if (m.conversation_id === activeId) {
            setInstantStreamedMessages((prev) =>
              prev.map((x) => (x.id === m.id ? { ...x, body: m.body || m.transcript || x.body } : x))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const c = payload.new as any;
          if (!c || !c.id) return;
          if (c.id === activeId) {
            setAiPilotEnabled(!c.ai_paused && c.control_mode === 'ai');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, selectedConv?.phone, sessionName]);

  const history: ThreadMessage[] = useMemo(() => {
    if (!selectedConv) return [];
    if (liveMessages.length > 0 || instantStreamedMessages.length > 0) {
      const base: ThreadMessage[] = liveMessages.map(mapRawMessageToThreadMessage);
      // Fusion sans doublon des messages arrivés instantanément par Realtime
      const missingStreamed = instantStreamedMessages.filter(
        (s) => !base.some((b) => b.id === s.id)
      );
      return [...base, ...missingStreamed];
    }
    const seed = REAL_CONVERSATION_MESSAGES[selectedConv.id];
    if (seed) {
      return seed.map((m, i) => {
        const inbound = m.role === 'user' || m.direction === 'inbound';
        return { id: m.id || `m${i}`, inbound, body: m.body, createdAt: m.createdAt, receipt: (inbound ? undefined : 'read') as ReceiptState };
      });
    }
    return [{ id: 'default-1', inbound: true, body: selectedConv.fullMessage || selectedConv.preview, createdAt: selectedConv.lastExchange }];
  }, [selectedConv, liveMessages, instantStreamedMessages]);

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
    updateConversationReadStatus(conv.id, false);
    if (conv.phone) markWahaChatSeen(conv.phone, sessionName);
  };

  const toggleUnread = (conv: ConversationItem, e?: MouseEvent) => {
    e?.stopPropagation();
    const nextUnread = !conv.unread;
    setConversationUnread(conv, nextUnread);
    updateConversationReadStatus(conv.id, nextUnread);
    if (!nextUnread && conv.phone) {
      markWahaChatSeen(conv.phone, sessionName);
    }
  };

  const toggleArchive = async (conv: ConversationItem, e?: MouseEvent) => {
    e?.stopPropagation();
    const nextArchived = !conv.isArchived;
    setConversationArchived(conv, nextArchived);

    updateConversationArchiveStatus(conv.id, nextArchived);
    if (conv.phone) {
      setWahaChatArchived(conv.phone, nextArchived, sessionName);
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

  const orderScope = useMemo(() => {
    if (!selectedConv) return null;
    return extractActiveOrderScope(thread, selectedConv.name);
  }, [selectedConv, thread]);

  const paymentInfo = useMemo(() => {
    return resolvePaymentInfoByPhone(selectedConv?.phone || '');
  }, [selectedConv?.phone]);

  const ghostwriter = useMemo(() => {
    return generateGhostwriterVariants(
      nextStep?.stageKey || 'accueil',
      selectedConv?.name || '',
      orderScope?.recipientName || nextStep?.recipientName || '',
      orderScope?.detectedOccasion || nextStep?.detectedOccasion || '',
      nextStep?.recommendedReply || ''
    );
  }, [nextStep?.stageKey, selectedConv?.name, orderScope?.recipientName, orderScope?.detectedOccasion, nextStep?.recommendedReply]);

  const handleApplyTone = (tone: 'shorter' | 'warmer' | 'action') => {
    if (!replyText.trim()) return;
    const shifted = shiftTextTone(replyText, tone);
    setReplyText(shifted);
  };

  const handleAnalyzeLastReceipt = () => {
    const inbounds = thread.filter((m) => m.inbound);
    const lastInbound = inbounds[inbounds.length - 1];
    const textToAnalyze = lastInbound?.body || '';
    const res = analyzeReceiptText(textToAnalyze);
    setReceiptAnalysis(res);
  };

  const handleSavePrivateNote = async () => {
    if (!selectedConv?.phone || isSavingNote) return;
    setIsSavingNote(true);
    const ok = await savePrivateContactNote(selectedConv.phone, privateNote);
    setIsSavingNote(false);
    showFeedback({
      success: ok,
      message: ok ? 'Note interne enregistrée dans le dossier client.' : 'Erreur d\'enregistrement de la note.',
    });
  };

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
    <div className={
      isImmersiveFullScreen
        ? "fixed inset-0 z-[100] h-[100dvh] w-full bg-[#08090C] overflow-hidden flex flex-col select-none"
        : "max-w-7xl mx-auto pb-16 space-y-5 vx-view-enter"
    }>
      {/* 1. Barre Supérieure Unifiée Plein Écran (Haute Couture, Zéro Conflit) */}
      {isImmersiveFullScreen ? (
        <header className="h-13 px-3 sm:px-5 bg-[#090B0E] border-b border-white/[0.08] flex items-center justify-between shrink-0 select-none">
          {/* Gauche : Statut Passerelle & Titre Sobre */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <MessageCircle className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-[13.5px] font-bold text-white tracking-tight">WhatsApp Copilot</span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] text-neutral-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${linkMeta.dot}`} />
                    <span className="text-neutral-200">{linkMeta.label}</span>
                    {link.state === 'online' && link.latencyMs !== null && (
                      <span className="font-mono text-neutral-500">{link.latencyMs}ms</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Droite : Commandes Rapides (Tablette-Friendly, min 36-40px touch) */}
          <div className="flex items-center gap-2">
            {/* Commutateur Pilote Auto vs Mode Manuel */}
            {selectedConv && (
              <button
                type="button"
                onClick={handleToggleAiPilot}
                disabled={isLoadingAiMode}
                title={aiPilotEnabled ? "Désactiver le pilote auto pour répondre manuellement" : "Activer le pilote auto pour laisser l'IA répondre"}
                className={`inline-flex items-center gap-2 h-8 sm:h-9 px-3 rounded-full text-[11.5px] sm:text-xs font-semibold transition-all cursor-pointer ${
                  aiPilotEnabled
                    ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${aiPilotEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="hidden sm:inline">{aiPilotEnabled ? 'Pilote Auto' : 'Manuel'}</span>
              </button>
            )}

            {/* Toggle Volet Cockpit (Adapté Tablette) */}
            <button
              type="button"
              onClick={() => setIsSuperCockpitOpen(!isSuperCockpitOpen)}
              className={`inline-flex items-center gap-2 h-8 sm:h-9 px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isSuperCockpitOpen
                  ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                  : 'border border-white/[0.12] bg-white/[0.03] text-neutral-300 hover:text-white hover:border-white/25'
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${isSuperCockpitOpen ? 'text-black' : 'text-neutral-400'}`} />
              <span className="hidden sm:inline">Cockpit IA</span>
            </button>

            {/* Export JSON */}
            <button
              type="button"
              onClick={handleExport}
              title="Exporter les discussions"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-neutral-400 hover:text-white hover:border-white/25 transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {/* Quitter Plein Écran */}
            <button
              type="button"
              onClick={() => setIsImmersiveFullScreen(false)}
              title="Quitter le plein écran"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-neutral-400 hover:text-white hover:border-white/25 transition-all cursor-pointer"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
      ) : (
        /* En-tête standard dans le site principal */
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Discussions WhatsApp</h1>
            <p className="text-sm sm:text-base text-[#A3A3A3] mt-2 leading-relaxed max-w-xl">
              Cockpit commercial en temps réel pour piloter les ventes de votre studio musical.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsImmersiveFullScreen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Ouvrir en Plein Écran (Tablette / Web)</span>
            </button>
            <span
              title={beatTitle}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] text-neutral-400"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${linkMeta.dot}`} />
              <span className="text-neutral-200">{linkMeta.label}</span>
              {secure && <ShieldCheck className="h-3 w-3 text-neutral-500" strokeWidth={1.75} />}
            </span>
          </div>
        </div>
      )}

      {/* 2. Conteneur Maître Adapté Tablette (Split-View Épuré) */}
      <div className={
        isImmersiveFullScreen
          ? "flex-1 flex flex-row overflow-hidden min-h-0 bg-[#08090C] relative"
          : `vx-hairline rounded-2xl border border-white/[0.08] bg-[#0B0C10] overflow-hidden flex flex-row relative ${
              isSuperCockpitOpen ? 'lg:h-[calc(100dvh-13rem)] lg:min-h-[660px]' : 'lg:h-[calc(100dvh-13rem)] lg:min-h-[660px]'
            }`
      }>
        {/* Colonne 1 : Liste des Discussions (Largeur fixe confortable sur tablette) */}
        <aside className={`w-full md:w-[290px] lg:w-[320px] shrink-0 flex-col min-h-0 border-r border-white/[0.08] bg-[#07080B] ${
          mobileThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Onglets Discussions / Archivées */}
          <div className="flex border-b border-white/[0.08] p-1.5 gap-1 bg-[#090B0E]">
            <button
              type="button"
              onClick={() => setSection('discussions')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                section === 'discussions'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
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
              <span>Archivées</span>
              {archivedConversations.length > 0 && (
                <span className="font-mono text-[11px] text-neutral-400">
                  ({archivedConversations.length})
                </span>
              )}
            </button>
          </div>

          {/* Recherche & Filtre Non Lus */}
          <div className="p-2.5 border-b border-white/[0.08] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder={section === 'archived' ? "Rechercher archives..." : "Nom, numéro..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-white/20 transition-colors"
              />
            </div>
            {section === 'discussions' && (
              <button
                type="button"
                onClick={() => setOnlyUnread(!onlyUnread)}
                title={onlyUnread ? "Afficher toutes les discussions" : "Filtrer non lus"}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  onlyUnread
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:text-white'
                }`}
              >
                <span>Non lus</span>
              </button>
            )}
          </div>

          {/* Liste Scrollable avec touch-scrolling natif */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageCircle className="h-6 w-6 text-neutral-600 mx-auto" strokeWidth={1.5} />
                <p className="text-xs font-medium text-neutral-400">Aucune discussion ici</p>
              </div>
            ) : (
              filteredConversations.map((conv, i) => {
                const isSelected = conv.id === selectedConv?.id;
                const voice = isVoice(conv.fullMessage);
                return (
                  <div
                    key={conv.id}
                    style={{ '--i': Math.min(i, 8) } as CSSProperties}
                    className={`vx-stagger group relative border-b border-white/[0.04] transition-colors duration-150 ${
                      isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectConversation(conv)}
                      className="w-full text-left flex gap-3 px-3.5 py-3 cursor-pointer"
                    >
                      {isSelected && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-white" />}
                      <Monogram name={conv.name} unread={conv.unread} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1.5">
                          <span className={`truncate text-[13px] ${conv.unread ? 'font-semibold text-white' : 'font-medium text-neutral-200'}`}>
                            {conv.name}
                          </span>
                          <span className={`font-mono text-[10.5px] shrink-0 ${conv.unread ? 'text-emerald-400 font-medium' : 'text-neutral-500'}`}>{conv.lastExchange}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs text-neutral-400 truncate min-w-0">
                            {voice && <Mic className="h-3 w-3 shrink-0 text-amber-400" strokeWidth={1.75} />}
                            <span className={`truncate ${conv.unread ? 'text-neutral-100 font-medium' : ''}`}>{voice ? 'Note vocale' : conv.preview}</span>
                          </span>
                          {conv.unread && (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black shrink-0">
                              1
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Actions au survol / touch */}
                    <div className="absolute right-2.5 bottom-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => toggleArchive(conv, e)}
                        title={conv.isArchived ? "Désarchiver" : "Archiver"}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        {conv.isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => toggleUnread(conv, e)}
                        title={conv.unread ? "Marquer lu" : "Marquer non lu"}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        {conv.unread ? <MailOpen className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {syncedAt && (
            <div className="hidden md:flex items-center gap-1.5 border-t border-white/[0.08] px-3.5 py-2 font-mono text-[10.5px] text-neutral-500">
              <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
              <span>Synchro {syncedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
        </aside>

        {/* Colonne 2 : Fil Central de la Discussion (Largeur Royale sur Tablette) */}
        <main className={`flex-1 min-w-0 flex flex-col h-full bg-[#08090C] overflow-hidden ${
          mobileThreadOpen ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedConv ? (
            <>
              {/* En-tête de Discussion Épuré (48px, Zéro Bouton Doublon) */}
              <div className="h-14 px-4 sm:px-5 border-b border-white/[0.08] bg-[#0A0C10] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileThreadOpen(false)}
                    aria-label="Retour à la liste"
                    className="md:hidden -ml-1 p-1.5 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Monogram name={selectedConv.name} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{selectedConv.name}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/[0.06] text-neutral-300 border border-white/[0.08] tracking-wider shrink-0">
                        {paymentInfo.code}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-neutral-500 truncate">{selectedConv.phone}</div>
                  </div>
                </div>

                {/* Actions contextuelles sobres */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCashModalOpen(true)}
                    title="Encaisser la commande (Caisse Wave / OM)"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Encaisser</span>
                  </button>

                  <a
                    href={whatsappDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir directement dans WhatsApp"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20 transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </a>

                  {/* Bouton pour révéler le Cockpit IA sur tablette s'il est masqué */}
                  <button
                    type="button"
                    onClick={() => setIsSuperCockpitOpen(!isSuperCockpitOpen)}
                    title={isSuperCockpitOpen ? "Fermer le Cockpit" : "Ouvrir le Cockpit"}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer ${
                      isSuperCockpitOpen
                        ? 'bg-white text-black'
                        : 'border border-white/[0.1] bg-white/[0.02] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Fil de Messages (Aéré, Confortable) */}
              <div
                ref={threadRef}
                key={selectedConv.id}
                className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3 bg-[#08090C]"
              >
                {thread.map((m, idx, all) => {
                  const isAudio = !!m.voice || m.mediaKind === 'audio' || (m.inbound && isVoice(m.body));
                  const isImage = m.mediaKind === 'image';
                  const isVideo = m.mediaKind === 'video';
                  const day = dayOf(m.createdAt);
                  const showDay = idx === 0 || day !== dayOf(all[idx - 1].createdAt);
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="flex items-center gap-3 py-3">
                          <span className="h-px flex-1 bg-white/[0.06]" />
                          <span className="font-mono text-[11px] text-neutral-500">{day}</span>
                          <span className="h-px flex-1 bg-white/[0.06]" />
                        </div>
                      )}
                      <div className={`flex ${m.inbound ? 'justify-start' : 'justify-end'} ${idx >= history.length ? 'vx-view-enter' : ''}`}>
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            m.inbound
                              ? `rounded-bl-sm border bg-[#0E1015] border-white/[0.08] text-neutral-200 ${isAudio ? 'w-[320px]' : ''}`
                              : `rounded-br-sm bg-white text-black shadow-sm ${isAudio ? 'w-[320px]' : ''}`
                          }`}
                        >
                          {isAudio ? (
                            <div className="space-y-2">
                              <WaveformPlayer
                                seed={m.id + (m.body || '')}
                                src={m.voice?.url || m.mediaUrl}
                                peaks={m.voice?.peaks}
                                durationHint={m.voice?.durationSec || 30}
                                tone={m.inbound ? 'dark' : 'light'}
                              />
                              {(m.transcript || (m.body && !/\.(m4a|mp3|ogg|wav)$/i.test(m.body))) && (
                                <div className={`border-t pt-1.5 text-xs ${m.inbound ? 'border-white/[0.08] text-neutral-300' : 'border-black/10 text-neutral-700'}`}>
                                  {m.transcript || stripVoice(m.body)}
                                </div>
                              )}
                            </div>
                          ) : isImage && m.mediaUrl ? (
                            <div className="space-y-1.5">
                              <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl">
                                <img src={m.mediaUrl} alt="Photo WhatsApp" className="max-h-64 w-auto rounded-xl object-cover hover:opacity-90 transition-opacity" />
                              </a>
                              {m.body && m.body !== 'Photo' && (
                                <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{m.body}</p>
                              )}
                            </div>
                          ) : isVideo && m.mediaUrl ? (
                            <div className="space-y-1.5">
                              <video src={m.mediaUrl} controls className="max-h-64 w-auto rounded-xl" />
                              {m.body && m.body !== 'Vidéo' && (
                                <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{m.body}</p>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{m.body || m.transcript || ''}</p>
                          )}
                          <div className="mt-1 flex items-center justify-end gap-1.5 font-mono text-[10.5px] text-neutral-500">
                            <span>{timeOf(m.createdAt)}</span>
                            {!m.inbound && m.receipt && <Ticks receipt={m.receipt} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feedback d'envoi discret */}
              {sendFeedback && (
                <div className={`mx-4 mb-2 rounded-xl px-3 py-2 text-xs flex items-center gap-2 border ${
                  sendFeedback.success
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                }`}>
                  {sendFeedback.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                  <span>{sendFeedback.message}</span>
                </div>
              )}

              {/* Barre de Saisie & Actions Rapides (Ergonomie Tablette Touch) */}
              <div className="border-t border-white/[0.08] bg-[#0A0C10] p-3 sm:p-4 space-y-2.5">
                {/* Raccourcis Clés en carrousel tactile horizontal fluide */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {[...PRIMARY_SHORTCUTS, ...MORE_SHORTCUTS].map((snip) => (
                    <button
                      key={snip.id}
                      type="button"
                      onClick={(e) => handleShortcutClick(snip, e.shiftKey)}
                      title={`${snip.text}\n• Clic : Envoyer direct\n• Maj+Clic : Insérer`}
                      className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-neutral-300 hover:text-white hover:border-white/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>{snip.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleGenerateLyricsForChat}
                    className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-lg border border-white/[0.15] bg-white/[0.06] text-xs font-medium text-white hover:bg-white/[0.1] active:scale-95 transition-all cursor-pointer"
                  >
                    <WandSparkles className="h-3.5 w-3.5 text-neutral-300" />
                    <span>Générer texte</span>
                  </button>
                </div>

                {/* Champ de saisie tactile */}
                {recorderOpen ? (
                  <VoiceNoteRecorder
                    autoStart
                    confirmLabel="Envoyer le vocal"
                    onComplete={sendVoice}
                    onCancel={() => setRecorderOpen(false)}
                  />
                ) : (
                  <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-[#0E1015] p-1.5 pl-4 focus-within:border-white/25 transition-colors">
                    <textarea
                      ref={composerRef}
                      rows={1}
                      placeholder={`Répondre à ${selectedConv.name}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendText(replyText);
                        }
                      }}
                      className="flex-1 resize-none bg-transparent py-2.5 text-[14px] text-white placeholder:text-neutral-500 outline-none max-h-28"
                    />
                    {replyText.trim() ? (
                      <button
                        type="button"
                        onClick={() => sendText(replyText)}
                        disabled={isSending}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer disabled:opacity-30"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRecorderOpen(true)}
                        title="Enregistrer note vocale"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white hover:bg-white/[0.15] active:scale-95 transition-all cursor-pointer"
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
              <MessageCircle className="h-8 w-8 text-neutral-600 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium text-neutral-300">Sélectionnez une discussion</p>
              <p className="text-xs text-neutral-500 mt-1">Vos échanges WhatsApp réels s'affichent ici.</p>
            </div>
          )}
        </main>

        {/* 3. Volet Super Cockpit : Drawer Coulissant Élégant sur Tablette (Ne compresse jamais le chat !) */}
        {isSuperCockpitOpen && selectedConv && (
          <>
            {/* Backdrop sombre tactile sur tablette & mobile pour fermer d'un clic */}
            <div
              onClick={() => setIsSuperCockpitOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm 2xl:hidden transition-opacity"
            />

            <aside className="fixed inset-y-0 right-0 z-50 w-[360px] max-w-[88vw] 2xl:static 2xl:w-[350px] 2xl:z-auto bg-[#090B0E] border-l border-white/[0.08] flex flex-col h-full shadow-2xl 2xl:shadow-none select-none vx-view-enter">
              {/* En-tête du volet avec les 4 onglets */}
              <div className="p-3 border-b border-white/[0.08] bg-[#0B0D12] shrink-0">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-heading font-semibold text-xs tracking-wider uppercase text-white flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-neutral-300" />
                    <span>Copilote Commercial</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSuperCockpitOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {[
                    { id: 'ghostwriter', label: 'Copilote' },
                    { id: 'crm', label: 'Brief' },
                    { id: 'actions', label: 'Actions' },
                    { id: 'ocr', label: 'Reçu' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setCockpitTab(tab.id as any);
                        if (tab.id === 'ocr') handleAnalyzeLastReceipt();
                      }}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center ${
                        cockpitTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corps du volet */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {/* ONGLET 1 : GHOSTWRITER */}
                {cockpitTab === 'ghostwriter' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Étape : <strong className="text-white">{nextStep?.stageBadge || 'Accueil'}</strong></span>
                      <span className="text-emerald-400 font-mono text-[10.5px]">Direct</span>
                    </div>

                    {/* 3 Variantes de réponses soignées */}
                    <div className="space-y-2.5">
                      {[ghostwriter.variantDirect, ghostwriter.variantWarm, ghostwriter.variantConcise].map((v, i) => (
                        <div key={i} className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/20 transition-all space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-white">{v.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-400">{v.tag}</span>
                          </div>
                          <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">{v.text}</p>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyText(v.text);
                                if (composerRef.current) composerRef.current.focus();
                              }}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-medium border border-white/[0.08] text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                            >
                              Insérer
                            </button>
                            <button
                              type="button"
                              onClick={() => sendText(v.text)}
                              className="h-7 px-3 rounded-lg text-[11px] font-semibold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer"
                            >
                              Envoyer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Ajustement Tonalité */}
                    <div className="pt-2 border-t border-white/[0.08] space-y-2">
                      <span className="text-[11px] text-neutral-400">Ajuster la tonalité :</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyTone('shorter')}
                          className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                        >
                          Raccourcir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTone('warmer')}
                          className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                        >
                          Plus chaleureux
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTone('action')}
                          className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                        >
                          Demander capture
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : BRIEF & CRM */}
                {cockpitTab === 'crm' && (
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{selectedConv.name}</span>
                        <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-white/[0.06] text-white">{paymentInfo.code}</span>
                      </div>
                      <div className="text-xs font-mono text-neutral-400">{selectedConv.phone}</div>
                      <div className="text-xs text-neutral-400">
                        Pays : <strong className="text-white">{paymentInfo.countryName}</strong>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Brief Chanson</span>
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-neutral-500">Destinataire : </span>
                          <span className="font-semibold text-white">{orderScope?.recipientName || 'Non précisé'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Occasion : </span>
                          <span className="text-emerald-400 font-medium">{orderScope?.detectedOccasion || 'Non précisée'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Souvenirs : </span>
                          <span className="text-neutral-300">
                            {orderScope?.memories && orderScope.memories.length > 0 ? orderScope.memories.join(' · ') : 'En attente'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                        <StickyNote className="h-3 w-3" />
                        Note Interne Privée
                      </span>
                      <textarea
                        rows={3}
                        placeholder="Ex: Rappeler ce soir pour valider..."
                        value={privateNote}
                        onChange={(e) => setPrivateNote(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.08] bg-black/40 p-2.5 text-xs text-white placeholder:text-neutral-600 outline-none resize-none focus:border-white/20"
                      />
                      <button
                        type="button"
                        onClick={handleSavePrivateNote}
                        disabled={isSavingNote || !privateNote.trim()}
                        className="w-full h-8 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-30 transition-all cursor-pointer"
                      >
                        {isSavingNote ? 'Enregistrement...' : 'Enregistrer la note'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ONGLET 3 : ACTIONS 1-CLIC */}
                {cockpitTab === 'actions' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-300">
                          {paymentInfo.primaryMethod}
                        </span>
                        <span className="font-mono text-xs text-emerald-400 font-bold">{paymentInfo.accountNumber}</span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">{paymentInfo.instructions}</p>
                      <button
                        type="button"
                        onClick={() => sendText(paymentInfo.formattedBubble)}
                        className="w-full h-9 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Envoyer coordonnées ({paymentInfo.primaryMethod})</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Médias & Vocaux Officiels</span>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const shortcut = PRIMARY_SHORTCUTS.find(s => s.id === 'procedure_voice');
                            if (shortcut) handleShortcutClick(shortcut, false);
                          }}
                          className="h-10 px-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-left text-xs font-medium text-white flex items-center justify-between transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Mic className="h-3.5 w-3.5 text-neutral-300" />
                            <span>Vocal de procédure (33s)</span>
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">Audio OGG</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const shortcut = PRIMARY_SHORTCUTS.find(s => s.id === 'video_demo');
                            if (shortcut) handleShortcutClick(shortcut, false);
                          }}
                          className="h-10 px-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-left text-xs font-medium text-white flex items-center justify-between transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Video className="h-3.5 w-3.5 text-neutral-300" />
                            <span>Exemple vidéo démo</span>
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">Vidéo MP4</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const shortcut = PRIMARY_SHORTCUTS.find(s => s.id === 'tarifs');
                            if (shortcut) handleShortcutClick(shortcut, false);
                          }}
                          className="h-10 px-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-left text-xs font-medium text-white flex items-center justify-between transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-neutral-300" />
                            <span>Grille tarifs (1 200 F / 3 000 F)</span>
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">Texte</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET 4 : SCANNER OCR */}
                {cockpitTab === 'ocr' && (
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2.5">
                      <span className="text-xs font-semibold text-white flex items-center gap-2">
                        <ScanLine className="h-3.5 w-3.5 text-neutral-300" />
                        Vérificateur de Quittance
                      </span>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Analyse instantanée du dernier message reçu pour certifier le paiement Wave ou Orange Money.
                      </p>
                      <button
                        type="button"
                        onClick={handleAnalyzeLastReceipt}
                        className="w-full h-8 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer"
                      >
                        Lancer l'analyse OCR
                      </button>
                    </div>

                    {receiptAnalysis && (
                      <div className={`p-3.5 rounded-xl border space-y-2 ${
                        receiptAnalysis.status === 'verified'
                          ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                          : receiptAnalysis.status === 'suspect'
                          ? 'border-amber-500/30 bg-amber-500/[0.06]'
                          : 'border-white/[0.08] bg-white/[0.02]'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${
                            receiptAnalysis.status === 'verified' ? 'text-emerald-400' : receiptAnalysis.status === 'suspect' ? 'text-amber-400' : 'text-neutral-400'
                          }`}>
                            {receiptAnalysis.status === 'verified' ? 'Quittance Certifiée' : receiptAnalysis.status === 'suspect' ? 'Reçu Douteux' : 'Non reconnu'}
                          </span>
                          {receiptAnalysis.provider && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-white">
                              {receiptAnalysis.provider}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-neutral-300 space-y-1">
                          {receiptAnalysis.amount && (
                            <div>Montant : <strong className="text-white">{receiptAnalysis.amount.toLocaleString('fr-FR')} F CFA</strong></div>
                          )}
                          {receiptAnalysis.transactionRef && (
                            <div className="font-mono text-[11px] text-neutral-400">Réf : {receiptAnalysis.transactionRef}</div>
                          )}
                        </div>

                        {receiptAnalysis.status === 'verified' && (
                          <button
                            type="button"
                            onClick={() => {
                              handleConfirmCashOrder({
                                amount: receiptAnalysis.amount || 1200,
                                paymentMethod: receiptAnalysis.provider || 'Wave',
                                recipientName: orderScope?.recipientName || 'Client',
                                occasion: orderScope?.detectedOccasion || 'Anniversaire',
                                sendConfirmWhatsApp: true,
                              });
                            }}
                            className="w-full mt-2 h-8 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-all cursor-pointer"
                          >
                            Valider l'encaissement
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Modal d'Encaissement Direct */}
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
