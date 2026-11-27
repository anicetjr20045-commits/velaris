import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';

const PROTECTED_SESSIONS = new Set(['anicet2']);
const ALLOWED_SEND_ACTIONS = new Set(['sendText', 'sendVoice', 'sendFile', 'sendVideo', 'sendSeen']);

function readLocalEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) out[m[1].trim()] = m[2].trim();
      }
    }
  } catch {
    // Ignorer si absent en production
  }
  return out;
}

function getConfig() {
  const local = readLocalEnv();
  const env = (k: string, fallback = '') => (process.env[k] || local[k] || fallback).trim();

  return {
    supabaseUrl: env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || 'https://zoamdwupbhegcmancaeu.supabase.co',
    supabaseSecretKey: env('SUPABASE_SECRET_KEY'),
    wahaChromeUrl: (env('WAHA_BASE_URL') || 'https://waha.velarisagent.life').replace(/\/+$/, ''),
    wahaChromeKey: env('WAHA_API_KEY') || 'b4cffb1ef75fb400a79e30faa3a97802',
    wahaGowsUrl: (env('WAHA_GOWS_URL') || 'https://waha2.162.35.113.220.sslip.io').replace(/\/+$/, ''),
    wahaGowsKey: env('WAHA_GOWS_API_KEY') || '468e5262820b3e72f3efe2044443e4e04638eab1b4cc2466',
    webhookUrl: env('WAHA_WEBHOOK_URL') || 'https://waha.velarisagent.life/webhooks/waha',
    webhookHmacKey:
      env('WAHA_WEBHOOK_HMAC_KEY_ENGINE') ||
      '5a883800d77cd375559c3bdb8f99d71000b3c177a0affa9907b1cfe0535e824f',
  };
}

function targetForSession(sessionName: string, cfg: ReturnType<typeof getConfig>) {
  // Toutes les sessions membres (`studio_*`) tournent sur GOWS (léger, zéro Chrome)
  if (sessionName.startsWith('studio_')) {
    return { baseUrl: cfg.wahaGowsUrl, apiKey: cfg.wahaGowsKey, engine: 'gows' as const };
  }
  return { baseUrl: cfg.wahaChromeUrl, apiKey: cfg.wahaChromeKey, engine: 'chrome' as const };
}

function buildSessionConfig(sessionName: string, cfg: ReturnType<typeof getConfig>) {
  const base: Record<string, unknown> = {
    ignore: {
      status: true,
      groups: sessionName.startsWith('studio_'),
      channels: true,
    },
    webhooks: [
      {
        url: cfg.webhookUrl,
        events: sessionName.startsWith('studio_')
          ? ['message', 'message.any', 'message.reaction', 'session.status']
          : ['message', 'message.any', 'message.reaction', 'message.ack', 'chat.archive', 'session.status'],
        hmac: { key: cfg.webhookHmacKey },
      },
    ],
  };
  if (!sessionName.startsWith('studio_')) {
    base.noweb = { markOnline: false, store: { enabled: true, fullSync: false } };
  }
  return base;
}

async function wahaCall(
  target: { baseUrl: string; apiKey: string },
  wahaPath: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {},
  timeoutMs = 15000
): Promise<Response> {
  const headers: Record<string, string> = {
    'X-Api-Key': target.apiKey,
    Accept: 'application/json',
  };
  const method = init.method || 'GET';
  let bodyStr: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(init.body);
  }
  return fetch(`${target.baseUrl}${wahaPath}`, {
    method,
    headers,
    body: bodyStr,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function syncWaSessionRow(
  admin: any,
  userId: string,
  sessionName: string,
  wahaData: any
) {
  if (!admin || !wahaData?.status) return;
  try {
    const rawMe = wahaData?.me?.id ? String(wahaData.me.id) : null;
    const phone = rawMe ? rawMe.split('@')[0].split(':')[0].replace(/\D/g, '') : null;
    const mappedStatus =
      wahaData.status === 'WORKING'
        ? 'connected'
        : wahaData.status === 'SCAN_QR_CODE'
        ? 'scanning'
        : 'disconnected';

    await admin.from('wa_sessions').upsert(
      {
        user_id: userId,
        session_name: sessionName,
        status: mappedStatus,
        phone_number: phone,
        engine_owner: 'velaris_engine',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'session_name' }
    );
  } catch {
    // Non bloquant
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const cfg = getConfig();
  if (!cfg.supabaseSecretKey) {
    return res.status(503).json({ error: 'Configuration serveur Supabase incomplète.' });
  }

  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const admin = createClient(cfg.supabaseUrl, cfg.supabaseSecretKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user) {
    return res.status(401).json({ error: 'Session expirée ou invalide.' });
  }

  const user = userData.user;
  const ownSession = `studio_${user.id.slice(0, 8)}`;

  const body = req.body || {};
  const action = String(body.action || '').trim();
  const requestedSession = String(body.session || ownSession).trim();

  if (!requestedSession || !/^[\w-]+$/.test(requestedSession)) {
    return res.status(400).json({ error: 'Nom de session invalide.' });
  }

  if (PROTECTED_SESSIONS.has(requestedSession)) {
    return res.status(403).json({ error: `Session ${requestedSession} protégée.` });
  }

  // Isolation stricte : un membre ne contrôle que sa propre session studio_<8chars>
  if (requestedSession !== ownSession) {
    const { data: prof } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!prof?.is_admin) {
      return res.status(403).json({ error: 'Accès refusé à cette session WhatsApp.' });
    }
  }

  const target = targetForSession(requestedSession, cfg);

  try {
    // 1. STATUS (avec auto-provisionnement si session studio_* absente)
    if (action === 'status' || action === 'ensure') {
      let sRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}`);

      if ((sRes.status === 404 || action === 'ensure') && sRes.status === 404 && requestedSession.startsWith('studio_')) {
        const createRes = await wahaCall(target, '/api/sessions', {
          method: 'POST',
          body: {
            name: requestedSession,
            start: true,
            config: buildSessionConfig(requestedSession, cfg),
          },
        });
        if (createRes.ok) {
          const created = await createRes.json().catch(() => ({}));
          await syncWaSessionRow(admin, user.id, requestedSession, created);
          return res.status(200).json({ ok: true, session: created });
        }
      }

      if (!sRes.ok) {
        return res.status(sRes.status === 404 ? 404 : 502).json({
          ok: false,
          error: `Session indisponible (${sRes.status})`,
        });
      }

      let data: any = await sRes.json().catch(() => ({}));

      // Si la session est arrêtée / échouée lors d'un ensure explicite, la relancer proprement
      if (action === 'ensure' && (data.status === 'STOPPED' || data.status === 'FAILED')) {
        await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}`, {
          method: 'PUT',
          body: { config: buildSessionConfig(requestedSession, cfg) },
        }).catch(() => undefined);
        const startRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/start`, {
          method: 'POST',
        });
        if (startRes.ok) {
          data = await startRes.json().catch(() => data);
        }
      }

      await syncWaSessionRow(admin, user.id, requestedSession, data);
      return res.status(200).json({ ok: true, session: data });
    }

    // 2. RESTART / RÉGÉNÉRER LE QR CODE
    if (action === 'restart') {
      const checkRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}`);
      if (checkRes.status === 404) {
        const createRes = await wahaCall(target, '/api/sessions', {
          method: 'POST',
          body: {
            name: requestedSession,
            start: true,
            config: buildSessionConfig(requestedSession, cfg),
          },
        });
        const created = await createRes.json().catch(() => ({}));
        await syncWaSessionRow(admin, user.id, requestedSession, created);
        return res.status(createRes.ok ? 200 : 502).json({ ok: createRes.ok, session: created });
      }

      // Aligner le webhook avant redémarrage pour garantir la réception des réactions
      await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}`, {
        method: 'PUT',
        body: { config: buildSessionConfig(requestedSession, cfg) },
      }).catch(() => undefined);

      let restartRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/restart`, {
        method: 'POST',
      }, 20000);

      if (!restartRes.ok) {
        await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/stop`, { method: 'POST' }).catch(() => undefined);
        restartRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/start`, { method: 'POST' }, 20000);
      }

      const data = await restartRes.json().catch(() => ({}));
      await syncWaSessionRow(admin, user.id, requestedSession, data);
      return res.status(restartRes.ok ? 200 : 502).json({ ok: restartRes.ok, session: data });
    }

    // 3. STOP / LOGOUT (déconnecter ou changer de numéro)
    if (action === 'stop' || action === 'logout') {
      if (action === 'logout') {
        await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/logout`, { method: 'POST' }).catch(() => undefined);
      }
      const stopRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/stop`, { method: 'POST' });
      await syncWaSessionRow(admin, user.id, requestedSession, { status: 'STOPPED', me: null });
      return res.status(stopRes.ok ? 200 : 200).json({ ok: true });
    }

    // 4. QR IMAGE PNG
    if (action === 'qr') {
      let qrRes = await fetch(`${target.baseUrl}/api/${encodeURIComponent(requestedSession)}/auth/qr?format=image`, {
        method: 'GET',
        headers: { 'X-Api-Key': target.apiKey },
        signal: AbortSignal.timeout(12000),
      });

      // Si le QR renvoie 404 (session inexistante) ou 422 (session STOPPED sur GOWS)
      if (!qrRes.ok && (qrRes.status === 404 || qrRes.status === 422)) {
        const checkRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}`);
        if (checkRes.status === 404) {
          await wahaCall(target, '/api/sessions', {
            method: 'POST',
            body: {
              name: requestedSession,
              start: true,
              config: buildSessionConfig(requestedSession, cfg),
            },
          });
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/start`, {
            method: 'POST',
          }).catch(() => undefined);
          await new Promise((r) => setTimeout(r, 1500));
        }

        // Nouvelle tentative immédiate
        qrRes = await fetch(`${target.baseUrl}/api/${encodeURIComponent(requestedSession)}/auth/qr?format=image`, {
          method: 'GET',
          headers: { 'X-Api-Key': target.apiKey },
          signal: AbortSignal.timeout(12000),
        });
      }

      if (!qrRes.ok) {
        const errData: any = await qrRes.json().catch(() => ({}));
        return res.status(qrRes.status).json({
          ok: false,
          error: errData?.message || `QR non disponible (${qrRes.status})`,
        });
      }

      const contentType = qrRes.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await qrRes.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return res.status(200).send(buf);
    }

    // 5. CODE D'APPAIRAGE 8 CHIFFRES (sans caméra)
    if (action === 'pairing-code') {
      const cleanPhone = String(body.phoneNumber || '').replace(/\D/g, '');
      if (cleanPhone.length < 8) {
        return res.status(400).json({ ok: false, error: 'Numéro WhatsApp complet avec indicatif requis (ex: 22507...)' });
      }

      // S'assurer que la session est en SCAN_QR_CODE avant de demander le code
      const checkRes = await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}`);
      if (checkRes.status === 404) {
        await wahaCall(target, '/api/sessions', {
          method: 'POST',
          body: {
            name: requestedSession,
            start: true,
            config: buildSessionConfig(requestedSession, cfg),
          },
        });
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        const sData: any = await checkRes.json().catch(() => ({}));
        if (sData?.status === 'STOPPED' || sData?.status === 'FAILED') {
          await wahaCall(target, `/api/sessions/${encodeURIComponent(requestedSession)}/start`, {
            method: 'POST',
          }).catch(() => undefined);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      const codeRes = await wahaCall(
        target,
        `/api/${encodeURIComponent(requestedSession)}/auth/request-code`,
        {
          method: 'POST',
          body: { phoneNumber: cleanPhone },
        },
        15000
      );

      const data: any = await codeRes.json().catch(() => ({}));
      if (!codeRes.ok) {
        return res.status(codeRes.status).json({
          ok: false,
          error: data?.message || data?.error || 'Impossible de générer le code pour ce numéro. Vérifiez l’indicatif ou utilisez le QR Code.',
        });
      }

      return res.status(200).json({ ok: true, code: data?.code || null });
    }

    // 6. ENVOIS (sendText, sendVoice, sendFile, sendVideo, sendSeen)
    if (ALLOWED_SEND_ACTIONS.has(action)) {
      const payload = { ...(body.payload || {}), session: requestedSession };
      const sendRes = await wahaCall(target, `/api/${action}`, { method: 'POST', body: payload }, 30000);
      const data: any = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) {
        return res.status(sendRes.status).json({
          ok: false,
          error: data?.message || data?.error || `Erreur WAHA (${sendRes.status})`,
        });
      }
      return res.status(200).json({ ok: true, data });
    }

    return res.status(400).json({ error: `Action non supportée : ${action}` });
  } catch (err: any) {
    return res.status(502).json({
      ok: false,
      error: err?.name === 'AbortError' ? 'Passerelle WhatsApp saturée (délai dépassé).' : (err?.message || 'Erreur passerelle WhatsApp.'),
    });
  }
}
