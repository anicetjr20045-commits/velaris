/**
 * Crédits et abonnements Studio Velaris
 * - 1 crédit = 1 génération chanson = 85 F CFA ; Copilot : 0.05 crédit par échange
 * - Les crédits n'expirent jamais
 * - Abonnements : Mensuel (3 000 F CFA) & Trimestriel (7 000 F CFA)
 *
 * Source de vérité :
 * - studio connecté : table `profiles` + grand livre `credit_transactions` (Supabase).
 *   Le navigateur ne fait que LIRE ; crédits et débits passent par le webhook signé
 *   SasPay et les fonctions SQL atomiques (velaris_apply_payment / consume / refund).
 * - visiteur en démo : simulation locale (localStorage), clairement marquée comme telle.
 */

import type { CreditTransaction, StudioCredits, SubscriptionInfo, SubscriptionPlanId } from '../types/billing';
import { SASPAY_CONFIG } from './saspay';
import { supabase } from './supabase';

const DEMO_CREDITS_KEY = 'velaris_studio_credits_v1';
const DEMO_SUBSCRIPTION_KEY = 'velaris_studio_subscription_v1';
const RENEWAL_PREF_KEY = 'velaris_subscription_autorenew_v1';

const SONG_COST = 1;
const AI_PROMPT_COST = 0.05;

const base = (balance: number, history: CreditTransaction[], source: StudioCredits['source']): StudioCredits => ({
  balance,
  songCostCredits: SONG_COST,
  aiPromptCostCredits: AI_PROMPT_COST,
  cfaPerCredit: SASPAY_CONFIG.rates.cfaPerCredit,
  history,
  source,
});

const DEMO_CREDITS: StudioCredits = base(15, [
  {
    id: 'tx_init_001',
    type: 'initial_grant',
    amount: 15,
    balanceAfter: 15,
    reason: 'Dotation studio offerte de bienvenue (15 chansons IA)',
    date: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    reference: 'GRANT-WELCOME-15'
  }
], 'demo');

const NO_SUBSCRIPTION: SubscriptionInfo = {
  planId: 'free',
  planName: 'Aucun pass actif',
  priceXOF: 0,
  status: 'inactive',
  startedAt: '',
  expiresAt: null,
  autoRenew: false,
};

const DEMO_SUBSCRIPTION: SubscriptionInfo = {
  planId: 'monthly',
  planName: SASPAY_CONFIG.plans.monthly.name,
  priceXOF: 3000,
  status: 'active',
  startedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  expiresAt: new Date(Date.now() + 3600000 * 24 * 25).toISOString(),
  autoRenew: true,
  lastPaymentRef: 'DEMO-SASPAY',
  lastPaymentMethod: 'Wave'
};

/* ------------------------------------------------------------------ */
/* État partagé                                                       */
/* ------------------------------------------------------------------ */

interface BillingState {
  userId: string | null;
  credits: StudioCredits | null;
  subscription: SubscriptionInfo | null;
  error: string | null;
}

const state: BillingState = { userId: null, credits: null, subscription: null, error: null };
const listeners = new Set<() => void>();
let authWatched = false;
let loading: Promise<void> | null = null;

function notify() {
  listeners.forEach(fn => fn());
}

export function subscribeToBilling(fn: () => void): () => void {
  listeners.add(fn);
  watchAuth();
  return () => {
    listeners.delete(fn);
  };
}

function watchAuth() {
  if (authWatched) return;
  authWatched = true;
  supabase.auth.getSession().then(({ data: { session } }) => {
    state.userId = session?.user?.id ?? null;
    if (state.userId) void refreshBilling();
    else notify();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user?.id ?? null;
    if (next === state.userId) return;
    state.userId = next;
    state.credits = null;
    state.subscription = null;
    if (next) void refreshBilling();
    else notify();
  });
}

const KIND_TO_TYPE: Record<string, CreditTransaction['type']> = {
  purchase: 'purchase',
  subscription: 'purchase',
  song_generation: 'song_generation',
  ai_prompt: 'ai_prompt',
  refund: 'refund',
  initial_grant: 'initial_grant',
};

function mapSubscription(p: any, lastPayment?: any): SubscriptionInfo {
  if (!p?.subscription_plan || p.subscription_plan === 'free' || !p.subscription_expires_at) return NO_SUBSCRIPTION;
  const plan = p.subscription_plan === 'quarterly' ? SASPAY_CONFIG.plans.quarterly : SASPAY_CONFIG.plans.monthly;
  const expired = new Date(p.subscription_expires_at).getTime() < Date.now();
  const renew = readRenewalPref();
  return {
    planId: plan.id,
    planName: plan.name,
    priceXOF: plan.priceXOF,
    status: expired ? 'expired' : p.subscription_status === 'CANCELED' || !renew ? 'canceled' : 'active',
    startedAt: new Date(new Date(p.subscription_expires_at).getTime() - plan.durationDays * 86400000).toISOString(),
    expiresAt: p.subscription_expires_at,
    autoRenew: renew && !expired,
    lastPaymentRef: lastPayment?.transaction_ref || undefined,
    lastPaymentMethod: lastPayment ? 'SasPay Mobile Money' : undefined,
  };
}

/**
 * Recharge le solde et l'abonnement depuis Supabase (studio connecté).
 * Les appels concurrents sont fusionnés en un seul aller-retour.
 */
export function refreshBilling(): Promise<void> {
  if (!state.userId) return Promise.resolve();
  if (loading) return loading;
  const userId = state.userId;
  loading = (async () => {
    try {
      const [profileRes, txRes] = await Promise.all([
        supabase.from('profiles').select('credits, subscription_status, subscription_plan, subscription_expires_at').eq('id', userId).maybeSingle(),
        supabase
          .from('credit_transactions')
          .select('id, kind, credits_added, amount_cfa, balance_after, reason, transaction_ref, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (state.userId !== userId) return;
      if (profileRes.error) throw profileRes.error;

      const rows = txRes.data || [];
      const history: CreditTransaction[] = rows.map((t: any) => ({
        id: t.id,
        type: KIND_TO_TYPE[t.kind] || 'purchase',
        amount: Number(t.credits_added),
        balanceAfter: t.balance_after === null ? NaN : Number(t.balance_after),
        reason: t.reason || (Number(t.amount_cfa) > 0 ? `Paiement de ${Number(t.amount_cfa).toLocaleString('fr-FR')} F CFA` : 'Mouvement de crédits'),
        date: t.created_at,
        reference: t.transaction_ref || undefined,
      }));
      state.credits = base(Number(profileRes.data?.credits ?? 0), history, 'server');
      state.subscription = mapSubscription(profileRes.data, rows.find((t: any) => t.kind === 'subscription'));
      state.error = null;
    } catch (err: any) {
      state.error = err?.message || 'Solde indisponible';
    } finally {
      loading = null;
      notify();
    }
  })();
  return loading;
}

export function getBillingError(): string | null {
  return state.error;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                            */
/* ------------------------------------------------------------------ */

function readDemoCredits(): StudioCredits {
  try {
    const raw = localStorage.getItem(DEMO_CREDITS_KEY);
    if (!raw) return DEMO_CREDITS;
    const parsed = JSON.parse(raw);
    return base(
      typeof parsed.balance === 'number' ? parsed.balance : DEMO_CREDITS.balance,
      Array.isArray(parsed.history) ? parsed.history : DEMO_CREDITS.history,
      'demo'
    );
  } catch {
    return DEMO_CREDITS;
  }
}

function saveDemoCredits(credits: StudioCredits): void {
  try {
    localStorage.setItem(DEMO_CREDITS_KEY, JSON.stringify({ balance: credits.balance, history: credits.history }));
  } catch {
    // stockage indisponible
  }
  notify();
}

/**
 * Solde et historique des crédits (instantané ; s'abonner pour les mises à jour)
 */
export function getStudioCredits(): StudioCredits {
  if (state.userId) return state.credits ?? base(0, [], 'pending');
  return readDemoCredits();
}

/**
 * Abonnement du studio
 */
export function getStudioSubscription(): SubscriptionInfo {
  if (state.userId) return state.subscription ?? NO_SUBSCRIPTION;
  try {
    const raw = localStorage.getItem(DEMO_SUBSCRIPTION_KEY);
    const parsed: SubscriptionInfo = raw ? JSON.parse(raw) : DEMO_SUBSCRIPTION;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) parsed.status = 'expired';
    return parsed;
  } catch {
    return DEMO_SUBSCRIPTION;
  }
}

/* ------------------------------------------------------------------ */
/* Écritures                                                          */
/* ------------------------------------------------------------------ */

function pushDemoTx(delta: number, type: CreditTransaction['type'], reason: string, extra: Partial<CreditTransaction> = {}) {
  const current = readDemoCredits();
  const balance = Math.max(0, Math.round((current.balance + delta) * 100) / 100);
  const tx: CreditTransaction = {
    id: `tx_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    amount: delta,
    balanceAfter: balance,
    reason,
    date: new Date().toISOString(),
    ...extra,
  };
  saveDemoCredits({ ...current, balance, history: [tx, ...current.history].slice(0, 100) });
  return balance;
}

/**
 * Débit simulé d'une chanson en mode démo (le studio connecté est débité par le serveur)
 */
export function debitDemoSongCredit(clientName: string, songTitle: string, orderId?: string): {
  success: boolean;
  newBalance: number;
  error?: string;
} {
  const current = readDemoCredits();
  if (current.balance < SONG_COST) {
    return { success: false, newBalance: current.balance, error: `Solde insuffisant (${current.balance.toFixed(2)} crédit). Rechargez vos crédits (85 F CFA / chanson).` };
  }
  const newBalance = pushDemoTx(-SONG_COST, 'song_generation', `Génération « ${songTitle} » pour ${clientName} (démo)`, { orderId });
  return { success: true, newBalance };
}

/**
 * Micro-débit Copilot (0.05 crédit). Studio connecté : fonction SQL atomique,
 * sans bloquer la réponse si le solde est vide (tolérance de courtoisie).
 */
export function debitAiPromptCredit(reason: string = 'Requête Copilot IA Studio'): void {
  if (!state.userId) {
    pushDemoTx(-AI_PROMPT_COST, 'ai_prompt', reason);
    return;
  }
  void supabase
    .rpc('velaris_consume_credits', { p_amount: AI_PROMPT_COST, p_kind: 'ai_prompt', p_reason: reason.slice(0, 120) })
    .then(({ error }) => {
      if (!error) void refreshBilling();
    });
}

/* ------------------------------------------------------------------ */
/* Renouvellement                                                     */
/* ------------------------------------------------------------------ */

function readRenewalPref(): boolean {
  try {
    return localStorage.getItem(`${RENEWAL_PREF_KEY}:${state.userId ?? 'demo'}`) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Résiliation : SasPay encaisse des paiements ponctuels, il n'y a donc aucun
 * prélèvement automatique à annuler. On mémorise simplement le choix de ne pas
 * renouveler ; l'accès reste actif jusqu'à l'échéance déjà payée.
 */
export function cancelSubscription(): { success: boolean; subscription: SubscriptionInfo } {
  try {
    localStorage.setItem(`${RENEWAL_PREF_KEY}:${state.userId ?? 'demo'}`, 'off');
  } catch {
    // stockage indisponible
  }
  if (state.userId && state.subscription) {
    state.subscription = { ...state.subscription, status: 'canceled', autoRenew: false };
  } else if (!state.userId) {
    try {
      localStorage.setItem(DEMO_SUBSCRIPTION_KEY, JSON.stringify({ ...getStudioSubscription(), status: 'canceled', autoRenew: false }));
    } catch {
      // stockage indisponible
    }
  }
  notify();
  return { success: true, subscription: getStudioSubscription() };
}

export function resumeSubscriptionRenewal(): void {
  try {
    localStorage.removeItem(`${RENEWAL_PREF_KEY}:${state.userId ?? 'demo'}`);
  } catch {
    // stockage indisponible
  }
  if (state.userId) void refreshBilling();
  else notify();
}

export type { SubscriptionPlanId };
