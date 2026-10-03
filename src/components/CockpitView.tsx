import { useEffect, useMemo, useRef, useState, type CSSProperties, type FC, type PointerEvent } from 'react';
import {
  TrendingUp,
  Wallet,
  CheckCircle,
  Users,
  Percent,
  ArrowUpRight,
  Search,
  MessagesSquare,
  QrCode,
  Plus,
  Download,
  ChevronRight,
  type LucideIcon
} from 'lucide-react';
import type { Order, StudioMetrics } from '../types';
import { useCountUp } from '../hooks/useCountUp';

interface CockpitViewProps {
  metrics: StudioMetrics;
  orders: Order[];
  onSelectOrderForStudio: (orderId: string) => void;
  onOpenQrModal: () => void;
  onOpenNewOrderModal?: () => void;
  onOpenConversations?: () => void;
}

type StatusFilter = 'all' | Order['status'];

/* Étapes du flux, dans l'ordre de production */
const STATUS_META: Record<Order['status'], { label: string; dot: string; bar: string }> = {
  brief_recu: { label: 'Brief reçu', dot: 'bg-sky-400', bar: 'bg-sky-400/70' },
  paroles_pretes: { label: 'Paroles prêtes', dot: 'bg-white', bar: 'bg-white/70' },
  paiement_valide: { label: 'Paiement validé', dot: 'bg-[#E5B54F]', bar: 'bg-[#E5B54F]/70' },
  production_suno: { label: 'En studio', dot: 'bg-violet-400', bar: 'bg-violet-400/70' },
  livre: { label: 'Livré', dot: 'bg-emerald-400', bar: 'bg-emerald-400/70' },
};
const STATUS_ORDER: Order['status'][] = ['brief_recu', 'paroles_pretes', 'paiement_valide', 'production_suno', 'livre'];

const formatNumber = (n: number) => Math.round(n).toLocaleString('fr-FR');

/* Pose --mx/--my pour le reflet spéculaire .vx-spotlight */
const trackPointer = (e: PointerEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

const Sparkline: FC<{ points: number[] }> = ({ points }) => {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 26 - ((p - min) / span) * 22;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

interface KpiCardProps {
  index: number;
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  footnote: string;
  footIcon: LucideIcon;
  tone: string;
  trend: number[];
}

const KpiCard: FC<KpiCardProps> = ({ index, label, value, suffix, icon: Icon, footnote, footIcon: FootIcon, tone, trend }) => {
  const animated = useCountUp(value);
  return (
    <div
      onPointerMove={trackPointer}
      style={{ '--i': index } as CSSProperties}
      className="vx-stagger vx-spotlight vx-hairline group rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-5 transition-[border-color,transform] duration-300 ease-luxury hover:border-white/[0.16] hover:-translate-y-px"
    >
      <div className="relative flex items-center justify-between">
        <span className="text-[13px] text-[#A3A3A3]">{label}</span>
        <span className="h-7 w-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white transition-colors">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
      </div>

      <div className="relative mt-4 font-mono text-2xl sm:text-[28px] leading-none font-bold tracking-tight text-white">
        {formatNumber(animated)}
        {suffix && <span className="ml-1 text-sm font-medium text-neutral-500">{suffix}</span>}
      </div>

      <div className={`relative mt-4 ${tone} opacity-70 group-hover:opacity-100 transition-opacity duration-300`}>
        <Sparkline points={trend} />
      </div>

      <div className="relative mt-3 pt-3 border-t border-white/[0.08] flex items-center gap-1.5 text-[12.5px] font-mono text-[#A3A3A3]">
        <FootIcon className={`h-3 w-3 ${tone}`} strokeWidth={1.5} />
        <span className="truncate">{footnote}</span>
      </div>
    </div>
  );
};

export const CockpitView: FC<CockpitViewProps> = ({
  metrics,
  orders,
  onSelectOrderForStudio,
  onOpenQrModal,
  onOpenNewOrderModal,
  onOpenConversations,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Raccourci "/" pour la recherche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        q === '' ||
        o.clientName.toLowerCase().includes(q) ||
        o.recipient.toLowerCase().includes(q) ||
        o.occasion.toLowerCase().includes(q) ||
        o.clientPhone.includes(searchTerm.trim());

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Order['status'], number>;
    orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
    return counts;
  }, [orders]);

  const exportCsv = () => {
    const headers = ['ID', 'Client', 'WhatsApp', 'Destinataire', 'Occasion', 'Style', 'Statut', 'Montant FCFA', 'Paiement', 'Date'];
    const rows = filteredOrders.map(o => [
      o.id,
      `"${o.clientName}"`,
      `"${o.clientPhone}"`,
      `"${o.recipient}"`,
      `"${o.occasion}"`,
      o.style,
      o.status,
      o.amount,
      o.paymentMethod,
      `"${o.createdAt}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `velaris_commandes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filters: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: orders.length },
    { id: 'brief_recu', label: 'Briefs', count: statusCounts.brief_recu },
    { id: 'paroles_pretes', label: 'Paroles', count: statusCounts.paroles_pretes },
    { id: 'production_suno', label: 'Studio', count: statusCounts.production_suno },
    { id: 'livre', label: 'Livrés', count: statusCounts.livre },
  ];

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* En-tête exécutif */}
      <section className="vx-hairline relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0E1015] to-[#0B0C10] p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-64 w-[28rem] rounded-full bg-[#E5B54F]/[0.08] blur-3xl"
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[13px] text-[#A3A3A3]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
              <span className="first-letter:uppercase">{today}</span>
              <span className="text-neutral-700">·</span>
              <span className="font-mono">{metrics.ordersActive} en cours</span>
            </div>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-white leading-[1.08]">
              Cockpit du studio
            </h1>
            <p className="text-sm text-[#A3A3A3] mt-2 max-w-xl leading-relaxed">
              Leads WhatsApp, validation des paroles et mastering audio livré en 18 minutes.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenNewOrderModal && (
              <button
                onClick={onOpenNewOrderModal}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-neutral-200 transition-all duration-150 ease-press active:scale-[0.97] shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nouveau lead</span>
              </button>
            )}
            <button
              onClick={onOpenQrModal}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.22] px-4 py-2.5 text-[13px] font-medium text-neutral-300 hover:text-white transition-all duration-200 ease-luxury cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Connecter WhatsApp</span>
            </button>
            {onOpenConversations && (
              <button
                onClick={onOpenConversations}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.22] px-4 py-2.5 text-[13px] font-medium text-neutral-300 hover:text-white transition-all duration-200 ease-luxury cursor-pointer"
              >
                <MessagesSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Discussions</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Télémétrie : 4 indicateurs vivants */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          index={0}
          label="Chiffre d'affaires"
          value={metrics.totalRevenue}
          suffix={metrics.currency}
          icon={Wallet}
          footnote={metrics.totalRevenue > 0 ? "+34 % ce mois" : "Encaissements réels"}
          footIcon={TrendingUp}
          tone="text-emerald-400"
          trend={metrics.totalRevenue > 0 ? [12, 15, 14, 19, 18, 24, 23, 29, 31, 30, 36, 41] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
        <KpiCard
          index={1}
          label="Chansons livrées"
          value={metrics.ordersDelivered}
          icon={CheckCircle}
          footnote={metrics.ordersActive > 0 ? `${metrics.ordersActive} en production` : "0 en cours"}
          footIcon={ArrowUpRight}
          tone="text-white"
          trend={metrics.ordersDelivered > 0 ? [8, 10, 9, 13, 12, 15, 17, 16, 19, 22, 21, 25] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
        <KpiCard
          index={2}
          label="Prospects WhatsApp"
          value={metrics.adLeadsCount}
          icon={Users}
          footnote={metrics.adLeadsCount > 0 ? "65 F / lead en moyenne" : "Contacts qualifiés"}
          footIcon={MessagesSquare}
          tone="text-sky-400"
          trend={metrics.adLeadsCount > 0 ? [20, 18, 24, 22, 27, 25, 30, 34, 31, 36, 35, 40] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
        <KpiCard
          index={3}
          label="Conversion closing"
          value={metrics.conversionRate}
          suffix="%"
          icon={Percent}
          footnote={metrics.conversionRate > 0 ? "Formule 3 000 F en tête" : "Taux de transformation"}
          footIcon={ArrowUpRight}
          tone="text-[#E5B54F]"
          trend={metrics.conversionRate > 0 ? [14, 16, 15, 17, 19, 18, 20, 21, 20, 22, 23, 24] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
      </div>

      {/* Journal des commandes */}
      <section className="vx-hairline rounded-2xl border border-white/[0.08] bg-[#0B0C10] overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5 border-b border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Commandes actives
                <span className="ml-2 font-mono text-sm font-medium text-neutral-500">{filteredOrders.length}</span>
              </h2>
              <p className="text-[13px] text-[#A3A3A3] mt-1">
                Ouvrez une commande pour l'envoyer à l'atelier : paroles, voix, mastering.
              </p>
            </div>
            <button
              onClick={exportCsv}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.16] px-3.5 py-1.5 text-[13px] text-neutral-300 hover:text-white transition-all duration-200 ease-luxury cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Répartition du flux par étape */}
          {orders.length > 0 && (
            <div className="space-y-2">
              <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-white/[0.04]">
                {STATUS_ORDER.filter((s) => statusCounts[s] > 0).map((s) => (
                  <span
                    key={s}
                    title={`${STATUS_META[s].label} : ${statusCounts[s]}`}
                    style={{ flexGrow: statusCounts[s] }}
                    className={`${STATUS_META[s].bar} basis-0 transition-opacity duration-200 ${
                      statusFilter !== 'all' && statusFilter !== s ? 'opacity-25' : ''
                    }`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-neutral-500">
                {STATUS_ORDER.filter((s) => statusCounts[s] > 0).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
                    {STATUS_META[s].label}
                    <span className="font-mono text-[#A3A3A3]">{statusCounts[s]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recherche & filtres segmentés */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" strokeWidth={1.5} />
              <input
                ref={searchRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Client, destinataire, occasion, téléphone"
                className="w-full rounded-full border border-white/[0.08] bg-white/[0.02] pl-9 pr-10 py-2 text-[13px] text-white placeholder-neutral-500 focus:border-white/[0.24] focus:bg-white/[0.04] focus:outline-none transition-colors duration-200"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/[0.12] bg-white/[0.04] px-1.5 text-[11.5px] font-mono text-neutral-500">/</kbd>
            </div>

            <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5 overflow-x-auto no-scrollbar">
              {filters.map((f) => {
                const active = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors duration-150 ease-press cursor-pointer ${
                      active
                        ? 'bg-white text-black font-semibold'
                        : 'text-[#A3A3A3] hover:text-white'
                    }`}
                  >
                    {f.label}
                    <span className={`font-mono text-[11.5px] ${active ? 'text-black/50' : 'text-neutral-600'}`}>{f.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* En-têtes de colonnes (desktop) */}
        <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-4 px-6 py-2.5 text-[12.5px] text-neutral-500 border-b border-white/[0.08] bg-white/[0.01]">
          <span>Client & commande</span>
          <span>Statut</span>
          <span className="text-right">Montant</span>
          <span className="w-[84px]" />
        </div>

        {/* Lignes */}
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-neutral-300">Aucune commande ne correspond à ces filtres.</p>
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
              className="mt-3 text-[13px] text-[#A3A3A3] hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white/60 transition-colors cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.08]">
            {filteredOrders.map((order, i) => {
              const meta = STATUS_META[order.status];
              return (
                <li
                  key={order.id}
                  style={{ '--i': Math.min(i, 8) } as CSSProperties}
                  className="vx-stagger"
                >
                  <button
                    onClick={() => onSelectOrderForStudio(order.id)}
                    className="group w-full text-left grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] md:items-center gap-3 md:gap-4 px-5 sm:px-6 py-4 transition-colors duration-150 ease-press hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none cursor-pointer"
                  >
                    {/* Client */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white/[0.1] to-white/[0.03] border border-white/[0.08] text-white font-mono font-semibold text-[13px]">
                        {order.clientName.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-medium text-white text-sm truncate">{order.clientName}</span>
                          <span className="hidden sm:inline text-[12.5px] font-mono text-neutral-500 truncate">{order.clientPhone}</span>
                        </div>
                        <p className="text-[13px] text-[#A3A3A3] mt-0.5 truncate">
                          {order.occasion} pour <span className="text-neutral-200">{order.recipient}</span>
                          <span className="text-neutral-600"> · </span>
                          <span className="capitalize">{order.style.replace('_', ' ')}</span>
                        </p>
                      </div>
                    </div>

                    {/* Statut */}
                    <div className="flex items-center justify-between md:block">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[12.5px] text-neutral-300">
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${order.status === 'production_suno' ? 'vx-breathe' : ''}`} />
                        {meta.label}
                      </span>
                      <span className="md:hidden font-mono text-sm font-semibold text-white">
                        {formatNumber(order.amount)} F
                      </span>
                    </div>

                    {/* Montant */}
                    <div className="hidden md:block text-right">
                      <div className="font-mono text-sm font-semibold text-white">
                        {formatNumber(order.amount)} <span className="text-neutral-500 font-normal text-[13px]">F</span>
                      </div>
                      <div className="text-[12.5px] font-mono text-neutral-500 mt-0.5 truncate">
                        {order.paymentMethod} · {order.createdAt}
                      </div>
                    </div>

                    {/* Action */}
                    <span className="hidden md:inline-flex w-[84px] items-center justify-end gap-1 text-[13px] text-neutral-500 group-hover:text-white transition-colors duration-150">
                      Atelier
                      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 ease-luxury group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
