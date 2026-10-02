import { useState, type FC } from 'react';
import { 
  Landmark, 
  MessageSquare, 
  UserPlus, 
  Zap, 
  Smartphone, 
  ArrowRight
} from 'lucide-react';
import type { Order, StudioMetrics } from '../types';

interface RevenusViewProps {
  orders: Order[];
  metrics?: StudioMetrics;
  onOpenPipeline?: () => void;
  onOpenConversations?: () => void;
  onOpenVentes?: () => void;
}

export const RevenusView: FC<RevenusViewProps> = ({
  orders,
  metrics,
  onOpenPipeline,
  onOpenConversations,
  onOpenVentes,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Aujourd\'hui');

  const periods = [
    'Aujourd\'hui',
    'Hier',
    '7 jours',
    '30 jours',
    'Ce mois',
    'Cette année',
  ];

  const totalCA = metrics?.totalRevenue ?? 3644400;
  const todayRevenue = orders.filter(o => o.createdAt.includes('min')).reduce((sum, o) => sum + (o.amount || 0), 0);
  const todaySalesCount = orders.filter(o => o.createdAt.includes('min')).length;

  const hours = ['01h', '04h', '07h', '10h', '13h', '16h', '19h', '23h'];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* 1. Carte Chiffre d'affaires Total Réalisé — Precision Telemetry Master */}
      <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-6 sm:p-8 relative overflow-hidden shadow-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-neutral-400">
            <Landmark className="h-3.5 w-3.5 text-neutral-300" />
            <span>Chiffre d'affaires total réalisé</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-mono text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>En direct</span>
          </div>
        </div>

        <div>
          <div className="font-mono text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            {new Intl.NumberFormat('fr-FR').format(totalCA)} F CFA
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Grand livre des encaissements Wave et Orange Money validés.
          </p>
        </div>

        {/* Section Revenus Aujourd'hui intégrée */}
        <div className="pt-6 border-t border-[#2D261E] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
              Revenus · {selectedPeriod.toUpperCase()}
            </div>
            <div className="text-xs font-mono text-neutral-400">
              <span className="text-white font-semibold">{todaySalesCount}</span> vente(s) · Panier moyen{' '}
              <span className="text-white font-semibold">
                {todaySalesCount > 0 ? `${new Intl.NumberFormat('fr-FR').format(Math.round(todayRevenue / todaySalesCount))} F CFA` : '3 000 F CFA'}
              </span>
            </div>
          </div>

          <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {todayRevenue > 0 ? `${new Intl.NumberFormat('fr-FR').format(todayRevenue)} F CFA` : '0 F CFA'}
          </div>

          {/* Filtres de période en pilules */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all shrink-0 cursor-pointer border ${
                  selectedPeriod === period
                    ? 'border-white bg-white text-black font-semibold shadow-sm'
                    : 'bg-[#1A1713] text-neutral-400 hover:text-white border-[#2D261E] hover:bg-white/[0.04]'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Graphique temporel linéaire d'aujourd'hui (01h -> 23h) */}
          <div className="pt-4">
            <div className="relative h-12 flex items-end">
              <div className="absolute inset-x-0 bottom-1 h-[1px] bg-white/[0.08]" />
              <div className="w-full flex items-center justify-between z-10 px-2">
                {hours.map((h, i) => (
                  <div key={h} className="flex flex-col items-center">
                    <span className={`h-1.5 w-1.5 rounded-full ${i > 4 ? 'bg-white' : 'bg-white/20'}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mt-1 px-1">
              {hours.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grille de 4 cartes d'indicateurs opérationnels (2x2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Messages reçus aujourd'hui */}
        <div 
          onClick={onOpenConversations}
          className="rounded-xl border border-[#2D261E] bg-[#0E0C0A] p-5 hover:border-white/20 transition-all cursor-pointer group shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Messages Entrants</span>
            <MessageSquare className="h-4 w-4 text-neutral-500 group-hover:text-white transition-colors" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-white">
            126
          </div>
          <div className="text-xs text-neutral-400">
            Messages reçus sur vos numéros connectés
          </div>
        </div>

        {/* Nouveaux clients (7 jours) */}
        <div 
          onClick={onOpenPipeline}
          className="rounded-xl border border-[#2D261E] bg-[#0E0C0A] p-5 hover:border-white/20 transition-all cursor-pointer group shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Nouveaux Prospects</span>
            <UserPlus className="h-4 w-4 text-neutral-500 group-hover:text-white transition-colors" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-white">
            42
          </div>
          <div className="text-xs text-neutral-400">
            Nouveaux leads qualifiés sur 7 jours
          </div>
        </div>

        {/* Automatisations envoyées aujourd'hui */}
        <div className="rounded-xl border border-[#2D261E] bg-[#0E0C0A] p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Déclenchements IA</span>
            <Zap className="h-4 w-4 text-neutral-500" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-white">
            1
          </div>
          <div className="text-xs text-neutral-400">
            Automatisations WhatsApp exécutées aujourd'hui
          </div>
        </div>

        {/* Lignes WhatsApp connectées */}
        <div className="rounded-xl border border-[#2D261E] bg-[#0E0C0A] p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Lignes Connectées</span>
            <Smartphone className="h-4 w-4 text-neutral-500" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-white">
            0/1
          </div>
          <div className="text-xs text-neutral-400">
            Sessions WAHA actives pour votre studio
          </div>
        </div>
      </div>

      {/* 3. Section Dernières Ventes */}
      <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">FLUX RÉCENT</div>
            <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Dernières Ventes Encaissées
            </h3>
          </div>
          <button
            onClick={onOpenVentes}
            className="text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Tout afficher
          </button>
        </div>

        {orders.length > 0 ? (
          <div className="space-y-2.5">
            {orders.slice(0, 3).map((o) => (
              <div 
                key={o.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#1A1713] border border-[#2D261E]/60"
              >
                <div>
                  <div className="text-xs font-semibold text-white">{o.clientName}</div>
                  <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{o.occasion} · {o.createdAt}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-white">
                    {new Intl.NumberFormat('fr-FR').format(o.amount)} FCFA
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-neutral-400 border border-[#2D261E] mt-0.5 inline-block">
                    {o.status === 'livre' ? 'Livré' : 'En cours'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic py-2">
            Aucune vente sur cette période.
          </p>
        )}
      </div>

      {/* 4. Section Où en sont tes clients (30 jours) */}
      <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">PIPELINE ACTIF</div>
            <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Suivi de l'Entonnoir Clients (30 jours)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              187 prospects qualifiés et fiches en cours d'avancement
            </p>
          </div>
          <button
            onClick={onOpenPipeline}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-sm"
          >
            <span>Ouvrir le Kanban</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
