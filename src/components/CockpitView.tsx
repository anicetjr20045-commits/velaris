import type { FC } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  CheckCircle, 
  Users, 
  Percent, 
  ArrowUpRight, 
  Sparkles, 
  Play, 
  Clock, 
  Filter,
  MessageCircle,
  QrCode
} from 'lucide-react';
import type { Order, StudioMetrics } from '../types';

interface CockpitViewProps {
  metrics: StudioMetrics;
  orders: Order[];
  onSelectOrderForStudio: (orderId: string) => void;
  onOpenQrModal: () => void;
}

export const CockpitView: FC<CockpitViewProps> = ({
  metrics,
  orders,
  onSelectOrderForStudio,
  onOpenQrModal,
}) => {
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'brief_recu':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Clock className="h-3 w-3" /> Brief Reçu
          </span>
        );
      case 'paroles_pretes':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d4af37]/15 px-2.5 py-1 text-xs font-semibold text-[#e5c158] border border-[#d4af37]/30">
            <Sparkles className="h-3 w-3" /> Paroles Prêtes
          </span>
        );
      case 'production_suno':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-400 border border-purple-500/20">
            <Play className="h-3 w-3 animate-spin" /> Studio Suno
          </span>
        );
      case 'livre':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-3 w-3" /> Livré WhatsApp
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#12141c] via-[#0d0e14] to-[#08090d] p-5 sm:p-7 shadow-2xl">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[#d4af37]/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Studio Connecté & Opérationnel
              </p>
            </div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Tableau de Bord des Ventes
            </h1>
            <p className="text-sm text-white/60 mt-1 max-w-xl">
              Suivi en temps réel des leads WhatsApp issus de Facebook Ads, validation des paroles et livraisons automatisées.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenQrModal}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-4 py-3 text-xs font-semibold text-white/80 transition-all"
            >
              <QrCode className="h-4 w-4 text-[#e5c158]" />
              <span className="hidden sm:inline">Liaison WhatsApp</span>
            </button>
            <button
              onClick={() => onSelectOrderForStudio(orders[0]?.id || '')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59e2b] px-5 py-3 text-xs font-bold text-black shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              Ouvrir Studio 1-Clic
            </button>
          </div>
        </div>
      </div>

      {/* 4 Essential Business Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50">Chiffre d'Affaires</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#d4af37]/15 text-[#e5c158]">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metrics.totalRevenue.toLocaleString()} {metrics.currency}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>+34% ce mois</span>
          </div>
        </div>

        {/* Metric 2: Delivered Songs */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50">Chansons Livrées</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metrics.ordersDelivered}
            </span>
            <span className="text-xs text-white/40 ml-1.5">morceaux</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
            <Clock className="h-3 w-3 text-purple-400" />
            <span>{metrics.ordersActive} en cours</span>
          </div>
        </div>

        {/* Metric 3: Facebook Ads Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50">Prospects Pubs Ads</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metrics.adLeadsCount}
            </span>
            <span className="text-xs text-white/40 ml-1.5">sur WhatsApp</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
            <MessageCircle className="h-3 w-3" />
            <span>Coût moyen: 120 F / lead</span>
          </div>
        </div>

        {/* Metric 4: Conversion Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50">Conversion Vente</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metrics.conversionRate}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
            <ArrowUpRight className="h-3 w-3" />
            <span>Formule 3 000 F en tête</span>
          </div>
        </div>
      </div>

      {/* Orders Pipeline & Active Queue */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-white">
              Commandes WhatsApp en Direct
            </h2>
            <p className="text-xs text-white/50">
              Chaque message entrant est analysé automatiquement pour préparer les paroles et le style musical.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:text-white">
              <Filter className="h-3.5 w-3.5" />
              Toutes les commandes
            </button>
          </div>
        </div>

        {/* Orders List / Cards */}
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrderForStudio(order.id)}
              className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-[#d4af37]/40 hover:bg-white/[0.04] cursor-pointer"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] text-[#e5c158] font-bold text-sm">
                  {order.clientName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">
                      {order.clientName}
                    </span>
                    <span className="text-xs text-white/40">
                      {order.clientPhone}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-xs text-white/70 mt-1 line-clamp-1">
                    <span className="text-[#e5c158] font-medium">{order.occasion}</span> pour{' '}
                    <span className="text-white font-medium">{order.recipient}</span> — Style{' '}
                    <span className="capitalize text-white/90">{order.style.replace('_', ' ')}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4 border-t border-white/[0.04] pt-3 md:border-t-0 md:pt-0">
                <div className="text-left md:text-right">
                  <div className="font-['Space_Grotesk'] text-sm font-bold text-white">
                    {order.amount.toLocaleString()} FCFA
                  </div>
                  <div className="text-[11px] text-white/40 flex items-center gap-1 md:justify-end">
                    <span>{order.paymentMethod}</span>
                    <span>•</span>
                    <span>{order.createdAt}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOrderForStudio(order.id);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] group-hover:bg-[#d4af37] px-3.5 py-2 text-xs font-semibold text-white group-hover:text-black transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Traiter</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
