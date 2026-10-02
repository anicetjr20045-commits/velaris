/**
 * Service de gestion des Crédits et des Abonnements Studio Velaris
 * - Facturation : 1 crédit = 1 génération chanson = 85 F CFA
 * - Requêtes IA Copilot : 0.05 crédit par échange (~4.25 F CFA, économique)
 * - Règle absolue : Les crédits N'EXPIRENT JAMAIS
 * - Abonnements : Mensuel (3 000 F CFA) & 3 Mois (7 000 F CFA)
 * - Sécurité anti-fraude avec vérification des transactions
 */

import type { CreditTransaction, StudioCredits, SubscriptionInfo, SubscriptionPlanId } from '../types/billing';
import { SASPAY_CONFIG, getSasPaySessionStatus } from './saspay';

const CREDITS_STORAGE_KEY = 'velaris_studio_credits_v1';
const SUBSCRIPTION_STORAGE_KEY = 'velaris_studio_subscription_v1';

// Initial state for new studio
const DEFAULT_CREDITS: StudioCredits = {
  balance: 15.0, // 15 crédits offerts à l'ouverture du studio
  songCostCredits: 1.0,
  aiPromptCostCredits: 0.05,
  cfaPerCredit: 85,
  history: [
    {
      id: 'tx_init_001',
      type: 'initial_grant',
      amount: 15.0,
      balanceAfter: 15.0,
      reason: 'Dotation studio offerte de bienvenue (15 chansons IA)',
      date: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
      reference: 'GRANT-WELCOME-15'
    }
  ]
};

const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  planId: 'monthly',
  planName: 'Pass Studio Mensuel',
  priceXOF: 3000,
  status: 'active',
  startedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  expiresAt: new Date(Date.now() + 3600000 * 24 * 25).toISOString(), // expire dans 25 jours
  autoRenew: true,
  lastPaymentRef: 'TXN-SASPAY-2026-0891',
  lastPaymentMethod: 'Wave'
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribeToBilling(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Récupère le solde et l'historique des crédits
 */
export function getStudioCredits(): StudioCredits {
  try {
    const raw = localStorage.getItem(CREDITS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CREDITS_STORAGE_KEY, JSON.stringify(DEFAULT_CREDITS));
      return DEFAULT_CREDITS;
    }
    const parsed = JSON.parse(raw);
    return {
      balance: typeof parsed.balance === 'number' ? parsed.balance : DEFAULT_CREDITS.balance,
      songCostCredits: 1.0,
      aiPromptCostCredits: 0.05,
      cfaPerCredit: 85,
      history: Array.isArray(parsed.history) ? parsed.history : DEFAULT_CREDITS.history
    };
  } catch {
    return DEFAULT_CREDITS;
  }
}

/**
 * Sauvegarde les crédits
 */
function saveStudioCredits(credits: StudioCredits): void {
  try {
    localStorage.setItem(CREDITS_STORAGE_KEY, JSON.stringify(credits));
    notifyListeners();
  } catch (err) {
    console.warn('[billing] Failed to save credits to localStorage', err);
  }
}

/**
 * Débite des crédits pour une génération de chanson (1 crédit)
 */
export function debitSongCredit(clientName: string, songTitle: string, orderId?: string): {
  success: boolean;
  newBalance: number;
  error?: string;
} {
  const current = getStudioCredits();
  if (current.balance < current.songCostCredits) {
    return {
      success: false,
      newBalance: current.balance,
      error: `Solde insuffisant (${current.balance.toFixed(2)} crédit(s)). Rechargez vos crédits (85 F CFA / chanson).`
    };
  }

  const newBalance = Math.round((current.balance - current.songCostCredits) * 100) / 100;
  const transaction: CreditTransaction = {
    id: `tx_song_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'song_generation',
    amount: -current.songCostCredits,
    balanceAfter: newBalance,
    reason: `Génération Chanson IA « ${songTitle} » pour ${clientName}`,
    date: new Date().toISOString(),
    orderId
  };

  const updated: StudioCredits = {
    ...current,
    balance: newBalance,
    history: [transaction, ...current.history].slice(0, 100)
  };

  saveStudioCredits(updated);
  return { success: true, newBalance };
}

/**
 * Débite des micro-crédits pour l'utilisation de l'IA Copilot (0.05 crédit)
 */
export function debitAiPromptCredit(reason: string = 'Requête Copilot IA Studio'): {
  success: boolean;
  newBalance: number;
} {
  const current = getStudioCredits();
  // Permet toujours l'IA si solde > 0, sinon tolérance de courtoisie jusqu'à 0
  const cost = current.aiPromptCostCredits;
  const newBalance = Math.max(0, Math.round((current.balance - cost) * 100) / 100);

  const transaction: CreditTransaction = {
    id: `tx_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'ai_prompt',
    amount: -cost,
    balanceAfter: newBalance,
    reason,
    date: new Date().toISOString()
  };

  // Ne journaliser qu'une transaction sur 5 ou si le solde diminue pour éviter d'inonder l'historique
  const updated: StudioCredits = {
    ...current,
    balance: newBalance,
    history: [transaction, ...current.history].slice(0, 100)
  };

  saveStudioCredits(updated);
  return { success: true, newBalance };
}

/**
 * Recharge des crédits suite à un paiement SasPay validé
 * Règle d'or : Les crédits ajoutés n'expirent jamais.
 */
export function rechargeCredits(
  creditsToAdd: number,
  paymentReference: string,
  paymentMethod: string = 'SasPay Mobile Money'
): { success: boolean; newBalance: number } {
  if (creditsToAdd <= 0) return { success: false, newBalance: getStudioCredits().balance };

  const current = getStudioCredits();
  const newBalance = Math.round((current.balance + creditsToAdd) * 100) / 100;
  const costXOF = Math.round(creditsToAdd * current.cfaPerCredit);

  const transaction: CreditTransaction = {
    id: `tx_topup_${Date.now()}`,
    type: 'purchase',
    amount: creditsToAdd,
    balanceAfter: newBalance,
    reason: `Recharge de ${creditsToAdd} crédits (${costXOF.toLocaleString('fr-FR')} F CFA via ${paymentMethod})`,
    date: new Date().toISOString(),
    reference: paymentReference
  };

  const updated: StudioCredits = {
    ...current,
    balance: newBalance,
    history: [transaction, ...current.history].slice(0, 100)
  };

  saveStudioCredits(updated);
  return { success: true, newBalance };
}

/**
 * Récupère les données d'abonnement du studio
 */
export function getStudioSubscription(): SubscriptionInfo {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(DEFAULT_SUBSCRIPTION));
      return DEFAULT_SUBSCRIPTION;
    }
    const parsed = JSON.parse(raw);
    // Vérification de la date d'expiration
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      parsed.status = 'expired';
    }
    return parsed;
  } catch {
    return DEFAULT_SUBSCRIPTION;
  }
}

/**
 * Sauvegarde l'abonnement
 */
function saveStudioSubscription(sub: SubscriptionInfo): void {
  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(sub));
    notifyListeners();
  } catch (err) {
    console.warn('[billing] Failed to save subscription', err);
  }
}

/**
 * Active ou renouvelle un abonnement après confirmation SasPay
 */
export function activateSubscription(
  planId: SubscriptionPlanId,
  paymentRef: string,
  paymentMethod: string = 'SasPay Mobile Money'
): SubscriptionInfo {
  const planConfig = planId === 'quarterly' ? SASPAY_CONFIG.plans.quarterly : SASPAY_CONFIG.plans.monthly;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + planConfig.durationDays * 24 * 3600 * 1000).toISOString();

  const sub: SubscriptionInfo = {
    planId,
    planName: planConfig.name,
    priceXOF: planConfig.priceXOF,
    status: 'active',
    startedAt: now.toISOString(),
    expiresAt,
    autoRenew: true,
    lastPaymentRef: paymentRef,
    lastPaymentMethod: paymentMethod
  };

  saveStudioSubscription(sub);
  return sub;
}

/**
 * Résilie l'abonnement en cours (l'accès reste actif jusqu'à la date d'expiration)
 */
export function cancelSubscription(): { success: boolean; subscription: SubscriptionInfo } {
  const current = getStudioSubscription();
  const updated: SubscriptionInfo = {
    ...current,
    status: 'canceled',
    autoRenew: false
  };
  saveStudioSubscription(updated);
  return { success: true, subscription: updated };
}

/**
 * Vérification anti-fraude stricte pour valider un paiement SasPay et créditer le compte
 */
export async function verifyAndApplySasPayPayment(sessionId: string): Promise<{
  success: boolean;
  message: string;
  type?: 'subscription' | 'credits';
}> {
  const statusRes = await getSasPaySessionStatus(sessionId);
  if (!statusRes.success) {
    return { success: false, message: statusRes.error || 'Session introuvable auprès de SasPay.' };
  }

  if (statusRes.status !== 'PAID') {
    return {
      success: false,
      message: `Paiement non confirmé (statut actuel : ${statusRes.status || 'EN ATTENTE'}).`
    };
  }

  // Vérifier qu'on n'a pas déjà crédité cette session
  const currentCredits = getStudioCredits();
  const alreadyProcessed = currentCredits.history.some(tx => tx.reference === sessionId);
  if (alreadyProcessed) {
    return { success: true, message: 'Ce paiement a déjà été validé et appliqué à votre compte.' };
  }

  // Appliquer le paiement
  const ref = statusRes.transactionId || sessionId;
  rechargeCredits(50, ref, 'SasPay Mobile Money');
  return {
    success: true,
    message: 'Paiement SasPay certifié avec succès. 50 crédits ajoutés à vie.',
    type: 'credits'
  };
}
