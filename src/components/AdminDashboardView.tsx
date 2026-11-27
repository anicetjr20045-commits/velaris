import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import {
  Activity,
  Award,
  CalendarClock,
  Check,
  Coins,
  CreditCard,
  Film,
  Loader2,
  Mic,
  Music2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '../services/supabase';

interface AdminKpis {
  revenueTotalCfa: number;
  revenue30dCfa: number;
  revenue7dCfa: number;
  revenueTodayCfa: number;
  revenueSubsCfa: number;
  revenuePacksCfa: number;
  usersTotal: number;
  newUsers7d: number;
  subsActive: number;
  subsExpiringSoon: number;
  subsExpired: number;
  creditsSold: number;
  creditsConsumed: number;
  creditsOutstanding: number;
  songsGenerated: number;
  videosGenerated: number;
  voicesGenerated: number;
  analysesRun: number;
  wahaWorkingCount: number;
  pendingPayoutsCount: number;
  pendingPayoutsCfa: number;
}

interface DailyRev {
  date: string;
  label: string;
  revenueCfa: number;
  txCount: number;
}

interface AdminMember {
  id: string;
  studioName: string;
  email: string;
  phone: string;
  slug: string;
  credits: number;
  subStatus: 'active' | 'expired' | 'free';
  expiresAt: string | null;
  daysLeft: number;
  spentCfa: number;
  creditsBought: number;
  creditsUsed: number;
  actionsCount: number;
  createdAt: string;
  lastSignInAt: string | null;
}

interface AdminData {
  kpis: AdminKpis;
  dailyRevenue: DailyRev[];
  topUsers: AdminMember[];
  members: AdminMember[];
  recentTransactions: any[];
  payouts: any[];
  wahaSessions: Array<{ name: string; status: string; engine: string }>;
}

const fmtCfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;
const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export const AdminDashboardView: FC = () => {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'free'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expirée.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || 'Accès administrateur refusé.');
      } else {
        setData(json as AdminData);
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdmin();
  }, [fetchAdmin]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdjustCredits = async (member: AdminMember, delta: number) => {
    setBusyId(`cr_${member.id}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'adjust-credits',
          targetUserId: member.id,
          delta,
          reason: `Ajout admin (+${delta} cr.)`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        showToast(`${member.studioName} : solde mis à jour (${json.credits} cr.)`);
        void fetchAdmin();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleExtendSub = async (member: AdminMember, days: number) => {
    setBusyId(`sub_${member.id}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'extend-subscription',
          targetUserId: member.id,
          days,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        showToast(`${member.studioName} : Pass prolongé de ${days} jours.`);
        void fetchAdmin();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handlePayoutStatus = async (payoutId: string, status: 'paid' | 'rejected') => {
    setBusyId(`pay_${payoutId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark-payout-paid',
          payoutId,
          status,
        }),
      });
      if (res.ok) {
        showToast(status === 'paid' ? 'Retrait marqué comme payé.' : 'Retrait rejeté.');
        void fetchAdmin();
      }
    } finally {
      setBusyId(null);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.members.filter((m) => {
      if (statusFilter !== 'all' && m.subStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        m.studioName.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter]);

  if (loading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#8A90A0]">
        <Loader2 className="w-6 h-6 animate-spin text-[#E2BD6B]" />
        <p className="text-xs font-mono">Chargement de la tour de contrôle…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl bg-rose-500/10 border border-rose-500/30 p-6 text-center space-y-3">
        <ShieldCheck className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-base font-semibold text-white">Accès Administrateur</h2>
        <p className="text-xs text-rose-200">{error}</p>
      </div>
    );
  }

  if (!data) return null;
  const { kpis, dailyRevenue, topUsers, recentTransactions, payouts, wahaSessions } = data;
  const maxDailyRev = Math.max(1, ...dailyRevenue.map((d) => d.revenueCfa));

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-950/95 border border-emerald-400/50 text-emerald-100 text-xs font-medium shadow-2xl">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#E2BD6B]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tour de Contrôle Plateforme</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Administration Djelia
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void fetchAdmin()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0D0F14] border border-white/[0.08] hover:border-white/25 text-xs font-medium text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* 1. BELLE CARTE DES REVENUS GÉNÉRÉS PAR LE SITE + COURBE 14 JOURS */}
      <section className="stripe-glow-card rounded-[28px] p-5 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs font-medium text-white/75 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#E2BD6B]" />
              Revenus totaux générés par la plateforme (Chariow)
            </span>
            <div className="text-3xl sm:text-5xl font-bold text-white tabular-nums tracking-tight">
              {fmtCfa(kpis.revenueTotalCfa)} CFA
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-mono tabular-nums">
                Aujourd&apos;hui : {fmtCfa(kpis.revenueTodayCfa)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-white font-mono tabular-nums">
                7 jours : {fmtCfa(kpis.revenue7dCfa)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-white font-mono tabular-nums">
                30 jours : {fmtCfa(kpis.revenue30dCfa)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="rounded-2xl bg-black/35 border border-white/[0.08] p-3.5">
              <span className="text-[11px] text-white/60 block">Pass Créateur</span>
              <span className="text-base sm:text-lg font-bold text-white tabular-nums mt-0.5 block">
                {fmtCfa(kpis.revenueSubsCfa)}
              </span>
            </div>
            <div className="rounded-2xl bg-black/35 border border-white/[0.08] p-3.5">
              <span className="text-[11px] text-white/60 block">Packs Crédits</span>
              <span className="text-base sm:text-lg font-bold text-[#E2BD6B] tabular-nums mt-0.5 block">
                {fmtCfa(kpis.revenuePacksCfa)}
              </span>
            </div>
          </div>
        </div>

        {/* Graphique 14 derniers jours */}
        <div className="pt-4 border-t border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-white/60">
            <span>Évolution des encaissements sur 14 jours</span>
            <span>{kpis.creditsSold.toFixed(0)} crédits vendus</span>
          </div>
          <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5 sm:gap-2 items-end h-28 pt-2">
            {dailyRevenue.map((d) => {
              const pct = d.revenueCfa > 0 ? Math.max(10, Math.round((d.revenueCfa / maxDailyRev) * 100)) : 4;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      title={`${d.label} : ${fmtCfa(d.revenueCfa)} (${d.txCount} vente(s))`}
                      style={{ height: `${pct}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        d.revenueCfa > 0
                          ? 'bg-gradient-to-t from-[#E2BD6B]/70 to-white group-hover:from-[#E2BD6B] group-hover:to-white'
                          : 'bg-white/[0.08]'
                      }`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-white/45 hidden sm:block">
                    {d.label.slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. 4 KPIs STRATÉGIQUES */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8A90A0]">
            <span>Membres</span>
            <Users className="w-4 h-4 text-[#E2BD6B]" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{kpis.usersTotal}</div>
          <p className="text-[11px] text-[#10D98E]">
            {kpis.subsActive} actifs · +{kpis.newUsers7d} (7j)
          </p>
        </div>

        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8A90A0]">
            <span>Crédits utilisés</span>
            <Coins className="w-4 h-4 text-[#E2BD6B]" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {kpis.creditsConsumed.toFixed(1)}
          </div>
          <p className="text-[11px] text-[#8A90A0]">
            {kpis.creditsOutstanding.toFixed(0)} cr. restants en solde
          </p>
        </div>

        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8A90A0]">
            <span>WhatsApp GOWS</span>
            <Smartphone className="w-4 h-4 text-[#10D98E]" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{kpis.wahaWorkingCount}</div>
          <p className="text-[11px] text-[#8A90A0]">
            {wahaSessions.length} session(s) détectée(s)
          </p>
        </div>

        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8A90A0]">
            <span>Retraits en attente</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {fmtCfa(kpis.pendingPayoutsCfa)}
          </div>
          <p className="text-[11px] text-amber-300">
            {kpis.pendingPayoutsCount} demande(s) affiliation
          </p>
        </div>
      </section>

      {/* 3. STATISTIQUES DE PRODUCTION & MES MEILLEURS UTILISATEURS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mes Meilleurs Utilisateurs */}
        <section className="lg:col-span-7 rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#E2BD6B]" />
              <h2 className="text-base font-semibold text-white">Mes meilleurs utilisateurs</h2>
            </div>
            <span className="text-[11px] font-mono text-[#8A90A0]">Top 10 revenus & activité</span>
          </div>

          <div className="space-y-2.5">
            {topUsers.map((u, idx) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                      idx === 0
                        ? 'bg-[#E2BD6B] text-black'
                        : idx === 1
                        ? 'bg-white/20 text-white'
                        : idx === 2
                        ? 'bg-amber-700/40 text-amber-200'
                        : 'bg-white/[0.06] text-[#8A90A0]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{u.studioName}</p>
                    <p className="text-[11px] text-[#8A90A0] font-mono truncate">
                      {u.phone || u.email} · {u.creditsUsed} cr. utilisés
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-[#10D98E] tabular-nums">{fmtCfa(u.spentCfa)}</p>
                    <p className="text-[11px] text-[#8A90A0] tabular-nums">{u.credits} cr. restants</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === `cr_${u.id}`}
                    onClick={() => void handleAdjustCredits(u, 10)}
                    title="Offrir +10 crédits"
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-medium text-white cursor-pointer"
                  >
                    +10 cr.
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Statistiques d'usage IA & Santé */}
        <section className="lg:col-span-5 rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#E2BD6B]" />
            <h2 className="text-base font-semibold text-white">Statistiques Studio & Forfaits</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-xs text-[#8A90A0]">
                <Music2 className="w-3.5 h-3.5 text-[#E2BD6B]" />
                <span>Chansons</span>
              </div>
              <div className="text-xl font-bold text-white tabular-nums mt-1">{kpis.songsGenerated}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-xs text-[#8A90A0]">
                <Film className="w-3.5 h-3.5 text-[#E2BD6B]" />
                <span>Vidéos Lyrics</span>
              </div>
              <div className="text-xl font-bold text-white tabular-nums mt-1">{kpis.videosGenerated}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-xs text-[#8A90A0]">
                <Mic className="w-3.5 h-3.5 text-[#10D98E]" />
                <span>Voix IA</span>
              </div>
              <div className="text-xl font-bold text-white tabular-nums mt-1">{kpis.voicesGenerated}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-xs text-[#8A90A0]">
                <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                <span>Expire bientôt</span>
              </div>
              <div className="text-xl font-bold text-white tabular-nums mt-1">
                {kpis.subsExpiringSoon}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <p className="text-xs font-medium text-[#8A90A0]">Sessions WhatsApp actives</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {wahaSessions.map((s) => (
                <div
                  key={`${s.engine}_${s.name}`}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-[#07090D]"
                >
                  <span className="font-mono text-white truncate">
                    {s.name} <span className="text-[#8A90A0]">({s.engine})</span>
                  </span>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                      s.status === 'WORKING'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/10 text-[#8A90A0]'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 4. RETRAITS AFFILIATION EN ATTENTE */}
      {payouts.length > 0 && (
        <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Demandes de retrait affiliation</h2>
            <span className="text-xs font-mono text-[#8A90A0]">{payouts.length} récentes</span>
          </div>
          <div className="space-y-2.5">
            {payouts.slice(0, 10).map((p) => (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05] text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">
                    {fmtCfa(Number(p.amount || 0))} · {p.operator} ({p.phone_number})
                  </p>
                  <p className="text-[#8A90A0] font-mono">{fmtDate(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === `pay_${p.id}`}
                        onClick={() => void handlePayoutStatus(p.id, 'paid')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-semibold cursor-pointer"
                      >
                        Marquer payé
                      </button>
                      <button
                        type="button"
                        disabled={busyId === `pay_${p.id}`}
                        onClick={() => void handlePayoutStatus(p.id, 'rejected')}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-full font-mono text-[11px] ${
                        p.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {p.status === 'paid' ? 'Payé' : 'Rejeté'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. ANNUAIRE DES MEMBRES & GESTION CRÉDITS / ABONNEMENTS */}
      <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            Tous les membres ({filteredMembers.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8A90A0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, téléphone, email…"
                className="w-full h-9 pl-8 pr-3 rounded-xl bg-[#07090D] border border-white/[0.08] text-xs text-white placeholder-[#606575] focus:outline-none focus:border-white/30"
              />
            </div>

            {(['all', 'active', 'expired', 'free'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  statusFilter === f
                    ? 'bg-white text-black'
                    : 'bg-[#07090D] text-[#8A90A0] hover:text-white'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'expired' ? 'Expirés' : 'Gratuits'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {filteredMembers.slice(0, 60).map((m) => (
            <div
              key={m.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{m.studioName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      m.subStatus === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : m.subStatus === 'expired'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-white/10 text-[#8A90A0]'
                    }`}
                  >
                    {m.subStatus === 'active'
                      ? m.daysLeft > 0
                        ? `Actif (${m.daysLeft}j)`
                        : 'Actif'
                      : m.subStatus === 'expired'
                      ? 'Expiré'
                      : 'Sans Pass'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[#8A90A0] truncate">
                  {m.phone || m.email} · {m.credits} cr. · Dépensé {fmtCfa(m.spentCfa)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyId === `cr_${m.id}`}
                  onClick={() => void handleAdjustCredits(m, 20)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] text-[11px] font-medium text-white cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>20 cr.</span>
                </button>
                <button
                  type="button"
                  disabled={busyId === `sub_${m.id}`}
                  onClick={() => void handleExtendSub(m, 30)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#E2BD6B]/15 hover:bg-[#E2BD6B]/25 text-[11px] font-medium text-[#E2BD6B] cursor-pointer"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>+30j Pass</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. DERNIÈRES TRANSACTIONS CHARIOW & CRÉDITS */}
      <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Dernières transactions</h2>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07090D] text-xs"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{tx.reason || tx.kind}</p>
                <p className="text-[11px] font-mono text-[#8A90A0]">
                  {fmtDate(tx.created_at)} · {tx.payment_provider || 'STUDIO'}
                </p>
              </div>
              <div className="text-right shrink-0 font-mono">
                {Number(tx.amount_cfa || 0) > 0 && (
                  <span className="text-emerald-400 font-bold block">
                    +{fmtCfa(Number(tx.amount_cfa))}
                  </span>
                )}
                <span className={Number(tx.credits_added || 0) >= 0 ? 'text-[#E2BD6B]' : 'text-[#8A90A0]'}>
                  {Number(tx.credits_added || 0) >= 0 ? '+' : ''}
                  {tx.credits_added} cr.
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
