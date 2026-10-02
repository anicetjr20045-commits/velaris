import { useState, type CSSProperties, type DragEvent, type FC } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  Info,
  Search,
  WandSparkles
} from 'lucide-react';
import type { PipelineLead } from '../types';
import { REAL_PIPELINE_LEADS } from '../data/realProductionData';

interface PipelineViewProps {
  onSelectLeadForStudio?: (leadId: string) => void;
}

type Stage = PipelineLead['stage'];

/* Volumes historiques déjà traités hors des fiches affichées */
const STAGES: { id: Stage; title: string; hint: string; dot: string; ring: string; history: number }[] = [
  { id: 'nouveau', title: 'Nouveau prospect', hint: 'Premier message publicitaire', dot: 'bg-sky-400', ring: 'border-sky-400/30', history: 152 },
  { id: 'en_discussion', title: 'En discussion', hint: 'Brief émotionnel en cours', dot: 'bg-white', ring: 'border-white/30', history: 13 },
  { id: 'paiement', title: 'Devis & paiement', hint: 'Paroles validées, Mobile Money', dot: 'bg-[#D6AA60]', ring: 'border-[#D6AA60]/40', history: 7 },
  { id: 'livre', title: 'En studio & livré', hint: 'Production et livraison', dot: 'bg-emerald-400', ring: 'border-emerald-400/30', history: 4 },
];

const initials = (name: string) => {
  const parts = name.normalize('NFKD').replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase() : '#';
};

export const PipelineView: FC<PipelineViewProps> = ({ onSelectLeadForStudio }) => {
  const [leads, setLeads] = useState<PipelineLead[]>(REAL_PIPELINE_LEADS);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30 jours');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const periods = ["Aujourd'hui", '7 jours', '30 jours', 'Tout'];

  const moveLead = (leadId: string, stage: Stage) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage } : l)));
  };

  const shiftLead = (lead: PipelineLead, delta: -1 | 1) => {
    const idx = STAGES.findIndex(s => s.id === lead.stage) + delta;
    if (idx >= 0 && idx < STAGES.length) moveLead(lead.id, STAGES[idx].id);
  };

  const term = searchTerm.toLowerCase();
  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(term) ||
    (l.phone && l.phone.includes(searchTerm)) ||
    (l.tag && l.tag.toLowerCase().includes(term)) ||
    (l.summary && l.summary.toLowerCase().includes(term))
  );

  const totals = STAGES.map(s => filteredLeads.filter(l => l.stage === s.id).length + s.history);
  const tracked = totals.reduce((a, b) => a + b, 0);

  const onDrop = (e: DragEvent<HTMLElement>, stage: Stage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    if (id) moveLead(id, stage);
    setDragId(null);
    setOverStage(null);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16 vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Pipeline de closing</h1>
          <p className="text-sm text-neutral-400 mt-1.5 max-w-xl">
            Chaque contact avance du premier message publicitaire à la livraison. Glissez une fiche pour changer son étape.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
          Synchronisé en direct
        </span>
      </div>

      {/* Entonnoir */}
      <div className="vx-hairline rounded-2xl border border-white/[0.08] bg-[#08090C] p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <div className="text-xs text-neutral-400">
            <span className="font-mono text-xl font-bold tracking-tight text-white mr-2">{tracked}</span>
            prospects suivis
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
            {periods.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-colors duration-200 cursor-pointer ${
                  selectedPeriod === p ? 'bg-white text-black font-medium' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {STAGES.map((s, i) => {
            const conv = i > 0 && totals[i - 1] > 0 ? (totals[i] / totals[i - 1]) * 100 : null;
            return (
              <div key={s.id} className="min-w-0">
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <span
                    className={`vx-fill block h-full rounded-full ${s.dot}`}
                    style={{ '--i': i, width: `${Math.max(6, (totals[i] / Math.max(...totals)) * 100)}%` } as CSSProperties}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] text-neutral-400">{s.title}</span>
                  <span className="font-mono text-xs font-semibold text-white">{totals[i]}</span>
                </div>
                <div className="font-mono text-[10px] text-neutral-600 truncate">
                  {conv === null ? 'entrée' : `conv. ${conv.toFixed(1).replace('.', ',')} %`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recherche + guide */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Nom, numéro, occasion ou formule"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/[0.06] bg-[#08090C] pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-white/20 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsGuideOpen(o => !o)}
          aria-expanded={isGuideOpen}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-[#08090C] px-3.5 py-2.5 text-xs text-neutral-400 hover:text-white hover:border-white/15 transition-colors cursor-pointer"
        >
          <Info className="h-3.5 w-3.5" strokeWidth={1.5} />
          Comment les fiches avancent
        </button>
      </div>
      {isGuideOpen && (
        <p className="vx-fade-in rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-xs leading-relaxed text-neutral-400 max-w-3xl">
          L'IA accueille chaque contact WhatsApp et extrait l'occasion, le prénom du destinataire et le brief émotionnel. Brief complet : la fiche passe
          en « En discussion ». Paiement Wave ou Orange Money reçu : « Devis & paiement ». Génération lancée : « En studio & livré ».
        </p>
      )}

      {/* Kanban */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex lg:grid lg:grid-cols-4 gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 items-start">
        {STAGES.map((col, colIdx) => {
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
              className={`snap-start shrink-0 w-[82vw] sm:w-[320px] lg:w-auto rounded-2xl border p-2.5 transition-colors duration-200 ${
                isOver ? `${col.ring} bg-white/[0.03]` : 'border-white/[0.06] bg-[#07080B]'
              }`}
            >
              <header className="flex items-center gap-2.5 px-1.5 pt-1 pb-3">
                <span className="font-mono text-[10px] text-neutral-600">{String(colIdx + 1).padStart(2, '0')}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[13px] font-semibold text-white">{col.title}</h3>
                  <p className="truncate text-[10.5px] text-neutral-500">{col.hint}</p>
                </div>
                <span className="font-mono text-[11px] text-neutral-300 rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">
                  {totals[colIdx]}
                </span>
              </header>

              <div className="space-y-2 min-h-[260px]">
                {colLeads.length === 0 && (
                  <div className={`flex h-24 items-center justify-center rounded-xl border border-dashed text-[11px] transition-colors ${
                    isOver ? `${col.ring} text-neutral-300` : 'border-white/[0.07] text-neutral-600'
                  }`}>
                    Déposez une fiche ici
                  </div>
                )}
                {colLeads.map((lead, i) => (
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
                    className={`vx-stagger group relative rounded-xl border border-white/[0.07] bg-gradient-to-b from-[#101218] to-[#0C0D12] p-3 cursor-grab active:cursor-grabbing transition-[border-color,transform,opacity] duration-200 ease-luxury hover:border-white/[0.16] hover:-translate-y-px ${
                      dragId === lead.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] font-heading text-[10.5px] font-semibold text-neutral-300">
                        {initials(lead.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-white">{lead.name}</div>
                        {lead.phone && <div className="font-mono text-[10.5px] text-neutral-500">{lead.phone}</div>}
                      </div>
                      <GripVertical className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-400 transition-colors" aria-hidden="true" />
                    </div>

                    {lead.summary && (
                      <p className="mt-2.5 text-[11.5px] leading-relaxed text-neutral-400 line-clamp-2">{lead.summary}</p>
                    )}

                    <div className="mt-3 flex items-center gap-2 text-[10.5px]">
                      {lead.tag && (
                        <span className="truncate rounded-full border border-white/[0.08] px-2 py-0.5 text-neutral-300">{lead.tag}</span>
                      )}
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-neutral-500">
                        <Clock3 className="h-3 w-3" strokeWidth={1.5} />
                        {lead.lastExchange}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => shiftLead(lead, -1)}
                        disabled={colIdx === 0}
                        aria-label="Étape précédente"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.05] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftLead(lead, 1)}
                        disabled={colIdx === STAGES.length - 1}
                        aria-label="Étape suivante"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.05] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      {onSelectLeadForStudio && (
                        <button
                          type="button"
                          onClick={() => onSelectLeadForStudio(lead.id)}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <WandSparkles className="h-3 w-3" strokeWidth={1.5} />
                          Atelier
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
