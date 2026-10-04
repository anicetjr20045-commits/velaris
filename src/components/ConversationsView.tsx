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
  Hand,
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
  Tags,
  Truck,
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

const SNIPPETS: { label: string; icon: LucideIcon; text: string }[] = [
  { label: 'Accueil', icon: Hand, text: "Bonjour et bienvenue au Studio. Nous composons des chansons sur-mesure pour vos moments importants. Pour qui souhaitez-vous la chanson, et pour quelle occasion ?" },
  { label: 'Brief vocal', icon: Mic, text: "Pour démarrer l'écriture de votre chanson, envoyez-nous une note vocale : le prénom du destinataire, l'occasion et deux ou trois souvenirs qui vous tiennent à cœur." },
  { label: 'Formule 3 000 F', icon: Tags, text: 'Notre formule à 3 000 FCFA comprend les paroles sur-mesure, 2 masters audio HD et la livraison en 18 minutes.' },
  { label: 'Paiement', icon: Receipt, text: 'Vous pouvez régler par Wave ou Orange Money. Envoyez la capture du paiement ici et la production démarre aussitôt.' },
  { label: 'Paiement reçu', icon: CheckCircle2, text: 'Paiement bien reçu, merci. Votre commande passe immédiatement en production studio. Livraison du morceau dans 18 minutes.' },
  { label: 'Livraison', icon: Truck, text: 'Votre chanson est prête. Écoutez-la et dites-nous ce que vous en pensez. Merci pour votre confiance.' },
];

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

  const allInboundText = inbounds.map((m) => (m.body || '').replace(/[’‘`]/g, "'")).join(' ').toLowerCase();

  // Détection d'occasion avec support singulier & pluriel
  let detectedOccasion = 'Anniversaire';
  if (/\b(mariages?|marier|fianc\w*|dots?|époux|epoux|épouse?s?|epouses?|mariés?|maries?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Mariage';
  } else if (/\b(hommages?|deuils?|décès|deces|rip|mémoires?|memoires?|funérailles|funerailles|enterrements?|défunts?|defunts?|grand-mère|grand-pere|grand mère|grand pere)\b/i.test(allInboundText)) {
    detectedOccasion = 'Hommage';
  } else if (/\b(amours?|amoureux|amoureuse|chéris?|cheris?|chérie?s?|cherie?s?|cœurs?|coeurs?|bébés?|bebes?|couples?|saint-valentin|st valentin)\b/i.test(allInboundText)) {
    detectedOccasion = 'Amour';
  } else if (/\b(naissances?|baptêmes?|baptemes?|nouveau-nés?|nouveau nes?|accouchements?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Naissance & Baptême';
  } else if (/\b(mères?|meres?|mamans?|fête des mères|fete des meres)\b/i.test(allInboundText)) {
    detectedOccasion = 'Fête des mères';
  } else if (/\b(pères?|peres?|papas?|fête des pères|fete des peres)\b/i.test(allInboundText)) {
    detectedOccasion = 'Fête des pères';
  } else if (/\b(entreprises?|sociétés?|societes?|boutiques?|magasins?|commerces?|publicités?|publicites?|pubs?|solaires?|ventes?)\b/i.test(allInboundText)) {
    detectedOccasion = 'Entreprise & Publicité';
  }

  // Détection du prénom avec filtrage des mots d'arrêt et relations
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
    const clean = candidate.toLowerCase().trim();
    if (stopWords.includes(clean)) return '';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
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

  // Ne jamais attribuer conv.name comme destinataire par défaut, sauf si le client commande explicitement pour lui-même
  const isForSelf = /\b(pour moi|mon propre|c'est moi|pour mon anniversaire)\b/i.test(allInboundText);
  if (!recipientName && isForSelf && conv.name && !conv.name.startsWith('+') && !conv.name.toLowerCase().includes('client')) {
    recipientName = conv.name.split(' ')[0];
  }

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
      recommendedReply: `Paiement bien reçu, merci beaucoup ! Votre commande passe immédiatement en production studio. Livraison de vos versions audio master d'ici 18 minutes.`,
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
      recommendedReply: `Votre commande est actuellement en cours de finalisation au studio ! Le mixage et le mastering sont presque terminés. Vous recevrez vos fichiers audio d'ici quelques minutes.`,
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
      recommendedReply: `Parfait, paroles validées avec succès ! Pour lancer la composition musicale et le mastering en studio, vous pouvez effectuer le règlement de 3 000 F CFA par Wave, Orange Money ou Moov (+226 05 77 73 08). Vos 2 versions audio HD vous seront livrées en 18 minutes chrono !`,
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
      recommendedReply: `C'est bien noté pour ces ajustements. Je note tout de suite les corrections à apporter. Y a-t-il un autre détail à modifier avant la finalisation ?`,
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
      recommendedReply: `Nos chansons personnalisées sont créées et masterisées en 18 minutes chrono après validation des paroles et du dépôt ! Vous recevez 2 versions audio haute définition prêtes à offrir.`,
      actionKind: 'reply',
    };
  }

  // 6. Demande de tarif & coordonnées de dépôt (Moov, Wave, OM)
  const isPriceInquiry = /\b(combien|prix|tarif|tarifs|cout|coût|payer|paiement|moyen|numero|numéro|compte|wave|orange money|moov|modalite|modalités)\b/i.test(lastText) || isPendingCoords;
  if (isPriceInquiry) {
    const asksMoov = /\bmoov\b/i.test(lastText);
    const asksWave = /\bwave\b/i.test(lastText);
    const asksOM = /\b(orange|om)\b/i.test(lastText);

    let paymentDetails = `Règlement direct par :\n• Wave : +226 05 77 73 08 (Wendyam Anicet junior)\n• Orange Money : +226 05 77 73 08\n• Moov Money : +226 05 77 73 08`;
    if (asksMoov) {
      paymentDetails = `Règlement Moov Money au : +226 05 77 73 08 (Wendyam Anicet junior).\n(Également disponible sur Wave et Orange Money au même numéro).`;
    } else if (asksWave) {
      paymentDetails = `Règlement Wave au : +226 05 77 73 08 (Wendyam Anicet junior).\n(Également disponible sur Orange Money et Moov au même numéro).`;
    } else if (asksOM) {
      paymentDetails = `Règlement Orange Money au : +226 05 77 73 08 (Wendyam Anicet junior).\n(Également disponible sur Wave et Moov au même numéro).`;
    }

    return {
      stageKey: 'paiement_demande',
      stageBadge: 'Tarifs & Dépôt',
      detectedIntent: 'Demande de tarif ou de coordonnées',
      detectedOccasion,
      recipientName,
      recommendedReply: `Notre formule la plus choisie est à 3 000 F CFA (paroles complètes sur-mesure + 2 versions audio HD + livraison en 18 min).\n\n${paymentDetails}\n\nDès le dépôt fait, envoyez simplement la capture ici !`,
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
      recommendedReply: `Voici un extrait représentatif de nos productions en studio (style acoustique afro-love) : https://waha.velarisagent.life/demo/sample-afro.mp3\n\nNous adaptons le style selon vos souhaits (afro-love, rumba, gospel, acoustique). Dites-moi ce que vous en pensez !`,
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
      recommendedReply: `Oui, nous pouvons intégrer vos plus belles photos dans une vidéo diaporama HD synchronisée sur la musique de votre chanson ! Vous pouvez nous envoyer 3 à 5 photos directement ici sur WhatsApp.`,
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
      recommendedReply: `Nous composons dans tous les styles : Afro-love, Rumba, Acoustique guitare/piano, Gospel, Zouglou ou Reggae, avec voix masculine ou féminine selon votre choix. Quel style préférez-vous ?`,
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
      recommendedReply: `Note vocale bien reçue ! Je l'écoute avec attention pour relever tous les détails de votre chanson personnalisée.`,
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
      recommendedReply: `Absolument ! Nous composons régulièrement pour les célébrations de ${detectedOccasion.toLowerCase()}. Quel est le prénom de la personne à honorer et la date prévue ?`,
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
      recommendedReply: `Tout est bien noté pour ${recipientName} (${detectedOccasion}) ! Notre studio lance la rédaction de vos paroles complètes sur-mesure. Je vous transmets le texte d'ici quelques instants pour validation.`,
      actionKind: 'lyrics',
    };
  }

  // 13. Brief partiel (occasion détectée mais prénom ou détails requis)
  const hasOccasionSignal = /\b(anniversaire|danniversaire|mariage|hommage|amour|naissance|bapteme|baptême|fête|fete|mere|mère|pere|père|entreprise|societe)\b/i.test(allInboundText);
  if (hasOccasionSignal) {
    let questionText = `C'est bien noté pour l'anniversaire ! Quel est le prénom de la personne à célébrer, sa date d'anniversaire, et 2 ou 3 souvenirs marquants ?`;

    if (detectedOccasion === 'Anniversaire') {
      if (/\b(ami|amie|pote|copain|copine)\b/i.test(allInboundText)) {
        questionText = `C'est une superbe attention pour votre ami(e) ! Quel est son prénom, sa date d'anniversaire, et 2 ou 3 anecdotes complices ou souvenirs à glisser dans la chanson ?`;
      } else if (/\b(frère|frere|soeur|sœur)\b/i.test(allInboundText)) {
        questionText = `C'est une magnifique surprise fraternelle ! Quel est le prénom de votre frère / sœur, sa date d'anniversaire, et 2 ou 3 souvenirs marquants ?`;
      } else if (/\b(maman|mère|mere|papa|père|pere)\b/i.test(allInboundText)) {
        questionText = `Un merveilleux cadeau familial ! Quel est son prénom ou surnom, sa date d'anniversaire, et les qualités qui vous touchent le plus chez lui / elle ?`;
      }
    } else if (detectedOccasion === 'Mariage') {
      questionText = `Félicitations pour ce mariage ! Quels sont les prénoms des mariés, la date de la célébration et un souvenir marquant ?`;
    } else if (detectedOccasion === 'Hommage') {
      questionText = `Toutes nos pensées vous accompagnent. Quel est le nom de la personne à honorer et les souvenirs que vous souhaitez immortaliser ?`;
    } else if (detectedOccasion === 'Amour') {
      questionText = `Superbe projet ! Quel est le prénom de votre bien-aimé(e) et les petites attentions qui rendent votre histoire unique ?`;
    } else if (detectedOccasion === 'Naissance & Baptême') {
      questionText = `Félicitations ! Quel est le prénom du bébé / de l'enfant, la date de la célébration et un vœu chaleureux de la famille ?`;
    } else if (detectedOccasion === 'Fête des mères') {
      questionText = `Un magnifique cadeau pour maman ! Quel est son prénom ou surnom, et 2 ou 3 qualités qui vous touchent chez elle ?`;
    } else if (detectedOccasion === 'Fête des pères') {
      questionText = `Superbe hommage pour papa ! Quel est son prénom et les valeurs fortes qu'il vous a transmises ?`;
    } else if (detectedOccasion === 'Entreprise & Publicité') {
      questionText = `Excellente initiative ! Quel est le nom de l'entreprise, votre activité, localisation et vos numéros de contact ?`;
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
    return {
      stageKey: 'accueil',
      stageBadge: 'Accueil',
      detectedIntent: 'Nouveau contact',
      detectedOccasion,
      recipientName,
      recommendedReply: `Bonjour et bienvenue au Studio Velaris. Pour qui aimeriez-vous créer cette chanson, et pour quelle occasion précieuse (anniversaire, mariage, hommage, amour) ?`,
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
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set());

  const link = useWahaHeartbeat(sessionName, { autoReconnect: !!user });

  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* Alt+1…6 : snippets depuis n'importe où dans la vue */
  const insertRef = useRef(insertSnippet);
  insertRef.current = insertSnippet;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const idx = Number(e.code.replace('Digit', '')) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < SNIPPETS.length) {
        e.preventDefault();
        insertRef.current(SNIPPETS[idx].text);
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

  const suggestionKey = selectedConv && nextStep ? `${selectedConv.id}-${thread[thread.length - 1]?.id || thread.length}-${nextStep.stageKey}` : '';
  const activeNextStep = suggestionKey && dismissedSuggestions.has(suggestionKey) ? null : nextStep;

  const handleGenerateLyricsForChat = () => {
    if (!selectedConv || !nextStep) return;
    const occ = nextStep.detectedOccasion || 'Anniversaire';
    const name = nextStep.recipientName || (selectedConv.name.startsWith('+') ? 'Destinataire' : selectedConv.name);
    const song = generateHouseStyleSong({
      recipient: name,
      occasion: occ,
    });
    const formatted = `*${song.title}*\n\n${song.lyrics}`;
    setReplyText(formatted);
    if (composerRef.current) {
      composerRef.current.focus();
    }
    showFeedback({
      success: true,
      message: `Paroles complètes générées (${song.lineCount} vers Suno). Prêtes à être relues et envoyées !`,
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
                {/* 🧭 Assistant Prochaine Étape (Micro-barre discrète 1-clic) */}
                {activeNextStep && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#0E1015]/95 px-3 py-1.5 backdrop-blur-sm transition-all">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0 rounded-md border border-white/[0.12] bg-white/[0.05] px-2 py-0.5 font-mono text-[10.5px] font-medium text-neutral-300">
                        {activeNextStep.stageBadge}
                      </span>
                      <p
                        className="truncate text-xs text-neutral-300 font-sans cursor-pointer hover:text-white transition-colors"
                        title={`${activeNextStep.recommendedReply}\n\n(Cliquer pour insérer dans le compositeur)`}
                        onClick={() => {
                          setReplyText(activeNextStep.recommendedReply);
                          composerRef.current?.focus();
                        }}
                      >
                        {activeNextStep.recommendedReply.replace(/\n+/g, ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeNextStep.actionKind === 'cash' && (
                        <button
                          type="button"
                          onClick={() => setCashModalOpen(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-300 hover:bg-emerald-400/20 transition-colors cursor-pointer"
                        >
                          <Receipt className="h-3 w-3" />
                          <span>Encaisser</span>
                        </button>
                      )}

                      {activeNextStep.actionKind === 'lyrics' && (
                        <button
                          type="button"
                          onClick={handleGenerateLyricsForChat}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E5B54F]/30 bg-[#E5B54F]/10 px-2.5 py-1 text-[11.5px] font-medium text-[#F1DDB4] hover:bg-[#E5B54F]/20 transition-colors cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3 text-[#E5B54F]" />
                          <span>Paroles</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setReplyText(activeNextStep.recommendedReply);
                          composerRef.current?.focus();
                        }}
                        title="Insérer dans le champ pour modifier"
                        className="px-2.5 py-1 text-[11.5px] text-neutral-400 hover:text-white rounded-lg border border-white/[0.08] hover:border-white/20 transition-colors cursor-pointer"
                      >
                        Insérer
                      </button>

                      <button
                        type="button"
                        onClick={() => sendText(activeNextStep.recommendedReply)}
                        disabled={isSending}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-[11.5px] font-semibold text-black hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <ArrowUp className="h-3 w-3 stroke-[2.5]" />
                        <span>Envoyer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (suggestionKey) {
                            setDismissedSuggestions((prev) => new Set(prev).add(suggestionKey));
                          }
                        }}
                        title="Masquer la suggestion"
                        aria-label="Masquer la suggestion"
                        className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.05] transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {SNIPPETS.map((snip, i) => {
                    const Icon = snip.icon;
                    const active = replyText === snip.text;
                    return (
                      <button
                        key={snip.label}
                        type="button"
                        onClick={(e) => insertSnippet(snip.text, e.shiftKey)}
                        title={`${snip.text}\n\nAlt+${i + 1} pour insérer · Maj+clic pour envoyer directement`}
                        className={`group/snip inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors duration-200 cursor-pointer ${
                          active
                            ? 'border-[#E5B54F]/40 bg-[#E5B54F]/10 text-[#F1DDB4]'
                            : 'border-white/[0.08] bg-white/[0.02] text-[#A3A3A3] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <Icon className="h-3 w-3" strokeWidth={1.5} />
                        {snip.label}
                        <span className="hidden lg:inline font-mono text-[10.5px] text-neutral-600 group-hover/snip:text-neutral-500">{i + 1}</span>
                      </button>
                    );
                  })}
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
