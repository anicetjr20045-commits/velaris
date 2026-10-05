import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type FC } from 'react';
import {
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Hand,
  IdCard,
  Package,
  Search,
  SlidersHorizontal,
  SquareKanban
} from 'lucide-react';
import type { Order, PipelineLead } from '../types';
import { useAuth } from '../hooks/useAuth';

const EMPTY_LEADS: PipelineLead[] = [];
import { useStudioLive } from '../hooks/useStudioLive';
import { getLivePipelineLeads, updateLeadStage } from '../services/supabase';
import { STAGE_ORDER, inferLeadStage, stageRank } from '../services/pipelineAutopilot';

interface PipelineViewProps {
  onSelectLeadForStudio?: (leadId: string) => void;
  /** Commandes du studio : signal le plus fiable pour faire avancer une fiche */
  orders?: Order[];
}

type Stage = PipelineLead['stage'];
type Period = 'today' | '7d' | '30d' | 'all' | 'custom';

const STAGES: { id: Stage; title: string }[] = [
  { id: 'nouveau', title: 'Nouveau prospect' },
  { id: 'en_discussion', title: 'En discussion' },
  { id: 'devis', title: 'Devis envoyé' },
  { id: 'studio', title: 'En studio' },
  { id: 'livre', title: 'Livré' },
];
const STAGE_TITLE = Object.fromEntries(STAGES.map(s => [s.id, s.title])) as Record<Stage, string>;

interface AutoMove {
  id: string;
  leadId: string;
  leadName: string;
  from: Stage;
  to: Stage;
  reason: string;
  at: Date;
}

const AUTOPILOT_KEY = 'velaris.pipeline.autopilot.v1';
const MANUAL_KEY = 'velaris.pipeline.manual.v1';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : réglage conservé pour la session */
  }
};

const PERIODS: { id: Exclude<Period, 'custom'>; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'all', label: 'Tout' },
];

const FR_MONTHS: Record<string, number> = {
  janv: 0, fevr: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, aout: 7, sept: 8, oct: 9, nov: 10, dec: 11,
};

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Date du dernier échange : ISO si fourni par Supabase, sinon libellé « 30 sept. 14:59 » */
const leadDate = (lead: PipelineLead): Date | null => {
  if (lead.lastExchangeAt) {
    const d = new Date(lead.lastExchangeAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = normalize(lead.lastExchange).match(/(\d{1,2})\s+([a-z]+)\.?,?\s*(?:(\d{4}),?\s*)?(?:(\d{1,2})[:h](\d{2}))?/);
  if (!m) return null;
  const month = FR_MONTHS[m[2].slice(0, 4)] ?? FR_MONTHS[m[2].slice(0, 3)];
  if (month === undefined) return null;
  return new Date(m[3] ? Number(m[3]) : new Date().getFullYear(), month, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const waLink = (phone?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
};

const NO_ORDERS: Order[] = [];

export const PipelineView: FC<PipelineViewProps> = ({ onSelectLeadForStudio, orders = NO_ORDERS }) => {
  const { user } = useAuth();
  const { data: leads, setData: setLeads, syncedAt } = useStudioLive<PipelineLead[]>(
    getLivePipelineLeads,
    EMPTY_LEADS,
    ['conversations', 'contacts'],
    [user?.id],
    { enabled: !!user }
  );

  const [period, setPeriod] = useState<Period>('30d');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const [autopilot, setAutopilot] = useState<boolean>(() => readJson(AUTOPILOT_KEY, true));
  const [manualIds, setManualIds] = useState<string[]>(() => readJson(MANUAL_KEY, []));
  const [moves, setMoves] = useState<AutoMove[]>([]);
  const [autoReasons, setAutoReasons] = useState<Record<string, string>>({});
  // Avancées déjà tentées (lead -> étape) : un refus serveur ne relance pas la même écriture en boucle
  const attemptedRef = useRef<Map<string, Stage>>(new Map());

  const persistStage = (leadId: string, stage: Stage, previous: Stage) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage } : l)));
    if (user) {
      updateLeadStage(leadId, stage).then(ok => {
        if (!ok) setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage: previous } : l)));
      });
    }
  };

  /* Un déplacement manuel prime : le pilote automatique laisse ensuite la fiche tranquille */
  const moveLead = (leadId: string, stage: Stage) => {
    const previous = leads.find(l => l.id === leadId)?.stage;
    if (!previous || previous === stage) return;
    persistStage(leadId, stage, previous);
    if (!manualIds.includes(leadId)) {
      const next = [...manualIds, leadId];
      setManualIds(next);
      writeJson(MANUAL_KEY, next);
    }
    setAutoReasons(r => {
      const { [leadId]: _drop, ...rest } = r;
      return rest;
    });
  };

  const releaseLead = (leadId: string) => {
    const next = manualIds.filter(id => id !== leadId);
    setManualIds(next);
    writeJson(MANUAL_KEY, next);
    attemptedRef.current.delete(leadId);
  };

  const toggleAutopilot = () => {
    setAutopilot(on => {
      writeJson(AUTOPILOT_KEY, !on);
      return !on;
    });
  };

  /* Pilote automatique : à chaque synchro, chaque fiche avance jusqu'à l'étape que ses interactions justifient */
  useEffect(() => {
    if (!autopilot) return;
    const found: AutoMove[] = [];
    for (const lead of leads) {
      if (manualIds.includes(lead.id)) continue;
      const inference = inferLeadStage(lead, orders);
      if (!inference || attemptedRef.current.get(lead.id) === inference.stage) continue;
      attemptedRef.current.set(lead.id, inference.stage);
      found.push({
        id: `${lead.id}-${inference.stage}-${Date.now()}`,
        leadId: lead.id,
        leadName: lead.name,
        from: lead.stage,
        to: inference.stage,
        reason: inference.reason,
        at: new Date(),
      });
    }
    if (found.length === 0) return;
    for (const m of found) persistStage(m.leadId, m.to, m.from);
    setAutoReasons(r => ({ ...r, ...Object.fromEntries(found.map(m => [m.leadId, m.reason])) }));
    setMoves(prev => [...found, ...prev].slice(0, 12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, orders, autopilot, manualIds]);

  const filteredLeads = useMemo(() => {
    const today = startOfDay(new Date());
    const lower =
      period === 'today' ? today
      : period === '7d' ? new Date(today.getTime() - 6 * 86400000)
      : period === '30d' ? new Date(today.getTime() - 29 * 86400000)
      : period === 'custom' && range.from ? new Date(`${range.from}T00:00:00`)
      : null;
    const upper = period === 'custom' && range.to ? new Date(`${range.to}T23:59:59`) : null;

    const term = normalize(searchTerm.trim());
    const digits = searchTerm.replace(/\D/g, '');

    return leads.filter(l => {
      if (lower || upper) {
        const d = leadDate(l);
        if (!d) return false;
        if (lower && d < lower) return false;
        if (upper && d > upper) return false;
      }
      if (!term) return true;
      return (
        normalize(l.name).includes(term) ||
        (digits.length >= 3 && (l.phone || '').replace(/\D/g, '').includes(digits)) ||
        (!!l.tag && normalize(l.tag).includes(term)) ||
        (!!l.summary && normalize(l.summary).includes(term))
      );
    });
  }, [leads, period, range, searchTerm]);

  const onDrop = (e: DragEvent<HTMLElement>, stage: Stage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    if (id) moveLead(id, stage);
    setDragId(null);
    setOverStage(null);
  };

  const pill = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[15px] transition-colors duration-200 cursor-pointer ${
      active
        ? 'border-[#E5B54F] bg-[#E5B54F] text-[#050608] font-semibold shadow-[0_6px_24px_-10px_rgba(229,181,79,0.7)]'
        : 'border-white/[0.08] bg-[#08090C] text-[#E5E5E5] hover:border-[#E5B54F]/40'
    }`;

  return (
    <div className="space-y-6 max-w-6xl 2xl:max-w-[88rem] mx-auto pb-16">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3">
            <SquareKanban className="h-8 w-8 text-[#E5B54F]" strokeWidth={1.6} />
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Suivi clients</h1>
          </div>
          <p className="mt-2 max-w-lg text-sm sm:text-base leading-relaxed text-[#A3A3A3]">
            Chaque client avance automatiquement, du premier message à la livraison.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#08090C] px-4 py-3 self-start">
          <Bot className={`h-5 w-5 shrink-0 ${autopilot ? 'text-[#E5B54F]' : 'text-[#737373]'}`} strokeWidth={1.6} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white">Pilote automatique</div>
            <div className="text-xs text-[#737373] tabular-nums">
              {autopilot ? 'Les fiches avancent seules' : 'Déplacements manuels uniquement'}
              {syncedAt && ` · synchro ${syncedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autopilot}
            aria-label={autopilot ? 'Couper le pilote automatique' : 'Activer le pilote automatique'}
            onClick={toggleAutopilot}
            className="vx-switch ml-2 shrink-0"
          />
        </div>
      </div>

      {/* Filtres */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-base font-semibold text-white">
          <SlidersHorizontal className="h-[18px] w-[18px] text-[#E5B54F]" strokeWidth={1.8} />
          Filtrer les clients
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[#A3A3A3]" />
          <input
            type="text"
            placeholder="Nom, numéro, occasion ou offre…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-white/[0.08] bg-[#08090C] pl-11 pr-4 py-3 text-base text-white placeholder:text-[#737373] outline-none focus:border-[#E5B54F]/60 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={pill(period === p.id)} aria-pressed={period === p.id}>
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => setPeriod('custom')} className={pill(period === 'custom')} aria-pressed={period === 'custom'}>
            <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.6} />
            Dates
          </button>
        </div>

        {period === 'custom' && (
          <div className="vx-fade-in flex flex-wrap items-center gap-3 text-sm text-[#A3A3A3]">
            <label className="flex items-center gap-2">
              Du
              <input
                type="date"
                value={range.from}
                onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                className="rounded-xl border border-white/[0.08] bg-[#08090C] px-3 py-2 text-white [color-scheme:dark] outline-none focus:border-[#E5B54F]/60"
              />
            </label>
            <label className="flex items-center gap-2">
              au
              <input
                type="date"
                value={range.to}
                onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                className="rounded-xl border border-white/[0.08] bg-[#08090C] px-3 py-2 text-white [color-scheme:dark] outline-none focus:border-[#E5B54F]/60"
              />
            </label>
          </div>
        )}

        <p className="text-[15px] text-[#A3A3A3]">
          <span className="font-bold text-white tabular-nums">{filteredLeads.length}</span> clients dans cette période
        </p>
      </section>

      {/* Guide */}
      <div className="rounded-2xl border border-white/[0.12] bg-[#0E1015]">
        <button
          type="button"
          onClick={() => setIsGuideOpen(o => !o)}
          aria-expanded={isGuideOpen}
          className="w-full flex items-center gap-2.5 px-5 py-4 text-left text-base font-semibold text-white cursor-pointer"
        >
          <ChevronRight className={`h-4 w-4 text-[#E5B54F] transition-transform duration-300 ease-luxury ${isGuideOpen ? 'rotate-90' : ''}`} strokeWidth={2.4} />
          Comment ça marche ? (tout avance automatiquement)
        </button>
        {isGuideOpen && (
          <p className="vx-fade-in px-5 pb-5 -mt-1 text-[15px] leading-relaxed text-[#A3A3A3] max-w-3xl">
            L'IA accueille chaque contact WhatsApp et extrait l'occasion, le prénom du destinataire et le brief émotionnel. Brief en cours : la fiche
            passe en « En discussion ». Prix annoncé ou paroles prêtes : « Devis envoyé ». Paiement Wave ou Orange Money confirmé : « En studio ».
            Chanson remise au client : « Livré ». Le pilote ne fait jamais reculer une fiche ; si vous la déplacez à la main, il la laisse
            ensuite tranquille jusqu'à ce que vous la lui rendiez.
          </p>
        )}
      </div>

      {/* Mouvements automatiques */}
      {moves.length > 0 && (
        <section className="vx-fade-in rounded-2xl border border-white/[0.08] bg-[#08090C] px-5 py-4" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.8} />
            Mouvements automatiques
            <span className="font-normal text-[#737373]">· cette session</span>
          </div>
          <ul className="mt-3 space-y-2">
            {moves.slice(0, 5).map(m => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="font-mono text-xs tabular-nums text-[#737373]">
                  {m.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-medium text-white">{m.leadName}</span>
                <span className="text-[#A3A3A3]">
                  {STAGE_TITLE[m.from]} <span aria-hidden="true">→</span><span className="sr-only">vers</span> <span className="text-[#F3CA75]">{STAGE_TITLE[m.to]}</span>
                </span>
                <span className="text-[#737373]">· {m.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Kanban */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex 2xl:grid 2xl:grid-cols-5 gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 items-start">
        {STAGES.map((col) => {
          const colLeads = filteredLeads.filter(l => l.stage === col.id);
          const isOver = overStage === col.id && dragId !== null;
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (overStage !== col.id) setOverStage(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
              }}
              onDrop={(e) => onDrop(e, col.id)}
              className={`snap-start shrink-0 w-[82vw] sm:w-[300px] 2xl:w-auto rounded-[22px] border p-3 transition-colors duration-200 ${
                isOver ? 'border-[#E5B54F]/60 bg-[#E5B54F]/[0.04]' : 'border-white/[0.08] bg-[#0B0C10]'
              }`}
            >
              <header className="flex items-center justify-between gap-2 px-2 pt-2 pb-4">
                <h3 className="truncate text-[15px] font-bold uppercase tracking-[0.04em] text-white">{col.title}</h3>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-sm font-semibold tabular-nums text-[#D6D3D1]">
                  {colLeads.length}
                </span>
              </header>

              <div className="space-y-3 min-h-[200px]">
                {colLeads.length === 0 && (
                  <div className={`flex h-24 items-center justify-center rounded-2xl border border-dashed text-sm transition-colors ${
                    isOver ? 'border-[#E5B54F]/50 text-[#F3CA75]' : 'border-white/[0.08] text-[#737373]'
                  }`}>
                    Déposez une fiche ici
                  </div>
                )}
                {colLeads.map((lead, i) => {
                  const wa = waLink(lead.phone);
                  const manual = manualIds.includes(lead.id);
                  const autoReason = autoReasons[lead.id];
                  const rank = stageRank(lead.stage);
                  return (
                    <article
                      key={`${lead.id}-${lead.stage}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', lead.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      style={{ '--i': i } as CSSProperties}
                      className={`vx-stagger rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 cursor-grab active:cursor-grabbing transition-[border-color,opacity] duration-200 ease-luxury hover:border-white/[0.12] ${
                        dragId === lead.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="truncate text-[17px] font-semibold text-white">{lead.name}</h4>
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              title={`Ouvrir WhatsApp ${lead.phone}`}
                              aria-label={`Ouvrir la discussion WhatsApp de ${lead.name}`}
                              className="shrink-0 text-[#A3A3A3] hover:text-[#F3CA75] transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" strokeWidth={1.6} />
                            </a>
                          )}
                        </div>
                        {onSelectLeadForStudio && (
                          <button
                            type="button"
                            onClick={() => onSelectLeadForStudio(lead.id)}
                            title="Ouvrir la fiche dans l'Atelier"
                            aria-label={`Ouvrir la fiche de ${lead.name} dans l'Atelier`}
                            className="shrink-0 text-[#D6D3D1] hover:text-[#F3CA75] transition-colors cursor-pointer"
                          >
                            <IdCard className="h-[18px] w-[18px]" strokeWidth={1.6} />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 space-y-1.5 text-sm text-[#A3A3A3]">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                          <span className="truncate">Dernier échange {lead.lastExchange}</span>
                        </div>
                        {lead.tag && (
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                            <span className="truncate">chanson · {lead.tag.toLowerCase()}</span>
                          </div>
                        )}
                      </div>

                      {lead.summary && (
                        <p className="mt-3 border-l-2 border-[#D4A347] pl-3 text-[15px] leading-snug text-[#D6D3D1] line-clamp-2">
                          {lead.summary}
                        </p>
                      )}

                      {/* Progression dans le parcours client */}
                      <div className="mt-3.5 flex gap-1" aria-label={`Étape ${rank + 1} sur ${STAGE_ORDER.length}`}>
                        {STAGE_ORDER.map((s, si) => (
                          <span key={s} className={`h-1 flex-1 rounded-full ${si <= rank ? 'bg-[#E5B54F]' : 'bg-white/[0.07]'}`} />
                        ))}
                      </div>

                      {manual ? (
                        <button
                          type="button"
                          onClick={() => releaseLead(lead.id)}
                          title="Rendre cette fiche au pilote automatique"
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-[#A3A3A3] hover:text-[#F3CA75] transition-colors cursor-pointer"
                        >
                          <Hand className="h-3.5 w-3.5" strokeWidth={1.6} />
                          Suivi manuel · rendre au pilote
                        </button>
                      ) : autoReason ? (
                        <div className="vx-fade-in mt-2.5 flex items-center gap-1.5 text-xs text-[#F3CA75]">
                          <Bot className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                          <span className="truncate">Avancée auto · {autoReason}</span>
                        </div>
                      ) : null}

                      <div className="relative mt-3.5">
                        <select
                          value={lead.stage}
                          onChange={(e) => moveLead(lead.id, e.target.value as Stage)}
                          aria-label={`Étape de ${lead.name}`}
                          className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#08090C] pl-3.5 pr-9 py-2.5 text-[15px] text-white outline-none focus:border-[#E5B54F]/60 cursor-pointer"
                        >
                          {STAGES.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3]" />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
