/**
 * Service Client Chariow pour Djelia Academy
 * Permet d'initier le paiement Mobile Money (Wave, Orange Money, Moov, MTN, Carte)
 * pour le Pass Créateur à 4 900 F CFA / mois (30 jours).
 */

export interface ChariowCreditPack {
  productId: string;
  name: string;
  credits: number;
  priceCfa: number;
}

export const CHARIOW_CREDIT_PACKS: readonly ChariowCreditPack[] = [
  { productId: 'prd_ps1n1r1z', name: 'Pack Starter', credits: 20, priceCfa: 2000 },
  { productId: 'prd_6x7tpj8z', name: 'Pack Studio Pro', credits: 55, priceCfa: 4500 },
  { productId: 'prd_x88amcm9', name: 'Pack Agence', credits: 125, priceCfa: 9000 },
];

export interface ChariowCheckoutOptions {
  userId?: string;
  email: string;
  fullName?: string;
  phone?: string;
  countryCode?: string;
  redirectUrl?: string;
  productId?: string;
}

export interface ChariowCheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  saleId?: string;
  error?: string;
}

export async function initiateChariowCheckout(options: ChariowCheckoutOptions): Promise<ChariowCheckoutResponse> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.djelia.store';
    const redirectUrl = options.redirectUrl || `${origin}/studio?payment=success&sale_id={sale_id}`;

    const res = await fetch('/api/chariow-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: options.userId,
        email: options.email,
        fullName: options.fullName,
        phone: options.phone,
        countryCode: options.countryCode,
        redirectUrl,
        ...(options.productId ? { productId: options.productId } : {}),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Impossible d\'initialiser le paiement Chariow.',
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
      saleId: data.saleId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Passerelle de paiement temporairement indisponible.',
    };
  }
}

export async function verifyChariowSale(saleId: string): Promise<{ success: boolean; activated: boolean; status?: string; error?: string }> {
  try {
    const res = await fetch(`/api/chariow-verify?sale_id=${encodeURIComponent(saleId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, activated: false, error: data.error || 'Erreur vérification vente' };
    }
    return {
      success: true,
      activated: Boolean(data.activated),
      status: data.status,
    };
  } catch (err: any) {
    return { success: false, activated: false, error: err.message };
  }
}
