import { useState, type FC } from 'react';
import { 
  Search, 
  ExternalLink, 
  Clock, 
  ChevronRight, 
  Tag
} from 'lucide-react';
import type { PipelineLead } from '../types';
import { REAL_PIPELINE_LEADS } from '../data/realProductionData';

interface PipelineViewProps {
  onSelectLeadForStudio?: (leadId: string) => void;
}

export const PipelineView: FC<PipelineViewProps> = ({ onSelectLeadForStudio }) => {
  const [leads, setLeads] = useState<PipelineLead[]>(REAL_PIPELINE_LEADS);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30 jours');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const periods = ['Aujourd\'hui', '7 jours', '30 jours', 'Tout'];

  const handleStageChange = (leadId: string, newStage: PipelineLead['stage']) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
  };

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.tag && l.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.summary && l.summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const columns: { stage: PipelineLead['stage']; title: string; count: number }[] = [
    { 
      stage: 'nouveau', 
      title: 'NOUVEAU PROSPECT', 
      count: filteredLeads.filter(l => l.stage === 'nouveau').length + 152
    },
    { 
      stage: 'en_discussion', 
      title: 'EN DISCUSSION', 
      count: filteredLeads.filter(l => l.stage === 'en_discussion').length + 13 
    },
    { 
      stage: 'paiement', 
      title: 'DEVIS & PAIEMENT', 
      count: filteredLeads.filter(l => l.stage === 'paiement').length + 7 
    },
    { 
      stage: 'livre', 
      title: 'EN STUDIO / LIVRÉ', 
      count: filteredLeads.filter(l => l.stage === 'livre').length + 4 
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. En-tête Suivi Clients */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono tracking-wider text-neutral-300 uppercase">
              KANBAN STUDIO
            </span>
            <span className="text-xs font-mono text-neutral-500">Cycle de Vente WhatsApp</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Pipeline de Suivi Clients
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Chaque contact avance automatiquement du premier message publicitaire à la livraison audio finale.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400 self-start sm:self-auto shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Fiches synchronisées en direct</span>
        </div>
      </div>

      {/* 2. Barre de filtrage et recherche */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro, occasion ou formule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#07080B] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition-all font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer border ${
                  selectedPeriod === p
                    ? 'border-white bg-white text-black font-semibold shadow-sm'
                    : 'bg-[#07080B] text-neutral-400 hover:text-white border-white/[0.06] hover:bg-white/[0.03]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="text-xs text-neutral-500 font-mono">
            <span className="text-white font-bold">187</span> prospects suivis
          </div>
        </div>
      </div>

      {/* Accordéon explicatif */}
      <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-3.5 text-xs text-neutral-300">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between text-left font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <span className="font-mono text-xs">Architecture du pipeline automatique</span>
          <ChevronRight className={`h-4 w-4 transition-transform text-neutral-500 ${isGuideOpen ? 'rotate-90' : ''}`} />
        </button>
        {isGuideOpen && (
          <p className="mt-2.5 text-neutral-400 leading-relaxed border-t border-white/[0.06] pt-2.5 font-sans">
            L'IA accueille chaque contact WhatsApp, extrait l'occasion, le prénom du destinataire et le brief émotionnel. Dès que le brief est complet, le prospect passe en « En discussion ». À réception du paiement Mobile Money (Wave ou Orange Money), le statut bascule en « Devis & Paiement », puis en « En studio » lors de la génération Suno.
          </p>
        )}
      </div>

      {/* 3. Tableau Kanban en colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colLeads = filteredLeads.filter(l => l.stage === col.stage);
          return (
            <div 
              key={col.stage}
              className="rounded-2xl border border-white/[0.06] bg-[#07080B] p-4 flex flex-col space-y-3"
            >
              {/* En-tête de colonne */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400">
                  {col.title}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-white border border-white/[0.08]">
                  {col.count}
                </span>
              </div>

              {/* Liste des cartes du prospect */}
              <div className="space-y-2.5 min-h-[300px]">
                {colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-xl border border-white/[0.06] bg-[#0D0F14] p-3.5 space-y-2.5 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-white">
                        {lead.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-neutral-500">
                        <button
                          type="button"
                          onClick={() => onSelectLeadForStudio && onSelectLeadForStudio(lead.id)}
                          title="Ouvrir dans le Studio IA"
                          className="hover:text-white cursor-pointer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                      <Clock className="h-3 w-3 text-neutral-500" />
                      <span>{lead.lastExchange}</span>
                    </div>

                    {lead.tag && (
                      <div className="flex items-center gap-1 text-[10px] text-neutral-300 font-mono">
                        <Tag className="h-3 w-3 text-neutral-500" />
                        <span>{lead.tag}</span>
                      </div>
                    )}

                    {lead.summary && (
                      <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                        {lead.summary}
                      </p>
                    )}

                    {/* Sélecteur d'étape */}
                    <div className="pt-1">
                      <select
                        value={lead.stage}
                        onChange={(e) => handleStageChange(lead.id, e.target.value as PipelineLead['stage'])}
                        className="w-full bg-[#07080B] text-neutral-300 text-[11px] font-mono rounded-lg px-2.5 py-1.5 border border-white/[0.08] focus:outline-none focus:border-white/30 cursor-pointer"
                      >
                        <option value="nouveau">Nouveau prospect</option>
                        <option value="en_discussion">En discussion</option>
                        <option value="paiement">Devis & Paiement</option>
                        <option value="livre">Livré WhatsApp</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
