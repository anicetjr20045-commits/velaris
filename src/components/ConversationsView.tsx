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
  Tags,
  Truck,
  WandSparkles,
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
  recordOutboundMessage,
  updateConversationArchiveStatus,
  updateConversationReadStatus
} from '../services/supabase';
import { applyReadState, setConversationUnread, setConversationArchived, useReadState } from '../services/readState';
import { WaveformPlayer } from './WaveformPlayer';
import { VoiceNoteRecorder, type VoiceRecording } from './VoiceNoteRecorder';

interface ConversationsViewProps {
  onOpenOrderForStudio?: (name: string) => void;
}

type InboxFilter = 'all' | 'unread' | 'archived' | ConversationItem['status'];

const STATUS_META: Record<ConversationItem['status'], { label: string; dot: string }> = {
  nouveau: { label: 'Nouveau', dot: 'bg-sky-400' },
  en_discussion: { label: 'En discussion', dot: 'bg-white' },
  devis: { label: 'Devis', dot: 'bg-[#E5B54F]' },
  livre: { label: 'Livré', dot: 'bg-emerald-400' },
};

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
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [outgoing, setOutgoing] = useState<Record<string, OutgoingMessage[]>>({});

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

  const filteredConversations = searched.filter(c => {
    if (filter === 'archived') return !!c.isArchived;
    if (c.isArchived) return false;
    if (filter === 'all') return true;
    if (filter === 'unread') return c.unread;
    return c.status === filter;
  });

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

  const filters: { id: InboxFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: activeConversations.length },
    { id: 'unread', label: 'Non lus', count: activeConversations.filter(c => c.unread).length },
    { id: 'nouveau', label: 'Nouveaux', count: activeConversations.filter(c => c.status === 'nouveau').length },
    { id: 'devis', label: 'Devis', count: activeConversations.filter(c => c.status === 'devis').length },
    { id: 'archived', label: 'Archivés', count: archivedConversations.length },
  ];

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

  const cleanPhone = selectedConv ? selectedConv.phone.replace(/[^0-9]/g, '') : '';
  const whatsappDirectUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(replyText || '')}` : '#';
  const unreadTotal = conversations.filter(c => !c.isArchived && c.unread).length;
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
          <div className="p-3 space-y-2.5 border-b border-white/[0.08]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Nom, numéro, message"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-neutral-500 outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {filters.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] transition-colors duration-200 cursor-pointer ${
                    filter === f.id ? 'bg-white text-black font-medium' : 'text-[#A3A3A3] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {f.label}
                  <span className="font-mono text-[11.5px] text-neutral-600">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[60vh] lg:max-h-none">
            {filteredConversations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                {filter === 'archived' ? (
                  <>
                    <Archive className="h-6 w-6 text-neutral-600 mx-auto" strokeWidth={1.5} />
                    <p className="text-[13px] font-medium text-neutral-300">Aucune discussion archivée</p>
                    <p className="text-[12.5px] text-neutral-500 max-w-[220px] mx-auto leading-relaxed">
                      Les discussions que vous archivez apparaîtront ici sans encombrer votre boîte principale.
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
                const status = STATUS_META[conv.status] ?? STATUS_META.en_discussion;
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
                          <span className={`font-mono text-[11.5px] shrink-0 ${conv.unread ? 'text-emerald-400' : 'text-neutral-500'}`}>{conv.lastExchange}</span>
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[13px] text-[#A3A3A3]">
                          {voice && <Mic className="h-3 w-3 shrink-0 text-[#E5B54F]" strokeWidth={1.75} />}
                          <span className={`truncate ${conv.unread ? 'text-neutral-200' : ''}`}>{voice ? 'Note vocale' : conv.preview}</span>
                        </span>
                        <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-neutral-500">
                          <span className={`h-1 w-1 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
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
                      aria-label="Réponse WhatsApp"
                      className="flex-1 resize-none bg-transparent py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none max-h-28"
                    />
                    {replyText.trim() ? (
                      <button
                        type="button"
                        onClick={() => sendText(replyText)}
                        disabled={isSending}
                        aria-label="Envoyer sur WhatsApp"
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
    </div>
  );
};
