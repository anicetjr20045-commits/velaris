import { useState, useMemo, type FC } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  CheckCircle, 
  Users, 
  Percent, 
  ArrowUpRight, 
  Play, 
  Clock, 
  Search,
  MessageCircle,
  QrCode,
  Plus,
  Download,
  AlertCircle,
  Sliders,
  ChevronRight,
  FileText
} from 'lucide-react';
import type { Order, StudioMetrics } from '../types';

interface CockpitViewProps {
  metrics: StudioMetrics;
  orders: Order[];
  onSelectOrderForStudio: (orderId: string) => void;
  onOpenQrModal: () => void;
  onOpenNewOrderModal?: () => void;
}

export const CockpitView: FC<CockpitViewProps> = ({
  metrics,
  orders,
  onSelectOrderForStudio,
  onOpenQrModal,
  onOpenNewOrderModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Order['status']>('all');

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch = 
        searchTerm.trim() === '' ||
        o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.occasion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.clientPhone.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

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

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'brief_recu':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-blue-400 border border-blue-500/20">
            <Clock className="h-2.5 w-2.5" /> Brief Reçu
          </span>
        );
      case 'paroles_pretes':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white border border-white/20">
            <FileText className="h-2.5 w-2.5" /> Paroles Prêtes
          </span>
        );
      case 'production_suno':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-purple-400 border border-purple-500/20">
            <Play className="h-2.5 w-2.5 animate-spin" /> Studio Suno
          </span>
        );
      case 'livre':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-2.5 w-2.5" /> Livré WhatsApp
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Welcome Executive Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07080B] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-mono font-medium uppercase tracking-widest text-emerald-400">
                Studio Connecté & Opérationnel
              </p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Tableau de Bord des Ventes
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
              Suivi en direct des leads WhatsApp, validation des paroles et déclenchement du mastering audio en 18 minutes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onOpenNewOrderModal && (
              <button
                onClick={onOpenNewOrderModal}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.12)] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nouveau Lead Client</span>
              </button>
            )}
            <button
              onClick={onOpenQrModal}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Connecter WhatsApp</span>
            </button>
            <button
              onClick={() => onSelectOrderForStudio(orders[0]?.id || '')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Atelier Audio</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Essential Business Metrics — Precision Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Revenue */}
        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Chiffre d'Affaires</span>
            <div className="h-7 w-7 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white">
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {metrics.totalRevenue.toLocaleString()} {metrics.currency}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>+34% ce mois</span>
          </div>
        </div>

        {/* Metric 2: Delivered Songs */}
        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Chansons Livrées</span>
            <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {metrics.ordersDelivered}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
            <Clock className="h-3 w-3 text-purple-400" />
            <span>{metrics.ordersActive} en production</span>
          </div>
        </div>

        {/* Metric 3: Facebook Ads Leads */}
        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Prospects WhatsApp</span>
            <div className="h-7 w-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {metrics.adLeadsCount}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-blue-400">
            <MessageCircle className="h-3 w-3" />
            <span>Coût moyen: 65 F / lead</span>
          </div>
        </div>

        {/* Metric 4: Conversion Rate */}
        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Conversion Closing</span>
            <div className="h-7 w-7 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Percent className="h-3.5 w-3.5" />
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {metrics.conversionRate}%
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            <span>Formule 3 000 F en tête</span>
          </div>
        </div>
      </div>

      {/* Orders Pipeline & Active Queue */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#07080B] p-5 sm:p-6 space-y-4">
        {/* Header with Search and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">JOURNAL DE FLUX</div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Commandes & Discussions Actives ({filteredOrders.length})
            </h2>
            <p className="text-xs text-neutral-400">
              Prise de brief vocal, rédaction de paroles et lancement du rendu musical.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 text-xs font-mono text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Search Input & Status Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-1">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par client, destinataire, occasion, téléphone..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none transition-all"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'brief_recu', label: 'Briefs' },
              { id: 'paroles_pretes', label: 'Paroles' },
              { id: 'production_suno', label: 'Studio' },
              { id: 'livre', label: 'Livrés' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as typeof statusFilter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-mono transition-all border cursor-pointer ${
                  statusFilter === f.id
                    ? 'border-white/40 bg-white text-black font-semibold shadow-sm'
                    : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List / Cards */}
        <div className="space-y-2.5 pt-2">
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center text-neutral-500">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-neutral-400">Aucune commande ne correspond aux filtres.</p>
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="mt-2 text-xs text-white hover:underline cursor-pointer font-mono"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onSelectOrderForStudio(order.id)}
                className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#0D0F14]/60 p-4 transition-all hover:border-white/20 hover:bg-[#0D0F14] cursor-pointer"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-white font-mono font-bold text-sm">
                    {order.clientName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-white text-sm">
                        {order.clientName}
                      </span>
                      <span className="text-xs font-mono text-neutral-400">
                        {order.clientPhone}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                      <span className="text-neutral-300 font-medium">{order.occasion}</span> pour{' '}
                      <span className="text-white font-medium">{order.recipient}</span> — Style{' '}
                      <span className="capitalize text-neutral-300">{order.style.replace('_', ' ')}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t border-white/[0.04] pt-3 md:border-t-0 md:pt-0">
                  <div className="text-left md:text-right">
                    <div className="font-mono text-sm font-bold text-white">
                      {order.amount.toLocaleString()} FCFA
                    </div>
                    <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-1 md:justify-end">
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] group-hover:bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-300 group-hover:text-black transition-all cursor-pointer"
                  >
                    <span>Atelier</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
