import { Fragment, useEffect, useRef, useState, type CSSProperties, type FC, type ReactNode } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  Loader2,
  MessagesSquare,
  Music,
  PenLine,
  Phone,
  Radio,
  RotateCcw,
  Send,
  TrendingUp,
  UserRoundSearch,
  Wallet,
  Coins,
  Music2,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  askCopilot,
  extractPhoneFragment,
  planCopilotTools,
  sendCopilotWhatsAppMessage,
  type CopilotMessage
} from '../services/copilot';
import { getLiveStudioMetrics } from '../services/supabase';
import { useStudioLive } from '../hooks/useStudioLive';
import type { Order, StudioMetrics } from '../types';
import { REAL_STUDIO_METRICS } from '../data/realProductionData';
import { SonarGlyph, SonarMascot } from './SonarMascot';
import { SONAR_STATE_LABEL, type SonarState } from './sonarState';
import { WaveformPlayer } from './WaveformPlayer';
import { getStudioCredits, subscribeToBilling } from '../services/billing';
import { generateKieSong, deliverSongToWhatsApp } from '../services/kie';

interface StudioCopilotViewProps {
  sessionName?: string;
  onNavigateToStudio?: () => void;
  /** Commandes du studio (mêmes données que la Caisse) pour le suivi des ventes */
  orders?: Order[];
  metrics?: StudioMetrics;
}

/* ------------------------------------------------------------------ */
/* Outils & sources de données                                        */
/* ------------------------------------------------------------------ */

type SourceId = 'whatsapp' | 'orders' | 'lyrics' | 'knowledge';

const SOURCES: { id: SourceId; label: string; detail: string; icon: LucideIcon }[] = [
  { id: 'whatsapp', label: 'Conversations WhatsApp', detail: 'Fils et notes vocales WAHA', icon: MessagesSquare },
  { id: 'orders', label: 'Commandes & encaissements', detail: 'Base Supabase du studio', icon: Database },
  { id: 'lyrics', label: 'Atelier de paroles', detail: 'Couplets, refrains, outros', icon: PenLine },
  { id: 'knowledge', label: 'Méthode Velaris', detail: 'Tarifs, scripts de closing', icon: BookOpen },
];

interface ToolMeta {
  label: string;
  icon: LucideIcon;
  kind: 'search' | 'write';
  source: SourceId;
}

const TOOL_META: Record<string, ToolMeta> = {
  get_studio_metrics: { label: 'Lecture des encaissements', icon: Database, kind: 'search', source: 'orders' },
  get_live_orders: { label: 'Calcul des marges et du panier moyen', icon: Calculator, kind: 'search', source: 'orders' },
  search_client_context: { label: 'Recherche du contexte client', icon: UserRoundSearch, kind: 'search', source: 'whatsapp' },
  generate_lyric_score: { label: 'Composition des paroles', icon: PenLine, kind: 'write', source: 'lyrics' },
  search_studio_conversations: { label: 'Scan des conversations WhatsApp', icon: MessagesSquare, kind: 'search', source: 'whatsapp' },
  get_whatsapp_transcripts: { label: 'Lecture des transcriptions vocales', icon: FileText, kind: 'search', source: 'whatsapp' },
  query_velaris_knowledge_base: { label: 'Consultation de la méthode Velaris', icon: BookOpen, kind: 'search', source: 'knowledge' },
  sync_studio_database: { label: 'Base studio synchronisée', icon: Database, kind: 'search', source: 'orders' },
  detect_phone_number: { label: 'Détection du numéro', icon: Phone, kind: 'search', source: 'whatsapp' },
  lookup_contact_by_phone: { label: 'Recherche du contact par numéro', icon: UserRoundSearch, kind: 'search', source: 'whatsapp' },
  summarize_conversation: { label: 'Résumé de la discussion', icon: FileText, kind: 'write', source: 'whatsapp' },
  track_live_sales: { label: 'Suivi des ventes en direct', icon: Wallet, kind: 'search', source: 'orders' },
  compose_whatsapp_reply: { label: 'Rédaction du message WhatsApp', icon: Send, kind: 'write', source: 'whatsapp' },
  waha_gateway_ready: { label: 'Passerelle WAHA prête', icon: MessagesSquare, kind: 'search', source: 'whatsapp' },
};

const toolMeta = (id: string): ToolMeta =>
  TOOL_META[id] ?? { label: id.replace(/_/g, ' '), icon: Database, kind: 'search', source: 'knowledge' };

const STEP_MS = 700;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const nowTime = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Rendu Markdown léger (titres, listes, gras, italique)              */
/* ------------------------------------------------------------------ */

const renderInline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} className="font-serif italic text-[1.08em] text-[#E9D5AE]">{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });

const RichText: FC<{ text: string; caret?: boolean }> = ({ text, caret }) => {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: { marker: string; body: string }[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const current = list;
    blocks.push(
      <ul key={`l${blocks.length}`} className="space-y-1.5">
        {current.items.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            {current.ordered ? (
              <span className="font-mono text-[12.5px] text-[#E5B54F] pt-[3px] shrink-0 w-4">{item.marker}</span>
            ) : (
              <span className="mt-[9px] h-px w-2.5 bg-[#E5B54F]/70 shrink-0" />
            )}
            <span>{renderInline(item.body)}</span>
          </li>
        ))}
      </ul>
    );
    list = null;
  };

  let table: string[][] | null = null;
  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    blocks.push(
      <div key={`t${blocks.length}`} className="overflow-x-auto rounded-xl border border-[#2D261E]">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-[#2D261E] bg-white/[0.02]">
              {head.map((cell, i) => (
                <th key={i} className="px-3.5 py-2 font-normal text-[12.5px] text-neutral-500">{cell.replace(/\*\*/g, '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-[#2D261E] last:border-0">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`px-3.5 py-2.5 align-top ${
                      c === 0 ? 'text-neutral-300' : c === 1 ? 'font-mono font-semibold text-white whitespace-nowrap' : 'text-neutral-500'
                    }`}
                  >
                    {cell.replace(/\*\*/g, '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    table = null;
  };

  text.split('\n').forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) return;
      (table ??= []).push(cells);
      return;
    }
    flushTable();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);

    if (bullet || ordered) {
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(ordered ? { marker: ordered[1].padStart(2, '0'), body: ordered[2] } : { marker: '', body: bullet![1] });
      return;
    }

    flushList();
    if (!line.trim()) return;

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <h3 key={idx} className="font-display text-lg sm:text-xl font-bold text-white">
          {renderInline(heading[1])}
        </h3>
      );
    } else {
      blocks.push(<p key={idx}>{renderInline(line)}</p>);
    }
  });
  flushList();
  flushTable();

  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-[#D6D3D1]">
      {blocks}
      {caret && <span className="vx-caret" aria-hidden="true" />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Trace des outils en direct                                         */
/* ------------------------------------------------------------------ */

const ToolTrace: FC<{ tools: string[]; step: number }> = ({ tools, step }) => (
  <div className="vx-fade-in rounded-2xl border border-[#2D261E] bg-[#141210] p-4 space-y-1">
    {tools.map((id, i) => {
      const meta = toolMeta(id);
      const Icon = meta.icon;
      const status = i < step ? 'done' : i === step ? 'active' : 'pending';
      return (
        <div
          key={id}
          className={`relative flex items-center gap-3 rounded-xl px-2.5 py-2 overflow-hidden transition-colors duration-300 ${
            status === 'active' ? 'bg-white/[0.035]' : ''
          }`}
        >
          <span
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300 ${
              status === 'done'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : status === 'active'
                  ? 'border-[#E5B54F]/40 bg-[#E5B54F]/10 text-[#F3CA75]'
                  : 'border-[#2D261E] bg-white/[0.02] text-neutral-600'
            }`}
          >
            {status === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </span>
          <span className={`flex-1 text-[13px] transition-colors duration-300 ${status === 'pending' ? 'text-neutral-600' : 'text-neutral-200'}`}>
            {meta.label}
          </span>
          <span className="font-mono text-[11.5px] text-neutral-500 shrink-0">
            {status === 'done' ? 'ok' : status === 'active' ? 'en cours' : 'en file'}
          </span>
          {status === 'active' && (
            <span className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
              <span className="vx-scan block h-full w-full bg-gradient-to-r from-transparent via-[#E5B54F] to-transparent" />
            </span>
          )}
        </div>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ */
/* Vue                                                                */
/* ------------------------------------------------------------------ */

const WELCOME: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
`### Bonjour, je suis Sonar.
Votre analyste et assistant de production. Je lis en direct :
- **Vos encaissements et commandes** enregistrés dans la base du studio.
- **Vos conversations WhatsApp et briefs clients** captés par la passerelle WAHA.
- **Tout le site Velaris** : tarifs, délais, lignes WhatsApp, automatisations, académie.

Tapez simplement un **numéro** (même partiel, ex. *5835*) pour retrouver une discussion complète, ou demandez un chiffre, des paroles, une relance.`,
  timestamp: 'En direct',
  toolsExecuted: ['sync_studio_database', 'waha_gateway_ready'],
};

const SUGGESTIONS: { label: string; hint: string; icon: LucideIcon; query: string }[] = [
  { label: 'Ventes en direct', hint: 'CA cumulé, Wave / Orange Money, marge', icon: TrendingUp, query: "Combien ai-je encaissé et quelle est la répartition Wave / Orange Money ?" },
  { label: 'Retrouver par numéro', hint: 'Discussion complète et résumé', icon: Phone, query: 'Que m’a dit le 79 29 64 99 ?' },
  { label: 'Dernier brief client', hint: 'Ce que le client a demandé sur WhatsApp', icon: MessagesSquare, query: 'Rappelle-moi la discussion avec le dernier client WhatsApp.' },
  { label: 'Écrire des paroles', hint: 'Anniversaire, voix douce', icon: Music, query: "Écris les paroles pour l'anniversaire d'Orokiatou, style Afro Love." },
  { label: 'Relancer un indécis', hint: 'Message prêt à envoyer', icon: ArrowUpRight, query: 'Relance le 05 44 91 20 qui hésite à payer.' },
  { label: 'Connaître Velaris', hint: 'Tarifs, délais, QR WhatsApp', icon: BookOpen, query: 'Quels sont les tarifs et les délais de livraison ?' },
];

export const StudioCopilotView: FC<StudioCopilotViewProps> = ({
  sessionName: propSessionName,
  onNavigateToStudio,
  orders = [],
  metrics
}) => {
  const { user } = useAuth();
  const sessionName = propSessionName || (user ? `studio_${user.id.slice(0, 8)}` : 'Test');

  const [messages, setMessages] = useState<CopilotMessage[]>([WELCOME]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [keyPulse, setKeyPulse] = useState(0);
  const [trace, setTrace] = useState<{ tools: string[]; step: number } | null>(null);
  const [reveal, setReveal] = useState<{ id: string; total: number } | null>(null);
  const [revealChars, setRevealChars] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingMessageMap, setSendingMessageMap] = useState<Record<string, boolean>>({});
  const [sentSuccessMap, setSentSuccessMap] = useState<Record<string, boolean>>({});
  const [generatingSongMap, setGeneratingSongMap] = useState<Record<string, boolean>>({});
  const [songDeliveredMap, setSongDeliveredMap] = useState<Record<string, boolean>>({});

  // Solde de crédits Studio
  const [credits, setCredits] = useState(getStudioCredits());
  useEffect(() => {
    return subscribeToBilling(() => setCredits(getStudioCredits()));
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerateSongFromCard = async (msgId: string, card: any) => {
    setGeneratingSongMap(prev => ({ ...prev, [msgId]: true }));
    const gen = await generateKieSong({
      prompt: card.content,
      lyrics: card.content,
      style: card.style || 'Afro-Love acoustique',
      title: card.title || `Chanson pour ${card.recipient || 'Client'}`,
      clientName: card.recipient || 'Client',
      clientPhone: card.phone || '',
      orderId: `ORD-${Date.now().toString().slice(-4)}`
    });
    setGeneratingSongMap(prev => ({ ...prev, [msgId]: false }));

    if (gen.success && gen.result) {
      const res = gen.result;
      const newMsg: CopilotMessage = {
        id: `song_${Date.now()}`,
        role: 'assistant',
        text: `### Chanson générée avec succès pour ${card.recipient || 'Client'} !\n\nStyle : **${card.style || 'Afro-Love'}** · 1 crédit débité (85 F CFA).\nLe master audio est prêt pour écoute et expédition client WhatsApp.`,
        timestamp: nowTime(),
        toolsExecuted: ['check_studio_credits', 'query_kie_ai_api', 'synthesize_audio_master'],
        actionCard: {
          type: 'song_generation',
          title: res.title,
          phone: card.phone,
          recipient: card.recipient,
          style: card.style,
          content: card.content,
          metadata: {
            taskId: res.taskId,
            orderId: res.orderId,
            audioUrl: res.audioUrl,
            duration: res.duration,
            isSimulation: res.isSimulation,
            notice: res.notice,
            waLink: card.metadata?.waLink
          }
        }
      };
      setMessages(prev => [...prev, newMsg]);
    }
  };

  const handleDeliverSongToWhatsApp = async (msgId: string, card: any) => {
    if (!card.phone) return;
    setSendingMessageMap(prev => ({ ...prev, [msgId]: true }));
    const delivery = await deliverSongToWhatsApp({
      taskId: card.metadata?.taskId || 'demo_task',
      orderId: card.metadata?.orderId || 'ORD-001',
      clientName: card.recipient || 'Client',
      clientPhone: card.phone,
      isNewClient: false,
      title: card.title,
      style: card.style || 'Afro-Love',
      status: 'success',
      audioUrl: card.metadata?.audioUrl,
      createdAt: new Date().toISOString()
    }, sessionName);
    setSendingMessageMap(prev => ({ ...prev, [msgId]: false }));
    if (delivery.success) {
      setSongDeliveredMap(prev => ({ ...prev, [msgId]: true }));
    }
  };

  /* Ventes en direct : Realtime Supabase sur les commandes (studio connecté) */
  const { data: liveMetrics, syncedAt: metricsSyncedAt } = useStudioLive<StudioMetrics>(
    getLiveStudioMetrics,
    metrics ?? REAL_STUDIO_METRICS,
    ['orders'],
    [user?.id],
    { enabled: !!user }
  );
  const sumBy = (re: RegExp) => orders.filter(o => re.test(o.paymentMethod)).reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
  const waveTotal = sumBy(/wave/i);
  const omTotal = sumBy(/orange|moov|mtn/i);
  const wavePct = waveTotal + omTotal > 0 ? Math.round((waveTotal / (waveTotal + omTotal)) * 100) : 0;

  const detectedPhone = extractPhoneFragment(inputPrompt);

  const tracing = trace !== null;
  const traceStep = trace?.step;
  const revealing = reveal !== null;

  /* Défilement interne uniquement (ne fait pas sauter la page) */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, traceStep, tracing, revealing]);

  /* Avance de la trace d'outils pendant le calcul */
  useEffect(() => {
    if (!tracing) return;
    const timer = setInterval(() => {
      setTrace(t => (t && t.step < t.tools.length - 1 ? { ...t, step: t.step + 1 } : t));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [tracing]);

  /* Rédaction progressive de la dernière réponse */
  useEffect(() => {
    if (!reveal) return;
    const duration = Math.min(1800, Math.max(600, reveal.total * 6));
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        setReveal(null);
        return;
      }
      setRevealChars(Math.floor(reveal.total * (1 - Math.pow(1 - t, 2))));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reveal]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputPrompt).trim();
    if (!query || tracing) return;

    const userMessage: CopilotMessage = { id: `user_${Date.now()}`, role: 'user', text: query, timestamp: nowTime() };
    const history = [...messages, userMessage];
    setMessages(history);
    setInputPrompt('');
    setReveal(null);

    const tools = planCopilotTools(query);
    setTrace({ tools, step: 0 });

    let response: CopilotMessage;
    try {
      /* La trace reste visible le temps de dérouler chaque outil */
      [response] = await Promise.all([
        askCopilot(query, history, sessionName, user, { orders, metrics }),
        wait(prefersReducedMotion() ? 0 : tools.length * STEP_MS + 250),
      ]);
    } catch {
      response = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: "Le Copilot n'a pas pu interroger vos données. Vérifiez votre connexion puis relancez la question.",
        timestamp: nowTime(),
      };
    }

    setTrace(null);
    setMessages(prev => [...prev, response]);
    if (!prefersReducedMotion()) {
      setRevealChars(0);
      setReveal({ id: response.id, total: response.text.length });
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDirectWhatsAppSend = async (cardId: string, phone?: string, content?: string, convId?: string) => {
    if (!phone || !content) return;
    setSendingMessageMap(prev => ({ ...prev, [cardId]: true }));

    const res = await sendCopilotWhatsAppMessage(phone, content, sessionName, convId);
    setSendingMessageMap(prev => ({ ...prev, [cardId]: false }));

    if (res.success) {
      setSentSuccessMap(prev => ({ ...prev, [cardId]: true }));
      setTimeout(() => {
        setSentSuccessMap(prev => ({ ...prev, [cardId]: false }));
      }, 6000);
    } else {
      alert(`Erreur d'envoi WhatsApp : ${res.error || 'Vérifiez la connexion de votre passerelle WAHA'}`);
    }
  };

  const handleReset = () => {
    setMessages([WELCOME]);
    setReveal(null);
    inputRef.current?.focus();
  };

  /* État de la mascotte, dérivé de l'activité */
  const activeTool = trace ? toolMeta(trace.tools[trace.step]) : null;
  const sonarState: SonarState = activeTool
    ? activeTool.kind === 'write' ? 'writing' : 'searching'
    : revealing
      ? 'writing'
      : inputFocused || inputPrompt
        ? 'listening'
        : 'idle';

  /* Sources consultées par la dernière réponse */
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const touchedSources = new Set((lastAssistant?.toolsExecuted ?? []).map(t => toolMeta(t).source));
  const statusCaption: Record<SonarState, string> = {
    idle: 'Posez une question ou choisissez une action rapide.',
    listening: 'Je vous écoute. Entrée pour envoyer.',
    searching: activeTool ? `${activeTool.label}.` : 'Lecture de vos données.',
    writing: 'Je mets en forme la réponse.',
  };

  const isFresh = messages.length === 1;

  return (
    <div className="max-w-6xl mx-auto vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 mb-5 border-b border-[#2D261E]">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Copilot & analyste</h1>
          <p className="text-sm sm:text-base text-[#A8A29E] mt-2 leading-relaxed max-w-xl">
            Sonar lit vos ventes, vos conversations WhatsApp et vos briefs, puis rédige à votre place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[#2D261E] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-[#A8A29E]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
            <span>Passerelle</span>
            <span className="font-mono text-white">{sessionName}</span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            title="Nouvelle conversation"
            aria-label="Nouvelle conversation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2D261E] bg-white/[0.02] text-[#A8A29E] hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
        {/* Rail : mascotte + instruments */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="vx-hairline relative overflow-hidden rounded-2xl border border-[#2D261E] bg-[#13110E] p-4 lg:p-6 flex lg:flex-col items-center gap-4 lg:gap-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(18rem_12rem_at_50%_0%,rgba(229,181,79,0.10),transparent_70%)]"
            />
            <SonarMascot state={sonarState} pulse={keyPulse} trackPointer size={168} className="relative hidden lg:block" />
            <SonarMascot state={sonarState} pulse={keyPulse} size={76} className="relative lg:hidden shrink-0" />
            <div className="relative lg:text-center min-w-0">
              <div className="font-serif text-2xl text-white leading-none">Sonar</div>
              <div className="mt-2 flex lg:justify-center items-center gap-2 text-[13px] text-neutral-200" aria-live="polite">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    sonarState === 'idle' ? 'bg-neutral-500' : sonarState === 'listening' ? 'bg-emerald-400' : 'bg-[#E5B54F] vx-breathe'
                  }`}
                />
                <span>{SONAR_STATE_LABEL[sonarState]}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-neutral-500 leading-relaxed lg:max-w-[200px] lg:mx-auto truncate lg:whitespace-normal">
                {statusCaption[sonarState]}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2D261E] bg-[#171512] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Radio className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.6} />
                Ventes en direct
              </span>
              <span className="flex items-center gap-1.5 text-xs tabular-nums text-[#A8A29E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] vx-breathe" />
                {metricsSyncedAt ? metricsSyncedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '…'}
              </span>
            </div>
            <div>
              <div className="text-xs text-[#A8A29E]">Chiffre d'affaires cumulé</div>
              <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-[#F3CA75] whitespace-nowrap">
                {Math.round(liveMetrics.totalRevenue || 0).toLocaleString('fr-FR')}
                <span className="ml-1 text-sm font-medium text-[#A8A29E]">F</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Livrées', value: liveMetrics.ordersDelivered },
                { label: 'En cours', value: liveMetrics.ordersActive },
                { label: 'Marge', value: '92,4 %' },
              ].map(k => (
                <div key={k.label} className="rounded-xl border border-[#2D261E] bg-[#0E0C0A] px-2 py-2">
                  <div className="font-mono text-base font-semibold text-white">{k.value}</div>
                  <div className="text-[11.5px] text-[#A8A29E]">{k.label}</div>
                </div>
              ))}
            </div>
            {waveTotal + omTotal > 0 && (
              <div className="space-y-1.5">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-[#2A241D]">
                  <span className="vx-fill block h-full bg-[#E5B54F]" style={{ width: `${wavePct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-[#A8A29E]">
                  <span>Wave {wavePct} %</span>
                  <span>Orange Money {100 - wavePct} %</span>
                </div>
              </div>
            )}
          </div>

          {/* Solde Crédits Studio & Moteur Kie.ai */}
          <div className="rounded-2xl border border-[#E5B54F]/30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C1710] to-[#0E0C0A] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Coins className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.6} />
                Crédits Studio
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <Sparkles className="h-2.5 w-2.5" />
                Permanent
              </span>
            </div>
            <div>
              <div className="text-xs text-[#A8A29E]">Générateur Kie.ai (Suno)</div>
              <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-[#F3CA75] whitespace-nowrap">
                {credits.balance.toFixed(2)}
                <span className="ml-1 text-xs font-medium text-[#A8A29E]">crédits</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-[#A8A29E] pt-2 border-t border-[#2D261E]">
              <span>1 chanson = 1 crédit (85 F)</span>
              <span className="font-mono text-neutral-300">Sans expiration</span>
            </div>
          </div>

          <div className="hidden lg:block rounded-2xl border border-[#2D261E] bg-[#13110E] p-2">
            <div className="px-2.5 pt-2 pb-2.5 text-[12.5px] text-neutral-500">Sources de données</div>
            {SOURCES.map((s) => {
              const Icon = s.icon;
              const live = activeTool?.source === s.id;
              const touched = !trace && touchedSources.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 border transition-colors duration-300 ${
                    live ? 'border-[#E5B54F]/30 bg-[#E5B54F]/[0.06]' : 'border-transparent'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300 ${
                      live ? 'border-[#E5B54F]/40 text-[#F3CA75]' : 'border-[#2D261E] text-[#A8A29E]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-neutral-200 truncate">{s.label}</span>
                    <span className="block text-[12.5px] text-neutral-500 truncate">{s.detail}</span>
                  </span>
                  {live ? (
                    <span className="vx-wave-live flex items-center gap-[2px] h-4" aria-label="Lecture en cours">
                      {[0, 1, 2, 3].map(i => (
                        <span
                          key={i}
                          className="vx-wave-bar block w-[2px] h-full rounded-full bg-[#E5B54F]"
                          style={{ animationDelay: `${i * -0.18}s` }}
                        />
                      ))}
                    </span>
                  ) : touched ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} aria-label="Consultée" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-neutral-700" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Fil de discussion */}
        <section className="rounded-2xl border border-[#2D261E] bg-[#13110E] flex flex-col overflow-hidden lg:h-[calc(100dvh-16rem)] lg:min-h-[560px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7 max-h-[64vh] lg:max-h-none">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const isRevealing = reveal?.id === m.id;
              const shownText = isRevealing ? m.text.slice(0, revealChars) : m.text;

              if (isUser) {
                return (
                  <div key={m.id} className="flex flex-col items-end gap-1.5 vx-fade-in">
                    <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md bg-[#E5B54F] px-4 py-3 text-[15px] leading-relaxed text-[#0C0A09] font-medium shadow-[0_8px_30px_-8px_rgba(229,181,79,0.35)]">
                      {m.text}
                    </div>
                    <span className="font-mono text-[11.5px] text-neutral-600 px-1">{m.timestamp}</span>
                  </div>
                );
              }

              return (
                <div key={m.id} className="flex gap-3 sm:gap-4 vx-fade-in">
                  <div className="shrink-0 pt-0.5">
                    <SonarGlyph size={30} />
                  </div>
                  <div className="min-w-0 flex-1 max-w-[680px] space-y-3">
                    <div
                      className={`vx-hairline rounded-2xl rounded-tl-md border border-[#2D261E] bg-gradient-to-b from-[#1A1713] to-[#141210] p-4 sm:p-5 ${
                        m.id !== WELCOME.id ? 'vx-sheen' : ''
                      }`}
                    >
                      <RichText text={shownText} caret={isRevealing} />

                      {m.toolsExecuted && m.toolsExecuted.length > 0 && !isRevealing && (
                        <div className="mt-4 pt-3 border-t border-[#2D261E] flex flex-wrap items-center gap-1.5">
                          {m.toolsExecuted.map((t, i) => {
                            const meta = toolMeta(t);
                            const Icon = meta.icon;
                            return (
                              <span
                                key={t}
                                style={{ '--i': i } as CSSProperties}
                                className="vx-stagger inline-flex items-center gap-1.5 rounded-full border border-[#2D261E] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-[#A8A29E]"
                              >
                                <Icon className="h-3 w-3 text-emerald-400/80" strokeWidth={1.5} />
                                {meta.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {m.actionCard && !isRevealing && (
                      <div className="vx-view-enter vx-sheen relative overflow-hidden rounded-2xl border border-[#E5B54F]/25 bg-[#141210] shadow-[0_24px_60px_-20px_rgba(229,181,79,0.18)]">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(24rem_10rem_at_0%_0%,rgba(229,181,79,0.10),transparent_70%)]"
                        />
                        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#2D261E]">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5B54F]/30 bg-[#E5B54F]/10 text-[#F3CA75]">
                              {m.actionCard.type === 'song_generation' ? (
                                <Music2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                              ) : m.actionCard.type === 'lyrics' ? (
                                <Music className="h-3.5 w-3.5" strokeWidth={1.5} />
                              ) : m.actionCard.type === 'client_brief' ? (
                                <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                              ) : (
                                <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                              )}
                            </span>
                            <span className="text-base font-semibold text-white truncate">{m.actionCard.title}</span>
                          </div>
                          {m.actionCard.phone && (
                            <span className="font-mono text-[12.5px] text-emerald-300 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 shrink-0">
                              {m.actionCard.phone}
                            </span>
                          )}
                        </div>

                        {m.actionCard.type === 'song_generation' ? (
                          <div className="p-4 sm:p-5 space-y-3 bg-[#110F0D]">
                            <div className="flex items-center justify-between text-xs text-[#A8A29E]">
                              <span className="flex items-center gap-1.5 text-white font-medium">
                                <Music2 className="h-3.5 w-3.5 text-[#E5B54F]" />
                                Master Audio Studio (Kie.ai Suno)
                              </span>
                              <span className="font-mono text-emerald-400">1 crédit débité (85 F CFA)</span>
                            </div>
                            <div className="rounded-xl border border-[#2D261E] bg-[#171512] p-3.5">
                              <WaveformPlayer seed={m.id} src={m.actionCard.metadata?.audioUrl} durationHint={m.actionCard.metadata?.duration || 180} tone="dark" />
                            </div>
                            {m.actionCard.metadata?.notice && (
                              <p className="text-[11px] text-[#A8A29E] bg-[#1A1713] p-2.5 rounded-lg border border-[#2D261E]">
                                {m.actionCard.metadata.notice}
                              </p>
                            )}
                            <div className="font-serif text-[15px] leading-relaxed text-[#F1E6CF] max-h-36 overflow-y-auto whitespace-pre-wrap p-2 border border-white/5 rounded-lg">
                              {m.actionCard.content}
                            </div>
                          </div>
                        ) : m.actionCard.type === 'stats' && m.actionCard.metadata ? (
                          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06]">
                            {[
                              { label: 'Encaissé', value: String(m.actionCard.metadata.totalRevenue ?? '0'), unit: 'F' },
                              { label: 'Livrées', value: String(m.actionCard.metadata.delivered ?? 0), unit: '' },
                              { label: 'En cours', value: String(m.actionCard.metadata.active ?? 0), unit: '' },
                              { label: 'Closing', value: String(m.actionCard.metadata.convRate ?? 0).replace('.', ','), unit: '%' },
                            ].map((k, i) => (
                              <div key={k.label} style={{ '--i': i } as CSSProperties} className="vx-stagger bg-[#141210] px-4 sm:px-5 py-4">
                                <div className="text-[12.5px] text-neutral-500">{k.label}</div>
                                <div className="mt-1.5 font-mono text-xl font-bold tracking-tight text-white whitespace-nowrap">
                                  {k.value}
                                  {k.unit && <span className="ml-1 text-[13px] font-medium text-neutral-500">{k.unit}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                        <div
                          className={`relative px-4 sm:px-5 py-4 max-h-64 overflow-y-auto whitespace-pre-wrap ${
                            m.actionCard.type === 'lyrics'
                              ? 'font-serif text-[17px] leading-[1.65] text-[#F1E6CF]'
                              : 'font-mono text-[13px] leading-relaxed text-neutral-300'
                          }`}
                        >
                          {m.actionCard.content}
                        </div>
                        )}

                        <div className="relative flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5 border-t border-[#2D261E] bg-black/20">
                          <button
                            type="button"
                            onClick={() => handleCopyText(m.id, m.actionCard!.content)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-neutral-200 hover:bg-white/[0.07] hover:border-white/30 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Copié</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                                <span>Copier</span>
                              </>
                            )}
                          </button>

                          {m.actionCard.type === 'song_generation' && m.actionCard.phone && (
                            <button
                              type="button"
                              disabled={sendingMessageMap[m.id]}
                              onClick={() => handleDeliverSongToWhatsApp(m.id, m.actionCard)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#22C55E] px-4 py-2 text-sm font-semibold text-black hover:bg-[#16A34A] active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer disabled:opacity-50 shadow-[0_0_24px_-6px_rgba(34,197,94,0.5)]"
                            >
                              {sendingMessageMap[m.id] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Livraison en cours...</span>
                                </>
                              ) : songDeliveredMap[m.id] ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-black" />
                                  <span>Chanson livrée sur WhatsApp !</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Livrer le morceau au client</span>
                                </>
                              )}
                            </button>
                          )}

                          {m.actionCard.type === 'lyrics' && (
                            <button
                              type="button"
                              disabled={generatingSongMap[m.id]}
                              onClick={() => handleGenerateSongFromCard(m.id, m.actionCard)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#E5B54F] px-4 py-1.5 text-[13px] font-semibold text-black hover:bg-[#F0C068] active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer shadow-[0_0_20px_-5px_rgba(229,181,79,0.4)]"
                            >
                              {generatingSongMap[m.id] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Génération Kie.ai...</span>
                                </>
                              ) : (
                                <>
                                  <Music2 className="h-3.5 w-3.5" />
                                  <span>Générer avec Kie.ai (1 crédit)</span>
                                </>
                              )}
                            </button>
                          )}

                          {m.actionCard.phone && m.actionCard.type !== 'song_generation' && (
                            <button
                              type="button"
                              disabled={sendingMessageMap[m.id]}
                              onClick={() =>
                                handleDirectWhatsAppSend(m.id, m.actionCard?.phone, m.actionCard?.content, m.actionCard?.metadata?.convId)
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#E5B54F] px-4 py-2 text-sm font-semibold text-[#0C0A09] hover:bg-[#F0C068] active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer disabled:opacity-50 shadow-[0_0_24px_-6px_rgba(229,181,79,0.5)]"
                            >
                              {sendingMessageMap[m.id] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Envoi en cours</span>
                                </>
                              ) : sentSuccessMap[m.id] ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Envoyé sur WhatsApp</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Envoyer sur WhatsApp</span>
                                </>
                              )}
                            </button>
                          )}

                          {m.actionCard.metadata?.waLink && (
                            <a
                              href={m.actionCard.metadata.waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/40 bg-[#22C55E]/[0.08] px-4 py-2 text-sm font-semibold text-[#4ADE80] hover:bg-[#22C55E]/[0.14] active:scale-[0.97] transition-all duration-150 ease-press"
                            >
                              <MessagesSquare className="h-3.5 w-3.5" strokeWidth={1.8} />
                              <span>Ouvrir WhatsApp</span>
                            </a>
                          )}

                          {m.actionCard.type === 'lyrics' && onNavigateToStudio && (
                            <button
                              type="button"
                              onClick={onNavigateToStudio}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#3A3022] px-4 py-1.5 text-[13px] font-semibold text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                            >
                              <span>Envoyer à l'Atelier</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="font-mono text-[11.5px] text-neutral-600 px-1">{m.timestamp}</div>
                  </div>
                </div>
              );
            })}

            {trace && (
              <div className="flex gap-3 sm:gap-4">
                <div className="shrink-0 pt-0.5">
                  <SonarGlyph size={30} />
                </div>
                <div className="flex-1 max-w-[520px]">
                  <ToolTrace tools={trace.tools} step={trace.step} />
                </div>
              </div>
            )}

            {isFresh && !trace && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-0 sm:pl-[46px]">
                {SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleSendMessage(s.query)}
                      style={{ '--i': i + 2 } as CSSProperties}
                      className="vx-stagger group flex items-start gap-3 rounded-2xl border border-[#2D261E] bg-white/[0.015] p-3.5 text-left hover:border-white/[0.18] hover:bg-white/[0.035] active:scale-[0.99] transition-all duration-200 ease-luxury cursor-pointer"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2D261E] text-[#A8A29E] group-hover:text-[#F3CA75] group-hover:border-[#E5B54F]/30 transition-colors duration-200">
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-neutral-100">{s.label}</span>
                        <span className="block mt-0.5 text-[12.5px] text-neutral-500">{s.hint}</span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compositeur */}
          <div className="border-t border-[#2D261E] bg-[#0E0C0A] p-3 sm:p-4 space-y-2.5">
            {!isFresh && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      disabled={tracing}
                      onClick={() => handleSendMessage(s.query)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#2D261E] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-[#A8A29E] hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer disabled:opacity-40"
                    >
                      <Icon className="h-3 w-3" strokeWidth={1.5} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {detectedPhone && !tracing && (
              <div className="vx-fade-in flex items-center gap-2 rounded-xl border border-[#E5B54F]/35 bg-[#E5B54F]/[0.07] px-3 py-2 text-sm text-[#F3CA75]">
                <Phone className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">
                  Numéro détecté <span className="font-mono font-semibold">{detectedPhone}</span> : Entrée pour retrouver la discussion complète
                </span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={`flex items-end gap-2 rounded-2xl border bg-white/[0.025] p-1.5 pl-4 transition-colors duration-200 ${
                inputFocused ? 'border-[#E5B54F]/45' : 'border-[#2D261E]'
              }`}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={inputPrompt}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onChange={(e) => {
                  setInputPrompt(e.target.value);
                  setKeyPulse(p => p + 1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Un numéro (+226…, 07…, 5835), un prénom, un chiffre, des paroles…"
                disabled={tracing}
                aria-label="Message pour Sonar"
                className="flex-1 resize-none bg-transparent py-2.5 text-[15px] text-white placeholder:text-[#78716C] outline-none max-h-32 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || tracing}
                aria-label="Envoyer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5B54F] text-[#0C0A09] hover:bg-[#F0C068] active:scale-95 transition-all duration-150 ease-press cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {tracing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
              </button>
            </form>
            <div className="flex items-center justify-between px-1 text-[12.5px] text-neutral-600">
              <span>
                <kbd className="font-mono text-[#A8A29E]">Entrée</kbd> pour envoyer,{' '}
                <kbd className="font-mono text-[#A8A29E]">Maj + Entrée</kbd> pour une nouvelle ligne
              </span>
              <span className="hidden sm:inline font-mono">Velaris Intelligence 2.5</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
