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
  RotateCcw,
  Send,
  TrendingUp,
  UserRoundSearch,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  askCopilot,
  sendCopilotWhatsAppMessage,
  type CopilotMessage
} from '../services/copilot';
import { SonarGlyph, SonarMascot } from './SonarMascot';
import { SONAR_STATE_LABEL, type SonarState } from './sonarState';

interface StudioCopilotViewProps {
  sessionName?: string;
  onNavigateToStudio?: () => void;
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
  waha_gateway_ready: { label: 'Passerelle WAHA prête', icon: MessagesSquare, kind: 'search', source: 'whatsapp' },
};

const toolMeta = (id: string): ToolMeta =>
  TOOL_META[id] ?? { label: id.replace(/_/g, ' '), icon: Database, kind: 'search', source: 'knowledge' };

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Même aiguillage que services/copilot.ts : annonce les outils pendant le calcul */
const predictTools = (query: string): string[] => {
  const n = normalize(query);
  const finance =
    ['chiffre', 'encaisse', 'revenu', 'stat', 'vente', 'performance', 'taux de conversion'].some(k => n.includes(k)) ||
    (n.includes('combien') && (n.includes('gagne') || n.includes('fait')));
  if (finance) return ['get_studio_metrics', 'get_live_orders'];
  if (['parole', 'ecris la chanson', 'redige la chanson', 'texte de la chanson', 'chanson pour'].some(k => n.includes(k))) {
    return ['search_client_context', 'generate_lyric_score'];
  }
  const recall =
    ['rappelle', 'resume', 'discute', 'parle', 'client', 'historique', 'conversation'].some(k => n.includes(k)) ||
    /\+?[0-9]{8,15}/.test(query);
  if (recall) return ['search_studio_conversations', 'get_whatsapp_transcripts'];
  return ['query_velaris_knowledge_base'];
};

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
              <span className="font-mono text-[11px] text-[#D6AA60] pt-[3px] shrink-0 w-4">{item.marker}</span>
            ) : (
              <span className="mt-[9px] h-px w-2.5 bg-[#D6AA60]/70 shrink-0" />
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
      <div key={`t${blocks.length}`} className="overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02]">
              {head.map((cell, i) => (
                <th key={i} className="px-3.5 py-2 font-normal text-[11px] text-neutral-500">{cell.replace(/\*\*/g, '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-white/[0.05] last:border-0">
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
        <h3 key={idx} className="font-heading text-[15px] sm:text-base font-semibold text-white tracking-tight">
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
    <div className="space-y-2.5 text-[13px] sm:text-sm leading-relaxed text-neutral-300">
      {blocks}
      {caret && <span className="vx-caret" aria-hidden="true" />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Trace des outils en direct                                         */
/* ------------------------------------------------------------------ */

const ToolTrace: FC<{ tools: string[]; step: number }> = ({ tools, step }) => (
  <div className="vx-fade-in rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-4 space-y-1">
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
                  ? 'border-[#D6AA60]/40 bg-[#D6AA60]/10 text-[#E9CC94]'
                  : 'border-white/[0.08] bg-white/[0.02] text-neutral-600'
            }`}
          >
            {status === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </span>
          <span className={`flex-1 text-xs transition-colors duration-300 ${status === 'pending' ? 'text-neutral-600' : 'text-neutral-200'}`}>
            {meta.label}
          </span>
          <span className="font-mono text-[10px] text-neutral-500 shrink-0">
            {status === 'done' ? 'ok' : status === 'active' ? 'en cours' : 'en file'}
          </span>
          {status === 'active' && (
            <span className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
              <span className="vx-scan block h-full w-full bg-gradient-to-r from-transparent via-[#D6AA60] to-transparent" />
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
- **Vos tarifs et automatisations** (1 200 F, 3 000 F, 5 000 F).

Demandez-moi un chiffre, retrouvez un client, ou laissez-moi écrire des paroles et vos messages de relance.`,
  timestamp: 'En direct',
  toolsExecuted: ['sync_studio_database', 'waha_gateway_ready'],
};

const SUGGESTIONS: { label: string; hint: string; icon: LucideIcon; query: string }[] = [
  { label: 'Synthèse des encaissements', hint: 'Chiffre d’affaires, livraisons, panier moyen', icon: TrendingUp, query: "Combien ai-je encaissé cette semaine et quel est mon chiffre d'affaires total ?" },
  { label: 'Dernier brief client', hint: 'Ce que le client a demandé sur WhatsApp', icon: MessagesSquare, query: 'Rappelle-moi la discussion avec le dernier client WhatsApp et ce qu’il a demandé.' },
  { label: 'Écrire des paroles', hint: 'Anniversaire romantique, voix douce', icon: Music, query: "Rédige les paroles d'une chanson d'anniversaire romantique pour une cliente." },
  { label: 'Relancer un indécis', hint: 'Message WhatsApp prêt à envoyer', icon: ArrowUpRight, query: 'Rédige-moi un message WhatsApp persuasif pour relancer un client qui hésite.' },
];

export const StudioCopilotView: FC<StudioCopilotViewProps> = ({
  sessionName: propSessionName,
  onNavigateToStudio
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

    const tools = predictTools(query);
    setTrace({ tools, step: 0 });

    let response: CopilotMessage;
    try {
      /* La trace reste visible le temps de dérouler chaque outil */
      [response] = await Promise.all([
        askCopilot(query, history, sessionName, user),
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 mb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Copilot & analyste</h1>
          <p className="text-sm text-neutral-400 mt-1.5 max-w-xl">
            Sonar lit vos ventes, vos conversations WhatsApp et vos briefs, puis rédige à votre place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
            <span>Passerelle</span>
            <span className="font-mono text-white">{sessionName}</span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            title="Nouvelle conversation"
            aria-label="Nouvelle conversation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
        {/* Rail : mascotte + instruments */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="vx-hairline relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08090C] p-4 lg:p-6 flex lg:flex-col items-center gap-4 lg:gap-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(18rem_12rem_at_50%_0%,rgba(214,170,96,0.10),transparent_70%)]"
            />
            <SonarMascot state={sonarState} pulse={keyPulse} trackPointer size={168} className="relative hidden lg:block" />
            <SonarMascot state={sonarState} pulse={keyPulse} size={76} className="relative lg:hidden shrink-0" />
            <div className="relative lg:text-center min-w-0">
              <div className="font-serif text-2xl text-white leading-none">Sonar</div>
              <div className="mt-2 flex lg:justify-center items-center gap-2 text-xs text-neutral-200" aria-live="polite">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    sonarState === 'idle' ? 'bg-neutral-500' : sonarState === 'listening' ? 'bg-emerald-400' : 'bg-[#D6AA60] vx-breathe'
                  }`}
                />
                <span>{SONAR_STATE_LABEL[sonarState]}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-500 leading-relaxed lg:max-w-[200px] lg:mx-auto truncate lg:whitespace-normal">
                {statusCaption[sonarState]}
              </p>
            </div>
          </div>

          <div className="hidden lg:block rounded-2xl border border-white/[0.08] bg-[#08090C] p-2">
            <div className="px-2.5 pt-2 pb-2.5 text-[11px] text-neutral-500">Sources de données</div>
            {SOURCES.map((s) => {
              const Icon = s.icon;
              const live = activeTool?.source === s.id;
              const touched = !trace && touchedSources.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 border transition-colors duration-300 ${
                    live ? 'border-[#D6AA60]/30 bg-[#D6AA60]/[0.06]' : 'border-transparent'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300 ${
                      live ? 'border-[#D6AA60]/40 text-[#E9CC94]' : 'border-white/[0.08] text-neutral-400'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-neutral-200 truncate">{s.label}</span>
                    <span className="block text-[11px] text-neutral-500 truncate">{s.detail}</span>
                  </span>
                  {live ? (
                    <span className="vx-wave-live flex items-center gap-[2px] h-4" aria-label="Lecture en cours">
                      {[0, 1, 2, 3].map(i => (
                        <span
                          key={i}
                          className="vx-wave-bar block w-[2px] h-full rounded-full bg-[#D6AA60]"
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
        <section className="rounded-2xl border border-white/[0.08] bg-[#08090C] flex flex-col overflow-hidden lg:h-[calc(100dvh-16rem)] lg:min-h-[560px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7 max-h-[64vh] lg:max-h-none">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const isRevealing = reveal?.id === m.id;
              const shownText = isRevealing ? m.text.slice(0, revealChars) : m.text;

              if (isUser) {
                return (
                  <div key={m.id} className="flex flex-col items-end gap-1.5 vx-fade-in">
                    <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md bg-white px-4 py-3 text-[13px] sm:text-sm leading-relaxed text-black font-medium shadow-[0_8px_30px_rgba(255,255,255,0.06)]">
                      {m.text}
                    </div>
                    <span className="font-mono text-[10px] text-neutral-600 px-1">{m.timestamp}</span>
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
                      className={`vx-hairline rounded-2xl rounded-tl-md border border-white/[0.08] bg-gradient-to-b from-[#0F1117] to-[#0A0B0F] p-4 sm:p-5 ${
                        m.id !== WELCOME.id ? 'vx-sheen' : ''
                      }`}
                    >
                      <RichText text={shownText} caret={isRevealing} />

                      {m.toolsExecuted && m.toolsExecuted.length > 0 && !isRevealing && (
                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5">
                          {m.toolsExecuted.map((t, i) => {
                            const meta = toolMeta(t);
                            const Icon = meta.icon;
                            return (
                              <span
                                key={t}
                                style={{ '--i': i } as CSSProperties}
                                className="vx-stagger inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] text-neutral-400"
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
                      <div className="vx-view-enter vx-sheen relative overflow-hidden rounded-2xl border border-[#D6AA60]/25 bg-[#0C0D11] shadow-[0_24px_60px_-20px_rgba(214,170,96,0.18)]">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(24rem_10rem_at_0%_0%,rgba(214,170,96,0.10),transparent_70%)]"
                        />
                        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/[0.06]">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D6AA60]/30 bg-[#D6AA60]/10 text-[#E9CC94]">
                              {m.actionCard.type === 'lyrics' ? (
                                <Music className="h-3.5 w-3.5" strokeWidth={1.5} />
                              ) : m.actionCard.type === 'client_brief' ? (
                                <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                              ) : (
                                <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                              )}
                            </span>
                            <span className="text-sm font-semibold text-white truncate">{m.actionCard.title}</span>
                          </div>
                          {m.actionCard.phone && (
                            <span className="font-mono text-[11px] text-emerald-300 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 shrink-0">
                              {m.actionCard.phone}
                            </span>
                          )}
                        </div>

                        {m.actionCard.type === 'stats' && m.actionCard.metadata ? (
                          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06]">
                            {[
                              { label: 'Encaissé', value: String(m.actionCard.metadata.totalRevenue ?? '0'), unit: 'F' },
                              { label: 'Livrées', value: String(m.actionCard.metadata.delivered ?? 0), unit: '' },
                              { label: 'En cours', value: String(m.actionCard.metadata.active ?? 0), unit: '' },
                              { label: 'Closing', value: String(m.actionCard.metadata.convRate ?? 0).replace('.', ','), unit: '%' },
                            ].map((k, i) => (
                              <div key={k.label} style={{ '--i': i } as CSSProperties} className="vx-stagger bg-[#0C0D11] px-4 sm:px-5 py-4">
                                <div className="text-[11px] text-neutral-500">{k.label}</div>
                                <div className="mt-1.5 font-mono text-xl font-bold tracking-tight text-white whitespace-nowrap">
                                  {k.value}
                                  {k.unit && <span className="ml-1 text-xs font-medium text-neutral-500">{k.unit}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                        <div
                          className={`relative px-4 sm:px-5 py-4 max-h-64 overflow-y-auto whitespace-pre-wrap ${
                            m.actionCard.type === 'lyrics'
                              ? 'font-serif text-[17px] leading-[1.65] text-[#F1E6CF]'
                              : 'font-mono text-xs leading-relaxed text-neutral-300'
                          }`}
                        >
                          {m.actionCard.content}
                        </div>
                        )}

                        <div className="relative flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5 border-t border-white/[0.06] bg-black/20">
                          <button
                            type="button"
                            onClick={() => handleCopyText(m.id, m.actionCard!.content)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/[0.07] hover:border-white/30 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
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

                          {m.actionCard.phone && (
                            <button
                              type="button"
                              disabled={sendingMessageMap[m.id]}
                              onClick={() =>
                                handleDirectWhatsAppSend(m.id, m.actionCard?.phone, m.actionCard?.content, m.actionCard?.metadata?.convId)
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer disabled:opacity-50 shadow-[0_0_24px_rgba(255,255,255,0.10)]"
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

                          {m.actionCard.type === 'lyrics' && onNavigateToStudio && (
                            <button
                              type="button"
                              onClick={onNavigateToStudio}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#D6AA60] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#E2BC7A] active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                            >
                              <span>Envoyer à l'Atelier</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="font-mono text-[10px] text-neutral-600 px-1">{m.timestamp}</div>
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
                      className="vx-stagger group flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-3.5 text-left hover:border-white/[0.18] hover:bg-white/[0.035] active:scale-[0.99] transition-all duration-200 ease-luxury cursor-pointer"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-neutral-400 group-hover:text-[#E9CC94] group-hover:border-[#D6AA60]/30 transition-colors duration-200">
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-neutral-100">{s.label}</span>
                        <span className="block mt-0.5 text-[11px] text-neutral-500">{s.hint}</span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compositeur */}
          <div className="border-t border-white/[0.08] bg-[#07080B] p-3 sm:p-4 space-y-2.5">
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
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-neutral-400 hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer disabled:opacity-40"
                    >
                      <Icon className="h-3 w-3" strokeWidth={1.5} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={`flex items-end gap-2 rounded-2xl border bg-white/[0.025] p-1.5 pl-4 transition-colors duration-200 ${
                inputFocused ? 'border-[#D6AA60]/45' : 'border-white/[0.08]'
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
                placeholder="Demandez un chiffre, un client, des paroles…"
                disabled={tracing}
                aria-label="Message pour Sonar"
                className="flex-1 resize-none bg-transparent py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none max-h-32 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || tracing}
                aria-label="Envoyer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all duration-150 ease-press cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {tracing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
              </button>
            </form>
            <div className="flex items-center justify-between px-1 text-[11px] text-neutral-600">
              <span>
                <kbd className="font-mono text-neutral-400">Entrée</kbd> pour envoyer,{' '}
                <kbd className="font-mono text-neutral-400">Maj + Entrée</kbd> pour une nouvelle ligne
              </span>
              <span className="hidden sm:inline font-mono">Velaris Intelligence 2.4</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
