import fs from 'node:fs';
import path from 'node:path';
import { CHARIOW_CATALOG } from './_chariow-catalog.js';

function getEnvConfig() {
  let apiKey = process.env.CHARIOW_API_KEY || '';
  let productId = process.env.CHARIOW_PRODUCT_ID || 'prd_bh3vpcup';

  if (!apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m) {
            const k = m[1].trim();
            const v = m[2].trim();
            if (k === 'CHARIOW_API_KEY' && !apiKey) apiKey = v;
            if (k === 'CHARIOW_PRODUCT_ID' && !productId) productId = v;
          }
        }
      }
    } catch {}
  }

  return { apiKey, productId };
}

function parsePhoneAndCountry(rawPhone: string, hintCountry?: string): { number: string; countryCode: string } {
  const digits = rawPhone.replace(/\D/g, '');
  if (hintCountry && hintCountry.length === 2) {
    return { number: digits, countryCode: hintCountry.toUpperCase() };
  }
  if (digits.startsWith('226')) return { number: digits.slice(3) || digits, countryCode: 'BF' };
  if (digits.startsWith('225')) return { number: digits.slice(3) || digits, countryCode: 'CI' };
  if (digits.startsWith('221')) return { number: digits.slice(3) || digits, countryCode: 'SN' };
  if (digits.startsWith('237')) return { number: digits.slice(3) || digits, countryCode: 'CM' };
  if (digits.startsWith('223')) return { number: digits.slice(3) || digits, countryCode: 'ML' };
  if (digits.startsWith('228')) return { number: digits.slice(3) || digits, countryCode: 'TG' };
  if (digits.startsWith('229')) return { number: digits.slice(3) || digits, countryCode: 'BJ' };
  if (digits.startsWith('224')) return { number: digits.slice(3) || digits, countryCode: 'GN' };
  if (digits.startsWith('241')) return { number: digits.slice(3) || digits, countryCode: 'GA' };
  if (digits.startsWith('242')) return { number: digits.slice(3) || digits, countryCode: 'CG' };
  if (digits.startsWith('243')) return { number: digits.slice(3) || digits, countryCode: 'CD' };
  if (digits.startsWith('33')) return { number: digits.slice(2) || digits, countryCode: 'FR' };
  if (digits.startsWith('1')) return { number: digits.slice(1) || digits, countryCode: 'US' };
  return { number: digits, countryCode: 'BF' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const config = getEnvConfig();
  if (!config.apiKey) {
    return res.status(503).json({ error: 'Passerelle Chariow non configurée.' });
  }

  const body = req.body || {};
  const requestedProductId = String(body.productId || '').trim();
  const catalogItem = CHARIOW_CATALOG[requestedProductId] || CHARIOW_CATALOG[config.productId] || CHARIOW_CATALOG.prd_bh3vpcup;
  const userId = String(body.userId || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const rawPhone = String(body.phone || '');
  const fullName = String(body.fullName || '').trim() || 'Créateur Djelia';
  const redirectUrl = String(body.redirectUrl || '').trim() || 'https://app.djelia.store/studio?payment=success&sale_id={sale_id}';

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Adresse email valide requise pour initier le paiement.' });
  }

  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || firstName || 'Client';
  const hintCountry = String(body.countryCode || '').trim().toUpperCase();
  const { number: phoneNumber, countryCode } = parsePhoneAndCountry(rawPhone, hintCountry);

  const chariowPayload = {
    product_id: catalogItem.productId,
    email,
    first_name: firstName.slice(0, 50),
    last_name: lastName.slice(0, 50),
    phone: {
      number: phoneNumber,
      country_code: countryCode,
    },
    redirect_url: redirectUrl,
    custom_metadata: {
      user_id: userId || 'anonymous',
      product_id: catalogItem.productId,
      plan: catalogItem.kind === 'subscription' ? 'creator_pass' : 'credit_pack',
      amount_cfa: String(catalogItem.priceCfa),
      credits: String(catalogItem.credits),
    },
  };

  try {
    const chariowRes = await fetch('https://api.chariow.com/v1/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chariowPayload),
    });

    const data: any = await chariowRes.json().catch(() => ({}));
    if (!chariowRes.ok || !data?.data?.payment?.checkout_url) {
      console.error('Erreur Chariow checkout:', data);
      return res.status(502).json({
        error: data?.message || 'Impossible d\'initier la session de paiement Chariow.',
      });
    }

    return res.status(200).json({
      success: true,
      checkoutUrl: data.data.payment.checkout_url,
      saleId: data.data.purchase?.id || '',
    });
  } catch (err: any) {
    console.error('Exception Chariow checkout:', err);
    return res.status(500).json({ error: 'Erreur réseau lors de la communication avec Chariow.' });
  }
}
