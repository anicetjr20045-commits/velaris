/**
 * Service Client Chariow pour Djelia Academy
 * Permet d'initier le paiement Mobile Money (Wave, Orange Money, Moov, MTN, Carte)
 * pour le Pass Créateur à 4 900 F CFA / mois (30 jours).
 */

export interface ChariowCheckoutOptions {
  userId?: string;
  email: string;
  fullName?: string;
  phone?: string;
  countryCode?: string;
  redirectUrl?: string;
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
