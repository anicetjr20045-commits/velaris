import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
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
            if (k === 'WAHA_API_KEY' && !wahaApiKey) wahaApiKey = v;
          }
        }
      }
    } catch {}
  }

  return { supabaseUrl, supabaseSecretKey, wahaBaseUrl, wahaApiKey, wahaSession };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const config = getEnvConfig();
  if (!config.supabaseSecretKey) {
    return res.status(500).json({ error: 'Configuration Supabase incomplète' });
  }

  const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

  const notificationsSent: any[] = [];
  const expiredProfilesUpdated: string[] = [];

  try {
    // 1. Récupérer les utilisateurs via Supabase Auth Admin
    const { data: usersData, error: uErr } = await admin.auth.admin.listUsers();
    if (uErr) throw uErr;

    const allUsers = usersData?.users || [];

    for (const u of allUsers) {
      const meta = u.user_metadata || {};
      const subStatus = meta.subscription_status;
      const expIso = meta.subscription_expires_at;

      if (subStatus !== 'ACTIVE' || !expIso) continue;

      const expDate = new Date(expIso);
      const rawPhone = String(meta.phone || u.phone || meta.phone_number || '');
      const digits = rawPhone.replace(/\D/g, '');
      const cleanPhone = digits.length >= 8
        ? digits.startsWith('226') || digits.startsWith('225') || digits.startsWith('221') || digits.startsWith('237')
          ? digits
          : `226${digits}`
        : null;

      const studioName = meta.studio_name || meta.full_name || 'Créateur';
      const formattedDate = expDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

      // CAS A : Expiré aujourd'hui ou dans le passé
      if (expDate.getTime() <= now.getTime()) {
        const updatedMeta = {
          ...meta,
          subscription_status: 'EXPIRED',
          expired_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        await admin.auth.admin.updateUserById(u.id, { user_metadata: updatedMeta }).catch(() => {});

        try {
          await admin
            .from('profiles')
            .update({
              subscription_status: 'EXPIRED',
              updated_at: now.toISOString(),
            })
            .eq('id', u.id);
        } catch {}

        expiredProfilesUpdated.push(u.id);

        if (cleanPhone) {
          const msg = `Djelia Academy : Bonjour ${studioName}.\nVotre Pass Créateur a expiré le ${formattedDate}.\nL'accès à votre studio, à vos outils et à votre ligne WhatsApp a été suspendu.\nPour réactiver immédiatement vos accès et obtenir 30 nouveaux crédits : https://velaris-dun.vercel.app`;

          await fetch(`${config.wahaBaseUrl}/api/sendText`, {
            method: 'POST',
            headers: {
              'X-Api-Key': config.wahaApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session: config.wahaSession,
              chatId: `${cleanPhone}@c.us`,
              text: msg,
            }),
          }).catch(() => {});

          notificationsSent.push({ userId: u.id, type: 'expired', phone: cleanPhone });
        }
      }
      // CAS B : Expire dans moins de 3 jours (rappel préventif)
      else if (expDate.getTime() <= threeDaysFromNow.getTime()) {
        const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        const lastWarning = meta.last_warning_sent_at;
        const alreadySentToday = lastWarning && new Date(lastWarning).toDateString() === now.toDateString();

        if (cleanPhone && !alreadySentToday) {
          const msg = `Djelia Academy : Bonjour ${studioName} !\nVotre Pass Créateur expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (le ${formattedDate}).\nPensez à renouveler dès maintenant pour éviter l'interruption de votre ligne WhatsApp et conserver vos crédits : https://velaris-dun.vercel.app`;

          await fetch(`${config.wahaBaseUrl}/api/sendText`, {
            method: 'POST',
            headers: {
              'X-Api-Key': config.wahaApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session: config.wahaSession,
              chatId: `${cleanPhone}@c.us`,
              text: msg,
            }),
          }).catch(() => {});

          await admin.auth.admin.updateUserById(u.id, {
            user_metadata: {
              ...meta,
              last_warning_sent_at: now.toISOString(),
            },
          }).catch(() => {});

          notificationsSent.push({ userId: u.id, type: 'warning', daysLeft, phone: cleanPhone });
        }
      }
    }

    return res.status(200).json({
      success: true,
      checkedCount: allUsers.length,
      expiredCount: expiredProfilesUpdated.length,
      notificationsSentCount: notificationsSent.length,
      details: { expiredProfilesUpdated, notificationsSent },
    });
  } catch (err: any) {
    console.error('[Check Expirations] Erreur:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
