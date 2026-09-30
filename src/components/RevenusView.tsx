import { useState, type FC } from 'react';
import { 
  Landmark, 
  Radio, 
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Carte Chiffre d'affaires Total Réalisé */}
      <div className="rounded-2xl border border-amber-950/30 bg-[#12110e] p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#c5a059]">
            <Landmark className="h-4 w-4" />
            <span>Chiffre d'affaires total réalisé</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>En direct</span>
          </div>
        </div>

        <div className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#f3f4f6] mb-2">
          {new Intl.NumberFormat('fr-FR').format(totalCA)} F CFA
        </div>

        <p className="text-sm text-stone-400">
          Historique repris + toutes les ventes validées depuis
        </p>

        {/* Section Revenus Aujourd'hui intégrée */}
        <div className="mt-8 pt-6 border-t border-white/[0.08]">
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2">
            Revenus · {selectedPeriod.toUpperCase()}
          </div>

          <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6] mb-2">
            {todayRevenue > 0 ? `${new Intl.NumberFormat('fr-FR').format(todayRevenue)} F CFA` : '0 F CFA'}
          </div>

          <div className="text-sm text-stone-400 mb-5">
            <span className="font-semibold text-stone-200">{todaySalesCount}</span> vente{' '}
            <span className="text-stone-600">·</span>{' '}
            <span className="font-semibold text-stone-200">{todaySalesCount}</span> client{' '}
            <span className="text-stone-600">·</span> Panier moyen{' '}
            <span className="font-semibold text-stone-200">
              {todaySalesCount > 0 ? `${new Intl.NumberFormat('fr-FR').format(Math.round(todayRevenue / todaySalesCount))} F CFA` : '0 F CFA'}
            </span>
          </div>

          {/* Filtres de période en pilules */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
                  selectedPeriod === period
                    ? 'bg-[#c5a059] text-black font-semibold shadow-md'
                    : 'bg-[#181612] text-stone-300 hover:bg-[#201d18] border border-white/[0.06]'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Graphique temporel linéaire d'aujourd'hui (01h -> 23h) */}
          <div className="mt-6 pt-4">
            <div className="relative h-16 flex items-end">
              <div className="absolute inset-x-0 bottom-2 h-[1px] bg-amber-500/20" />
              {/* Courbe ou ligne plate d'activité */}
              <div className="w-full flex items-center justify-between z-10 px-2">
                {hours.map((h) => (
                  <div key={h} className="flex flex-col items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500/40" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono mt-1 px-1">
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
          className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-5 hover:border-amber-500/30 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <MessageSquare className="h-5 w-5 text-stone-400 group-hover:text-[#c5a059] transition-colors" />
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-white mb-1">
            126
          </div>
          <div className="text-xs text-stone-400">
            Messages reçus aujourd'hui
          </div>
        </div>

        {/* Nouveaux clients (7 jours) */}
        <div 
          onClick={onOpenPipeline}
          className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-5 hover:border-amber-500/30 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <UserPlus className="h-5 w-5 text-stone-400 group-hover:text-[#c5a059] transition-colors" />
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-white mb-1">
            42
          </div>
          <div className="text-xs text-stone-400">
            Nouveaux clients (7 jours)
          </div>
        </div>

        {/* Automatisations envoyées aujourd'hui */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <Zap className="h-5 w-5 text-stone-400" />
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-white mb-1">
            1
          </div>
          <div className="text-xs text-stone-400">
            Automatisations envoyées aujourd'hui
          </div>
        </div>

        {/* Lignes WhatsApp connectées */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <Smartphone className="h-5 w-5 text-stone-400" />
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-white mb-1">
            0/1
          </div>
          <div className="text-xs text-stone-400">
            Lignes WhatsApp connectées
          </div>
        </div>
      </div>

      {/* 3. Section Dernières Ventes */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-bold text-[#f3f4f6]">
            Dernières ventes
          </h3>
          <button
            onClick={onOpenVentes}
            className="text-xs text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            Tout voir
          </button>
        </div>

        {orders.length > 0 ? (
          <div className="space-y-3">
            {orders.slice(0, 3).map((o) => (
              <div 
                key={o.id}
                className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/[0.05]"
              >
                <div>
                  <div className="text-sm font-semibold text-stone-200">{o.clientName}</div>
                  <div className="text-xs text-stone-500">{o.occasion} · {o.createdAt}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#e5c158]">
                    {new Intl.NumberFormat('fr-FR').format(o.amount)} FCFA
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {o.status === 'livre' ? 'Livré' : 'En cours'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500 italic py-2">
            Aucune vente sur cette période.
          </p>
        )}
      </div>

      {/* 4. Section Où en sont tes clients (30 jours) */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#f3f4f6]">
              Où en sont tes clients (30 jours)
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              187 prospects qualifiés et fiches en cours d'avancement
            </p>
          </div>
          <button
            onClick={onOpenPipeline}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#1c1914] text-[#e5c158] hover:bg-[#25211a] border border-[#c5a059]/30 transition-all cursor-pointer"
          >
            <span>Suivi clients</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
