/**
 * Service d'intégration SasPay Live
 * API REST pour Mobile Money (Wave, Orange Money, MTN, Moov) et Cartes bancaires
 * Documentation officielle : https://docs.saspay.me/
 */

import type { SasPayCheckoutRequest, SasPayCheckoutResponse, SubscriptionPlanId } from '../types/billing';

export const SASPAY_CONFIG = {
  apiKey: 'sk_live_zlZ6VKJ75jNB0NcI8I6-BssNMZCm6eU8Hfe0dvdkAYc',
  baseUrl: 'https://api.saspay.me/api/v1',
  currency: 'XOF',
  freePaymentLinkUrl: 'https://link.saspay.me/b1w0ra13bhc', // Lien de paiement montant libre hébergé SasPay
  webhooks: {
    supabaseEndpoint: 'https://dnwlqgsftauqsyjwhoza.supabase.co/functions/v1/saspay-webhook',
    directEndpoint: 'https://velaris.money/api/public/webhooks/saspay',
    activeEvents: ['transaction.success', 'transaction.failed', 'transaction.cancelled', 'settlement.success']
  },
  rates: {
    cfaPerCredit: 85,
    minCfaRecharge: 200, // Seuil minimum SasPay
    monthlySubscriptionXOF: 3000,
    quarterlySubscriptionXOF: 7000,
  },
  plans: {
    monthly: {
      id: 'monthly' as SubscriptionPlanId,
      name: 'Abonnement Velaris Studio Mensuel',
      priceXOF: 3000,
      durationDays: 30,
      description: 'Accès complet au Studio Velaris (30 jours) + WAHA WhatsApp + Pipeline CRM'
    },
    quarterly: {
      id: 'quarterly' as SubscriptionPlanId,
      name: 'Abonnement Velaris Studio Trimestriel (3 mois)',
      priceXOF: 7000,
      durationDays: 90,
      description: 'Accès complet 3 mois au Studio Velaris (avantage de 2 000 F CFA offert)'
    }
  }
};

/**
 * Calcule le nombre de crédits accordés pour un montant en F CFA
 * Ratio : 1 crédit = 85 F CFA
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
    formattedCredits: credits.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
  };
}

/**
 * Crée une session de checkout hébergée SasPay
 * Endpoint : POST https://api.saspay.me/api/v1/checkout-sessions/
 */
export async function createSasPayCheckout(req: SasPayCheckoutRequest): Promise<{
  success: boolean;
  data?: SasPayCheckoutResponse;
  error?: string;
}> {
  try {
    const formattedAmount = `${Math.round(req.amount)}.00`;
    const payload = {
      amount: formattedAmount,
      currency: req.currency || SASPAY_CONFIG.currency,
      description: req.description,
      customer_email: req.customerEmail || 'studio@velaris.money',
      customer_name: req.customerName || 'Studio Velaris',
      customer_phone: req.customerPhone || '',
      return_url: req.returnUrl || `${window.location.origin}${window.location.pathname}?payment=success`,
      metadata: req.metadata || {}
    };

    const response = await fetch(`${SASPAY_CONFIG.baseUrl}/checkout-sessions/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SASPAY_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.data?.checkout_url) {
      const errMsg = json?.message || json?.error || `Erreur SasPay HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      data: {
        id: json.data.id,
        checkoutUrl: json.data.checkout_url,
        status: json.data.status,
        slug: json.data.slug,
        amount: json.data.amount,
        currency: json.data.currency,
        description: json.data.description
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Impossible de contacter la passerelle SasPay.'
    };
  }
}

/**
 * Vérifie le statut d'une session de checkout directement auprès de SasPay
 * Endpoint : GET https://api.saspay.me/api/v1/checkout-sessions/{id}/status/
 */
export async function getSasPaySessionStatus(sessionId: string): Promise<{
  success: boolean;
  status?: 'PAID' | 'PENDING' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  transactionId?: string | null;
  transactionStatus?: string | null;
  error?: string;
}> {
  try {
    const response = await fetch(`${SASPAY_CONFIG.baseUrl}/checkout-sessions/${sessionId}/status/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SASPAY_CONFIG.apiKey}`
      }
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.data) {
      return { success: false, error: json?.message || `HTTP ${response.status}` };
    }

    return {
      success: true,
      status: json.data.status,
      transactionId: json.data.transaction_id,
      transactionStatus: json.data.transaction_status
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Échec de vérification du statut SasPay' };
  }
}

/**
 * Sonde la santé de l'API SasPay en mesurant la latence
 */
export async function probeSasPayHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const started = performance.now();
  try {
    const res = await fetch(`${SASPAY_CONFIG.baseUrl}/countries/`, {
      method: 'GET',
      cache: 'no-store'
    });
    const latencyMs = Math.round(performance.now() - started);
    return {
      ok: res.ok,
      latencyMs,
      message: res.ok ? `En ligne (${latencyMs}ms)` : `HTTP ${res.status}`
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      message: err.message || 'Non joignable'
    };
  }
}

/**
 * Prépare une session de paiement libre (montant choisi librement par l'utilisateur)
 * ou retourne le lien hébergé SasPay universel.
 */
export async function createSasPayFreeAmountCheckout(options: {
  amountCfa?: number;
  customerEmail?: string;
  customerName?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  checkoutUrl?: string;
  creditsExpected?: number;
  error?: string;
}> {
  // Si aucun montant spécifique n'est spécifié, rediriger vers la page hébergée SasPay montant libre
  if (!options.amountCfa || options.amountCfa < SASPAY_CONFIG.rates.minCfaRecharge) {
    if (options.amountCfa && options.amountCfa < SASPAY_CONFIG.rates.minCfaRecharge) {
      return {
        success: false,
        error: `Le montant minimum pour un paiement est de ${SASPAY_CONFIG.rates.minCfaRecharge} F CFA.`
      };
    }
    return {
      success: true,
      checkoutUrl: SASPAY_CONFIG.freePaymentLinkUrl,
      creditsExpected: 0
    };
  }

  const { credits } = calculateCreditsForCFA(options.amountCfa);
  const checkoutRes = await createSasPayCheckout({
    amount: options.amountCfa,
    description: `Recharge libre Velaris Studio : ${credits} crédits (${options.amountCfa} F CFA)`,
    customerEmail: options.customerEmail || 'studio@velaris.money',
    customerName: options.customerName || 'Studio Velaris',
    metadata: {
      type: 'CREDIT_RECHARGE',
      amount_cfa: options.amountCfa,
      credits_expected: credits,
      userId: options.userId || 'anonymous_studio'
    }
  });

  if (!checkoutRes.success || !checkoutRes.data) {
    return {
      success: false,
      error: checkoutRes.error || 'Erreur lors de la création de la session libre SasPay.'
    };
  }

  return {
    success: true,
    checkoutUrl: checkoutRes.data.checkoutUrl,
    creditsExpected: credits
  };
}

