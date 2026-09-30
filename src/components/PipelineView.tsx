import { useState, type FC } from 'react';
import { 
  Columns3, 
  Search, 
  ExternalLink, 
  FileText, 
  Clock, 
  ChevronRight, 
  Tag, 
  Calendar
} from 'lucide-react';
import type { PipelineLead } from '../types';
import { MOCK_PIPELINE_LEADS } from '../data/mockData';

interface PipelineViewProps {
  onSelectLeadForStudio?: (leadId: string) => void;
}

export const PipelineView: FC<PipelineViewProps> = ({ onSelectLeadForStudio }) => {
  const [leads, setLeads] = useState<PipelineLead[]>(MOCK_PIPELINE_LEADS);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30 jours');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const periods = ['Aujourd\'hui', '7 jours', '30 jours', 'Tout', 'Dates'];

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
      count: filteredLeads.filter(l => l.stage === 'nouveau').length + 152 // Reflecting the 156 from screenshot
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
          <div className="flex items-center gap-2.5 mb-1.5">
            <Columns3 className="h-6 w-6 text-[#c5a059]" />
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6]">
              Suivi clients
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xl">
            Chaque client avance automatiquement, du premier message à la livraison.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 self-start sm:self-auto shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Fiches enrichies automatiquement chaque soir</span>
        </div>
      </div>

      {/* 2. Barre de filtrage et recherche */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest font-semibold text-stone-400 flex items-center gap-2">
          <span>Filtrer les clients</span>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Nom, numéro, occasion ou offre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#12110e] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#c5a059]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                  selectedPeriod === p
                    ? 'bg-[#c5a059] text-black font-semibold shadow-md'
                    : 'bg-[#14120f] text-stone-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {p === 'Dates' ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>Dates</span>
                  </span>
                ) : p}
              </button>
            ))}
          </div>

          <div className="text-xs text-stone-400 font-medium">
            <span className="text-stone-200 font-bold">187</span> clients dans cette période
          </div>
        </div>
      </div>

      {/* Accordéon explicatif */}
      <div className="rounded-xl border border-white/[0.06] bg-[#100f0c] p-3 text-xs text-stone-300">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between text-left font-semibold text-stone-300 hover:text-[#c5a059] transition-colors cursor-pointer"
        >
          <span>► Comment ça marche ? (tout avance automatiquement)</span>
          <ChevronRight className={`h-4 w-4 transition-transform ${isGuideOpen ? 'rotate-90' : ''}`} />
        </button>
        {isGuideOpen && (
          <p className="mt-2 text-stone-400 leading-relaxed border-t border-white/[0.05] pt-2">
            Sarah accueille chaque contact WhatsApp, récolte l'occasion, le destinataire et l'histoire. Dès que le brief est complet, elle passe le client en "En discussion". À réception du paiement Wave ou Orange Money, le statut bascule en "Devis & Paiement" puis en "En studio" lors de la génération Suno.
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
              className="rounded-2xl border border-white/[0.06] bg-[#0c0b09] p-4 flex flex-col space-y-3"
            >
              {/* En-tête de colonne */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  {col.title}
                </h3>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-stone-400">
                  {col.count}
                </span>
              </div>

              {/* Liste des cartes du prospect */}
              <div className="space-y-3 min-h-[300px]">
                {colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-xl border border-white/[0.07] bg-[#14120e] p-3.5 space-y-2.5 shadow-md hover:border-amber-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-[#f3f4f6]">
                        {lead.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-stone-500">
                        <button
                          type="button"
                          onClick={() => onSelectLeadForStudio && onSelectLeadForStudio(lead.id)}
                          title="Ouvrir dans le Studio IA"
                          className="hover:text-white cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <FileText className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-mono">
                      <Clock className="h-3 w-3" />
                      <span>Dernier échange {lead.lastExchange}</span>
                    </div>

                    {lead.tag && (
                      <div className="flex items-center gap-1 text-[11px] text-[#c5a059] font-medium">
                        <Tag className="h-3 w-3" />
                        <span>{lead.tag}</span>
                      </div>
                    )}

                    {lead.summary && (
                      <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/[0.03]">
                        {lead.summary}
                      </p>
                    )}

                    {/* Sélecteur d'étape */}
                    <div className="pt-1">
                      <select
                        value={lead.stage}
                        onChange={(e) => handleStageChange(lead.id, e.target.value as PipelineLead['stage'])}
                        className="w-full bg-[#1c1914] text-stone-300 text-xs rounded-lg px-2.5 py-1.5 border border-white/[0.08] focus:outline-none focus:border-[#c5a059] cursor-pointer"
                      >
                        <option value="nouveau">Nouveau prospect</option>
                        <option value="en_discussion">En discussion</option>
                        <option value="paiement">Devis & Paiement</option>
                        <option value="livre">Livré</option>
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
