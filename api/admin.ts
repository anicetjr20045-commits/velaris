import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let wahaChromeUrl = (process.env.WAHA_BASE_URL || 'https://waha.velarisagent.life').replace(/\/+$/, '');
  let wahaChromeKey = process.env.WAHA_API_KEY || 'b4cffb1ef75fb400a79e30faa3a97802';
  let wahaGowsUrl = (process.env.WAHA_GOWS_URL || 'https://waha2.162.35.113.220.sslip.io').replace(/\/+$/, '');
  let wahaGowsKey = process.env.WAHA_GOWS_API_KEY || '468e5262820b3e72f3efe2044443e4e04638eab1b4cc2466';

  if (!supabaseSecretKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m) {
            const k = m[1].trim();
            const v = m[2].trim();
            if (k === 'SUPABASE_SECRET_KEY' && !supabaseSecretKey) supabaseSecretKey = v;
            if (k === 'SUPABASE_URL' && v) supabaseUrl = v;
          }
        }
      }
    } catch {}
  }

  return { supabaseUrl, supabaseSecretKey, wahaChromeUrl, wahaChromeKey, wahaGowsUrl, wahaGowsKey };
}

const OWNER_PHONES = new Set(['22605777308', '22656240533', '22658357772']);
const OWNER_EMAILS = new Set([
  'wa_22605777308@djelia.store',
  'wa_22656240533@djelia.store',
  'wa_22658357772@djelia.store',
]);

function isOwnerAdmin(user: any): boolean {
  if (!user) return false;
  if (user.user_metadata?.is_admin === true || user.user_metadata?.role === 'admin') return true;
  const email = String(user.email || '').trim().toLowerCase();
  const phoneDigits = String(user.user_metadata?.phone || user.phone || '').replace(/\D/g, '');
  if (OWNER_EMAILS.has(email) || OWNER_PHONES.has(phoneDigits)) {
    return true;
  }
  const extraAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && extraAdmins.includes(email));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = String(req.headers['authorization'] || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });

  const cfg = getEnvConfig();
  if (!cfg.supabaseSecretKey) {
    return res.status(500).json({ error: 'SUPABASE_SECRET_KEY manquante côté serveur.' });
  }

  const admin = createClient(cfg.supabaseUrl, cfg.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
  if (!isOwnerAdmin(userData.user)) {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur.' });
  }

  // POST : Actions d'administration
  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '');

    if (action === 'adjust-credits') {
      const targetUserId = String(body.targetUserId || '').trim();
      const delta = Number(body.delta);
      const reason = String(body.reason || 'Ajustement administrateur').slice(0, 120);
      if (!targetUserId || !Number.isFinite(delta) || delta === 0) {
        return res.status(400).json({ error: 'Paramètres invalides.' });
      }
      const { data: targetRes, error: targetErr } = await admin.auth.admin.getUserById(targetUserId);
      if (targetErr || !targetRes?.user) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }
      const meta = (targetRes.user.user_metadata || {}) as Record<string, any>;
      const prev = Number(meta.credits ?? 0);
      const next = Math.max(0, Math.round((prev + delta) * 100) / 100);
      await admin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...meta,
          credits: next,
          updated_at: new Date().toISOString(),
        },
      });
      try {
        await admin.from('credit_transactions').insert({
          user_id: targetUserId,
          amount_cfa: 0,
          credits_added: delta,
          balance_after: next,
          payment_provider: 'ADMIN',
          status: 'SUCCESS',
          kind: delta > 0 ? 'bonus' : 'debit',
          reason,
        });
      } catch {}
      return res.status(200).json({ ok: true, credits: next });
    }

    if (action === 'extend-subscription') {
      const targetUserId = String(body.targetUserId || '').trim();
      const days = Math.max(1, Math.min(365, Math.round(Number(body.days) || 30)));
      const { data: targetRes, error: targetErr } = await admin.auth.admin.getUserById(targetUserId);
      if (targetErr || !targetRes?.user) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }
      const meta = (targetRes.user.user_metadata || {}) as Record<string, any>;
      const currentExp = meta.subscription_expires_at ? new Date(meta.subscription_expires_at).getTime() : 0;
      const base = currentExp > Date.now() ? currentExp : Date.now();
      const newExpiresAt = new Date(base + days * 24 * 3600 * 1000).toISOString();
      await admin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...meta,
          subscription_status: 'ACTIVE',
          subscription_plan: 'monthly',
          subscription_expires_at: newExpiresAt,
          subscription_started_at: meta.subscription_started_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      return res.status(200).json({ ok: true, expires_at: newExpiresAt });
    }

    if (action === 'mark-payout-paid') {
      const payoutId = String(body.payoutId || '').trim();
      const status = body.status === 'rejected' ? 'rejected' : 'paid';
      if (!payoutId) return res.status(400).json({ error: 'ID retrait manquant.' });
      const { error } = await admin.from('affiliate_payouts').update({ status }).eq('id', payoutId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, status });
    }

    return res.status(400).json({ error: 'Action non reconnue.' });
  }

  // GET : Tableau de bord Admin complet
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const [usersRes, txRes, payoutsRes, gowsSessRes, chromeSessRes] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      admin
        .from('credit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('affiliate_payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      fetch(`${cfg.wahaGowsUrl}/api/sessions?all=true`, {
        headers: { 'X-Api-Key': cfg.wahaGowsKey },
        signal: AbortSignal.timeout(4000),
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${cfg.wahaChromeUrl}/api/sessions?all=true`, {
        headers: { 'X-Api-Key': cfg.wahaChromeKey },
        signal: AbortSignal.timeout(4000),
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]);

    const users = usersRes.data?.users || [];
    const transactions = (txRes.data || []) as any[];
    const payouts = (payoutsRes.data || []) as any[];

    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;

    // Agrégation par utilisateur depuis credit_transactions
    const userSpendMap = new Map<string, { spentCfa: number; creditsBought: number; creditsUsed: number; actionsCount: number }>();
    let revenueTotalCfa = 0;
    let revenue30dCfa = 0;
    let revenue7dCfa = 0;
    let revenueTodayCfa = 0;
    let revenueSubsCfa = 0;
    let revenuePacksCfa = 0;
    let creditsSold = 0;
    let creditsConsumed = 0;
    let songsGenerated = 0;
    let videosGenerated = 0;
    let voicesGenerated = 0;
    let analysesRun = 0;

    // 14 derniers jours
    const dailyMap = new Map<string, { date: string; label: string; revenueCfa: number; txCount: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * dayMs);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      dailyMap.set(iso, { date: iso, label, revenueCfa: 0, txCount: 0 });
    }

    for (const tx of transactions) {
      const uid = String(tx.user_id || '');
      const amtCfa = Number(tx.amount_cfa || 0);
      const crAdded = Number(tx.credits_added || 0);
      const kind = String(tx.kind || '');
      const createdAtMs = tx.created_at ? new Date(tx.created_at).getTime() : 0;
      const isoDay = tx.created_at ? String(tx.created_at).slice(0, 10) : '';

      const cur = userSpendMap.get(uid) || { spentCfa: 0, creditsBought: 0, creditsUsed: 0, actionsCount: 0 };

      if (amtCfa > 0 && tx.status === 'SUCCESS') {
        revenueTotalCfa += amtCfa;
        if (now - createdAtMs <= 30 * dayMs) revenue30dCfa += amtCfa;
        if (now - createdAtMs <= 7 * dayMs) revenue7dCfa += amtCfa;
        if (isoDay === new Date(now).toISOString().slice(0, 10)) revenueTodayCfa += amtCfa;
        if (kind === 'subscription') revenueSubsCfa += amtCfa;
        else revenuePacksCfa += amtCfa;

        cur.spentCfa += amtCfa;
        if (crAdded > 0) {
          creditsSold += crAdded;
          cur.creditsBought += crAdded;
        }
        const dayEntry = dailyMap.get(isoDay);
        if (dayEntry) {
          dayEntry.revenueCfa += amtCfa;
          dayEntry.txCount += 1;
        }
      } else if (crAdded < 0) {
        const used = Math.abs(crAdded);
        creditsConsumed += used;
        cur.creditsUsed += used;
        cur.actionsCount += 1;
        if (kind === 'song_generation') songsGenerated += 1;
        else if (kind === 'music_video') videosGenerated += 1;
        else if (kind === 'voice_tts') voicesGenerated += 1;
        else if (kind === 'ai_analysis') analysesRun += 1;
      }

      if (uid) userSpendMap.set(uid, cur);
    }

    let subsActive = 0;
    let subsExpiringSoon = 0;
    let subsExpired = 0;
    let creditsOutstanding = 0;
    let newUsers7d = 0;

    const members = users.map((u) => {
      const meta = (u.user_metadata || {}) as Record<string, any>;
      const expMs = meta.subscription_expires_at ? new Date(meta.subscription_expires_at).getTime() : 0;
      const hasActiveDate = Boolean(meta.subscription_expires_at) && expMs > now;
      const isSubActive = meta.subscription_expires_at
        ? hasActiveDate
        : meta.subscription_status === 'ACTIVE' || meta.plan === 'pro';
      const daysLeft = hasActiveDate ? Math.ceil((expMs - now) / dayMs) : 0;

      if (isSubActive) {
        subsActive += 1;
        if (hasActiveDate && daysLeft <= 5) subsExpiringSoon += 1;
      } else if (meta.subscription_expires_at || meta.subscription_status === 'EXPIRED') {
        subsExpired += 1;
      }

      const cr = Number(meta.credits ?? 0);
      creditsOutstanding += cr;
      if (u.created_at && now - new Date(u.created_at).getTime() <= 7 * dayMs) {
        newUsers7d += 1;
      }

      const stats = userSpendMap.get(u.id) || { spentCfa: 0, creditsBought: 0, creditsUsed: 0, actionsCount: 0 };

      return {
        id: u.id,
        studioName: String(meta.studio_name || meta.full_name || u.email?.split('@')[0] || 'Créateur'),
        email: u.email || '',
        phone: String(meta.phone || ''),
        slug: String(meta.studio_slug || ''),
        credits: Math.round(cr * 100) / 100,
        subStatus: isSubActive ? 'active' : meta.subscription_expires_at ? 'expired' : 'free',
        expiresAt: meta.subscription_expires_at || null,
        daysLeft,
        spentCfa: stats.spentCfa,
        creditsBought: Math.round(stats.creditsBought * 100) / 100,
        creditsUsed: Math.round(stats.creditsUsed * 100) / 100,
        actionsCount: stats.actionsCount,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
      };
    });

    const topUsers = [...members]
      .sort((a, b) => b.spentCfa - a.spentCfa || b.creditsUsed - a.creditsUsed || b.credits - a.credits)
      .slice(0, 10);

    const gowsSessions = Array.isArray(gowsSessRes) ? gowsSessRes : [];
    const chromeSessions = Array.isArray(chromeSessRes) ? chromeSessRes : [];
    const wahaSessions = [
      ...gowsSessions.map((s: any) => ({ name: s.name, status: s.status, engine: 'GOWS' })),
      ...chromeSessions.map((s: any) => ({ name: s.name, status: s.status, engine: 'WEBJS' })),
    ];

    const pendingPayouts = payouts.filter((p) => p.status === 'pending');

    return res.status(200).json({
      ok: true,
      kpis: {
        revenueTotalCfa,
        revenue30dCfa,
        revenue7dCfa,
        revenueTodayCfa,
        revenueSubsCfa,
        revenuePacksCfa,
        usersTotal: users.length,
        newUsers7d,
        subsActive,
        subsExpiringSoon,
        subsExpired,
        creditsSold: Math.round(creditsSold * 100) / 100,
        creditsConsumed: Math.round(creditsConsumed * 100) / 100,
        creditsOutstanding: Math.round(creditsOutstanding * 100) / 100,
        songsGenerated,
        videosGenerated,
        voicesGenerated,
        analysesRun,
        wahaWorkingCount: wahaSessions.filter((s) => s.status === 'WORKING').length,
        pendingPayoutsCount: pendingPayouts.length,
        pendingPayoutsCfa: pendingPayouts.reduce((s, p) => s + Number(p.amount || 0), 0),
      },
      dailyRevenue: Array.from(dailyMap.values()),
      topUsers,
      members,
      recentTransactions: transactions.slice(0, 30),
      payouts: payouts.slice(0, 30),
      wahaSessions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erreur serveur admin.' });
  }
}
