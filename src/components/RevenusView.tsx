import { useMemo, useState, type FC } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Order, StudioMetrics } from '../types';

interface RevenusViewProps {
  orders: Order[];
  metrics?: StudioMetrics;
  onOpenConversations?: () => void;
  onOpenVentes?: () => void;
  onSelectOrder?: (orderId: string) => void;
  isWhatsAppConnected?: boolean;
}

type PeriodKey = '7d' | '30d' | 'all';

const fmtFCFA = (amount: number) =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} F CFA`;

const getInitials = (name: string) => {
  const parts = (name || 'CL').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.slice(0, 2) || 'CL').toUpperCase();
};

export const RevenusView: FC<RevenusViewProps> = ({
  orders,
  metrics,
  onSelectOrder,
}) => {
  const [period, setPeriod] = useState<PeriodKey>('30d');

  const filteredOrders = useMemo(() => {
    if (period === 'all') return orders;
    const now = Date.now();
    const days = period === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 3600 * 1000;

    return orders.filter((o) => {
      const parsed = Date.parse(o.createdAt);
      if (Number.isNaN(parsed)) return true;
      return parsed >= cutoff;
    });
  }, [orders, period]);

  const displayedRevenue = useMemo(() => {
    if (period === 'all' && metrics?.totalRevenue !== undefined && filteredOrders.length === orders.length) {
      return metrics.totalRevenue;
    }
    return filteredOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [filteredOrders, metrics?.totalRevenue, orders.length, period]);

  const salesCount = filteredOrders.length;
  const avgBasket = salesCount > 0 ? Math.round(displayedRevenue / salesCount) : 0;

  // Courbe douce adaptée à la période
  const curvePath =
    period === '7d'
      ? 'M 0 46 C 45 42, 75 30, 120 32 C 165 34, 210 18, 255 20 C 285 21, 305 10, 320 6'
      : period === '30d'
      ? 'M 0 50 C 45 46, 85 36, 130 38 C 175 40, 215 20, 260 16 C 290 14, 305 8, 320 4'
      : 'M 0 52 C 55 48, 110 38, 165 28 C 215 18, 265 12, 320 4';

  const fillPath = `${curvePath} L 320 64 L 0 64 Z`;

  return (
    <div className="space-y-8 pb-8">
      {/* 1. Grande carte Solde lumineuse façon Stripe */}
      <section className="stripe-glow-card rounded-[28px] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10D98E]" />
            <span className="text-xs font-medium text-white/75">Solde généré</span>
          </div>

          <div className="flex items-center gap-1 bg-black/35 p-1 rounded-full">
            {(
              [
                ['7d', '7j'],
                ['30d', '30j'],
                ['all', 'Tout'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  period === key
                    ? 'bg-white text-black font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums leading-none">
            {fmtFCFA(displayedRevenue)}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-[#10D98E] font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {salesCount > 0 ? `${salesCount} encaissement${salesCount > 1 ? 's' : ''}` : 'En direct'}
            </span>
            <span className="text-white/50">Wave & Orange Money</span>
          </div>
        </div>

        {/* Courbe fluide lumineuse */}
        <div className="pt-1">
          <svg
            viewBox="0 0 320 64"
            className="w-full h-14 overflow-visible"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="velarisStripeArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E2BD6B" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#E2BD6B" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill="url(#velarisStripeArea)" />
            <path
              d={curvePath}
              fill="none"
              stroke="#E2BD6B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="320" cy={period === '7d' ? '6' : '4'} r="4" fill="#FFF3D1" />
          </svg>
        </div>
      </section>

      {/* 2. Deux indicateurs simples et aérés */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-3xl bg-[#0D0F14] p-5 space-y-1.5">
          <span className="text-xs text-[#8A90A0]">Ventes encaissées</span>
          <p className="text-2xl font-bold text-white tabular-nums">{salesCount}</p>
        </div>
        <div className="rounded-3xl bg-[#0D0F14] p-5 space-y-1.5">
          <span className="text-xs text-[#8A90A0]">Panier moyen</span>
          <p className="text-2xl font-bold text-white tabular-nums">
            {avgBasket > 0 ? fmtFCFA(avgBasket) : '—'}
          </p>
        </div>
      </section>

      {/* 3. Transactions récentes des clients */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Transactions récentes</h2>
          <span className="text-xs text-[#8A90A0] tabular-nums">
            {filteredOrders.length} client{filteredOrders.length > 1 ? 's' : ''}
          </span>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {filteredOrders.slice(0, 12).map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder?.(order.id)}
                className="w-full py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] -mx-2 px-2 rounded-2xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#0D0F14] border border-white/[0.06] flex items-center justify-center text-xs font-semibold text-[#E2BD6B] shrink-0">
                    {getInitials(order.clientName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{order.clientName}</p>
                    <p className="text-xs text-[#8A90A0] truncate mt-0.5">
                      {order.occasion}
                      {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-[#10D98E] tabular-nums">
                    +{fmtFCFA(order.amount || 0)}
                  </p>
                  <p className="text-[11px] text-[#8A90A0] mt-0.5">
                    {order.status === 'livre' ? 'Livré' : order.createdAt || 'En cours'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-[#0D0F14] p-8 text-center space-y-2">
            <p className="text-sm font-medium text-white">Aucune transaction pour le moment</p>
            <p className="text-xs text-[#8A90A0] max-w-xs mx-auto leading-relaxed">
              Dès qu’un client règle une chanson sur WhatsApp ou votre site, son paiement apparaît ici automatiquement.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
