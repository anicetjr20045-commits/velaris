/**
 * Service Client Chariow pour Djelia Academy
 * Permet d'initier le paiement Mobile Money (Wave, Orange Money, Moov, MTN, Carte)
 * pour le Pass Créateur à 4 900 F CFA / mois (30 jours).
 */

export interface CountryInfo {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  region: string;
  operators: string[];
}

export const CHARIOW_COUNTRIES: CountryInfo[] = [
  {
    name: 'Burkina Faso',
    code: 'BF',
    dialCode: '+226',
    flag: '🇧🇫',
    region: 'Afrique de l’Ouest',
    operators: ['Orange Money', 'Moov Money'],
  },
  {
    name: 'Côte d’Ivoire',
    code: 'CI',
    dialCode: '+225',
    flag: '🇨🇮',
    region: 'Afrique de l’Ouest',
    operators: ['Wave', 'Orange Money', 'MTN MoMo', 'Moov'],
  },
  {
    name: 'Sénégal',
    code: 'SN',
    dialCode: '+221',
    flag: '🇸🇳',
    region: 'Afrique de l’Ouest',
    operators: ['Wave', 'Orange Money', 'Free Money'],
  },
  {
    name: 'Cameroun',
    code: 'CM',
    dialCode: '+237',
    flag: '🇨🇲',
    region: 'Afrique Centrale',
    operators: ['MTN MoMo', 'Orange Money'],
  },
  {
    name: 'Mali',
    code: 'ML',
    dialCode: '+223',
    flag: '🇲🇱',
    region: 'Afrique de l’Ouest',
    operators: ['Orange Money', 'Moov Africa'],
  },
  {
    name: 'Bénin',
    code: 'BJ',
    dialCode: '+229',
    flag: '🇧🇯',
    region: 'Afrique de l’Ouest',
    operators: ['MTN MoMo', 'Moov Money'],
  },
  {
    name: 'Togo',
    code: 'TG',
    dialCode: '+228',
    flag: '🇹🇬',
    region: 'Afrique de l’Ouest',
    operators: ['T-Money', 'Moov Money'],
  },
  {
    name: 'Gabon',
    code: 'GA',
    dialCode: '+241',
    flag: '🇬🇦',
    region: 'Afrique Centrale',
    operators: ['Airtel Money', 'Moov Money'],
  },
  {
    name: 'Congo',
    code: 'CG',
    dialCode: '+242',
    flag: '🇨🇬',
    region: 'Afrique Centrale',
    operators: ['MTN MoMo', 'Airtel Money'],
  },
  {
    name: 'RDC Kinshasa',
    code: 'CD',
    dialCode: '+243',
    flag: '🇨🇩',
    region: 'Afrique Centrale',
    operators: ['M-Pesa', 'Orange Money', 'Airtel'],
  },
  {
    name: 'Guinée',
    code: 'GN',
    dialCode: '+224',
    flag: '🇬🇳',
    region: 'Afrique de l’Ouest',
    operators: ['Orange Money', 'MTN'],
  },
  {
    name: 'France & Diaspora',
    code: 'FR',
    dialCode: '+33',
    flag: '🇫🇷',
    region: 'Diaspora',
    operators: ['Carte Bancaire', 'Apple Pay'],
  },
  {
    name: 'International',
    code: 'US',
    dialCode: '+1',
    flag: '🌍',
    region: 'International',
    operators: ['Carte Bancaire Visa / Mastercard'],
  },
];

const LS_CHARIOW_COUNTRY = 'velaris_chariow_country';
const LS_CHARIOW_PHONE = 'velaris_chariow_phone';

export function detectChariowCountry(phone?: string, preferredCode?: string): CountryInfo {
  if (preferredCode) {
    const byCode = CHARIOW_COUNTRIES.find((c) => c.code === preferredCode.toUpperCase());
    if (byCode) return byCode;
  }
  const clean = String(phone || '').trim();
  if (clean) {
    const matched = CHARIOW_COUNTRIES.find(
      (c) => clean.startsWith(c.dialCode.replace('+', '')) || clean.startsWith(c.dialCode)
    );
    if (matched) return matched;
  }
  return CHARIOW_COUNTRIES[0];
}

export function extractLocalPhoneDigits(phone: string | undefined, country: CountryInfo): string {
  const clean = String(phone || '').replace(/\D/g, '');
  if (!clean) return '';
  const prefix = country.dialCode.replace(/\D/g, '');
  return clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
}

export function formatChariowFullPhone(country: CountryInfo, localPhone: string): string {
  const cleanDigits = localPhone.replace(/\D/g, '');
  if (!cleanDigits) return '';
  return `${country.dialCode.replace('+', '')}${cleanDigits}`;
}

export function getSavedChariowPaymentInfo(fallbackUserPhone?: string): {
  country: CountryInfo;
  localPhone: string;
} {
  let savedCode = '';
  let savedPhone = '';
  if (typeof window !== 'undefined') {
    try {
      savedCode = localStorage.getItem(LS_CHARIOW_COUNTRY) || '';
      savedPhone = localStorage.getItem(LS_CHARIOW_PHONE) || '';
    } catch {
      // ignore
    }
  }
  const country = detectChariowCountry(savedPhone || fallbackUserPhone, savedCode);
  const localPhone = savedPhone
    ? savedPhone.replace(/\D/g, '')
    : extractLocalPhoneDigits(fallbackUserPhone, country);
  return { country, localPhone };
}

export function saveChariowPaymentInfo(countryCode: string, localPhone: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_CHARIOW_COUNTRY, countryCode);
    localStorage.setItem(LS_CHARIOW_PHONE, localPhone.replace(/\D/g, ''));
  } catch {
    // ignore
  }
}

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

export async function verifyChariowSale(saleId: string): Promise<{
  success: boolean;
  activated: boolean;
  status?: string;
  creditsAdded?: number;
  kind?: 'subscription' | 'credits';
  label?: string;
  priceCfa?: number;
  error?: string;
}> {
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
      creditsAdded: typeof data.creditsAdded === 'number' ? data.creditsAdded : data.credits_added,
      kind: data.kind,
      label: data.label,
      priceCfa: data.priceCfa,
    };
  } catch (err: any) {
    return { success: false, activated: false, error: err.message };
  }
}
