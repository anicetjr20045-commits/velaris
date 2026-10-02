import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FC, type ReactNode } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Coins,
  CreditCard,
  Database,
  Download,
  Gauge,
  Lock,
  Music2,
  Radio,
  Receipt,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdmin';
import type { Order, StudioMetrics, ConversationItem } from '../types';
import { WAHA_CONFIG, fetchWahaSessions, pingWaha, type WahaSession } from '../services/waha';
import { SUPABASE_CONFIG, supabase } from '../services/supabase';
import { SASPAY_CONFIG, probeSasPayHealth } from '../services/saspay';
import { KIE_CONFIG } from '../services/kie';
import { getStudioCredits, getStudioSubscription } from '../services/billing';

interface AdminConsoleViewProps {
  orders: Order[];
  metrics: StudioMetrics;
  conversations: ConversationItem[];
}

/* ------------------------------------------------------------------ */
/* Types & constantes                                                 */
/* ------------------------------------------------------------------ */

type NodeId = 'waha' | 'supabase' | 'saspay' | 'kie';
type NodeState = 'up' | 'degraded' | 'down' | 'pending' | 'unknown';

interface NodeHealth {
  state: NodeState;
  latency: number | null;
  detail: string;
  /** server = sonde exécutée par l'Edge Function avec les vraies clés ; client = sonde publique depuis le navigateur */
  source: 'server' | 'client';
  history: (number | null)[];
}

interface AdminKpis {
  studios_total: number;
  studios_new_30d: number;
  subs_active_monthly: number;
  subs_active_quarterly: number;
  revenue_total_cfa: number;
  revenue_30d_cfa: number;
  credits_sold: number;
  credits_granted: number;
  credits_consumed: number;
  credits_refunded: number;
  credits_outstanding: number;
  songs_total: number;
  songs_success: number;
  songs_failed: number;
  songs_delivered: number;
  briefs_total: number;
  orders_paid: number;
  orders_delivered: number;
  wa_sessions_connected: number;
}

interface StudioRow {
  id: string;
  email: string | null;
  studio_name: string | null;
  credits: number;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  wa_status: string | null;
  orders_count: number;
  songs_count: number;
}

interface TxRow {
  id: string;
  email: string | null;
  kind: string;
  amount_cfa: number;
  credits_added: number;
  balance_after: number | null;
  transaction_ref: string | null;
  payment_provider: string;
  status: string;
  reason: string | null;
  created_at: string;
}

interface LogEvent {
  id: number;
  at: Date;
  level: 'info' | 'ok' | 'warn' | 'critical';
  scope: string;
  message: string;
}

type DataSource = 'live' | 'studio' | 'demo';

const PROBE_INTERVAL_MS = 30_000;
const HISTORY_SIZE = 24;
const DEGRADED_MS = 900;

const panel = 'rounded-2xl border border-white/[0.08] bg-[#0B0C10]';
const eyebrow = 'font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500';

const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const fmtF = (n: number) => `${fmtInt(n)} F`;
const fmtCr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);
const fmtPct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} %`;
const fmtTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

const STATE_STYLE: Record<NodeState, { label: string; dot: string; text: string }> = {
  up: { label: 'Opérationnel', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  degraded: { label: 'Dégradé', dot: 'bg-amber-400', text: 'text-amber-300' },
  down: { label: 'Hors ligne', dot: 'bg-rose-500', text: 'text-rose-400' },
  pending: { label: 'Sondage', dot: 'bg-neutral-500', text: 'text-neutral-400' },
  unknown: { label: 'Non vérifié', dot: 'bg-neutral-600', text: 'text-neutral-500' },
};

const KIND_LABEL: Record<string, string> = {
  purchase: 'Recharge',
  subscription: 'Abonnement',
  song_generation: 'Chanson',
  ai_prompt: 'Copilot',
  refund: 'Remboursement',
  initial_grant: 'Bienvenue',
};

const emptyNode = (): NodeHealth => ({ state: 'pending', latency: null, detail: 'Sondage en cours', source: 'client', history: [] });

/* ------------------------------------------------------------------ */
/* Primitives visuelles                                               */
/* ------------------------------------------------------------------ */

/** Histogramme de latence : barres SVG, aucune mise en page recalculée */
const LatencyBars: FC<{ history: (number | null)[] }> = ({ history }) => {
  const max = Math.max(300, ...history.map(v => v ?? 0));
  const slots = Array.from({ length: HISTORY_SIZE }, (_, i) => history[history.length - HISTORY_SIZE + i]);
  return (
    <svg viewBox={`0 0 ${HISTORY_SIZE * 6} 28`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      {slots.map((v, i) => {
        if (v === undefined) return <rect key={i} x={i * 6} y={26} width={4} height={2} rx={1} fill="rgba(255,255,255,0.08)" />;
        if (v === null) return <rect key={i} x={i * 6} y={0} width={4} height={28} rx={1} fill="#F43F5E" opacity={0.7} />;
        const h = Math.max(3, (v / max) * 28);
        return <rect key={i} x={i * 6} y={28 - h} width={4} height={h} rx={1} fill={v > DEGRADED_MS ? '#FBBF24' : '#E5E7EB'} opacity={0.3 + (i / HISTORY_SIZE) * 0.7} />;
      })}
    </svg>
  );
};

/** Barre de proportion sobre (deux segments) */
const SplitBar: FC<{ a: number; b: number; labelA: string; labelB: string }> = ({ a, b, labelA, labelB }) => {
  const total = a + b;
  const pa = total > 0 ? (a / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="block h-full bg-white transition-[width] duration-700 ease-out" style={{ width: `${pa}%` }} />
        <span className="block h-full bg-white/25 transition-[width] duration-700 ease-out" style={{ width: `${total > 0 ? 100 - pa : 0}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] tabular-nums text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white" />{labelA}</span>
        <span className="flex items-center gap-1.5">{labelB}<span className="h-1.5 w-1.5 rounded-full bg-white/25" /></span>
      </div>
    </div>
  );
};

const SectionHead: FC<{ icon: LucideIcon; title: string; aside?: ReactNode }> = ({ icon: Icon, title, aside }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
    <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-white">
      <Icon className="h-4 w-4 text-neutral-400" strokeWidth={1.6} />
      {title}
    </h2>
    {aside}
  </div>
);

const Segmented = <T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) => (
  <div className="flex rounded-full border border-white/[0.08] p-0.5 text-xs" role="tablist">
    {options.map(o => (
      <button
        key={o.id}
        type="button"
        role="tab"
        aria-selected={value === o.id}
        onClick={() => onChange(o.id)}
        className={`h-7 rounded-full px-3 transition-colors duration-150 cursor-pointer ${value === o.id ? 'bg-white text-black font-medium' : 'text-neutral-400 hover:text-white'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Console                                                            */
/* ------------------------------------------------------------------ */

export const AdminConsoleView: FC<AdminConsoleViewProps> = ({ orders, metrics, conversations }) => {
  const { user } = useAuth();
  const access = useAdminAccess();

  const [nodes, setNodes] = useState<Record<NodeId, NodeHealth>>({
    waha: emptyNode(), supabase: emptyNode(), saspay: emptyNode(), kie: emptyNode(),
  });
  const [sessions, setSessions] = useState<{ name: string; status: string; phone: string | null; pushName: string | null }[]>([]);
  const [configured, setConfigured] = useState<Record<string, boolean> | null>(null);
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [source, setSource] = useState<DataSource>(user ? 'studio' : 'demo');
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [lastProbe, setLastProbe] = useState<Date | null>(null);
  const [probing, setProbing] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'warn'>('all');
  const [txFilter, setTxFilter] = useState<'all' | 'in' | 'out'>('all');
  const [studioQuery, setStudioQuery] = useState('');
  const eventId = useRef(0);
  const probingRef = useRef(false);

  const canSeeFleet = access === 'admin';

  const pushEvents = useCallback((batch: Omit<LogEvent, 'id' | 'at'>[]) => {
    const at = new Date();
    setEvents(prev => [...batch.map(e => ({ ...e, id: ++eventId.current, at })), ...prev].slice(0, 120));
  }, []);

  /* --- Données financières et parc (RPC administrateur) ------------- */
  const loadFleet = useCallback(async () => {
    if (!canSeeFleet) {
      setSource(user ? 'studio' : 'demo');
      return;
    }
    const [k, s, t] = await Promise.all([
      supabase.rpc('velaris_admin_kpis'),
      supabase.rpc('velaris_admin_studios', { p_limit: 300 }),
      supabase.rpc('velaris_admin_transactions', { p_limit: 200 }),
    ]);
    if (k.error) {
      setSource('studio');
      pushEvents([{ level: 'warn', scope: 'Supabase', message: 'RPC de direction indisponibles : appliquer la migration 20261002_billing_admin_hardening.sql' }]);
      return;
    }
    setKpis(k.data as AdminKpis);
    setStudios((s.data as StudioRow[]) || []);
    setTxs((t.data as TxRow[]) || []);
    setSource('live');
  }, [canSeeFleet, user, pushEvents]);

  /* --- Sondes d'infrastructure ------------------------------------- */
  const runProbe = useCallback(async () => {
    if (probingRef.current) return;
    probingRef.current = true;
    setProbing(true);

    const grade = (reachable: boolean, ms: number, ok = true): NodeState =>
      !reachable ? 'down' : !ok ? 'degraded' : ms > DEGRADED_MS ? 'degraded' : 'up';

    // Santé Supabase : toujours sondée depuis le navigateur (endpoint public)
    const supaT0 = performance.now();
    const supaRes = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/health`, { headers: { apikey: SUPABASE_CONFIG.publishableKey }, cache: 'no-store' })
      .then(r => r.ok)
      .catch(() => null);
    const supaMs = Math.round(performance.now() - supaT0);

    let server: any = null;
    if (canSeeFleet) {
      const { data, error } = await supabase.functions.invoke('admin-health', { body: {} });
      if (!error && data?.checkedAt) server = data;
    }

    const batch: Omit<LogEvent, 'id' | 'at'>[] = [];
    const next: Partial<Record<NodeId, Omit<NodeHealth, 'history' | 'source'> & { source: NodeHealth['source'] }>> = {};

    next.supabase = {
      state: supaRes === null ? 'down' : grade(true, supaMs, supaRes),
      latency: supaRes === null ? null : supaMs,
      detail: supaRes === null ? 'Endpoint auth injoignable' : `Projet ${SUPABASE_CONFIG.projectId.slice(0, 6)}… · Auth, PostgREST, Realtime`,
      source: 'client',
    };

    if (server) {
      setConfigured(server.configured);
      setSessions(server.sessions || []);
      for (const id of ['waha', 'kie', 'saspay'] as const) {
        const p = server[id];
        const missing = server.configured?.[id] === false;
        next[id] = {
          state: missing ? 'degraded' : grade(p.reachable, p.ms, p.authOk !== false),
          latency: p.reachable ? p.ms : null,
          detail: missing ? 'Clé serveur absente (secrets Edge Function)' : p.authOk === false ? 'Clé refusée par le fournisseur' : p.detail,
          source: 'server',
        };
      }
      if (!server.configured?.webhookSecret) batch.push({ level: 'critical', scope: 'SasPay', message: 'SASPAY_WEBHOOK_SECRET absent : aucun paiement ne peut être crédité' });
    } else {
      // Repli sans Edge Function : sondes publiques, sans clé, depuis le navigateur
      const [wahaOk, sas, kieReach, list] = await Promise.all([
        (async () => {
          const t0 = performance.now();
          const ok = user ? await pingWaha() : null;
          return { ok, ms: Math.round(performance.now() - t0) };
        })(),
        probeSasPayHealth(),
        (async () => {
          const t0 = performance.now();
          const ok = await fetch(`https://${KIE_CONFIG.publicHost}`, { mode: 'no-cors', cache: 'no-store' }).then(() => true).catch(() => false);
          return { ok, ms: Math.round(performance.now() - t0) };
        })(),
        canSeeFleet || access === 'unconfigured' ? fetchWahaSessions() : Promise.resolve([] as WahaSession[]),
      ]);
      next.waha = wahaOk.ok === null
        ? { state: 'unknown', latency: null, detail: 'Connexion requise pour sonder la passerelle', source: 'client' }
        : { state: grade(wahaOk.ok, wahaOk.ms), latency: wahaOk.ok ? wahaOk.ms : null, detail: wahaOk.ok ? 'Ping passerelle' : 'Ping sans réponse', source: 'client' };
      next.saspay = { state: grade(sas.reachable, sas.latencyMs, sas.ok), latency: sas.reachable ? sas.latencyMs : null, detail: sas.reachable ? 'API publique joignable' : 'SasPay injoignable', source: 'client' };
      next.kie = { state: kieReach.ok ? 'up' : 'down', latency: kieReach.ok ? kieReach.ms : null, detail: kieReach.ok ? 'Hôte joignable (clé non vérifiée)' : 'Hôte injoignable', source: 'client' };
      setSessions(list.map(s => ({ name: s.name, status: s.status, phone: s.me?.id ? s.me.id.split('@')[0].replace(/^(\d{5})\d+(\d{2})$/, '$1••••$2') : null, pushName: s.me?.pushName ?? null })));
    }

    setNodes(prev => {
      const out = { ...prev };
      for (const id of Object.keys(next) as NodeId[]) {
        const n = next[id]!;
        out[id] = { ...n, history: [...prev[id].history, n.latency].slice(-HISTORY_SIZE) };
      }
      return out;
    });

    for (const id of Object.keys(next) as NodeId[]) {
      const n = next[id]!;
      const scope = id === 'waha' ? 'WAHA' : id === 'kie' ? 'Kie.ai' : id === 'saspay' ? 'SasPay' : 'Supabase';
      if (n.state === 'down') batch.push({ level: 'critical', scope, message: n.detail });
      else if (n.state === 'degraded') batch.push({ level: 'warn', scope, message: `${n.detail}${n.latency ? ` · ${n.latency} ms` : ''}` });
      else if (n.state === 'up') batch.push({ level: 'ok', scope, message: `${n.detail} · ${n.latency} ms` });
    }
    pushEvents(batch);

    setLastProbe(new Date());
    probingRef.current = false;
    setProbing(false);
  }, [canSeeFleet, access, user, pushEvents]);

  const refreshAll = useCallback(async () => {
    await Promise.all([runProbe(), loadFleet()]);
  }, [runProbe, loadFleet]);

  // Audit de contexte à l'ouverture
  useEffect(() => {
    if (access === 'loading') return;
    const audit: Omit<LogEvent, 'id' | 'at'>[] = [
      window.isSecureContext
        ? { level: 'ok', scope: 'Transport', message: 'Contexte HTTPS sécurisé' }
        : { level: 'critical', scope: 'Transport', message: 'Page servie hors HTTPS' },
      access === 'admin'
        ? { level: 'ok', scope: 'Accès', message: 'Administrateur vérifié par profiles.is_admin' }
        : access === 'unconfigured'
          ? { level: 'warn', scope: 'Accès', message: 'Aucun administrateur configuré : console ouverte à tout studio connecté' }
          : { level: 'info', scope: 'Accès', message: 'Vue limitée : données du studio uniquement' },
      WAHA_CONFIG.mode === 'proxy'
        ? { level: 'ok', scope: 'Secrets', message: 'Clé WAHA hors du navigateur (proxy Edge Function)' }
        : { level: 'warn', scope: 'Secrets', message: 'Transport WAHA direct : VITE_WAHA_API_KEY présente dans le bundle' },
    ];
    pushEvents(audit);
  }, [access, pushEvents]);

  // Sondage immédiat puis toutes les 30 s, en pause onglet masqué
  useEffect(() => {
    if (access === 'loading') return;
    void refreshAll();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runProbe();
    }, PROBE_INTERVAL_MS);
    const f = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadFleet();
    }, PROBE_INTERVAL_MS * 4);
    return () => {
      window.clearInterval(t);
      window.clearInterval(f);
    };
  }, [access, refreshAll, runProbe, loadFleet]);

  /* --- Indicateurs de direction ------------------------------------ */
  const direction = useMemo(() => {
    if (source === 'live' && kpis) {
      const mrr = kpis.subs_active_monthly * SASPAY_CONFIG.plans.monthly.priceXOF + (kpis.subs_active_quarterly * SASPAY_CONFIG.plans.quarterly.priceXOF) / 3;
      return {
        mrr,
        subsMonthly: kpis.subs_active_monthly,
        subsQuarterly: kpis.subs_active_quarterly,
        revenueTotal: Number(kpis.revenue_total_cfa),
        revenue30d: Number(kpis.revenue_30d_cfa),
        creditsSold: Number(kpis.credits_sold),
        creditsGranted: Number(kpis.credits_granted),
        creditsConsumed: Number(kpis.credits_consumed),
        creditsRefunded: Number(kpis.credits_refunded),
        creditsOutstanding: Number(kpis.credits_outstanding),
        briefs: kpis.briefs_total,
        songs: kpis.songs_success,
        songsFailed: kpis.songs_failed,
        songsDelivered: kpis.songs_delivered,
        ordersPaid: kpis.orders_paid,
        studios: kpis.studios_total,
        studiosNew: kpis.studios_new_30d,
        waConnected: kpis.wa_sessions_connected,
      };
    }
    // Studio connecté sans droits de direction, ou démonstration : périmètre local
    const credits = getStudioCredits();
    const sub = getStudioSubscription();
    const sold = credits.history.filter(t => t.type === 'purchase').reduce((s, t) => s + t.amount, 0);
    const consumed = -credits.history.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const delivered = orders.filter(o => o.status === 'livre').length;
    const paid = orders.filter(o => o.status === 'livre' || o.status === 'paiement_valide' || o.status === 'production_suno').length;
    return {
      mrr: sub.status === 'active' ? (sub.planId === 'quarterly' ? sub.priceXOF / 3 : sub.priceXOF) : 0,
      subsMonthly: sub.status === 'active' && sub.planId === 'monthly' ? 1 : 0,
      subsQuarterly: sub.status === 'active' && sub.planId === 'quarterly' ? 1 : 0,
      revenueTotal: orders.reduce((s, o) => s + (o.amount || 0), 0) || metrics.totalRevenue,
      revenue30d: 0,
      creditsSold: sold,
      creditsGranted: credits.history.filter(t => t.type === 'initial_grant').reduce((s, t) => s + t.amount, 0),
      creditsConsumed: consumed,
      creditsRefunded: credits.history.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0),
      creditsOutstanding: credits.balance,
      briefs: Math.max(conversations.length, orders.length),
      songs: delivered,
      songsFailed: 0,
      songsDelivered: delivered,
      ordersPaid: paid,
      studios: 1,
      studiosNew: 0,
      waConnected: sessions.filter(s => s.status === 'WORKING').length,
    };
  }, [source, kpis, orders, metrics, conversations, sessions]);

  const conversion = ratio(Math.min(direction.songs, direction.briefs), direction.briefs);
  const paidConversion = ratio(Math.min(direction.ordersPaid, direction.briefs), direction.briefs);
  const creditUsage = ratio(direction.creditsConsumed, direction.creditsSold + direction.creditsGranted);

  const kpiTiles: { label: string; value: string; sub: string; icon: LucideIcon; trend?: 'up' | 'down' }[] = [
    {
      label: 'MRR récurrent',
      value: fmtF(direction.mrr),
      sub: `${direction.subsMonthly} mensuel · ${direction.subsQuarterly} trimestriel`,
      icon: Gauge,
    },
    {
      label: source === 'live' ? 'Encaissé SasPay cumulé' : 'Chiffre d’affaires du studio',
      value: fmtF(direction.revenueTotal),
      sub: source === 'live' ? `${fmtF(direction.revenue30d)} sur 30 jours` : `${orders.length} commandes`,
      icon: Wallet,
      trend: direction.revenue30d > 0 ? 'up' : undefined,
    },
    {
      label: 'Crédits vendus / consommés',
      value: `${fmtCr(direction.creditsSold)} / ${fmtCr(direction.creditsConsumed)}`,
      sub: `${fmtCr(direction.creditsOutstanding)} cr en circulation · ${fmtF(direction.creditsOutstanding * SASPAY_CONFIG.rates.cfaPerCredit)} de passif`,
      icon: Coins,
    },
    {
      label: 'Conversion brief en chanson',
      value: fmtPct(conversion),
      sub: `${fmtInt(direction.songs)} chansons sur ${fmtInt(direction.briefs)} briefs`,
      icon: Music2,
      trend: conversion >= 30 ? 'up' : conversion > 0 ? 'down' : undefined,
    },
  ];

  const nodeList: { id: NodeId; label: string; icon: LucideIcon; host: string }[] = [
    { id: 'waha', label: 'Passerelle WAHA', icon: Radio, host: new URL(WAHA_CONFIG.baseUrl).host },
    { id: 'supabase', label: 'Supabase', icon: Database, host: new URL(SUPABASE_CONFIG.url).host },
    { id: 'saspay', label: 'SasPay', icon: CreditCard, host: 'api.saspay.me' },
    { id: 'kie', label: 'Kie.ai · Suno', icon: Music2, host: KIE_CONFIG.publicHost },
  ];
  const nodeValues = Object.values(nodes);
  const anyDown = nodeValues.some(n => n.state === 'down');
  const allUp = nodeValues.every(n => n.state === 'up');

  const securityChecks: { label: string; pass: boolean | 'warn'; note: string }[] = [
    { label: 'Transport chiffré', pass: window.isSecureContext, note: 'TLS navigateur et API' },
    { label: 'Contrôle d’accès direction', pass: access === 'admin' ? true : 'warn', note: access === 'admin' ? 'profiles.is_admin vérifié côté base' : 'Désigner un administrateur (is_admin)' },
    { label: 'Clé WAHA hors du bundle', pass: WAHA_CONFIG.mode === 'proxy' ? true : 'warn', note: WAHA_CONFIG.mode === 'proxy' ? 'Proxy waha-proxy, une session par studio' : 'Mode direct actif' },
    { label: 'Webhook SasPay signé', pass: configured ? (configured.webhookSecret ? true : false) : 'warn', note: 'HMAC-SHA256 obligatoire, 300 s, idempotence par référence' },
    { label: 'Clés SasPay et Kie.ai serveur', pass: configured ? (configured.saspay && configured.kie ? true : false) : 'warn', note: 'Secrets Edge Functions, jamais dans le navigateur' },
    { label: 'Session anicet2 préservée', pass: true, note: 'Lecture seule côté client et proxy' },
  ];

  const visibleEvents = logFilter === 'all' ? events : events.filter(e => e.level === 'warn' || e.level === 'critical');
  const visibleTxs = txs.filter(t => (txFilter === 'all' ? true : txFilter === 'in' ? Number(t.credits_added) > 0 : Number(t.credits_added) < 0));
  const q = studioQuery.trim().toLowerCase();
  const visibleStudios = q
    ? studios.filter(s => [s.email, s.studio_name, s.id].some(v => v?.toLowerCase().includes(q)))
    : studios;

  const exportCsv = () => {
    const head = ['date', 'studio', 'type', 'montant_cfa', 'credits', 'solde_apres', 'reference', 'fournisseur', 'statut'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = visibleTxs.map(t => [t.created_at, t.email, KIND_LABEL[t.kind] || t.kind, t.amount_cfa, t.credits_added, t.balance_after, t.transaction_ref, t.payment_provider, t.status].map(esc).join(';'));
    const blob = new Blob([`﻿${head.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velaris-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (access === 'denied') {
    return (
      <div className={`${panel} mx-auto max-w-lg p-10 text-center space-y-3`}>
        <Lock className="mx-auto h-7 w-7 text-neutral-500" strokeWidth={1.4} />
        <h1 className="text-xl font-semibold tracking-tight text-white">Console réservée à la direction</h1>
        <p className="text-sm text-neutral-400">Votre compte studio n’a pas les droits d’administration. Les indicateurs de votre studio sont disponibles dans Ventes & Caisse.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={eyebrow}>Direction · Velaris Studio OS</div>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white sm:text-4xl">Console de direction</h1>
          <p className="mt-1.5 max-w-xl text-sm text-neutral-400">
            Revenus récurrents, économie des crédits, conversion, télémétrie des sous-systèmes et audit financier.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.08] px-3 font-mono text-[11px] text-neutral-400">
            <span className={`h-1.5 w-1.5 rounded-full ${source === 'live' ? 'bg-emerald-400' : source === 'studio' ? 'bg-sky-400' : 'bg-neutral-500'}`} />
            {source === 'live' ? 'Parc complet · temps réel' : source === 'studio' ? 'Périmètre studio' : 'Démonstration'}
          </span>
          <span className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium ${
            anyDown ? 'border-rose-500/30 text-rose-300' : allUp ? 'border-emerald-500/25 text-emerald-300' : 'border-white/[0.08] text-neutral-300'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full vx-breathe ${anyDown ? 'bg-rose-500' : allUp ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {anyDown ? 'Incident en cours' : allUp ? 'Tous systèmes opérationnels' : 'Surveillance active'}
          </span>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={probing}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition-all duration-150 hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {access === 'unconfigured' && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-[13px] text-amber-100">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            Aucun administrateur n’est configuré. Appliquez la migration de durcissement puis exécutez
            <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px]">update profiles set is_admin = true where email = '…'</code>
            pour verrouiller cette console et activer les métriques du parc.
          </span>
        </div>
      )}

      {/* KPI de direction */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
        {kpiTiles.map(({ label, value, sub, icon: Icon, trend }, i) => (
          <div key={label} style={{ '--i': i } as CSSProperties} className="vx-stagger bg-[#0B0C10] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-neutral-400">{label}</span>
              <Icon className="h-4 w-4 text-neutral-600" strokeWidth={1.5} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[26px] font-bold tracking-tight tabular-nums text-white">{value}</span>
              {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-400" />}
              {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-amber-300" />}
            </div>
            <div className="truncate font-mono text-[11px] tabular-nums text-neutral-500">{sub}</div>
          </div>
        ))}
      </div>

      {/* Économie du studio */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={`${panel} p-5 space-y-4`}>
          <div className={eyebrow}>Abonnements actifs</div>
          <div className="font-mono text-3xl font-bold tabular-nums text-white">{fmtInt(direction.subsMonthly + direction.subsQuarterly)}</div>
          <SplitBar
            a={direction.subsMonthly * SASPAY_CONFIG.plans.monthly.priceXOF}
            b={(direction.subsQuarterly * SASPAY_CONFIG.plans.quarterly.priceXOF) / 3}
            labelA={`Mensuel ${fmtF(direction.subsMonthly * 3000)}`}
            labelB={`Trimestriel ${fmtF((direction.subsQuarterly * 7000) / 3)}/mois`}
          />
          <p className="text-[12px] text-neutral-500">
            {source === 'live' ? `${fmtInt(direction.studios)} studios inscrits · ${fmtInt(direction.studiosNew)} nouveaux sur 30 jours` : 'Abonnement du studio connecté'}
          </p>
        </section>

        <section className={`${panel} p-5 space-y-4`}>
          <div className={eyebrow}>Cycle des crédits</div>
          <div className="font-mono text-3xl font-bold tabular-nums text-white">{fmtPct(creditUsage)}</div>
          <SplitBar
            a={direction.creditsConsumed}
            b={Math.max(0, direction.creditsSold + direction.creditsGranted - direction.creditsConsumed)}
            labelA={`Consommés ${fmtCr(direction.creditsConsumed)}`}
            labelB={`Disponibles ${fmtCr(Math.max(0, direction.creditsSold + direction.creditsGranted - direction.creditsConsumed))}`}
          />
          <p className="text-[12px] text-neutral-500">
            {fmtCr(direction.creditsGranted)} offerts · {fmtCr(direction.creditsRefunded)} remboursés après échec Kie.ai
          </p>
        </section>

        <section className={`${panel} p-5 space-y-4`}>
          <div className={eyebrow}>Entonnoir de production</div>
          <ol className="space-y-2.5">
            {[
              { label: 'Briefs reçus', value: direction.briefs },
              { label: 'Commandes payées', value: direction.ordersPaid },
              { label: 'Chansons produites', value: direction.songs },
              { label: 'Livrées sur WhatsApp', value: direction.songsDelivered },
            ].map((step, i, all) => (
              <li key={step.label} className="space-y-1">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-neutral-300">
                    <span className="font-mono text-[10px] tabular-nums text-neutral-600">{String(i + 1).padStart(2, '0')}</span>
                    {step.label}
                  </span>
                  <span className="font-mono tabular-nums text-white">{fmtInt(step.value)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full bg-white/70 transition-[width] duration-700 ease-out" style={{ width: `${ratio(step.value, Math.max(1, all[0].value))}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[12px] text-neutral-500">Conversion brief en paiement : {fmtPct(paidConversion)}{direction.songsFailed ? ` · ${direction.songsFailed} échecs Kie.ai` : ''}</p>
        </section>
      </div>

      {/* Télémétrie */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold tracking-tight text-white">Télémétrie des sous-systèmes</h2>
          <span className="font-mono text-[11px] text-neutral-500">{lastProbe ? `Sondé à ${fmtTime(lastProbe)} · toutes les 30 s` : 'Sondage initial'}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {nodeList.map(({ id, label, icon: Icon, host }, i) => {
            const n = nodes[id];
            const st = STATE_STYLE[n.state];
            return (
              <div key={id} style={{ '--i': i } as CSSProperties} className={`vx-stagger ${panel} p-4 space-y-3.5`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-neutral-300">
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-white">{label}</div>
                      <div className="truncate font-mono text-[11px] text-neutral-500">{host}</div>
                    </div>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1.5 text-[11px] font-semibold ${st.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>
                <LatencyBars history={n.history} />
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-neutral-400">{n.detail}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono">
                    {n.latency !== null && <span className="tabular-nums text-white">{n.latency} ms</span>}
                    <span className="rounded border border-white/[0.08] px-1 py-px text-[9px] uppercase tracking-wider text-neutral-500">{n.source === 'server' ? 'Serveur' : 'Navigateur'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Gestion des studios */}
        <section className={`${panel} overflow-hidden xl:col-span-3`}>
          <SectionHead
            icon={Users}
            title="Studios"
            aside={
              source === 'live' ? (
                <label className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                  <input
                    value={studioQuery}
                    onChange={e => setStudioQuery(e.target.value)}
                    placeholder="Email, nom, identifiant"
                    aria-label="Rechercher un studio"
                    className="h-8 w-56 rounded-full border border-white/[0.08] bg-transparent pl-8 pr-3 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/25"
                  />
                </label>
              ) : (
                <span className="font-mono text-[11px] text-neutral-500">{sessions.length} ligne{sessions.length > 1 ? 's' : ''} WAHA</span>
              )
            }
          />
          {source === 'live' ? (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-[#0B0C10]">
                  <tr className={`${eyebrow} border-b border-white/[0.06]`}>
                    <th className="px-5 py-2.5 font-normal">Studio</th>
                    <th className="px-3 py-2.5 font-normal">Pass</th>
                    <th className="px-3 py-2.5 text-right font-normal">Crédits</th>
                    <th className="px-3 py-2.5 text-right font-normal">Chansons</th>
                    <th className="px-5 py-2.5 font-normal">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {visibleStudios.map(s => {
                    const active = s.subscription_status === 'ACTIVE' && s.subscription_expires_at && new Date(s.subscription_expires_at) > new Date();
                    return (
                      <tr key={s.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3">
                          <div className="truncate font-medium text-white">{s.studio_name || s.email || s.id.slice(0, 8)}</div>
                          <div className="truncate font-mono text-[11px] text-neutral-500">{s.email} · inscrit {fmtDate(s.created_at)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`font-mono text-[11px] ${active ? 'text-emerald-400' : 'text-neutral-500'}`}>
                            {active ? `${s.subscription_plan === 'quarterly' ? '3 mois' : 'Mensuel'} · ${fmtDate(s.subscription_expires_at)}` : 'Aucun'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-white">{fmtCr(Number(s.credits))}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-300">{s.songs_count}</td>
                        <td className="px-5 py-3">
                          <span className={`font-mono text-[11px] ${s.wa_status === 'connected' ? 'text-emerald-400' : 'text-neutral-500'}`}>
                            {s.wa_status === 'connected' ? 'Connectée' : s.wa_status === 'scanning' ? 'QR en attente' : 'Hors ligne'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleStudios.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">Aucun studio ne correspond.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-neutral-500">
              {probing || !lastProbe ? 'Interrogation de la passerelle' : 'La liste du parc est réservée aux administrateurs vérifiés.'}
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {sessions.map(s => (
                <li key={s.name} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-white">{s.pushName || s.name}</div>
                    <div className="truncate font-mono text-[11px] text-neutral-500">session {s.name}{s.phone ? ` · +${s.phone}` : ''}</div>
                  </div>
                  <span className={`font-mono text-[11px] ${s.status === 'WORKING' ? 'text-emerald-400' : s.status === 'SCAN_QR_CODE' ? 'text-amber-300' : 'text-rose-400'}`}>{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Posture de sécurité */}
        <section className={`${panel} overflow-hidden xl:col-span-2`}>
          <SectionHead
            icon={ShieldCheck}
            title="Posture de sécurité"
            aside={<span className="font-mono text-[11px] tabular-nums text-neutral-500">{securityChecks.filter(c => c.pass === true).length}/{securityChecks.length}</span>}
          />
          <ul className="divide-y divide-white/[0.04]">
            {securityChecks.map(c => (
              <li key={c.label} className="flex items-start gap-3 px-5 py-3">
                {c.pass === true ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.6} />
                ) : c.pass === 'warn' ? (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" strokeWidth={1.6} />
                ) : (
                  <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" strokeWidth={1.6} />
                )}
                <div className="min-w-0">
                  <div className="text-[13px] text-white">{c.label}</div>
                  <div className="text-[11px] text-neutral-500">{c.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Audit des transactions */}
      <section className={`${panel} overflow-hidden`}>
        <SectionHead
          icon={Receipt}
          title="Audit des transactions"
          aside={
            source === 'live' ? (
              <div className="flex items-center gap-2">
                <Segmented value={txFilter} onChange={setTxFilter} options={[{ id: 'all', label: 'Tout' }, { id: 'in', label: 'Entrées' }, { id: 'out', label: 'Débits' }]} />
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={visibleTxs.length === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] px-3 text-xs text-neutral-300 transition-colors hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              </div>
            ) : null
          }
        />
        {source === 'live' ? (
          <div className="max-h-[380px] overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-[#0B0C10]">
                <tr className={`${eyebrow} border-b border-white/[0.06]`}>
                  <th className="px-5 py-2.5 font-normal">Date</th>
                  <th className="px-3 py-2.5 font-normal">Studio</th>
                  <th className="px-3 py-2.5 font-normal">Type</th>
                  <th className="px-3 py-2.5 text-right font-normal">Montant</th>
                  <th className="px-3 py-2.5 text-right font-normal">Crédits</th>
                  <th className="px-5 py-2.5 font-normal">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono text-[12px]">
                {visibleTxs.map(t => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums text-neutral-500">
                      {new Date(t.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-neutral-300">{t.email || '—'}</td>
                    <td className="px-3 py-2.5 text-neutral-300">{KIND_LABEL[t.kind] || t.kind}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{Number(t.amount_cfa) > 0 ? fmtF(Number(t.amount_cfa)) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${Number(t.credits_added) >= 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                      {Number(t.credits_added) >= 0 ? '+' : ''}{fmtCr(Number(t.credits_added))}
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-2.5 text-neutral-500" title={t.transaction_ref || ''}>{t.transaction_ref || '—'}</td>
                  </tr>
                ))}
                {visibleTxs.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center font-sans text-sm text-neutral-500">Aucune transaction sur ce filtre.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {getStudioCredits().history.slice(0, 8).map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                <span className="min-w-0 truncate text-neutral-300">{t.reason}</span>
                <span className={`shrink-0 font-mono tabular-nums ${t.amount >= 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>{t.amount >= 0 ? '+' : ''}{fmtCr(t.amount)} cr</span>
              </li>
            ))}
            <li className="px-5 py-3 text-[12px] text-neutral-500">Grand livre du studio connecté. L’audit du parc complet est réservé aux administrateurs vérifiés.</li>
          </ul>
        )}
      </section>

      {/* Journal des événements */}
      <section className={`${panel} overflow-hidden`}>
        <SectionHead
          icon={ScrollText}
          title="Journal des événements et erreurs"
          aside={<Segmented value={logFilter} onChange={setLogFilter} options={[{ id: 'all', label: 'Tout' }, { id: 'warn', label: 'Alertes' }]} />}
        />
        <div className="max-h-80 overflow-y-auto font-mono text-[12px]">
          {visibleEvents.length === 0 ? (
            <div className="px-5 py-8 text-center font-sans text-sm text-neutral-500">Aucune alerte sur la période.</div>
          ) : (
            visibleEvents.map(e => (
              <div key={e.id} className="vx-fade-in grid grid-cols-[auto_88px_1fr] items-center gap-3 border-b border-white/[0.04] px-5 py-2 last:border-0">
                <span className="tabular-nums text-neutral-600">{fmtTime(e.at)}</span>
                <span className={`flex items-center gap-1.5 truncate ${
                  e.level === 'critical' ? 'text-rose-400' : e.level === 'warn' ? 'text-amber-300' : e.level === 'ok' ? 'text-emerald-400' : 'text-sky-300'
                }`}>
                  <Activity className="h-3 w-3 shrink-0" />
                  {e.scope}
                </span>
                <span className="truncate text-neutral-300">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
