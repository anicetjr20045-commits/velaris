import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { resolveChariowProduct } from './_chariow-catalog.js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let webhookSecret = process.env.CHARIOW_WEBHOOK_SECRET || '';
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
            if (k === 'CHARIOW_WEBHOOK_SECRET' && !webhookSecret) webhookSecret = v;
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

  // 1. Vérification de sécurité (Signature HMAC ou Jeton d'URL/En-tête)
  const queryToken = String(req.query?.token || '');
  const headerToken = String(req.headers['x-chariow-token'] || req.headers['x-webhook-token'] || '');
  const providedToken = queryToken || headerToken;
  const rawSig = String(
    req.headers['x-chariow-signature'] ||
    req.headers['x-webhook-signature'] ||
    req.headers['x-signature'] ||
    ''
  ).trim();

  let isAuthenticated = false;

  // A. Vérification de la signature HMAC Chariow (sha256)
  if (rawSig && config.webhookSecret) {
    const cleanSig = rawSig.toLowerCase().startsWith('sha256=') ? rawSig.slice(7) : rawSig;
    try {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const computed = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
      if (cleanSig.length === computed.length && crypto.timingSafeEqual(Buffer.from(cleanSig.toLowerCase()), Buffer.from(computed.toLowerCase()))) {
        isAuthenticated = true;
      }
    } catch (e) {
      console.warn('[Chariow Webhook] Erreur vérification HMAC:', e);
    }
  }

  // B. Vérification du jeton d'URL ou d'en-tête (fallback).
  // Le secret n'est plus écrit en dur : il a fuité publiquement une première fois.
  if (!isAuthenticated && providedToken) {
    if (safeEqual(providedToken, config.webhookSecret)) {
      isAuthenticated = true;
    }
  }

  if (config.webhookSecret && !isAuthenticated) {
    console.warn('[Chariow Webhook] Authentification refusée.');
    return res.status(401).json({ error: 'Signature ou jeton invalide' });
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

  // 1-bis. Contre-vérification serveur : la vente doit exister chez Chariow.
  // Indispensable : le secret de signature est public (repo open source), donc un
  // webhook peut être forgé de toutes pièces. On refuse tout sale_id inconnu.
  const chariowApiKey = process.env.CHARIOW_API_KEY || '';
  if (chariowApiKey && saleId && !saleId.startsWith('SALE-')) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const verifyRes = await fetch(`https://api.chariow.com/v1/sales/${encodeURIComponent(saleId)}`, {
        headers: {
          Authorization: `Bearer ${chariowApiKey}`,
          Accept: 'application/json',
          'User-Agent': 'velaris-webhook/1.0',
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (verifyRes.status === 404) {
        console.warn(`[Chariow Webhook] Vente ${saleId} inconnue côté Chariow, rejetée.`);
        return res.status(401).json({ error: 'Vente inconnue chez Chariow' });
      }
      if (verifyRes.ok) {
        const remote = (await verifyRes.json().catch(() => null)) as { data?: { status?: string } } | null;
        const remoteStatus = String(remote?.data?.status || '').toLowerCase();
        if (remoteStatus && !['completed', 'paid', 'success', 'active'].includes(remoteStatus)) {
          console.warn(`[Chariow Webhook] Vente ${saleId} au statut distant "${remoteStatus}", ignorée.`);
          return res.status(200).json({ received: true, applied: false, reason: `Statut Chariow: ${remoteStatus}` });
        }
        console.log(`[Chariow Webhook] Vente ${saleId} confirmée par l'API Chariow (${remoteStatus || 'ok'}).`);
      }
    } catch (e) {
      console.warn('[Chariow Webhook] Contre-vérification indisponible, on poursuit:', (e as Error).message);
    }
  }

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
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData?.users?.find((u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase());
        if (found) {
          targetUserId = found.id;
        }
      } catch {}
    }

    if (!targetUserId) {
      console.warn(`[Chariow Webhook] Utilisateur introuvable pour email=${customerEmail}. Paiement enregistré en attente.`);
      return res.status(200).json({ received: true, applied: false, reason: 'Utilisateur non rattaché' });
    }

    // 2. Vérification idempotence (anti-doublon)
    const transactionRef = `CHARIOW-${saleId}`;
    try {
      const { data: existingTx } = await admin
        .from('credit_transactions')
        .select('id')
        .eq('transaction_ref', transactionRef)
        .maybeSingle();

      if (existingTx) {
        console.log(`[Chariow Webhook] Transaction ${transactionRef} déjà appliquée.`);
        return res.status(200).json({ received: true, applied: false, reason: 'Déjà traité' });
      }
    } catch {}

    // 3. Résolution du produit Chariow (Pass Créateur vs Pack Crédits)
    const catalogItem = resolveChariowProduct(
      sale.product_id || sale.product?.id || data.product?.id || metadata.product_id,
      sale.amount?.value || sale.amount || metadata.amount_cfa,
    );

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
        currentCredits = Math.round((Number(currentMeta.credits) || 0) * 100) / 100;
      }
    } catch {}

    if (currentMeta.last_payment_ref === transactionRef) {
      return res.status(200).json({ received: true, applied: false, reason: 'Déjà traité' });
    }

    const baseTime = currentExpires > Date.now() ? currentExpires : Date.now();
    const newExpiresAt =
      catalogItem.kind === 'subscription'
        ? new Date(baseTime + catalogItem.durationDays * 24 * 3600 * 1000).toISOString()
        : currentMeta.subscription_expires_at;
    const CREDITS_TO_ADD = catalogItem.credits;
    const newCredits = Math.round((currentCredits + CREDITS_TO_ADD) * 100) / 100;

    // 4. Mise à jour atomique du profil via user_metadata (garanti)
    await admin.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...currentMeta,
        ...(catalogItem.kind === 'subscription'
          ? {
              subscription_status: 'ACTIVE',
              subscription_plan: 'monthly',
              subscription_expires_at: newExpiresAt,
              subscription_started_at: currentMeta.subscription_started_at || new Date().toISOString(),
            }
          : {}),
        credits: newCredits,
        last_payment_ref: transactionRef,
        updated_at: new Date().toISOString(),
      },
    });

    // 5. Enregistrement dans le grand livre des transactions si la table existe
    try {
      await admin.from('credit_transactions').insert({
        user_id: targetUserId,
        amount_cfa: catalogItem.priceCfa,
        credits_added: CREDITS_TO_ADD,
        balance_after: newCredits,
        transaction_ref: transactionRef,
        payment_provider: 'CHARIOW',
        status: 'SUCCESS',
        kind: catalogItem.kind === 'subscription' ? 'subscription' : 'purchase',
        reason: catalogItem.label,
        metadata: {
          chariow_sale_id: saleId,
          chariow_product_id: catalogItem.productId,
          customer_email: customerEmail,
          customer_phone: rawCustomerPhone,
        },
      });
    } catch {}

    console.log(`[Chariow Webhook] ✅ Succès : User ${targetUserId} (${catalogItem.productId}) +${CREDITS_TO_ADD} crédits (solde ${newCredits}).`);

    // 6. Notification WhatsApp de félicitations (si numéro disponible)
    const phoneDigits = rawCustomerPhone.replace(/\D/g, '');
    if (phoneDigits.length >= 8) {
      const cleanPhone = phoneDigits.startsWith('226') || phoneDigits.startsWith('225') || phoneDigits.startsWith('221')
        ? phoneDigits
        : `226${phoneDigits}`;

      const studioName = currentMeta?.studio_name || currentMeta?.full_name || 'Créateur';
      const notifMsg =
        catalogItem.kind === 'subscription'
          ? `Djelia Academy : Félicitations ${studioName} !\nVotre Pass Créateur (4 900 F CFA) est maintenant actif.\n30 crédits de production musicale ont été ajoutés à votre studio. Bonnes créations !`
          : `Djelia Studio : Merci ${studioName} !\nVotre ${catalogItem.label} est validé.\n+${CREDITS_TO_ADD} crédits ont été ajoutés (nouveau solde : ${newCredits} crédits).`;

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
