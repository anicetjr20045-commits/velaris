import { useEffect, useMemo, useState, type FC } from 'react';
import { MessageCircle, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics } from '../types';

interface RevenusViewProps {
  orders: Order[];
  metrics?: StudioMetrics;
  onOpenConversations?: () => void;
  onOpenVentes?: () => void;
  onSelectOrder?: (orderId: string, conversationId?: string, clientPhone?: string) => void;
  isWhatsAppConnected?: boolean;
}

type PeriodKey = '7d' | '30d' | 'all';
type SourceFilter = 'all' | 'whatsapp' | 'affiliate';

interface AffiliateCommission {
  order_id: string;
  created_at: string;
  order_price: number;
  commission: number;
  formula?: string;
  status?: string;
}

interface AffiliateStats {
  clicks_count: number;
  sales_count: number;
  conversion_rate: number;
  total_earned: number;
  balance: number;
  commissions: AffiliateCommission[];
}

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
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Slug d'affiliation pour récupérer les commissions 50%
  const meta = user?.user_metadata || {};
  const studioName = (meta.studio_name as string) || 'Mon Studio';
  const cleanSlug =
    (meta.studio_slug as string) ||
    studioName.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
    'mon-studio';

  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats>({
    clicks_count: 0,
    sales_count: 0,
    conversion_rate: 0,
    total_earned: 0,
    balance: 0,
    commissions: [],
  });

  useEffect(() => {
    let cancelled = false;
    const fetchAffiliate = async () => {
      try {
        const res = await fetch(
          `https://waha.velarisagent.life/api/stt/pay/affiliate/stats?slug=${encodeURIComponent(
            cleanSlug
          )}`
        );
        const json = await res.json();
        if (!cancelled && json.code === 200 && json.data) {
          setAffiliateStats(json.data);
        }
      } catch {
        // En cas d'indisponibilité temporaire, conserver l'état local
      }
    };
    fetchAffiliate();
    return () => {
      cancelled = true;
    };
  }, [cleanSlug]);

  // Commandes directes WhatsApp filtrées par période
  const filteredWhatsAppOrders = useMemo(() => {
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

  // Commissions d'affiliation filtrées par période
  const filteredCommissions = useMemo(() => {
    if (period === 'all') return affiliateStats.commissions;
    const now = Date.now();
    const days = period === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 3600 * 1000;

    return affiliateStats.commissions.filter((c) => {
      const parsed = Date.parse(c.created_at);
      if (Number.isNaN(parsed)) return true;
      return parsed >= cutoff;
    });
  }, [affiliateStats.commissions, period]);

  // Calculs financiers consolidés
  const directWhatsAppRevenue = useMemo(() => {
    if (
      period === 'all' &&
      metrics?.totalRevenue !== undefined &&
      filteredWhatsAppOrders.length === orders.length
    ) {
      return metrics.totalRevenue;
    }
    return filteredWhatsAppOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [filteredWhatsAppOrders, metrics?.totalRevenue, orders.length, period]);

  const affiliateRevenue = useMemo(() => {
    if (period === 'all' && affiliateStats.total_earned > 0) {
      return affiliateStats.total_earned;
    }
    return filteredCommissions.reduce((sum, c) => sum + (c.commission || 0), 0);
  }, [affiliateStats.total_earned, filteredCommissions, period]);

  // REVENU TOTAL CONSOLIDÉ = VENTES DIRECTES WHATSAPP + COMMISSIONS AFFILIATION 50%
  const totalConsolidatedRevenue = directWhatsAppRevenue + affiliateRevenue;
  const totalSalesCount = filteredWhatsAppOrders.length + filteredCommissions.length;
  const avgBasket = totalSalesCount > 0 ? Math.round(totalConsolidatedRevenue / totalSalesCount) : 0;

  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Liste unifiée des transactions récentes (WhatsApp + Affiliation)
  interface UnifiedTransaction {
    id: string;
    type: 'whatsapp' | 'affiliate';
    clientName: string;
    clientPhone?: string;
    country?: string;
    countryCode?: string;
    exactTime?: string;
    conversationId?: string;
    subtitle: string;
    amount: number;
    rawDate: string;
    status: string;
    orderRef?: Order;
    commissionRef?: AffiliateCommission;
  }

  const unifiedTransactions = useMemo<UnifiedTransaction[]>(() => {
    const list: UnifiedTransaction[] = [];

    // Ajouter les commandes WhatsApp directes
    filteredWhatsAppOrders.forEach((o) => {
      list.push({
        id: `wa-${o.id}`,
        type: 'whatsapp',
        clientName: o.clientName || 'Client WhatsApp',
        clientPhone: o.clientPhone,
        country: o.country || 'Afrique de l’Ouest',
        countryCode: o.countryCode || 'AFR',
        exactTime: o.exactTime || o.createdAt,
        conversationId: o.conversationId,
        subtitle: `${o.occasion || 'Chanson personnalisée'}${
          o.paymentMethod ? ` · ${o.paymentMethod}` : ''
        }`,
        amount: o.amount || 0,
        rawDate: o.rawCreatedAt || o.createdAt || new Date().toISOString(),
        status: o.status === 'livre' ? 'Livré' : 'Validé',
        orderRef: o,
      });
    });

    // Ajouter les commissions d'affiliation
    filteredCommissions.forEach((c) => {
      const orderShortId = c.order_id ? c.order_id.slice(-6).toUpperCase() : 'REC';
      list.push({
        id: `aff-${c.order_id}`,
        type: 'affiliate',
        clientName: `Commande #${orderShortId}`,
        subtitle: `Commission 50% · Formule ${c.formula || 'Chanson'} (Vente ${fmtFCFA(
          c.order_price || 0
        )})`,
        amount: c.commission || 0,
        rawDate: c.created_at || new Date().toISOString(),
        status: c.status || 'Validée',
        commissionRef: c,
      });
    });

    // Trier par date décroissante
    list.sort((a, b) => {
      const timeA = Date.parse(a.rawDate) || 0;
      const timeB = Date.parse(b.rawDate) || 0;
      return timeB - timeA;
    });

    // Appliquer le filtre de source
    if (sourceFilter === 'whatsapp') return list.filter((t) => t.type === 'whatsapp');
    if (sourceFilter === 'affiliate') return list.filter((t) => t.type === 'affiliate');
    return list;
  }, [filteredWhatsAppOrders, filteredCommissions, sourceFilter]);

  // Courbe douce de tendance
  const curvePath =
    period === '7d'
      ? 'M 0 46 C 45 42, 75 30, 120 32 C 165 34, 210 18, 255 20 C 285 21, 305 10, 320 6'
      : period === '30d'
      ? 'M 0 50 C 45 46, 85 36, 130 38 C 175 40, 215 20, 260 16 C 290 14, 305 8, 320 4'
      : 'M 0 52 C 55 48, 110 38, 165 28 C 215 18, 265 12, 320 4';

  const fillPath = `${curvePath} L 320 64 L 0 64 Z`;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* 1. GRANDE CARTE SOLDE CONSOLIDÉ STYLE STRIPE LUMINEUX */}
      <section className="stripe-glow-card rounded-[28px] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10D98E] animate-pulse" />
            <span className="text-xs font-medium text-white/80">
              Revenu Central Consolidé (Direct WhatsApp + Affiliation 50%)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/[0.08]">
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
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  period === key
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Montant Total Consolidé */}
        <div className="space-y-3">
          <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white tabular-nums leading-none">
            {fmtFCFA(totalConsolidatedRevenue)}
          </div>

          {/* Ventilation nette : WhatsApp Direct vs Affiliation 50% */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10D98E]/10 border border-[#10D98E]/25 text-[#10D98E] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10D98E]" />
              <span>WhatsApp Direct : {fmtFCFA(directWhatsAppRevenue)}</span>
              <span className="text-white/40">({filteredWhatsAppOrders.length})</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E2BD6B]/15 border border-[#E2BD6B]/30 text-[#E2BD6B] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E2BD6B]" />
              <span>Affiliation 50% : {fmtFCFA(affiliateRevenue)}</span>
              <span className="text-white/40">({filteredCommissions.length})</span>
            </div>

            <span className="text-white/40 text-[11px] hidden sm:inline">
              Encaissements Wave & Orange Money
            </span>
          </div>
        </div>

        {/* Courbe SVG fluide lumineuse */}
        <div className="pt-2">
          <svg
            viewBox="0 0 320 64"
            className="w-full h-14 overflow-visible"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="velarisRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E2BD6B" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#E2BD6B" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill="url(#velarisRevenueArea)" />
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

      {/* 2. STATISTIQUES & INDICATEURS DÉTAILLÉS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pôle WhatsApp Direct */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Ventes Directes</span>
            <span className="w-2 h-2 rounded-full bg-[#10D98E]" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {fmtFCFA(directWhatsAppRevenue)}
          </p>
          <p className="text-[11px] text-[#8A90A0]">
            {filteredWhatsAppOrders.length} client{filteredWhatsAppOrders.length > 1 ? 's' : ''} WhatsApp
          </p>
        </div>

        {/* Pôle Affiliation 50% */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Commissions Affiliation</span>
            <span className="w-2 h-2 rounded-full bg-[#E2BD6B]" />
          </div>
          <p className="text-2xl font-bold text-[#E2BD6B] tabular-nums">
            {fmtFCFA(affiliateRevenue)}
          </p>
          <p className="text-[11px] text-[#8A90A0]">
            {filteredCommissions.length} vente{filteredCommissions.length > 1 ? 's' : ''} via lien court
          </p>
        </div>

        {/* Panier Moyen Global */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Panier Moyen</span>
            <TrendingUp className="w-3.5 h-3.5 text-white/40" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {avgBasket > 0 ? fmtFCFA(avgBasket) : '—'}
          </p>
          <p className="text-[11px] text-[#8A90A0]">Sur l'ensemble des canaux</p>
        </div>

        {/* Taux de Conversion ou Total Ventes */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Volume Total</span>
            <Sparkles className="w-3.5 h-3.5 text-[#E2BD6B]" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{totalSalesCount}</p>
          <p className="text-[11px] text-[#8A90A0]">
            {affiliateStats.clicks_count > 0
              ? `${affiliateStats.clicks_count} clics · ${(
                  (totalSalesCount / affiliateStats.clicks_count) *
                  100
                ).toFixed(1)}% conv.`
              : 'Commandes traitées'}
          </p>
        </div>
      </section>

      {/* 3. HISTORIQUE & JOURNAL DES TRANSACTIONS */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Journal des Transactions</h2>
            <p className="text-xs text-[#8A90A0]">
              Retrouvez chaque client WhatsApp et accédez à sa conversation en 1 clic.
            </p>
          </div>

          {/* Filtres de source */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0D0F14] border border-white/[0.06] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-white text-black'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              Toutes ({filteredWhatsAppOrders.length + filteredCommissions.length})
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter('whatsapp')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                sourceFilter === 'whatsapp'
                  ? 'bg-[#10D98E] text-black font-bold'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              WhatsApp Direct ({filteredWhatsAppOrders.length})
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter('affiliate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                sourceFilter === 'affiliate'
                  ? 'bg-[#E2BD6B] text-black font-bold'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              Affiliation ({filteredCommissions.length})
            </button>
          </div>
        </div>

        {/* Liste des transactions unifiées */}
        {unifiedTransactions.length > 0 ? (
          <div className="space-y-4">
            <div className="divide-y divide-white/[0.06] rounded-3xl bg-[#08090C] border border-white/[0.06] overflow-hidden px-4 sm:px-6">
              {unifiedTransactions.slice(0, visibleCount).map((tx) => {
                const cleanPhone = tx.clientPhone?.replace(/[^0-9]/g, '');
                const isWhatsApp = tx.type === 'whatsapp';

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      if (isWhatsApp) {
                        onSelectOrder?.(tx.orderRef?.id || '', tx.conversationId, tx.clientPhone);
                      }
                    }}
                    className={`py-4 px-2 -mx-2 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isWhatsApp ? 'hover:bg-white/[0.04] cursor-pointer' : ''
                    }`}
                  >
                    {/* Côté gauche : Avatar + Nom + Téléphone + Pays + Heure */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
                          isWhatsApp
                            ? 'bg-[#10D98E]/10 border border-[#10D98E]/25 text-[#10D98E]'
                            : 'bg-[#E2BD6B]/15 border border-[#E2BD6B]/30 text-[#E2BD6B]'
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">
                          {isWhatsApp ? getInitials(tx.clientName) : '50%'}
                        </span>
                        {isWhatsApp && tx.countryCode && (
                          <span className="text-[9px] font-mono font-semibold tracking-wider opacity-80 mt-0.5">
                            {tx.countryCode}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">
                            {tx.clientName}
                          </p>
                          {tx.clientPhone && (
                            <span className="text-xs font-mono text-[#C7CAD4] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
                              {tx.clientPhone}
                            </span>
                          )}
                          {tx.country && (
                            <span className="text-[10px] font-medium text-[#A6ABB9] px-2 py-0.5 rounded-md bg-white/[0.03]">
                              {tx.country}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A90A0]">
                          <span>{tx.subtitle}</span>
                          {tx.exactTime && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[11px] text-[#A6ABB9]">
                                {tx.exactTime}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Côté droit : Bouton WhatsApp direct + Montant + Statut */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-14 sm:pl-0">
                      {isWhatsApp && cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10D98E]/10 hover:bg-[#10D98E]/20 text-[#10D98E] text-xs font-semibold border border-[#10D98E]/25 transition-colors cursor-pointer"
                          title={`Ouvrir WhatsApp avec ${tx.clientName}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <div className="text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isWhatsApp ? 'text-[#10D98E]' : 'text-[#E2BD6B]'
                          }`}
                        >
                          +{fmtFCFA(tx.amount)}
                        </p>
                        <p className="text-[11px] text-[#8A90A0] mt-0.5 font-mono">
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination / Voir plus */}
            {unifiedTransactions.length > visibleCount && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                  className="px-5 py-2.5 rounded-2xl bg-[#0D0F14] hover:bg-[#141720] border border-white/[0.08] text-xs font-semibold text-white transition-all cursor-pointer inline-flex items-center gap-2 shadow-md"
                >
                  <span>Afficher 50 transactions supplémentaires ({visibleCount} / {unifiedTransactions.length})</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-8 text-center space-y-2">
            <p className="text-sm font-medium text-white">Aucune transaction enregistrée</p>
            <p className="text-xs text-[#8A90A0] max-w-sm mx-auto leading-relaxed">
              Dès qu’une vente est effectuée sur WhatsApp ou via votre lien d’affiliation personnalisé, elle apparaîtra ici avec son montant et un accès direct au client.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
