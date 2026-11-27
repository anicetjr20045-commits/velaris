import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let apiKey = process.env.CHARIOW_API_KEY || '';
  let productId = process.env.CHARIOW_PRODUCT_ID || 'prd_bh3vpcup';
  let wahaBaseUrl = (process.env.WAHA_BASE_URL || 'https://waha.velarisagent.life').replace(/\/+$/, '');
  let wahaApiKey = process.env.WAHA_API_KEY || '';
  let wahaSession = process.env.WAHA_SESSION || 'Test';

  if (!supabaseSecretKey || !apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m) {
            const k = m[1].trim();
            const v = m[2].trim();
            if (k === 'SUPABASE_SECRET_KEY' && !supabaseSecretKey) supabaseSecretKey = v;
            if (k === 'CHARIOW_API_KEY' && !apiKey) apiKey = v;
            if (k === 'CHARIOW_PRODUCT_ID' && !productId) productId = v;
            if (k === 'WAHA_API_KEY' && !wahaApiKey) wahaApiKey = v;
          }
        }
      }
    } catch {}
  }

  return { supabaseUrl, supabaseSecretKey, apiKey, productId, wahaBaseUrl, wahaApiKey, wahaSession };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const saleId = String(req.query?.sale_id || req.body?.sale_id || '').trim();
  if (!saleId) {
    return res.status(400).json({ error: 'sale_id manquant' });
  }

  const config = getEnvConfig();
  if (!config.apiKey) {
    return res.status(503).json({ error: 'Passerelle Chariow non configurée.' });
  }

  try {
    const chariowRes = await fetch(`https://api.chariow.com/v1/sales/${encodeURIComponent(saleId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!chariowRes.ok) {
      const errData: any = await chariowRes.json().catch(() => ({}));
      return res.status(chariowRes.status).json({
        success: false,
        error: errData?.message || 'Transaction Chariow introuvable.',
      });
    }

    const payload: any = await chariowRes.json().catch(() => ({}));
    const sale = payload?.data || {};
    const saleStatus = sale.status;
    const payStatus = sale.payment?.status;
    const isCompleted = saleStatus === 'completed' || payStatus === 'completed' || payStatus === 'paid';

    if (!isCompleted) {
      return res.status(200).json({
        success: true,
        activated: false,
        status: saleStatus || 'awaiting_payment',
        payment_status: payStatus,
      });
    }

    // Si le paiement est complété, s'assurer que l'abonnement est activé (idempotent)
    const metadata = sale.custom_metadata || {};
    const metadataUserId = metadata.user_id && metadata.user_id !== 'anonymous' ? metadata.user_id : null;
    const customerEmail = String(sale.customer?.email || '').trim().toLowerCase();
    const rawCustomerPhone = String(sale.customer?.phone?.number || metadata.phone || '');

    if (!config.supabaseSecretKey) {
      return res.status(200).json({
        success: true,
        activated: true,
        status: 'completed',
        note: 'Paiement confirmé (base de données non jointe)',
      });
    }

    const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let targetUserId = metadataUserId;
    if (!targetUserId && customerEmail) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData?.users?.find((u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase());
        if (found) targetUserId = found.id;
      } catch {}
    }

    if (!targetUserId) {
      return res.status(200).json({
        success: true,
        activated: false,
        status: 'completed',
        reason: 'Utilisateur non identifié pour ce paiement',
      });
    }

    const transactionRef = `CHARIOW-${saleId}`;
    try {
      const { data: existingTx } = await admin
        .from('credit_transactions')
        .select('id')
        .eq('transaction_ref', transactionRef)
        .maybeSingle();

      if (existingTx) {
        return res.status(200).json({
          success: true,
          activated: true,
          status: 'completed',
          already_applied: true,
        });
      }
    } catch {}

    // Récupérer le profil et métadonnées
    let currentExpires = 0;
    let currentCredits = 0;
    let currentMeta: Record<string, any> = {};

    try {
      const { data: userResp } = await admin.auth.admin.getUserById(targetUserId);
      if (userResp?.user) {
        currentMeta = userResp.user.user_metadata || {};
        if (currentMeta.subscription_expires_at) {
          currentExpires = new Date(currentMeta.subscription_expires_at).getTime();
        }
        currentCredits = Number(currentMeta.credits) || 0;
      }
    } catch {}

    const baseTime = currentExpires > Date.now() ? currentExpires : Date.now();
    const newExpiresAt = new Date(baseTime + 30 * 24 * 3600 * 1000).toISOString();
    const CREDITS_TO_ADD = 30;
    const newCredits = currentCredits + CREDITS_TO_ADD;

    // Mise à jour synchrone user_metadata (garantie)
    await admin.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...currentMeta,
        subscription_status: 'ACTIVE',
        subscription_plan: 'monthly',
        subscription_expires_at: newExpiresAt,
        subscription_started_at: currentMeta.subscription_started_at || new Date().toISOString(),
        credits: newCredits,
        last_payment_ref: transactionRef,
        updated_at: new Date().toISOString(),
      },
    });

    // Mise à jour profiles de secours
    try {
      await admin
        .from('profiles')
        .update({
          subscription_status: 'ACTIVE',
          subscription_plan: 'monthly',
          subscription_expires_at: newExpiresAt,
          credits: newCredits,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);
    } catch {}

    try {
      await admin.from('credit_transactions').insert({
        user_id: targetUserId,
        amount_cfa: 4900,
        credits_added: CREDITS_TO_ADD,
        balance_after: newCredits,
        transaction_ref: transactionRef,
        payment_provider: 'CHARIOW',
        status: 'SUCCESS',
        kind: 'subscription',
        reason: 'Pass Créateur Djelia Academy (4 900 F CFA / 30 jours)',
        metadata: {
          chariow_sale_id: saleId,
          chariow_product_id: sale.product?.id || config.productId,
          customer_email: customerEmail,
          customer_phone: rawCustomerPhone,
        },
      });
    } catch {}

    return res.status(200).json({
      success: true,
      activated: true,
      status: 'completed',
      expires_at: newExpiresAt,
      credits_added: CREDITS_TO_ADD,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
