import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let wahaBaseUrl = (process.env.WAHA_BASE_URL || process.env.VITE_WAHA_BASE_URL || 'https://waha.velarisagent.life').replace(/\/+$/, '');
  let wahaApiKey = process.env.WAHA_API_KEY || process.env.VITE_WAHA_API_KEY || '';
  let wahaSession = process.env.WAHA_SESSION || 'Test';
  let hmacSecret = process.env.AUTH_HMAC_SECRET || process.env.WAHA_WEBHOOK_HMAC_KEY || 'auth-djelia-secret-salt-2026';

  if (!supabaseSecretKey || !wahaApiKey) {
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
            if (k === 'WAHA_WEBHOOK_HMAC_KEY' && hmacSecret === 'auth-djelia-secret-salt-2026') hmacSecret = v;
          }
        }
      }
    } catch {}
  }

  return { supabaseUrl, supabaseSecretKey, wahaBaseUrl, wahaApiKey, wahaSession, hmacSecret };
}

// Mémoire glissante pour le rate-limiting par téléphone et par IP
const phoneRateLimits = new Map<string, { lastSentAt: number; count: number; windowStart: number }>();
const ipRateLimits = new Map<string, { count: number; windowStart: number }>();
const usedChallenges = new Map<string, number>();
const failedCodeAttempts = new Map<string, { count: number; firstAt: number }>();

// Nettoyage périodique des entrées expirées (anti-fuite mémoire)
function purgeOldCaches() {
  const now = Date.now();
  for (const [hash, timestamp] of usedChallenges.entries()) {
    if (now - timestamp > 600_000) usedChallenges.delete(hash);
  }
  for (const [hash, entry] of failedCodeAttempts.entries()) {
    if (now - entry.firstAt > 600_000) failedCodeAttempts.delete(hash);
  }
  for (const [ip, entry] of ipRateLimits.entries()) {
    if (now - entry.windowStart > 600_000) ipRateLimits.delete(ip);
  }
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function checkRateLimit(phone: string, ip: string): { allowed: boolean; message?: string } {
  purgeOldCaches();
  const now = Date.now();

  // 1. Limite globale par IP (max 15 requêtes / 10 minutes pour neutraliser les bots automatisés)
  const ipEntry = ipRateLimits.get(ip);
  if (!ipEntry || now - ipEntry.windowStart > 600_000) {
    ipRateLimits.set(ip, { count: 1, windowStart: now });
  } else {
    if (ipEntry.count >= 15) {
      return { allowed: false, message: 'Trop de requêtes depuis cette connexion. Veuillez patienter 10 minutes.' };
    }
    ipEntry.count += 1;
  }

  // 2. Limite stricte par numéro de téléphone
  const phoneEntry = phoneRateLimits.get(phone);
  if (!phoneEntry) {
    phoneRateLimits.set(phone, { lastSentAt: now, count: 1, windowStart: now });
    return { allowed: true };
  }

  // Cooldown obligatoire de 60 secondes entre 2 envois vers un même numéro
  if (now - phoneEntry.lastSentAt < 60_000) {
    const waitSec = Math.ceil((60_000 - (now - phoneEntry.lastSentAt)) / 1000);
    return { allowed: false, message: `Veuillez patienter ${waitSec}s avant de redemander un nouveau code.` };
  }

  // Plafond horaire : 5 envois max par heure
  if (now - phoneEntry.windowStart > 3_600_000) {
    phoneRateLimits.set(phone, { lastSentAt: now, count: 1, windowStart: now });
    return { allowed: true };
  }

  if (phoneEntry.count >= 5) {
    return { allowed: false, message: 'Limite de sécurité atteinte (5 codes max par heure). Réessayez plus tard.' };
  }

  phoneEntry.count += 1;
  phoneEntry.lastSentAt = now;
  return { allowed: true };
}

function createChallenge(phone: string, code: string, hmacSecret: string): string {
  const codeHash = crypto.createHmac('sha256', hmacSecret).update(`${phone}:${code}`).digest('hex');
  const payload = {
    phone,
    codeHash,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    attemptsLeft: 3,
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', hmacSecret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifyChallenge(challengeToken: string, hmacSecret: string): { valid: boolean; payload?: any; error?: string } {
  if (!challengeToken || typeof challengeToken !== 'string') {
    return { valid: false, error: 'Jeton de vérification manquant.' };
  }
  const parts = challengeToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Format de jeton invalide.' };
  }
  const [b64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', hmacSecret).update(b64).digest('base64url');
  if (sig !== expectedSig) {
    return { valid: false, error: 'Signature de sécurité invalide.' };
  }

  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Le code a expiré (délai de 5 min dépassé). Veuillez en demander un nouveau.' };
    }
    if (payload.attemptsLeft <= 0) {
      return { valid: false, error: 'Nombre maximal de tentatives dépassé. Demandez un nouveau code.' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Jeton de sécurité corrompu.' };
  }
}

export default async function handler(req: any, res: any) {
  // En-têtes CORS stricts
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const clientIp = String(
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  ).split(',')[0].trim();

  const config = getEnvConfig();
  const body = req.body || {};
  const action = body.action;

  // 1. Action : ENVOYER LE CODE WHATSAPP
  if (action === 'send-code') {
    const rawPhone = String(body.phone || '');
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide. Incluez l\'indicatif pays (+225, +226...).' });
    }

    const rate = checkRateLimit(phone, clientIp);
    if (!rate.allowed) {
      return res.status(429).json({ error: rate.message });
    }

    // Code cryptographique aléatoire à 6 chiffres (1 chance sur 1 000 000)
    const code = String(crypto.randomInt(100000, 1000000));
    const challengeToken = createChallenge(phone, code, config.hmacSecret);

    // Envoi via WAHA (multi-passerelle résiliente : GOWS waha2 + fallback waha principal)
    const cleanDigits = phone.replace(/\D/g, '');
    const message = `Djelia Studio : votre code de connexion sécurisé est ${code}.\nCe code expire dans 5 minutes. Ne le partagez avec personne.`;

    const trySendGateway = async (
      baseUrl: string,
      apiKey: string,
      preferredSession: string
    ): Promise<{ ok: true } | { ok: false; status: number; errJson: any }> => {
      let targetSession = preferredSession;
      try {
        const sRes = await fetch(`${baseUrl}/api/sessions?all=true`, {
          headers: { 'X-Api-Key': apiKey },
          signal: AbortSignal.timeout(4000),
        });
        if (sRes.ok) {
          const sessions = (await sRes.json().catch(() => [])) as any[];
          const exact = sessions.find((s) => s.name === preferredSession && s.status === 'WORKING');
          const anyWorking = sessions.find((s) => s.status === 'WORKING');
          if (exact) targetSession = exact.name;
          else if (anyWorking) targetSession = anyWorking.name;
          else return { ok: false, status: 503, errJson: { message: 'Aucune session WORKING' } };
        }
      } catch {
        // continuer avec preferredSession
      }

      const wRes = await fetch(`${baseUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: targetSession,
          chatId: `${cleanDigits}@c.us`,
          text: message,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (wRes.ok) return { ok: true };
      const errJson = await wRes.json().catch(() => ({}));
      return { ok: false, status: wRes.status, errJson };
    };

    try {
      const gowsUrl = (process.env.WAHA_GOWS_URL || 'https://waha2.162.35.113.220.sslip.io').replace(/\/+$/, '');
      const gowsKey = process.env.WAHA_GOWS_API_KEY || '468e5262820b3e72f3efe2044443e4e04638eab1b4cc2466';

      // 1. Essai prioritaire sur la passerelle active GOWS (studio_5756a961)
      let result: { ok: true } | { ok: false; status: number; errJson: any } = await trySendGateway(
        gowsUrl,
        gowsKey,
        'studio_5756a961'
      ).catch(() => ({
        ok: false as const,
        status: 503,
        errJson: {},
      }));

      // 2. Repli sur la passerelle principale (Test)
      if (!result.ok) {
        result = await trySendGateway(config.wahaBaseUrl, config.wahaApiKey, config.wahaSession).catch(() => ({
          ok: false as const,
          status: 503,
          errJson: {},
        }));
      }

      if (!result.ok) {
        phoneRateLimits.delete(phone);
        console.error('Erreur WAHA sendText multi-passerelle:', result.errJson);
        const errMsg = String((result.errJson as any)?.exception?.message || (result.errJson as any)?.message || '');
        if (errMsg.includes('No LID') || errMsg.includes('not registered')) {
          return res.status(400).json({
            error: `Le numéro ${phone} n'est pas reconnu sur WhatsApp. Assurez-vous d'avoir saisi le bon numéro.`,
          });
        }
        return res.status(502).json({
          error: 'Impossible d\'envoyer le message WhatsApp. Vérifiez que votre numéro a bien WhatsApp actif.',
        });
      }

      // Sécurité : le code n'est JAMAIS renvoyé dans la réponse HTTP !
      return res.status(200).json({
        success: true,
        phone,
        challengeToken,
        message: 'Code envoyé sur votre WhatsApp avec succès.',
      });
    } catch (err: any) {
      phoneRateLimits.delete(phone);
      console.error('Exception WAHA:', err);
      return res.status(503).json({ error: 'Passerelle WhatsApp temporairement indisponible.' });
    }
  }

  // 2. Action : VÉRIFIER LE CODE WHATSAPP & CRÉER LA SESSION SUPABASE
  if (action === 'verify-code') {
    const rawPhone = String(body.phone || '');
    const phone = normalizePhone(rawPhone);
    const code = String(body.code || '').trim();
    const challengeToken = String(body.challengeToken || '');
    const studioName = String(body.studioName || '').replace(/[<>]/g, '').trim().slice(0, 60);

    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone manquant ou invalide.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Le code doit comporter exactement 6 chiffres.' });
    }

    const verification = verifyChallenge(challengeToken, config.hmacSecret);
    if (!verification.valid || !verification.payload) {
      return res.status(400).json({ error: verification.error || 'Session expirée ou invalide.' });
    }

    const { payload } = verification;
    if (payload.phone !== phone) {
      return res.status(400).json({ error: 'Incohérence entre le numéro et le jeton de sécurité.' });
    }

    // Protection anti-rejeu (Replay attack prevention) & anti brute-force serveur
    if (usedChallenges.has(payload.codeHash)) {
      return res.status(400).json({ error: 'Ce code de vérification a déjà été utilisé.' });
    }
    const serverAttempts = failedCodeAttempts.get(payload.codeHash);
    if (serverAttempts && serverAttempts.count >= 3) {
      return res.status(400).json({ error: 'Nombre maximal de tentatives dépassé. Demandez un nouveau code.' });
    }

    // Calcul du hash attendu avec timing-safe comparison
    const checkHash = crypto.createHmac('sha256', config.hmacSecret).update(`${phone}:${code}`).digest('hex');
    const expectedBuf = Buffer.from(payload.codeHash, 'hex');
    const checkBuf = Buffer.from(checkHash, 'hex');
    const match = expectedBuf.length === checkBuf.length && crypto.timingSafeEqual(expectedBuf, checkBuf);

    if (!match) {
      const nextCount = (serverAttempts?.count || 0) + 1;
      failedCodeAttempts.set(payload.codeHash, {
        count: nextCount,
        firstAt: serverAttempts?.firstAt || Date.now(),
      });
      payload.attemptsLeft = Math.max(0, Math.min(payload.attemptsLeft - 1, 3 - nextCount));
      const updatedB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const updatedSig = crypto.createHmac('sha256', config.hmacSecret).update(updatedB64).digest('base64url');
      const updatedChallenge = `${updatedB64}.${updatedSig}`;

      return res.status(400).json({
        error:
          payload.attemptsLeft <= 0
            ? 'Nombre maximal de tentatives dépassé. Demandez un nouveau code.'
            : `Code incorrect. Il vous reste ${payload.attemptsLeft} tentative(s) avant verrouillage.`,
        challengeToken: updatedChallenge,
      });
    }

    // Code valide : marquer le challenge comme consommé immédiatement
    usedChallenges.set(payload.codeHash, Date.now());

    // Génération de la session officielle Supabase
    try {
      const cleanDigits = phone.replace(/\D/g, '');
      const userEmail = `wa_${cleanDigits}@djelia.store`;

      const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const linkRes = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
        options: {
          data: {
            phone,
            studio_name: studioName || 'Mon Studio Djelia',
            full_name: studioName || `Membre WhatsApp ${phone.slice(-4)}`,
          },
        },
      });

      if (linkRes.error) {
        console.error('Erreur Supabase generateLink:', linkRes.error);
        return res.status(500).json({ error: 'Erreur lors de la génération de session sécurisée.' });
      }

      const emailOtp = linkRes.data?.properties?.email_otp;
      if (!emailOtp) {
        return res.status(500).json({ error: 'Jeton de session introuvable.' });
      }

      return res.status(200).json({
        success: true,
        email: userEmail,
        emailOtp,
      });
    } catch (err: any) {
      console.error('Exception Supabase admin:', err);
      return res.status(500).json({ error: 'Erreur interne d\'authentification.' });
    }
  }

  return res.status(400).json({ error: 'Action non reconnue.' });
}
