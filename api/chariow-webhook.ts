import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let webhookSecret = process.env.CHARIOW_WEBHOOK_SECRET || 'chariow_sec_djelia_2026_9dc757c6';
  let wahaBaseUrl = (process.env.WAHA_BASE_URL || 'https://waha.velarisagent.life').replace(/\/+$/, '');
  let wahaApiKey = process.env.WAHA_API_KEY || '';
  let wahaSession = process.env.WAHA_SESSION || 'Test';

  if (!supabaseSecretKey) {
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
            if (k === 'CHARIOW_WEBHOOK_SECRET' && webhookSecret === 'chariow_sec_djelia_2026_9dc757c6') webhookSecret = v;
            if (k === 'WAHA_API_KEY' && !wahaApiKey) wahaApiKey = v;
          }
        }
      }
    } catch {}
  }

  return { supabaseUrl, supabaseSecretKey, webhookSecret, wahaBaseUrl, wahaApiKey, wahaSession };
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Chariow-Signature');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const config = getEnvConfig();

  // 1. Vérification du token de sécurité (dans l'URL ?token=... ou dans le header Authorization/X-Token)
  const queryToken = String(req.query?.token || '');
  const headerToken = String(req.headers['x-chariow-token'] || req.headers['x-webhook-token'] || '');
  const providedToken = queryToken || headerToken;

  if (config.webhookSecret && providedToken) {
    if (!safeEqual(providedToken, config.webhookSecret)) {
      console.warn('[Chariow Webhook] Jeton de sécurité invalide.');
      return res.status(401).json({ error: 'Jeton de sécurité invalide' });
    }
  }

  const payload = req.body || {};
  const headerEvent = String(req.headers['x-pulse-event'] || req.headers['x-event-name'] || '');
  const eventType = String(headerEvent || payload.type || payload.event || '').toLowerCase();
  const eventId = String(payload.id || payload.event_id || req.headers['x-pulse-delivery-id'] || '');
  const data = payload.data || payload;

  console.log(`[Chariow Webhook] Reçu: type=${eventType || 'inconnu'} id=${eventId}`);

  const sale = data.sale || data.purchase || (data.product ? data : {}) || {};
  const license = data.license || {};
  const metadata = sale.custom_metadata || payload.custom_metadata || payload.metadata || {};
  const payInfo = sale.payment || data.payment || {};

  // Vérifier si c'est un événement de succès de vente ou d'activation
  const isSuccess =
    eventType === 'successful.sale' ||
    eventType === 'successful_sale' ||
    eventType === 'license.activated' ||
    eventType === 'sale.completed' ||
    eventType === 'transaction.success' ||
    sale.status === 'completed' ||
    data.status === 'completed' ||
    payInfo.status === 'completed' ||
    payInfo.status === 'paid' ||
    payInfo.status === 'success';

  if (!isSuccess) {
    return res.status(200).json({ received: true, applied: false, note: `Événement ${eventType || 'non-complété'} ignoré` });
  }

  const saleId = String(sale.id || license.sale_id || eventId || 'SALE-UNKNOWN');
  const metadataUserId = metadata.user_id && metadata.user_id !== 'anonymous' ? metadata.user_id : null;
  const customerEmail = String(sale.customer?.email || '').trim().toLowerCase();
  const rawCustomerPhone = String(sale.customer?.phone?.number || metadata.phone || '');

  if (!config.supabaseSecretKey) {
    console.error('[Chariow Webhook] Clé Supabase manquante');
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Résolution de l'utilisateur (par ID ou par email)
    let targetUserId = metadataUserId;
    if (!targetUserId && customerEmail) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .maybeSingle();
      if (profile?.id) {
        targetUserId = profile.id;
      }
    }

    if (!targetUserId) {
      console.warn(`[Chariow Webhook] Utilisateur introuvable pour email=${customerEmail}. Paiement enregistré en attente.`);
      return res.status(200).json({ received: true, applied: false, reason: 'Utilisateur non rattaché' });
    }

    // 2. Vérification idempotence (anti-doublon)
    const transactionRef = `CHARIOW-${saleId}`;
    const { data: existingTx } = await admin
      .from('credit_transactions')
      .select('id')
      .eq('transaction_ref', transactionRef)
      .maybeSingle();

    if (existingTx) {
      console.log(`[Chariow Webhook] Transaction ${transactionRef} déjà appliquée.`);
      return res.status(200).json({ received: true, applied: false, reason: 'Déjà traité' });
    }

    // 3. Calcul de la nouvelle date d'expiration (30 jours)
    const { data: currentProfile } = await admin
      .from('profiles')
      .select('subscription_expires_at, credits, studio_name')
      .eq('id', targetUserId)
      .maybeSingle();

    const currentExpires = currentProfile?.subscription_expires_at
      ? new Date(currentProfile.subscription_expires_at).getTime()
      : 0;
    const baseTime = currentExpires > Date.now() ? currentExpires : Date.now();
    const newExpiresAt = new Date(baseTime + 30 * 24 * 3600 * 1000).toISOString();

    const CREDITS_TO_ADD = 30; // 30 crédits de production inclus dans le Pass à 4 900 F CFA
    const newCredits = (Number(currentProfile?.credits) || 0) + CREDITS_TO_ADD;

    // 4. Mise à jour atomique du profil
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        subscription_status: 'ACTIVE',
        subscription_plan: 'monthly',
        subscription_expires_at: newExpiresAt,
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (updateErr) {
      console.error('[Chariow Webhook] Erreur mise à jour profil:', updateErr);
      return res.status(500).json({ error: 'Échec mise à jour profil' });
    }

    // 5. Enregistrement dans le grand livre des transactions
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
        chariow_product_id: sale.product_id || 'prd_bh3vpcup',
        customer_email: customerEmail,
        customer_phone: rawCustomerPhone,
      },
    });

    console.log(`[Chariow Webhook] ✅ Succès : User ${targetUserId} activé jusqu'au ${newExpiresAt} avec +${CREDITS_TO_ADD} crédits.`);

    // 6. Notification WhatsApp de félicitations (si numéro disponible)
    const phoneDigits = rawCustomerPhone.replace(/\D/g, '');
    if (phoneDigits.length >= 8) {
      const cleanPhone = phoneDigits.startsWith('226') || phoneDigits.startsWith('225') || phoneDigits.startsWith('221')
        ? phoneDigits
        : `226${phoneDigits}`;

      const studioName = currentProfile?.studio_name || 'Créateur';
      const notifMsg = `Djelia Academy : Félicitations ${studioName} !\nVotre Pass Créateur (4 900 F CFA) est maintenant actif.\n30 crédits de production musicale ont été ajoutés à votre studio. Bonnes créations !`;

      fetch(`${config.wahaBaseUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.wahaApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: config.wahaSession,
          chatId: `${cleanPhone}@c.us`,
          text: notifMsg,
        }),
      }).catch((wahaErr) => {
        console.error('[Chariow Webhook] Erreur notification WhatsApp:', wahaErr);
      });
    }

    return res.status(200).json({
      received: true,
      applied: true,
      user_id: targetUserId,
      expires_at: newExpiresAt,
      credits_added: CREDITS_TO_ADD,
    });
  } catch (err: any) {
    console.error('[Chariow Webhook] Exception:', err);
    return res.status(500).json({ error: 'Erreur interne lors du traitement Chariow' });
  }
}
