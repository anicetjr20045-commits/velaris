/**
 * Service d'intégration SasPay (Mobile Money Wave, Orange Money, MTN, Moov et cartes)
 * Documentation officielle : https://docs.saspay.me/
 *
 * Aucune clé secrète dans le navigateur : les sessions de paiement sont créées par
 * l'Edge Function `saspay-checkout` (montant, type et utilisateur fixés côté serveur)
 * et le crédit n'est appliqué que par le webhook signé `saspay-webhook`.
 */

import type { SubscriptionPlanId } from '../types/billing';
import { supabase } from './supabase';

export const SASPAY_CONFIG = {
  publicBaseUrl: 'https://api.saspay.me/api/v1',
  currency: 'XOF',
  // Lien hébergé montant libre : le paiement n'est rattaché à aucun studio, réconciliation manuelle
  freePaymentLinkUrl: 'https://link.saspay.me/b1w0ra13bhc',
  webhooks: {
    supabaseEndpoint: 'https://dnwlqgsftauqsyjwhoza.supabase.co/functions/v1/saspay-webhook',
    directEndpoint: 'https://velaris.money/api/public/webhooks/saspay',
    activeEvents: ['transaction.success', 'transaction.failed', 'transaction.cancelled', 'settlement.success']
  },
  rates: {
    cfaPerCredit: 85,
    minCfaRecharge: 200, // Seuil minimum SasPay
    maxCfaRecharge: 500000,
    monthlySubscriptionXOF: 3000,
    quarterlySubscriptionXOF: 7000,
  },
  plans: {
    monthly: {
      id: 'monthly' as SubscriptionPlanId,
      name: 'Pass Studio Mensuel',
      priceXOF: 3000,
      durationDays: 30,
      description: 'Accès complet au Studio Velaris (30 jours) + WAHA WhatsApp + Pipeline CRM'
    },
    quarterly: {
      id: 'quarterly' as SubscriptionPlanId,
      name: 'Pass Studio Trimestriel',
      priceXOF: 7000,
      durationDays: 90,
      description: 'Accès complet 3 mois au Studio Velaris (2 000 F CFA d’économie)'
    }
  }
};

/**
 * Nombre de crédits accordés pour un montant en F CFA (1 crédit = 85 F CFA).
 * Même arrondi que la fonction SQL velaris_apply_payment (2 décimales).
 */
export function calculateCreditsForCFA(amountCfa: number): {
  credits: number;
  ratePerCredit: number;
  formattedCredits: string;
} {
  const rate = SASPAY_CONFIG.rates.cfaPerCredit;
  const credits = Math.max(0, Math.round((amountCfa / rate) * 100) / 100);
  return {
    credits,
    ratePerCredit: rate,
    formattedCredits: credits.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  };
}

export interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

const PENDING_KEY = 'velaris_saspay_pending_v1';

/* Dernière session ouverte : permet de vérifier le statut au retour de SasPay */
function rememberPending(id: string, kind: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id, kind, at: Date.now() }));
  } catch {
    // stockage indisponible
  }
}

export function getPendingCheckout(): { id: string; kind: string; at: number } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    // Une session SasPay expire ; au-delà de 2 h elle n'a plus d'intérêt
    return parsed && Date.now() - parsed.at < 2 * 3600 * 1000 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // stockage indisponible
  }
}

async function invokeCheckout(payload: Record<string, unknown>): Promise<CheckoutResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Connectez-vous à votre studio pour payer.' };

  const { data, error } = await supabase.functions.invoke('saspay-checkout', { body: payload });
  if (error || !data?.checkoutUrl) {
    const detail = (data && data.error) || (error && 'context' in error ? await readFunctionError(error) : error?.message);
    return { success: false, error: detail || 'Passerelle de paiement indisponible pour le moment.' };
  }
  rememberPending(data.id, String(payload.kind));
  return { success: true, checkoutUrl: data.checkoutUrl, sessionId: data.id };
}

/* Les erreurs HTTP des Edge Functions portent le message dans le corps de la réponse */
async function readFunctionError(error: unknown): Promise<string | undefined> {
  try {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json() : null;
    return body?.error;
  } catch {
    return undefined;
  }
}

const returnUrl = () => `${window.location.origin}${window.location.pathname}?payment=return`;

/**
 * Abonnement : 3 000 F CFA / mois ou 7 000 F CFA / 3 mois (prix imposés par le serveur)
 */
export function createSubscriptionCheckout(planId: SubscriptionPlanId): Promise<CheckoutResult> {
  return invokeCheckout({ action: 'create', kind: 'SUBSCRIPTION', plan: planId === 'quarterly' ? 'quarterly' : 'monthly', returnUrl: returnUrl() });
}

/**
 * Recharge de crédits en montant libre (min. 200 F CFA)
 */
export function createCreditRechargeCheckout(amountCfa: number): Promise<CheckoutResult> {
  const amount = Math.round(amountCfa);
  if (!Number.isFinite(amount) || amount < SASPAY_CONFIG.rates.minCfaRecharge) {
    return Promise.resolve({ success: false, error: `Le montant minimum est de ${SASPAY_CONFIG.rates.minCfaRecharge} F CFA.` });
  }
  if (amount > SASPAY_CONFIG.rates.maxCfaRecharge) {
    return Promise.resolve({ success: false, error: `Le montant maximum par paiement est de ${SASPAY_CONFIG.rates.maxCfaRecharge.toLocaleString('fr-FR')} F CFA.` });
  }
  return invokeCheckout({ action: 'create', kind: 'CREDIT_RECHARGE', amountCfa: amount, returnUrl: returnUrl() });
}

/**
 * Statut d'une session de paiement (lecture seule : le crédit vient du webhook)
 */
export async function getCheckoutStatus(sessionId: string): Promise<{
  success: boolean;
  status?: 'PAID' | 'PENDING' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('saspay-checkout', { body: { action: 'status', sessionId } });
  if (error || !data?.status) return { success: false, error: data?.error || error?.message || 'Statut indisponible' };
  return { success: true, status: data.status };
}

/**
 * Sonde la santé de l'API publique SasPay en mesurant la latence (sans clé)
 */
export async function probeSasPayHealth(): Promise<{
  ok: boolean;
  reachable: boolean;
  latencyMs: number;
  message: string;
}> {
  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${SASPAY_CONFIG.publicBaseUrl}/countries/`, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
    const latencyMs = Math.round(performance.now() - started);
    return { ok: res.ok, reachable: true, latencyMs, message: res.ok ? `En ligne (${latencyMs} ms)` : `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, reachable: false, latencyMs: Math.round(performance.now() - started), message: err?.message || 'Non joignable' };
  } finally {
    clearTimeout(timer);
  }
}
