import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties, type FC } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  CheckCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Search,
  WandSparkles,
  type LucideIcon,
  Receipt,
  Tags
} from 'lucide-react';
import type { ConversationItem } from '../types';
import {
  REAL_CONVERSATIONS,
  REAL_CONVERSATION_MESSAGES
} from '../data/realProductionData';
import { sendWahaTextMessage } from '../services/waha';
import { useAuth } from '../hooks/useAuth';
import { getLiveConversations } from '../services/supabase';

interface ConversationsViewProps {
  onOpenOrderForStudio?: (name: string) => void;
}

type InboxFilter = 'all' | 'unread' | ConversationItem['status'];

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

/* Hash stable pour générer une forme d'onde propre à chaque note */
const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* Forme d'onde pseudo-aléatoire mais stable pour une même note */
const waveformFor = (seed: string, count = 32) => {
  let h = hashString(seed);
  return Array.from({ length: count }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const envelope = Math.sin((i / (count - 1)) * Math.PI) * 0.55 + 0.35;
    return Math.max(0.18, Math.min(1, envelope * (0.55 + ((h % 1000) / 1000) * 0.75)));
  });
};

const Monogram: FC<{ name: string; unread?: boolean; size?: 'sm' | 'md' }> = ({ name, unread, size = 'md' }) => (
  <span
    className={`relative flex shrink-0 items-center justify-center rounded-full border font-heading font-semibold tracking-tight ${
      size === 'sm' ? 'h-9 w-9 text-[12.5px]' : 'h-10 w-10 text-[13px]'
    } ${unread ? 'border-[#E5B54F]/50 bg-[#E5B54F]/[0.08] text-[#F1DDB4]' : 'border-[#3A3022] bg-white/[0.03] text-neutral-300'}`}
  >
    {initials(name)}
    {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#13110E] bg-emerald-400" />}
  </span>
);

/* ------------------------------------------------------------------ */
/* Note vocale : lecture simulée, ondes qui se remplissent            */
/* ------------------------------------------------------------------ */

const VoiceNote: FC<{
  id: string;
  transcript: string;
  playing: boolean;
  onToggle: () => void;
}> = ({ id, transcript, playing, onToggle }) => {
  const seconds = Math.min(58, Math.max(9, Math.round(transcript.length / 4.5)));
  const bars = useMemo(() => waveformFor(id + transcript), [id, transcript]);
  const onEnded = useEffectEvent(() => onToggle());

  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      progressRef.current = Math.min(1, progressRef.current + (now - last) / (seconds * 1000));
      last = now;
      setProgress(progressRef.current);
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        setProgress(0);
        onEnded();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, seconds]);

  const elapsed = Math.round(progress * seconds);
  const shown = playing || progress > 0 ? elapsed : seconds;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? 'Mettre en pause la note vocale' : 'Écouter la note vocale'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-press active:scale-95 cursor-pointer ${
            playing ? 'bg-[#E5B54F] text-black' : 'bg-white text-black hover:bg-neutral-200'
          }`}
        >
          {playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />}
        </button>
        <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden="true">
          {bars.map((b, i) => {
            const filled = i / bars.length < progress;
            return (
              <span
                key={i}
                className={`block w-[3px] rounded-full transition-colors duration-150 ${filled ? 'bg-[#E5B54F]' : 'bg-white/25'}`}
                style={{ height: `${b * 100}%` }}
              />
            );
          })}
        </div>
        <span className="font-mono text-[12.5px] text-[#A8A29E] shrink-0 w-9 text-right">
          0:{String(shown).padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-2 border-t border-[#2D261E] pt-2">
        <FileText className="h-3 w-3 mt-[3px] shrink-0 text-neutral-500" strokeWidth={1.5} />
        <p className="text-[12.5px] leading-relaxed text-neutral-300">{transcript}</p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Vue                                                                */
/* ------------------------------------------------------------------ */

const SNIPPETS: { label: string; icon: LucideIcon; text: string }[] = [
  { label: 'Demander le brief vocal', icon: Mic, text: "Pour démarrer l'écriture de votre chanson sur-mesure, envoyez-nous une note vocale ou décrivez l'occasion et le prénom du destinataire." },
  { label: 'Formule 3 000 F', icon: Tags, text: 'Notre formule à 3 000 FCFA comprend les paroles sur-mesure, 2 masters audio HD et la livraison en 18 minutes.' },
  { label: 'Confirmer le paiement', icon: Receipt, text: 'Paiement bien reçu. Votre commande passe immédiatement en production studio. Livraison du morceau dans 18 minutes.' },
];

export const ConversationsView: FC<ConversationsViewProps> = ({ onOpenOrderForStudio }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>(() => (user ? [] : REAL_CONVERSATIONS));
  const [selectedId, setSelectedId] = useState<string>(() => (user ? '' : REAL_CONVERSATIONS[0]?.id || ''));
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [customMessages, setCustomMessages] = useState<Record<string, { body: string; time: string }[]>>({});

  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLiveConversations().then((live) => {
      setConversations(live);
      if (live.length > 0) {
        setSelectedId((prev) => (prev && live.some(c => c.id === prev) ? prev : live[0].id));
      } else {
        setSelectedId('');
      }
    });
  }, [user]);

  const selectedConv = conversations.find(c => c.id === selectedId) || conversations[0] || null;

  const term = searchTerm.toLowerCase();
  const searched = conversations.filter(c =>
    c.name.toLowerCase().includes(term) || c.phone.includes(searchTerm) || c.preview.toLowerCase().includes(term)
  );
  const filteredConversations = searched.filter(c =>
    filter === 'all' ? true : filter === 'unread' ? c.unread : c.status === filter
  );

  const filters: { id: InboxFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: searched.length },
    { id: 'unread', label: 'Non lus', count: searched.filter(c => c.unread).length },
    { id: 'nouveau', label: 'Nouveaux', count: searched.filter(c => c.status === 'nouveau').length },
    { id: 'devis', label: 'Devis', count: searched.filter(c => c.status === 'devis').length },
  ];

  const initialMessages = (selectedId && REAL_CONVERSATION_MESSAGES[selectedId]) || [
    {
      id: 'default-1',
      role: 'user',
      direction: 'inbound',
      body: selectedConv ? (selectedConv.fullMessage || selectedConv.preview) : '',
      createdAt: selectedConv ? selectedConv.lastExchange : 'Récemment',
    }
  ];
  const currentExtraMessages = (selectedId && customMessages[selectedId]) || [];

  /* Séparateurs de jour : '30 sept. 10:38' -> '30 sept.' */
  const dayOf = (createdAt: string) => createdAt.replace(/,?\s*\d{1,2}:\d{2}$/, '').trim();
  const timeOf = (createdAt: string) => createdAt.match(/\d{1,2}:\d{2}$/)?.[0] ?? createdAt;

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [selectedId, currentExtraMessages.length]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setPlayingId(null);
    setMobileThreadOpen(true);
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, unread: false } : c)));
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending || !selectedConv) return;
    const textToSend = replyText.trim();
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    setCustomMessages(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), { body: textToSend, time }]
    }));
    setReplyText('');
    setIsSending(true);
    setSendFeedback(null);

    try {
      const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
      const res = await sendWahaTextMessage(selectedConv.phone, textToSend, sessionName);
      setSendFeedback(
        res.success
          ? { success: true, message: `Envoyé sur WhatsApp à ${selectedConv.phone}.` }
          : { success: false, message: res.error || 'La passerelle WAHA ne répond pas. Ouvrez WhatsApp pour envoyer manuellement.' }
      );
    } catch (err: any) {
      setSendFeedback({ success: false, message: err.message || 'Impossible de joindre le serveur WAHA.' });
    } finally {
      setIsSending(false);
      setTimeout(() => setSendFeedback(null), 5000);
    }
  };

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
  const unreadTotal = conversations.filter(c => c.unread).length;

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5 vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Discussions WhatsApp</h1>
          <p className="text-sm sm:text-base text-[#A8A29E] mt-2 leading-relaxed max-w-xl">
            Répondez aux prospects de vos publicités et suivez les relances de l'IA, au même endroit.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2D261E] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-[#A8A29E]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
            <span className="font-mono text-white">{unreadTotal}</span> non lu{unreadTotal > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-[#2D261E] bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-neutral-300 hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* Boîte double panneau */}
      <div className="vx-hairline rounded-2xl border border-[#2D261E] bg-[#13110E] overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] lg:h-[calc(100dvh-13rem)] lg:min-h-[620px]">
        {/* Liste */}
        <div className={`flex-col min-h-0 border-r border-[#2D261E] ${mobileThreadOpen ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 space-y-2.5 border-b border-[#2D261E]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Nom, numéro, message"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#2D261E] bg-white/[0.02] pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-neutral-500 outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {filters.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] transition-colors duration-200 cursor-pointer ${
                    filter === f.id ? 'bg-white text-black font-medium' : 'text-[#A8A29E] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {f.label}
                  <span className={`font-mono text-[11.5px] ${filter === f.id ? 'text-neutral-600' : 'text-neutral-600'}`}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[60vh] lg:max-h-none">
            {filteredConversations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <MessageCircle className="h-6 w-6 text-neutral-600 mx-auto" strokeWidth={1.5} />
                <p className="text-[13px] font-medium text-neutral-300">Aucune discussion ici</p>
                <p className="text-[12.5px] text-neutral-500 max-w-[220px] mx-auto leading-relaxed">
                  Dès qu'un client écrit sur votre numéro WhatsApp Studio, sa conversation apparaît dans cette liste.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv, i) => {
                const isSelected = conv.id === selectedConv?.id;
                const voice = isVoice(conv.fullMessage);
                const status = STATUS_META[conv.status] ?? STATUS_META.en_discussion;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => selectConversation(conv.id)}
                    style={{ '--i': Math.min(i, 8) } as CSSProperties}
                    className={`vx-stagger relative w-full text-left flex gap-3 px-3.5 py-3 border-b border-[#2D261E]/60 transition-colors duration-200 cursor-pointer ${
                      isSelected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {isSelected && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-white" />}
                    <Monogram name={conv.name} unread={conv.unread} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${conv.unread ? 'font-semibold text-white' : 'font-medium text-neutral-200'}`}>
                          {conv.name}
                        </span>
                        <span className="font-mono text-[11.5px] text-neutral-500 shrink-0">{conv.lastExchange}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[13px] text-[#A8A29E]">
                        {voice && <Mic className="h-3 w-3 shrink-0 text-[#E5B54F]" strokeWidth={1.75} />}
                        <span className="truncate">{voice ? 'Note vocale' : conv.preview}</span>
                      </span>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-neutral-500">
                        <span className={`h-1 w-1 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Fil */}
        <div className={`flex-col min-h-0 ${mobileThreadOpen ? 'flex' : 'hidden lg:flex'}`}>
          {selectedConv ? (
            <>
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[#2D261E] bg-[#141210]">
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  aria-label="Retour à la liste"
                  className="lg:hidden -ml-1 p-1.5 rounded-lg text-[#A8A29E] hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Monogram name={selectedConv.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{selectedConv.name}</div>
                  <div className="font-mono text-[12.5px] text-neutral-500">{selectedConv.phone}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3A3022] px-3 py-1.5 text-[12.5px] text-neutral-300 hover:text-white hover:border-white/25 transition-colors duration-200"
                  >
                    <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>

              {selectedConv.facts && (
                <div className="flex gap-2.5 px-4 sm:px-5 py-2.5 border-b border-[#2D261E] bg-[#E5B54F]/[0.03]">
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
                {initialMessages.map((m, idx, all) => {
                  const inbound = m.role === 'user' || m.direction === 'inbound';
                  const voice = inbound && isVoice(m.body);
                  const day = dayOf(m.createdAt);
                  const showDay = idx === 0 || day !== dayOf(all[idx - 1].createdAt);
                  const msgId = m.id || `m${idx}`;
                  return (
                    <div key={msgId}>
                      {showDay && (
                        <div className="flex items-center gap-3 py-3">
                          <span className="h-px flex-1 bg-white/[0.06]" />
                          <span className="font-mono text-[11.5px] text-neutral-500">{day}</span>
                          <span className="h-px flex-1 bg-white/[0.06]" />
                        </div>
                      )}
                      <div className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[86%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 ${
                            inbound
                              ? `rounded-bl-md border bg-[#1A1713] text-neutral-200 ${voice ? 'border-[#E5B54F]/20 w-[300px] sm:w-[340px]' : 'border-[#2D261E]'}`
                              : 'rounded-br-md bg-white text-black shadow-[0_8px_24px_-12px_rgba(255,255,255,0.25)]'
                          }`}
                        >
                          {voice ? (
                            <VoiceNote
                              id={msgId}
                              transcript={stripVoice(m.body)}
                              playing={playingId === msgId}
                              onToggle={() => setPlayingId(p => (p === msgId ? null : msgId))}
                            />
                          ) : (
                            <p className="whitespace-pre-line text-sm leading-relaxed">{m.body}</p>
                          )}
                          <div className={`mt-1.5 flex items-center justify-end gap-1 font-mono text-[11.5px] ${inbound ? 'text-neutral-500' : 'text-neutral-500'}`}>
                            {voice && <span className="mr-auto inline-flex items-center gap-1 text-[#E5B54F]"><Mic className="h-2.5 w-2.5" />Note vocale</span>}
                            <span>{timeOf(m.createdAt)}</span>
                            {!inbound && <CheckCheck className="h-3 w-3 text-sky-600" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {currentExtraMessages.map((em, eidx) => (
                  <div key={`extra-${eidx}`} className="flex justify-end vx-view-enter">
                    <div className="max-w-[86%] sm:max-w-[72%] rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-black shadow-[0_8px_24px_-12px_rgba(255,255,255,0.25)]">
                      <p className="whitespace-pre-line text-sm leading-relaxed">{em.body}</p>
                      <div className="mt-1.5 flex items-center justify-end gap-1 font-mono text-[11.5px] text-neutral-500">
                        <span>{em.time}</span>
                        {isSending && eidx === currentExtraMessages.length - 1 ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCheck className="h-3 w-3 text-sky-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Retour d'envoi */}
              {sendFeedback && (
                <div
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
              <div className="border-t border-[#2D261E] bg-[#0E0C0A] p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {SNIPPETS.map((snip) => {
                    const Icon = snip.icon;
                    const active = replyText === snip.text;
                    return (
                      <button
                        key={snip.label}
                        type="button"
                        onClick={() => setReplyText(snip.text)}
                        title={snip.text}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors duration-200 cursor-pointer ${
                          active
                            ? 'border-[#E5B54F]/40 bg-[#E5B54F]/10 text-[#F1DDB4]'
                            : 'border-[#2D261E] bg-white/[0.02] text-[#A8A29E] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <Icon className="h-3 w-3" strokeWidth={1.5} />
                        {snip.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-end gap-2 rounded-2xl border border-[#2D261E] bg-white/[0.025] p-1.5 pl-4 focus-within:border-white/25 transition-colors duration-200">
                  <textarea
                    rows={1}
                    placeholder={`Répondre à ${selectedConv.name}`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    aria-label="Réponse WhatsApp"
                    className="flex-1 resize-none bg-transparent py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none max-h-28"
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isSending}
                    aria-label="Envoyer sur WhatsApp"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all duration-150 ease-press cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
                  </button>
                </div>
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
