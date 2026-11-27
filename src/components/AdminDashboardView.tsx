import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import {
  Activity,
  Award,
  Ban,
  CalendarClock,
  Check,
  Coins,
  CreditCard,
  ExternalLink,
  Film,
  Globe,
  Loader2,
  Mic,
  Music2,
  Plus,
  RefreshCw,
  RotateCw,
  ScrollText,
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
  estimatedApiCostCfa: number;
  estimatedNetMarginCfa: number;
  usersTotal: number;
  newUsers7d: number;
  subsActive: number;
  subsExpiringSoon: number;
  subsExpired: number;
  bannedCount: number;
  creditsSold: number;
  creditsConsumed: number;
  creditsOutstanding: number;
  songsGenerated: number;
  videosGenerated: number;
  voicesGenerated: number;
  analysesRun: number;
  refundsCount: number;
  wahaWorkingCount: number;
  gowsOnline: boolean;
  gowsLatencyMs: number | null;
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
  isBanned: boolean;
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
  adminAuditLogs: any[];
  payouts: any[];
  studios: Array<{ slug: string; studio_name?: string; user_id?: string; is_active?: boolean }>;
  wahaSessions: Array<{ name: string; status: string; engine: string }>;
}

type AdminSection = 'overview' | 'members' | 'payments' | 'infra';

const fmtCfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;
const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export const AdminDashboardView: FC = () => {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'free'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modale gestion membre personnalisée
  const [editingMember, setEditingMember] = useState<AdminMember | null>(null);
  const [customCreditsDelta, setCustomCreditsDelta] = useState('30');
  const [customSubDays, setCustomSubDays] = useState('30');
  const [customReason, setCustomReason] = useState('Attribution administrateur');

  // Vérification manuelle Chariow sale_id
  const [saleIdInput, setSaleIdInput] = useState('');
  const [verifiedSale, setVerifiedSale] = useState<any | null>(null);

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

  const postAdmin = async (payload: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.ok, json };
  };

  const handleAdjustCredits = async (member: AdminMember, delta: number, reason?: string) => {
    setBusyId(`cr_${member.id}`);
    try {
      const { ok, json } = await postAdmin({
        action: 'adjust-credits',
        targetUserId: member.id,
        delta,
        reason: reason || `Ajustement admin (${delta > 0 ? '+' : ''}${delta} cr.)`,
      });
      if (ok) {
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
      const { ok } = await postAdmin({
        action: 'extend-subscription',
        targetUserId: member.id,
        days,
      });
      if (ok) {
        showToast(`${member.studioName} : Pass activé/prolongé de ${days} jours.`);
        void fetchAdmin();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleBan = async (member: AdminMember) => {
    setBusyId(`ban_${member.id}`);
    try {
      const { ok } = await postAdmin({
        action: 'toggle-ban',
        targetUserId: member.id,
        banned: !member.isBanned,
      });
      if (ok) {
        showToast(member.isBanned ? `${member.studioName} réactivé.` : `${member.studioName} suspendu.`);
        void fetchAdmin();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handlePayoutStatus = async (payoutId: string, status: 'paid' | 'rejected') => {
    setBusyId(`pay_${payoutId}`);
    try {
      const { ok } = await postAdmin({
        action: 'mark-payout-paid',
        payoutId,
        status,
      });
      if (ok) {
        showToast(status === 'paid' ? 'Retrait marqué comme payé.' : 'Retrait rejeté.');
        void fetchAdmin();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleWahaAction = async (sessionName: string, engine: string, op: 'restart' | 'stop' | 'logout') => {
    setBusyId(`waha_${sessionName}`);
    try {
      const { ok, json } = await postAdmin({
        action: 'waha-session-action',
        sessionName,
        engine,
        op,
      });
      if (ok) {
        showToast(`Session ${sessionName} : ${op} exécuté.`);
        void fetchAdmin();
      } else {
        showToast(json.error || 'Erreur session WhatsApp.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyChariowSale = async () => {
    if (!saleIdInput.trim()) return;
    setBusyId('verify_sale');
    setVerifiedSale(null);
    try {
      const { ok, json } = await postAdmin({
        action: 'verify-chariow-sale',
        saleId: saleIdInput.trim(),
      });
      if (ok && json.sale) {
        setVerifiedSale(json.sale);
      } else {
        showToast(json.error || 'Vente Chariow introuvable.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleMinisite = async (slug: string, currentActive: boolean) => {
    setBusyId(`site_${slug}`);
    try {
      const { ok } = await postAdmin({
        action: 'toggle-minisite',
        slug,
        active: !currentActive,
      });
      if (ok) {
        showToast(`Mini-site /s/${slug} ${!currentActive ? 'activé' : 'désactivé'}.`);
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
  const { kpis, dailyRevenue, topUsers, recentTransactions, adminAuditLogs, payouts, studios, wahaSessions } = data;
  const maxDailyRev = Math.max(1, ...dailyRevenue.map((d) => d.revenueCfa));

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-950/95 border border-emerald-400/50 text-emerald-100 text-xs font-medium shadow-2xl">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* En-tête + Navigation interne */}
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

      {/* Onglets Admin */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'overview', label: 'Revenus & Top Créateurs' },
            { id: 'members', label: `Membres (${kpis.usersTotal})` },
            { id: 'payments', label: `Chariow & Retraits (${kpis.pendingPayoutsCount})` },
            { id: 'infra', label: 'WhatsApp, Mini-sites & Audit' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              section === tab.id
                ? 'bg-white text-black font-semibold'
                : 'bg-[#0D0F14] text-[#8A90A0] hover:text-white border border-white/[0.06]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1 : VUE D'ENSEMBLE, REVENUS, MARGES & TOP UTILISATEURS */}
      {section === 'overview' && (
        <div className="space-y-6">
          {/* BELLE CARTE DES REVENUS GÉNÉRÉS PAR LE SITE */}
          <section className="stripe-glow-card rounded-[28px] p-5 sm:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="space-y-2">
                <span className="text-xs font-medium text-white/75 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#E2BD6B]" />
                  Revenus totaux générés par le site (Chariow)
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-black/35 border border-white/[0.08] p-3.5">
                  <span className="text-[11px] text-white/60 block">Pass Créateur</span>
                  <span className="text-sm sm:text-base font-bold text-white tabular-nums mt-0.5 block">
                    {fmtCfa(kpis.revenueSubsCfa)}
                  </span>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/[0.08] p-3.5">
                  <span className="text-[11px] text-white/60 block">Packs Crédits</span>
                  <span className="text-sm sm:text-base font-bold text-[#E2BD6B] tabular-nums mt-0.5 block">
                    {fmtCfa(kpis.revenuePacksCfa)}
                  </span>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/[0.08] p-3.5 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-white/60 block">Marge nette est.</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
                    {fmtCfa(kpis.estimatedNetMarginCfa)}
                  </span>
                </div>
              </div>
            </div>

            {/* Graphique 14 derniers jours */}
            <div className="pt-4 border-t border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-white/60">
                <span>Encaissements sur 14 jours</span>
                <span>
                  Coût API est. : {fmtCfa(kpis.estimatedApiCostCfa)} · {kpis.creditsSold.toFixed(0)} cr. vendus
                </span>
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

          {/* 4 KPIs */}
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
                {kpis.creditsOutstanding.toFixed(0)} cr. en circulation
              </p>
            </div>

            <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#8A90A0]">
                <span>WhatsApp GOWS</span>
                <Smartphone className="w-4 h-4 text-[#10D98E]" />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">{kpis.wahaWorkingCount}</div>
              <p className="text-[11px] text-[#8A90A0]">
                {kpis.gowsOnline ? `En ligne (${kpis.gowsLatencyMs ?? '—'} ms)` : 'Hors ligne'}
              </p>
            </div>

            <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-4 sm:p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#8A90A0]">
                <span>Retraits attente</span>
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

          {/* MES MEILLEURS UTILISATEURS & STATISTIQUES STUDIO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#E2BD6B]" />
                  <h2 className="text-base font-semibold text-white">Mes meilleurs utilisateurs</h2>
                </div>
                <span className="text-[11px] font-mono text-[#8A90A0]">Top 10 revenus</span>
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

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-[#10D98E] tabular-nums">{fmtCfa(u.spentCfa)}</p>
                        <p className="text-[11px] text-[#8A90A0] tabular-nums">{u.credits} cr.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingMember(u)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-medium text-white cursor-pointer"
                      >
                        Gérer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-5 rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E2BD6B]" />
                <h2 className="text-base font-semibold text-white">Statistiques de production</h2>
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
                <div className="p-3.5 rounded-2xl bg-[#0D0F14] border border-white/[0.05]">
                  <div className="flex items-center gap-2 text-xs text-[#8A90A0]">
                    <Mic className="w-3.5 h-3.5 text-[#10D98E]" />
                    <span>Voix IA</span>
                  </div>
                  <div className="text-xl font-bold text-white tabular-nums mt-1">{kpis.voicesGenerated}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]">
                  <div className="flex items-center gap-2 text-xs text-[#8A90A0]">
                    <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Expire ≤ 5j</span>
                  </div>
                  <div className="text-xl font-bold text-white tabular-nums mt-1">{kpis.subsExpiringSoon}</div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#07090D] border border-white/[0.05] p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8A90A0]">Pass expirés</span>
                  <span className="font-mono text-rose-300">{kpis.subsExpired}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A90A0]">Remboursements auto API</span>
                  <span className="font-mono text-white">{kpis.refundsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A90A0]">Comptes suspendus</span>
                  <span className="font-mono text-rose-300">{kpis.bannedCount}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SECTION 2 : GESTION COMPLÈTE DES MEMBRES */}
      {section === 'members' && (
        <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">
              Annuaire membres ({filteredMembers.length})
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

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredMembers.slice(0, 100).map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#07090D] border border-white/[0.05]"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {m.isBanned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300">
                        Suspendu
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-[#8A90A0] truncate">
                    {m.phone || m.email} · {m.credits} cr. · Payé {fmtCfa(m.spentCfa)} · Inscrit {fmtDate(m.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
                  <button
                    type="button"
                    onClick={() => setEditingMember(m)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-[11px] text-white/80 cursor-pointer"
                  >
                    Options
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3 : RÉCONCILIATION CHARIOW, RETRAITS & TRANSACTIONS */}
      {section === 'payments' && (
        <div className="space-y-6">
          {/* Vérifier une vente Chariow */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Vérifier une vente Chariow (sale_id)</h2>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={saleIdInput}
                onChange={(e) => setSaleIdInput(e.target.value)}
                placeholder="Ex : sale_abc123..."
                className="flex-1 h-10 px-3.5 rounded-xl bg-[#07090D] border border-white/[0.08] text-xs font-mono text-white placeholder-[#606575] focus:outline-none focus:border-white/30"
              />
              <button
                type="button"
                disabled={busyId === 'verify_sale'}
                onClick={() => void handleVerifyChariowSale()}
                className="px-5 h-10 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 cursor-pointer"
              >
                {busyId === 'verify_sale' ? 'Vérification…' : 'Contrôler'}
              </button>
            </div>
            {verifiedSale && (
              <div className="p-3.5 rounded-2xl bg-[#07090D] border border-emerald-500/30 text-xs space-y-1">
                <p className="text-white font-semibold">
                  {verifiedSale.productLabel} ({fmtCfa(verifiedSale.priceCfa)}) · Statut :{' '}
                  <span className="text-emerald-400 font-mono">{verifiedSale.status}</span>
                </p>
                <p className="text-[#8A90A0] font-mono">
                  Client : {verifiedSale.customerPhone || verifiedSale.customerEmail || '—'} · +{verifiedSale.credits} cr.
                </p>
              </div>
            )}
          </section>

          {/* Retraits affiliation */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Demandes de retrait affiliation</h2>
              <span className="text-xs font-mono text-[#8A90A0]">{payouts.length} récentes</span>
            </div>
            {payouts.length === 0 ? (
              <p className="text-xs text-[#8A90A0]">Aucune demande de retrait enregistrée.</p>
            ) : (
              <div className="space-y-2.5">
                {payouts.map((p) => (
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
            )}
          </section>

          {/* Dernières transactions */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Dernières transactions</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
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
      )}

      {/* SECTION 4 : WHATSAPP, MINI-SITES & JOURNAL D'AUDIT */}
      {section === 'infra' && (
        <div className="space-y-6">
          {/* Sessions WAHA */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#10D98E]" />
                <h2 className="text-base font-semibold text-white">Sessions WhatsApp (GOWS & WEBJS)</h2>
              </div>
              <span className="text-xs font-mono text-[#8A90A0]">{wahaSessions.length} session(s)</span>
            </div>
            <div className="space-y-2">
              {wahaSessions.map((s) => (
                <div
                  key={`${s.engine}_${s.name}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#07090D] text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-white font-semibold">{s.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#8A90A0]">
                      {s.engine}
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === `waha_${s.name}`}
                      onClick={() => void handleWahaAction(s.name, s.engine, 'restart')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-white cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Redémarrer</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `waha_${s.name}`}
                      onClick={() => void handleWahaAction(s.name, s.engine, 'stop')}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mini-sites Affiliation */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#E2BD6B]" />
              <h2 className="text-base font-semibold text-white">Mini-sites affiliés ({studios.length})</h2>
            </div>
            {studios.length === 0 ? (
              <p className="text-xs text-[#8A90A0]">Aucun mini-site enregistré.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {studios.map((st) => {
                  const active = st.is_active !== false;
                  return (
                    <div
                      key={st.slug}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[#07090D] text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{st.studio_name || st.slug}</p>
                        <a
                          href={`https://djelia.store/s/${st.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-[#E2BD6B] inline-flex items-center gap-1 hover:underline"
                        >
                          <span>/s/{st.slug}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === `site_${st.slug}`}
                        onClick={() => void handleToggleMinisite(st.slug, active)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-medium cursor-pointer ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {active ? 'Actif' : 'Désactivé'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Journal d'Audit Admin & Remboursements */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[#E2BD6B]" />
              <h2 className="text-base font-semibold text-white">Journal d&apos;audit & remboursements</h2>
            </div>
            {adminAuditLogs.length === 0 ? (
              <p className="text-xs text-[#8A90A0]">Aucune action d&apos;audit récente.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {adminAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07090D] text-xs"
                  >
                    <div>
                      <p className="text-white font-medium">{log.reason || log.kind}</p>
                      <p className="text-[11px] font-mono text-[#8A90A0]">{fmtDate(log.created_at)}</p>
                    </div>
                    <span className="font-mono text-[#E2BD6B]">
                      {Number(log.credits_added || 0) !== 0 ? `${log.credits_added} cr.` : log.kind}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODALE GESTION FINE D'UN MEMBRE */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0D0F14] border border-white/[0.1] rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{editingMember.studioName}</h3>
                <p className="text-xs font-mono text-[#8A90A0]">{editingMember.phone || editingMember.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A90A0] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#07090D]">
                <span className="text-[#8A90A0] block">Solde actuel</span>
                <span className="text-base font-bold text-white tabular-nums">{editingMember.credits} cr.</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#07090D]">
                <span className="text-[#8A90A0] block">Fin du Pass</span>
                <span className="text-sm font-mono text-white">{fmtDate(editingMember.expiresAt)}</span>
              </div>
            </div>

            {/* Ajuster crédits */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#8A90A0]">
                Ajouter ou retirer des crédits (ex: 30 ou -10)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customCreditsDelta}
                  onChange={(e) => setCustomCreditsDelta(e.target.value)}
                  className="w-24 h-10 px-3 rounded-xl bg-[#07090D] border border-white/[0.1] text-xs font-mono text-white"
                />
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Motif"
                  className="flex-1 h-10 px-3 rounded-xl bg-[#07090D] border border-white/[0.1] text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const d = Number(customCreditsDelta);
                    if (Number.isFinite(d) && d !== 0) {
                      void handleAdjustCredits(editingMember, d, customReason);
                      setEditingMember(null);
                    }
                  }}
                  className="px-4 h-10 rounded-xl bg-white text-black text-xs font-semibold cursor-pointer"
                >
                  Appliquer
                </button>
              </div>
            </div>

            {/* Accorder / prolonger abonnement */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#8A90A0]">
                Accorder / prolonger le Pass Créateur (jours)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customSubDays}
                  onChange={(e) => setCustomSubDays(e.target.value)}
                  className="w-24 h-10 px-3 rounded-xl bg-[#07090D] border border-white/[0.1] text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const days = Math.max(1, Math.min(365, Number(customSubDays) || 30));
                    void handleExtendSub(editingMember, days);
                    setEditingMember(null);
                  }}
                  className="flex-1 h-10 rounded-xl bg-[#E2BD6B] text-black text-xs font-semibold cursor-pointer"
                >
                  Accorder +{customSubDays} jours
                </button>
              </div>
            </div>

            {/* Suspendre / Réactiver */}
            <div className="pt-2 border-t border-white/[0.08] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void handleToggleBan(editingMember);
                  setEditingMember(null);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  editingMember.isBanned
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{editingMember.isBanned ? 'Réactiver le compte' : 'Suspendre le compte'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
