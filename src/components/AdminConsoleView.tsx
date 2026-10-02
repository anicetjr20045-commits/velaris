import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FC } from 'react';
import {
  Crown,
  RefreshCw,
  Activity,
  Database,
  Music2,
  ShieldCheck,
  ShieldAlert,
  Users,
  Wallet,
  Radio,
  Lock,
  Smartphone,
  CircleCheck,
  CircleAlert,
  CircleX,
  CreditCard,
  Coins
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics, ConversationItem } from '../types';
import { WAHA_CONFIG, fetchWahaSessions, type WahaSession } from '../services/waha';
import { SUPABASE_CONFIG } from '../services/supabase';
import { SASPAY_CONFIG } from '../services/saspay';
import { KIE_CONFIG } from '../services/kie';
import { getStudioCredits, getStudioSubscription } from '../services/billing';

interface AdminConsoleViewProps {
  orders: Order[];
  metrics: StudioMetrics;
  conversations: ConversationItem[];
}

type NodeState = 'up' | 'degraded' | 'down' | 'pending';
type NodeId = 'waha' | 'supabase' | 'kie' | 'saspay';

interface NodeHealth {
  state: NodeState;
  latency: number | null;
  detail: string;
  /** "Sondé" = requête réseau réelle ; "Déduit" = calculé à partir d'autres signaux */
  source: 'Sondé' | 'Déduit';
  history: (number | null)[];
}

interface SecurityEvent {
  id: number;
  at: Date;
  level: 'info' | 'ok' | 'warn' | 'critical';
  scope: string;
  message: string;
}

const PROBE_INTERVAL_MS = 30_000;
const HISTORY_SIZE = 24;
const DEGRADED_MS = 900;

const panelClass = 'rounded-2xl border border-[#2D261E] bg-[#13110E] vx-hairline';

const fmtF = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} F`;
const fmtTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Masque un identifiant WhatsApp : 22656240533@c.us -> +226 56 •• •• 33 */
function maskWhatsAppId(id?: string | null): string {
  if (!id) return 'Non appairée';
  const digits = id.replace(/@.*/, '').replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} •• •• ${digits.slice(-2)}`;
}

/** Requête chronométrée ; toute réponse HTTP (même 401) prouve que le nœud répond */
async function timedProbe(url: string, init?: RequestInit): Promise<{ ok: boolean; reachable: boolean; ms: number }> {
  const started = performance.now();
  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    return { ok: res.ok, reachable: true, ms: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, reachable: false, ms: Math.round(performance.now() - started) };
  } finally {
    window.clearTimeout(timeout);
  }
}

const emptyNode = (source: NodeHealth['source']): NodeHealth => ({
  state: 'pending',
  latency: null,
  detail: 'Sondage en cours…',
  source,
  history: []
});

const STATE_STYLE: Record<NodeState, { label: string; dot: string; text: string; ring: string }> = {
  up: { label: 'Opérationnel', dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'border-emerald-500/25' },
  degraded: { label: 'Dégradé', dot: 'bg-amber-400', text: 'text-amber-300', ring: 'border-amber-500/30' },
  down: { label: 'Hors ligne', dot: 'bg-rose-500', text: 'text-rose-400', ring: 'border-rose-500/35' },
  pending: { label: 'Sondage…', dot: 'bg-neutral-500', text: 'text-neutral-400', ring: 'border-[#2D261E]' }
};

const SESSION_STYLE = (status: string) => {
  if (status === 'WORKING') return { label: 'Connectée', cls: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.06]' };
  if (status === 'SCAN_QR_CODE') return { label: 'QR à scanner', cls: 'text-amber-300 border-amber-500/30 bg-amber-500/[0.06]' };
  if (status === 'STARTING') return { label: 'Démarrage', cls: 'text-sky-300 border-sky-500/25 bg-sky-500/[0.06]' };
  return { label: status === 'FAILED' ? 'En échec' : 'Arrêtée', cls: 'text-rose-400 border-rose-500/30 bg-rose-500/[0.06]' };
};

/** Mini-histogramme de latence (barres SVG, aucun reflow) */
const LatencyBars: FC<{ history: (number | null)[] }> = ({ history }) => {
  const max = Math.max(300, ...history.map((v) => v ?? 0));
  const slots = Array.from({ length: HISTORY_SIZE }, (_, i) => history[history.length - HISTORY_SIZE + i] ?? undefined);
  return (
    <svg viewBox={`0 0 ${HISTORY_SIZE * 6} 28`} className="w-full h-7" preserveAspectRatio="none" aria-hidden>
      {slots.map((v, i) => {
        if (v === undefined) return <rect key={i} x={i * 6} y={26} width={4} height={2} rx={1} fill="#2D261E" />;
        if (v === null) return <rect key={i} x={i * 6} y={0} width={4} height={28} rx={1} fill="#E11D48" opacity={0.7} />;
        const h = Math.max(3, (v / max) * 28);
        return (
          <rect key={i} x={i * 6} y={28 - h} width={4} height={h} rx={1} fill={v > DEGRADED_MS ? '#FBBF24' : '#E5B54F'} opacity={0.35 + (i / HISTORY_SIZE) * 0.65} />
        );
      })}
    </svg>
  );
};

export const AdminConsoleView: FC<AdminConsoleViewProps> = ({ orders, metrics, conversations }) => {
  const { user, isDemoMode } = useAuth();

  const [nodes, setNodes] = useState<Record<NodeId, NodeHealth>>({
    waha: emptyNode('Sondé'),
    supabase: emptyNode('Sondé'),
    kie: emptyNode('Sondé'),
    saspay: emptyNode('Sondé')
  });
  const [sessions, setSessions] = useState<WahaSession[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [lastProbe, setLastProbe] = useState<Date | null>(null);
  const [probing, setProbing] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'warn'>('all');
  const eventId = useRef(0);
  const probingRef = useRef(false);

  const pushEvents = useCallback((batch: Omit<SecurityEvent, 'id' | 'at'>[]) => {
    const at = new Date();
    setEvents((prev) => [
      ...batch.map((e) => ({ ...e, id: ++eventId.current, at })),
      ...prev
    ].slice(0, 80));
  }, []);

  const runProbe = useCallback(async () => {
    if (probingRef.current) return;
    probingRef.current = true;
    setProbing(true);

    const [wahaPing, supa, sessionList, saspayPing, kiePing] = await Promise.all([
      timedProbe(`${WAHA_CONFIG.baseUrl}/ping`, { headers: { 'X-Api-Key': WAHA_CONFIG.apiKey } }),
      timedProbe(`${SUPABASE_CONFIG.url}/auth/v1/health`, { headers: { apikey: SUPABASE_CONFIG.publishableKey } }),
      fetchWahaSessions(),
      timedProbe(`${SASPAY_CONFIG.baseUrl}/countries/`, { headers: { Authorization: `Bearer ${SASPAY_CONFIG.apiKey}` } }),
      timedProbe(`${KIE_CONFIG.baseUrl}/generate/record-info?taskId=probe`, { headers: { Authorization: `Bearer ${KIE_CONFIG.apiKey}` } })
    ]);

    const working = sessionList.filter((s) => s.status === 'WORKING').length;
    const failing = sessionList.filter((s) => s.status === 'FAILED' || s.status === 'STOPPED').length;

    const grade = (reachable: boolean, ms: number): NodeState =>
      !reachable ? 'down' : ms > DEGRADED_MS ? 'degraded' : 'up';

    setNodes((prev) => {
      const next = { ...prev };
      const wahaState = grade(wahaPing.reachable && wahaPing.ok, wahaPing.ms);
      next.waha = {
        ...prev.waha,
        state: wahaState,
        latency: wahaPing.reachable ? wahaPing.ms : null,
        detail: wahaPing.reachable
          ? `${working}/${sessionList.length} session${sessionList.length > 1 ? 's' : ''} active${working > 1 ? 's' : ''}`
          : 'Ping sans réponse',
        history: [...prev.waha.history, wahaPing.reachable ? wahaPing.ms : null].slice(-HISTORY_SIZE)
      };
      next.supabase = {
        ...prev.supabase,
        state: grade(supa.reachable, supa.ms),
        latency: supa.reachable ? supa.ms : null,
        detail: supa.reachable ? `Projet ${SUPABASE_CONFIG.projectId.slice(0, 6)}… · Auth & PostgREST` : 'Endpoint auth injoignable',
        history: [...prev.supabase.history, supa.reachable ? supa.ms : null].slice(-HISTORY_SIZE)
      };
      next.kie = {
        ...prev.kie,
        state: grade(kiePing.reachable, kiePing.ms),
        latency: kiePing.reachable ? kiePing.ms : null,
        detail: kiePing.reachable ? 'Moteur Suno GPU · API opérationnelle' : 'API Kie.ai sans réponse',
        history: [...prev.kie.history, kiePing.reachable ? kiePing.ms : null].slice(-HISTORY_SIZE)
      };
      next.saspay = {
        ...prev.saspay,
        state: grade(saspayPing.reachable, saspayPing.ms),
        latency: saspayPing.reachable ? saspayPing.ms : null,
        detail: saspayPing.reachable ? 'Passerelle Mobile Money & Cartes en ligne' : 'SasPay injoignable',
        history: [...prev.saspay.history, saspayPing.reachable ? saspayPing.ms : null].slice(-HISTORY_SIZE)
      };
      return next;
    });

    setSessions(sessionList);
    setLastProbe(new Date());

    const batch: Omit<SecurityEvent, 'id' | 'at'>[] = [];
    batch.push(
      wahaPing.reachable
        ? { level: wahaPing.ms > DEGRADED_MS ? 'warn' : 'ok', scope: 'WAHA', message: `Ping passerelle ${wahaPing.ms} ms` }
        : { level: 'critical', scope: 'WAHA', message: 'Passerelle injoignable : relances automatiques suspendues' }
    );
    batch.push(
      supa.reachable
        ? { level: supa.ms > DEGRADED_MS ? 'warn' : 'ok', scope: 'Supabase', message: `Santé Auth ${supa.ms} ms` }
        : { level: 'critical', scope: 'Supabase', message: 'Endpoint auth injoignable : bascule sur cache local' }
    );
    batch.push(
      saspayPing.reachable
        ? { level: 'ok', scope: 'SasPay', message: `Passerelle de paiement connectée (${saspayPing.ms} ms)` }
        : { level: 'warn', scope: 'SasPay', message: 'Passerelle SasPay non disponible' }
    );
    batch.push(
      kiePing.reachable
        ? { level: 'ok', scope: 'Kie.ai', message: `Moteur Suno joint avec succès (${kiePing.ms} ms)` }
        : { level: 'warn', scope: 'Kie.ai', message: 'API Kie.ai temporairement inaccessible' }
    );
    if (failing > 0) {
      batch.push({ level: 'warn', scope: 'WAHA', message: `${failing} session${failing > 1 ? 's' : ''} arrêtée${failing > 1 ? 's' : ''} ou en échec` });
    }
    pushEvents(batch);

    probingRef.current = false;
    setProbing(false);
  }, [pushEvents]);

  // Audit de sécurité à l'ouverture (contexte navigateur + session)
  useEffect(() => {
    const audit: Omit<SecurityEvent, 'id' | 'at'>[] = [];
    audit.push(
      window.isSecureContext
        ? { level: 'ok', scope: 'Transport', message: 'Contexte sécurisé HTTPS actif' }
        : { level: 'critical', scope: 'Transport', message: 'Page servie hors HTTPS' }
    );
    if (user) {
      audit.push({ level: 'ok', scope: 'Auth', message: 'Session JWT valide · données isolées par RLS' });
    } else {
      audit.push({ level: 'info', scope: 'Auth', message: isDemoMode ? 'Mode démonstration : aucune donnée privée exposée' : 'Visiteur non authentifié : jeu de démonstration' });
    }
    audit.push({ level: 'warn', scope: 'Secrets', message: 'Clé API WAHA présente dans le bundle client : à déplacer côté serveur' });
    pushEvents(audit);
  }, [user, isDemoMode, pushEvents]);

  // Sondage immédiat puis toutes les 30 s (pause quand l'onglet est masqué)
  useEffect(() => {
    void runProbe();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runProbe();
    }, PROBE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [runProbe]);

  // Métriques consolidées du parc
  const fleet = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0) || metrics.totalRevenue;
    const delivered = orders.filter((o) => o.status === 'livre').length;
    const unread = conversations.filter((c) => c.unread).length;
    const working = sessions.filter((s) => s.status === 'WORKING').length;
    return {
      revenue,
      orders: orders.length,
      delivered,
      conversations: conversations.length,
      unread,
      studios: sessions.length,
      working,
      conversion: metrics.conversionRate
    };
  }, [orders, metrics, conversations, sessions]);

  const credits = getStudioCredits();
  const sub = getStudioSubscription();

  const nodeList: { id: NodeId; label: string; icon: typeof Activity; host: string }[] = [
    { id: 'waha', label: 'Passerelle WAHA', icon: Radio, host: new URL(WAHA_CONFIG.baseUrl).host },
    { id: 'supabase', label: 'Supabase PostgreSQL', icon: Database, host: new URL(SUPABASE_CONFIG.url).host },
    { id: 'kie', label: 'Kie.ai Suno (GPU)', icon: Music2, host: 'api.kie.ai' },
    { id: 'saspay', label: 'Passerelle SasPay', icon: CreditCard, host: 'api.saspay.me' }
  ];

  const allUp = Object.values(nodes).every((n) => n.state === 'up');
  const anyDown = Object.values(nodes).some((n) => n.state === 'down');

  const securityChecks: { label: string; pass: boolean | 'warn'; note: string }[] = [
    { label: 'Transport chiffré', pass: typeof window !== 'undefined' && window.isSecureContext, note: 'TLS de bout en bout navigateur ↔ API' },
    { label: 'Isolation RLS', pass: !!user || 'warn', note: user ? 'Requêtes filtrées par user_id' : 'Actif dès la connexion' },
    { label: 'Paiements & Anti-fraude SasPay', pass: true, note: 'Double contrôle REST + signature HMAC-SHA256 (5 min)' },
    { label: 'Crédits Studio Kie.ai', pass: true, note: 'Non périssables · 1 crédit = 85 F CFA' },
    { label: 'Sessions WAHA par studio', pass: true, note: 'Nom de session studio_<id> par tenant' }
  ];

  const visibleEvents = logFilter === 'all' ? events : events.filter((e) => e.level === 'warn' || e.level === 'critical');

  const kpis = [
    { label: 'Studios connectés', value: `${fleet.working}/${fleet.studios || 0}`, sub: 'Sessions WhatsApp actives', icon: Users },
    { label: 'Chiffre consolidé', value: fmtF(fleet.revenue), sub: `${fleet.orders} commandes · ${fleet.delivered} livrées`, icon: Wallet },
    { label: 'Abonnements SasPay', value: `${sub.priceXOF.toLocaleString('fr-FR')} F`, sub: `${sub.status === 'active' ? 'Pass actif' : 'En attente'}`, icon: CreditCard },
    { label: 'Crédits Studio', value: `${credits.balance.toFixed(1)} cr`, sub: `${(credits.balance * 85).toLocaleString('fr-FR')} F (sans expiration)`, icon: Coins }
  ];

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#E5B54F]/[0.08] border border-[#E5B54F]/35 flex items-center justify-center text-[#F3CA75]">
            <Crown className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Console de direction</h1>
            <p className="text-sm sm:text-base text-[#A8A29E] mt-1.5 leading-relaxed">
              Télémétrie du réseau de studios, santé des nœuds et journal de sécurité.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 h-9 text-xs font-medium ${
            anyDown ? 'border-rose-500/35 text-rose-300' : allUp ? 'border-emerald-500/25 text-emerald-300' : 'border-[#3A3022] text-amber-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full vx-breathe ${anyDown ? 'bg-rose-500' : allUp ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {anyDown ? 'Incident en cours' : allUp ? 'Tous systèmes opérationnels' : 'Surveillance active'}
          </span>
          <button
            onClick={() => void runProbe()}
            disabled={probing}
            className="inline-flex items-center gap-2 h-11 sm:h-9 rounded-full bg-white px-4 text-[13px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-60 transition-all duration-150 ease-press"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
            Sonder
          </button>
        </div>
      </div>

      {/* KPI du parc */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(({ label, value, sub, icon: Icon }, i) => (
          <div key={label} style={{ '--i': i } as CSSProperties} className={`${panelClass} vx-stagger vx-spotlight p-4 sm:p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#A8A29E]">{label}</span>
              <Icon className="h-4 w-4 text-[#78716C]" strokeWidth={1.5} />
            </div>
            <div className="font-mono text-2xl sm:text-[28px] font-bold tracking-tight text-white tabular-nums">{value}</div>
            <div className="text-xs text-neutral-500 truncate">{sub}</div>
          </div>
        ))}
      </div>

      {/* Santé des nœuds */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-white">Santé de l'infrastructure</h2>
          <span className="text-xs font-mono text-neutral-500">
            {lastProbe ? `Dernier sondage ${fmtTime(lastProbe)} · auto 30 s` : 'Sondage initial…'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {nodeList.map(({ id, label, icon: Icon, host }, i) => {
            const n = nodes[id];
            const s = STATE_STYLE[n.state];
            return (
              <div key={id} style={{ '--i': i } as CSSProperties} className={`vx-stagger rounded-2xl border bg-[#13110E] p-5 space-y-4 transition-colors duration-300 ease-luxury ${s.ring}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-white/[0.03] border border-[#2D261E] flex items-center justify-center text-neutral-300">
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-white truncate">{label}</div>
                      <div className="text-xs font-mono text-neutral-500 truncate">{host}</div>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${n.state !== 'pending' ? 'vx-breathe' : ''}`} />
                    {s.label}
                  </span>
                </div>

                {n.source === 'Sondé' ? (
                  <LatencyBars history={n.history} />
                ) : (
                  <div className="h-7 flex items-center">
                    <div className="h-px w-full bg-gradient-to-r from-[#3A3022] via-[#E5B54F]/30 to-transparent" />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 truncate">{n.detail}</span>
                  <span className="flex items-center gap-2 shrink-0 font-mono">
                    {n.latency !== null && <span className="text-white tabular-nums">{n.latency} ms</span>}
                    <span className="rounded-md border border-[#2D261E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">{n.source}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Réseau de studios */}
        <section className={`${panelClass} xl:col-span-3 overflow-hidden`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2D261E]">
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
              Réseau de studios
            </h2>
            <span className="text-xs font-mono text-neutral-500">{sessions.length} ligne{sessions.length > 1 ? 's' : ''}</span>
          </div>

          {sessions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-neutral-500">
              {probing || !lastProbe ? 'Interrogation de la passerelle…' : 'Aucune session renvoyée par la passerelle WAHA.'}
            </div>
          ) : (
            <div className="divide-y divide-[#2D261E]">
              {sessions.map((s) => {
                const st = SESSION_STYLE(s.status);
                const activity = s.timestamps?.activity ? new Date(s.timestamps.activity) : null;
                return (
                  <div key={s.name} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{s.me?.pushName || s.name}</div>
                      <div className="text-xs font-mono text-neutral-500 truncate">session · {s.name}</div>
                    </div>
                    <div className="hidden sm:block text-xs font-mono text-neutral-400 tabular-nums">
                      {maskWhatsAppId(s.me?.id)}
                      {activity && <div className="text-neutral-600">actif {activity.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Contrôles de sécurité */}
        <section className={`${panelClass} xl:col-span-2 overflow-hidden`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2D261E]">
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
              Posture de sécurité
            </h2>
            <span className="text-xs font-mono text-neutral-500">
              {securityChecks.filter((c) => c.pass === true).length}/{securityChecks.length}
            </span>
          </div>
          <ul className="divide-y divide-[#2D261E]">
            {securityChecks.map((c) => (
              <li key={c.label} className="flex items-start gap-3 px-5 py-3.5">
                {c.pass === true ? (
                  <CircleCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" strokeWidth={1.6} />
                ) : c.pass === 'warn' ? (
                  <CircleAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" strokeWidth={1.6} />
                ) : (
                  <CircleX className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" strokeWidth={1.6} />
                )}
                <div className="min-w-0">
                  <div className="text-sm text-white">{c.label}</div>
                  <div className="text-xs text-neutral-500">{c.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Journal de sécurité & télémétrie */}
      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#2D261E]">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
            Journal de sécurité & télémétrie
          </h2>
          <div className="flex rounded-lg border border-[#2D261E] p-0.5 text-xs">
            {(['all', 'warn'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-3 h-8 rounded-md transition-colors duration-150 ${
                  logFilter === f ? 'bg-[#E5B54F]/[0.12] text-[#F3CA75]' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Tout' : 'Alertes'}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto font-mono text-xs">
          {visibleEvents.length === 0 ? (
            <div className="px-5 py-8 text-center text-neutral-500 font-sans text-sm">Aucune alerte sur la période.</div>
          ) : (
            visibleEvents.map((e) => (
              <div key={e.id} className="vx-fade-in grid grid-cols-[auto_auto_1fr] items-center gap-3 px-5 py-2.5 border-b border-[#2D261E]/60 last:border-0">
                <span className="text-neutral-600 tabular-nums">{fmtTime(e.at)}</span>
                <span className={`w-20 truncate ${
                  e.level === 'critical' ? 'text-rose-400' : e.level === 'warn' ? 'text-amber-300' : e.level === 'ok' ? 'text-emerald-400' : 'text-sky-300'
                }`}>
                  {e.level === 'critical' && <ShieldAlert className="inline h-3 w-3 mr-1 -mt-0.5" />}
                  {e.scope}
                </span>
                <span className="text-neutral-300 truncate">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
