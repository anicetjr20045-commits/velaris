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
  QrCode,
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
import { generateKieSong, deliverSongToWhatsApp, waitForKieSong } from '../services/kie';
import type { KieSongResult } from '../types/billing';

interface StudioCopilotViewProps {
  sessionName?: string;
  onNavigateToStudio?: () => void;
  onOpenQrModal?: () => void;
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
  lookup_client_dossier: { label: 'Ouverture du dossier client', icon: UserRoundSearch, kind: 'search', source: 'whatsapp' },
  extract_client_memories: { label: 'Extraction des souvenirs du brief', icon: FileText, kind: 'search', source: 'whatsapp' },
  check_studio_credits: { label: 'Vérification du solde de crédits', icon: Coins, kind: 'search', source: 'orders' },
  get_studio_credits: { label: 'Lecture du solde de crédits', icon: Coins, kind: 'search', source: 'orders' },
  get_subscription_status: { label: 'État de l’abonnement', icon: Wallet, kind: 'search', source: 'orders' },
  check_saspay_gateway: { label: 'Passerelle SasPay', icon: Wallet, kind: 'search', source: 'orders' },
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
  text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} className="font-serif italic text-[1.08em] text-[#E9D5AE]">{part.slice(1, -1)}</em>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const isWhatsApp = linkMatch[2].includes('wa.me');
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1 font-medium underline underline-offset-2 transition-colors ${
            isWhatsApp
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'text-[#E5B54F] hover:text-[#F3CA75]'
          }`}
        >
          {linkMatch[1]}
          <ArrowUpRight className="inline h-3 w-3 opacity-70" />
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });

const CopyableBlock: FC<{ content: string; label?: string }> = ({ content, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const isSong = content.includes('[Verse') || content.includes('[Couplet') || content.includes('[Intro]') || content.includes('[Refrain]');

  return (
    <div className="relative my-3.5 rounded-xl border border-white/[0.12] bg-[#07080B] overflow-hidden shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)] group">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center gap-2">
          {isSong ? (
            <Music className="h-3.5 w-3.5 text-[#E5B54F]" strokeWidth={1.6} />
          ) : (
            <FileText className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.6} />
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider font-medium text-[#E5B54F]">
            {label || (isSong ? 'Paroles prêtes à copier' : 'Texte structuré')}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium border border-white/[0.10] bg-white/[0.05] hover:bg-white/[0.10] hover:text-white text-neutral-300 transition-all cursor-pointer active:scale-95"
          title="Copier le texte en 1 clic"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} />
              <span className="text-emerald-300 font-semibold">Copié en 1 clic !</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-neutral-400" strokeWidth={1.6} />
              <span>Copier en 1 clic</span>
            </>
          )}
        </button>
      </div>
      <div className={`p-4 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto select-all ${
        isSong ? 'font-serif text-[15.5px] text-[#F3E8D3] leading-[1.6]' : 'font-mono text-[13px] text-neutral-200'
      }`}>
        {content}
      </div>
    </div>
  );
};

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
      <div key={`t${blocks.length}`} className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02]">
              {head.map((cell, i) => (
                <th key={i} className="px-3.5 py-2 font-normal text-[12.5px] text-neutral-500">{cell.replace(/\*\*/g, '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-white/[0.08] last:border-0">
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

  let inCode = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trimEnd();

    // Gestion des blocs de code ``` ... ```
    if (line.startsWith('```')) {
      if (inCode) {
        flushList();
        flushTable();
        const content = codeBuffer.join('\n');
        blocks.push(
          <CopyableBlock
            key={`code_${idx}`}
            content={content}
            label={codeLang ? `${codeLang.toUpperCase()} · Prêt à copier` : undefined}
          />
        );
        inCode = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        flushList();
        flushTable();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      (table ??= []).push(cells);
      continue;
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
      continue;
    }

    flushList();
    if (!line.trim()) continue;

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
  }

  flushList();
  flushTable();

  if (inCode && codeBuffer.length > 0) {
    blocks.push(
      <CopyableBlock
        key={`code_end`}
        content={codeBuffer.join('\n')}
        label={codeLang ? `${codeLang.toUpperCase()} · Prêt à copier` : undefined}
      />
    );
  }

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
                  ? 'border-[#E5B54F]/40 bg-[#E5B54F]/10 text-[#F3CA75]'
                  : 'border-white/[0.08] bg-white/[0.02] text-neutral-600'
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
  onOpenQrModal,
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

  const [cardNotice, setCardNotice] = useState<Record<string, { ok: boolean; text: string }>>({});
  const noticeFor = (id: string, ok: boolean, text: string) => setCardNotice(prev => ({ ...prev, [id]: { ok, text } }));

  /* Met à jour la carte d'une production en cours (statut, audio) */
  const patchSongCard = (songMsgId: string, song: KieSongResult) =>
    setMessages(prev =>
      prev.map(m =>
        m.id === songMsgId && m.actionCard
          ? {
              ...m,
              actionCard: {
                ...m.actionCard,
                metadata: { ...m.actionCard.metadata, status: song.status, audioUrl: song.audioUrl, duration: song.duration, notice: song.notice },
              },
            }
          : m
      )
    );

  const handleGenerateSongFromCard = async (msgId: string, card: any) => {
    if (generatingSongMap[msgId]) return;
    setGeneratingSongMap(prev => ({ ...prev, [msgId]: true }));
    const gen = await generateKieSong({
      prompt: card.content,
      lyrics: card.content,
      style: card.style || 'Afro-Love acoustique',
      title: card.title || `Chanson pour ${card.recipient || 'Client'}`,
      clientName: card.recipient || 'Client',
      clientPhone: card.phone || '',
    });
    setGeneratingSongMap(prev => ({ ...prev, [msgId]: false }));

    if (!gen.success || !gen.result) {
      noticeFor(msgId, false, gen.error || 'Production impossible pour le moment.');
      return;
    }

    const res = gen.result;
    const songMsgId = `song_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: songMsgId,
        role: 'assistant',
        text: res.isSimulation
          ? `### Simulation de production\n\nMode démo : aucun crédit réel n'est débité et rien n'est envoyé au client.`
          : `### Production lancée pour ${card.recipient || 'le client'}\n\nStyle : **${res.style}** · 1 crédit débité (remboursé automatiquement en cas d'échec). Le morceau arrive en général en 1 à 4 minutes.`,
        timestamp: nowTime(),
        toolsExecuted: ['check_studio_credits', 'generate_lyric_score'],
        actionCard: {
          type: 'song_generation',
          title: res.title,
          phone: card.phone,
          recipient: card.recipient,
          style: res.style,
          content: card.content,
          metadata: {
            taskId: res.taskId,
            orderId: res.orderId,
            status: res.status,
            audioUrl: res.audioUrl,
            duration: res.duration,
            isSimulation: res.isSimulation,
            isNewClient: res.isNewClient,
            notice: res.notice,
            waLink: card.metadata?.waLink
          }
        }
      }
    ]);

    if (res.status === 'pending') {
      const done = await waitForKieSong(res);
      patchSongCard(songMsgId, done);
    }
  };

  const handleDeliverSongToWhatsApp = async (msgId: string, card: any) => {
    if (!card.phone || !card.metadata?.audioUrl) return;
    setSendingMessageMap(prev => ({ ...prev, [msgId]: true }));
    const delivery = await deliverSongToWhatsApp({
      taskId: card.metadata.taskId,
      orderId: card.metadata.orderId,
      clientName: card.recipient || 'Client',
      clientPhone: card.phone,
      isNewClient: !!card.metadata.isNewClient,
      title: card.title,
      style: card.style || 'Afro-Love',
      status: card.metadata.status,
      audioUrl: card.metadata.audioUrl,
      isSimulation: card.metadata.isSimulation,
      createdAt: new Date().toISOString()
    }, sessionName);
    setSendingMessageMap(prev => ({ ...prev, [msgId]: false }));
    noticeFor(msgId, delivery.success, delivery.message);
    if (delivery.success) setSongDeliveredMap(prev => ({ ...prev, [msgId]: true }));
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
    // Mode démo : les numéros affichés sont de vrais clients, rien ne part réellement
    if (!user) {
      noticeFor(cardId, true, `Mode démo : envoi simulé vers ${phone}. Connectez votre studio pour écrire depuis votre ligne.`);
      return;
    }
    setSendingMessageMap(prev => ({ ...prev, [cardId]: true }));
    const res = await sendCopilotWhatsAppMessage(phone, content, sessionName, convId);
    setSendingMessageMap(prev => ({ ...prev, [cardId]: false }));

    if (res.success) {
      setSentSuccessMap(prev => ({ ...prev, [cardId]: true }));
      setTimeout(() => {
        setSentSuccessMap(prev => ({ ...prev, [cardId]: false }));
      }, 6000);
    } else {
      noticeFor(cardId, false, `Envoi impossible : ${res.error || 'vérifiez la connexion de votre ligne WhatsApp'}.`);
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

  return (
    <div className="max-w-6xl mx-auto vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 mb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Analyste & Copilot IA</h1>
          <p className="text-sm sm:text-base text-[#A3A3A3] mt-2 leading-relaxed max-w-xl">
            Sonar analyse vos ventes, vos conversations WhatsApp et vos briefs en direct.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenQrModal ? (
            <button
              type="button"
              onClick={onOpenQrModal}
              className="flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 px-3.5 py-1.5 text-[12.5px] text-neutral-300 hover:text-white transition-all cursor-pointer group"
              title="Lier la ligne WhatsApp Studio (Code QR)"
            >
              <QrCode className="h-3.5 w-3.5 text-[#E5B54F] group-hover:scale-110 transition-transform" strokeWidth={1.7} />
              <span>Ligne WhatsApp</span>
              <span className="font-mono text-xs text-neutral-500">({sessionName})</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-[#A3A3A3]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
              <span>Passerelle</span>
              <span className="font-mono text-white">{sessionName}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleReset}
            title="Nouvelle conversation"
            aria-label="Nouvelle conversation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-[#A3A3A3] hover:text-white hover:border-white/20 transition-colors duration-200 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
        {/* Rail : mascotte + instruments */}
        <aside className="space-y-3.5 lg:sticky lg:top-20">
          <div className="vx-hairline relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-4 flex lg:flex-col items-center gap-3 lg:gap-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(18rem_12rem_at_50%_0%,rgba(229,181,79,0.08),transparent_70%)]"
            />
            <SonarMascot state={sonarState} pulse={keyPulse} trackPointer size={124} className="relative hidden lg:block" />
            <SonarMascot state={sonarState} pulse={keyPulse} size={64} className="relative lg:hidden shrink-0" />
            <div className="relative lg:text-center min-w-0">
              <div className="font-serif text-xl sm:text-2xl text-white leading-none">Sonar</div>
              <div className="mt-1.5 flex lg:justify-center items-center gap-2 text-[12.5px] text-neutral-300" aria-live="polite">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    sonarState === 'idle' ? 'bg-neutral-500' : sonarState === 'listening' ? 'bg-emerald-400' : 'bg-[#E5B54F] vx-breathe'
                  }`}
                />
                <span>{SONAR_STATE_LABEL[sonarState]}</span>
              </div>
              <p className="mt-1 text-[11.5px] text-neutral-500 leading-snug lg:max-w-[190px] lg:mx-auto truncate lg:whitespace-normal">
                {statusCaption[sonarState]}
              </p>
            </div>
          </div>

          {/* Instruments Studio unifiés : Ventes réelles + Crédits */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-3.5 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
                  <Radio className="h-3.5 w-3.5 text-[#E5B54F]" strokeWidth={1.6} />
                  Ventes en direct
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
                  {metricsSyncedAt ? metricsSyncedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '…'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono text-xl font-bold tracking-tight text-[#F3CA75]">
                  {Math.round(liveMetrics.totalRevenue || 0).toLocaleString('fr-FR')}
                  <span className="ml-1 text-xs font-normal text-neutral-400">F CFA</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  92% marge
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center pt-0.5">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                  <div className="font-mono text-xs font-semibold text-white">{liveMetrics.ordersDelivered}</div>
                  <div className="text-[10.5px] text-neutral-500">Livrées</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                  <div className="font-mono text-xs font-semibold text-white">{liveMetrics.ordersActive}</div>
                  <div className="text-[10.5px] text-neutral-500">En cours</div>
                </div>
              </div>
              {waveTotal + omTotal > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="vx-fill block h-full bg-[#E5B54F]" style={{ width: `${wavePct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10.5px] font-mono text-neutral-500">
                    <span>Wave {wavePct}%</span>
                    <span>OM {100 - wavePct}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Solde Crédits Studio */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
                  <Coins className="h-3.5 w-3.5 text-[#E5B54F]" strokeWidth={1.6} />
                  Crédits Kie.ai
                </span>
                <span className="font-mono text-[13px] font-bold text-[#F3CA75]">
                  {credits.balance.toFixed(1)} <span className="text-[10.5px] font-normal text-neutral-400">crédits</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>1 production = 1 crédit</span>
                <span className="text-neutral-400">Permanent</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-2 space-y-0.5">
            <div className="px-2.5 pt-1.5 pb-2 text-[11px] font-mono uppercase tracking-wider text-neutral-500">Sources connectées</div>
            {SOURCES.map((s) => {
              const Icon = s.icon;
              const live = activeTool?.source === s.id;
              const touched = !trace && touchedSources.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 border transition-colors duration-200 ${
                    live ? 'border-[#E5B54F]/30 bg-[#E5B54F]/[0.06]' : 'border-transparent'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${
                      live ? 'border-[#E5B54F]/40 text-[#F3CA75]' : 'border-white/[0.08] text-neutral-400'
                    }`}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] text-neutral-300 truncate">{s.label}</span>
                  </span>
                  {live ? (
                    <span className="vx-wave-live flex items-center gap-[2px] h-3" aria-label="Lecture en cours">
                      {[0, 1, 2, 3].map(i => (
                        <span
                          key={i}
                          className="vx-wave-bar block w-[2px] h-full rounded-full bg-[#E5B54F]"
                          style={{ animationDelay: `${i * -0.18}s` }}
                        />
                      ))}
                    </span>
                  ) : touched ? (
                    <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} aria-label="Consultée" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-neutral-700" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Fil de discussion */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] flex flex-col overflow-hidden lg:h-[calc(100dvh-16rem)] lg:min-h-[560px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7 max-h-[64vh] lg:max-h-none">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const isRevealing = reveal?.id === m.id;
              const shownText = isRevealing ? m.text.slice(0, revealChars) : m.text;

              if (isUser) {
                return (
                  <div key={m.id} className="flex flex-col items-end gap-1.5 vx-fade-in">
                    <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md border border-white/[0.12] bg-[#161820] px-4 py-3 text-[14.5px] leading-relaxed text-neutral-100 font-normal shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
                      {m.text}
                    </div>
                    <span className="font-mono text-[11px] text-neutral-500 px-1">{m.timestamp}</span>
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
                      className={`vx-hairline rounded-2xl rounded-tl-md border border-white/[0.08] bg-gradient-to-b from-[#0E1015] to-[#0B0C10] p-4 sm:p-5 ${
                        m.id !== WELCOME.id ? 'vx-sheen' : ''
                      }`}
                    >
                      <RichText text={shownText} caret={isRevealing} />

                      {m.toolsExecuted && m.toolsExecuted.length > 0 && !isRevealing && (
                        <div className="mt-4 pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-1.5">
                          {m.toolsExecuted.map((t, i) => {
                            const meta = toolMeta(t);
                            const Icon = meta.icon;
                            return (
                              <span
                                key={t}
                                style={{ '--i': i } as CSSProperties}
                                className="vx-stagger inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-[#A3A3A3]"
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
                      <div className="vx-view-enter vx-sheen relative overflow-hidden rounded-2xl border border-[#E5B54F]/25 bg-[#0B0C10] shadow-[0_24px_60px_-20px_rgba(229,181,79,0.18)]">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(24rem_10rem_at_0%_0%,rgba(229,181,79,0.10),transparent_70%)]"
                        />
                        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/[0.08]">
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
                          <div className="p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between text-xs text-neutral-400">
                              <span className="flex items-center gap-1.5 text-white font-medium">
                                <Music2 className="h-3.5 w-3.5 text-neutral-300" />
                                Master audio · Kie.ai Suno
                              </span>
                              <span className={`font-mono ${
                                m.actionCard.metadata?.status === 'failed' ? 'text-rose-300' : m.actionCard.metadata?.status === 'pending' ? 'text-amber-300' : 'text-emerald-400'
                              }`}>
                                {m.actionCard.metadata?.isSimulation
                                  ? 'Simulation'
                                  : m.actionCard.metadata?.status === 'pending'
                                    ? 'Production en cours'
                                    : m.actionCard.metadata?.status === 'failed'
                                      ? 'Échec · crédit remboursé'
                                      : 'Prêt · 1 crédit'}
                              </span>
                            </div>
                            <div className="rounded-xl border border-white/[0.08] bg-[#08090C] p-3.5">
                              {m.actionCard.metadata?.status === 'pending' ? (
                                <div className="flex items-center gap-2.5 text-[13px] text-neutral-300">
                                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                                  Suno compose le morceau. Vous pouvez continuer à travailler : la carte se met à jour seule.
                                </div>
                              ) : (
                                <WaveformPlayer seed={m.id} src={m.actionCard.metadata?.audioUrl} durationHint={m.actionCard.metadata?.duration || 180} tone="dark" />
                              )}
                            </div>
                            {m.actionCard.metadata?.notice && (
                              <p className="text-[12px] text-neutral-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.06]">
                                {m.actionCard.metadata.notice}
                              </p>
                            )}
                            <div className="font-serif text-[15px] leading-relaxed text-neutral-200 max-h-36 overflow-y-auto whitespace-pre-wrap p-2 border border-white/[0.06] rounded-lg">
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
                              <div key={k.label} style={{ '--i': i } as CSSProperties} className="vx-stagger bg-[#0B0C10] px-4 sm:px-5 py-4">
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

                        {cardNotice[m.id] && (
                          <div
                            role="status"
                            className={`px-4 sm:px-5 py-2.5 border-t text-[13px] ${
                              cardNotice[m.id].ok ? 'border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-200' : 'border-rose-500/20 bg-rose-500/[0.05] text-rose-200'
                            }`}
                          >
                            {cardNotice[m.id].text}
                          </div>
                        )}
                        <div className="relative flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5 border-t border-white/[0.08] bg-black/20">
                          <button
                            type="button"
                            onClick={() => handleCopyText(m.id, m.actionCard!.content)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] hover:border-white/25 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-300 font-semibold">Copié en 1 clic !</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
                                <span>Copier en 1 clic</span>
                              </>
                            )}
                          </button>

                          {m.actionCard.type === 'song_generation' && m.actionCard.phone && user && !m.actionCard.metadata?.isSimulation && m.actionCard.metadata?.status === 'success' && (
                            <button
                              type="button"
                              disabled={sendingMessageMap[m.id]}
                              onClick={() => handleDeliverSongToWhatsApp(m.id, m.actionCard)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12.5px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer disabled:opacity-40 shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
                            >
                              {sendingMessageMap[m.id] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Livraison en cours</span>
                                </>
                              ) : songDeliveredMap[m.id] ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Livrée sur WhatsApp</span>
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
                              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12.5px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
                            >
                              {generatingSongMap[m.id] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Lancement…</span>
                                </>
                              ) : (
                                <>
                                  <Music2 className="h-3.5 w-3.5" />
                                  <span>Lancer la production · 1 crédit</span>
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
                              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12.5px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer disabled:opacity-40 shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
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

                          {m.actionCard.phone && (
                            <a
                              href={`https://wa.me/${m.actionCard.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[12.5px] font-medium text-emerald-300 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/50 active:scale-[0.97] transition-all duration-150 ease-press"
                              title="Ouvrir la discussion exacte sur WhatsApp"
                            >
                              <MessagesSquare className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.7} />
                              <span>Ouvrir la discussion WhatsApp</span>
                              <ArrowUpRight className="h-3 w-3 opacity-60" />
                            </a>
                          )}

                          {m.actionCard.metadata?.waLink && !m.actionCard.phone && (
                            <a
                              href={m.actionCard.metadata.waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] hover:border-white/25 active:scale-[0.97] transition-all duration-150 ease-press"
                            >
                              <MessagesSquare className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.7} />
                              <span>Ouvrir WhatsApp</span>
                            </a>
                          )}

                          {m.actionCard.type === 'lyrics' && onNavigateToStudio && (
                            <button
                              type="button"
                              onClick={onNavigateToStudio}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] hover:border-white/25 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                            >
                              <span>Envoyer à l'Atelier</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400" />
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

          </div>

          {/* Compositeur */}
          <div className="border-t border-white/[0.08] bg-[#08090C] p-3 sm:p-4 space-y-2.5">
            {/* Suggestions très compactes et discrètes juste en bas */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    type="button"
                    disabled={tracing}
                    onClick={() => handleSendMessage(s.query)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer disabled:opacity-30"
                  >
                    <Icon className="h-2.5 w-2.5 text-neutral-400" strokeWidth={1.5} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            {detectedPhone && !tracing && (
              <div className="vx-fade-in flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-200">
                <Phone className="h-3.5 w-3.5 text-[#E5B54F] shrink-0" strokeWidth={1.8} />
                <span className="truncate">
                  Numéro <span className="font-mono font-semibold text-white">{detectedPhone}</span> détecté : Entrée pour retrouver la discussion
                </span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={`flex items-end gap-2 rounded-2xl border p-1.5 pl-4 transition-all duration-200 ${
                inputFocused
                  ? 'bg-[#181B26] border-white/35 shadow-[0_0_24px_-6px_rgba(255,255,255,0.08)]'
                  : 'bg-[#13151D] border-white/[0.14] hover:border-white/[0.24]'
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
                placeholder="Écrivez votre message..."
                disabled={tracing}
                aria-label="Message pour Sonar"
                className="flex-1 resize-none bg-transparent py-2.5 text-[15px] text-white placeholder:text-neutral-500 outline-none max-h-32 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || tracing}
                aria-label="Envoyer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all duration-150 ease-press cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {tracing ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <ArrowUp className="h-4 w-4 text-black" strokeWidth={2} />}
              </button>
            </form>
            <div className="flex items-center justify-between px-1 text-[12.5px] text-neutral-600">
              <span>
                <kbd className="font-mono text-[#A3A3A3]">Entrée</kbd> pour envoyer,{' '}
                <kbd className="font-mono text-[#A3A3A3]">Maj + Entrée</kbd> pour une nouvelle ligne
              </span>
              <span className="hidden sm:inline font-mono">Velaris Intelligence 2.5</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
