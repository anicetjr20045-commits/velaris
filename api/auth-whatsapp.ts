import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co';
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

// Mémoire glissante pour le rate-limiting
const rateLimits = new Map<string, { lastSentAt: number; count: number; windowStart: number }>();

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function checkRateLimit(phone: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const entry = rateLimits.get(phone);

  if (!entry) {
    rateLimits.set(phone, { lastSentAt: now, count: 1, windowStart: now });
    return { allowed: true };
  }

  // 1 envoi max toutes les 60 secondes
  if (now - entry.lastSentAt < 60_000) {
    const waitSec = Math.ceil((60_000 - (now - entry.lastSentAt)) / 1000);
    return { allowed: false, message: `Veuillez patienter ${waitSec}s avant de redemander un code.` };
  }

  // 5 envois max par heure
  if (now - entry.windowStart > 3_600_000) {
    rateLimits.set(phone, { lastSentAt: now, count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= 5) {
    return { allowed: false, message: 'Limite horaire atteinte (5 demandes max). Réessayez plus tard.' };
  }

  entry.count += 1;
  entry.lastSentAt = now;
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
      return { valid: false, error: 'Le code a expiré (délai de 5 min dépassé).' };
    }
    if (payload.attemptsLeft <= 0) {
      return { valid: false, error: 'Nombre maximal de tentatives dépassé. Demandez un nouveau code.' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Jeton illisible.' };
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const config = getEnvConfig();
  const body = req.body || {};
  const action = body.action;

  // 1. Action : ENVOYER LE CODE WHATSAPP
  if (action === 'send-code') {
    const rawPhone = String(body.phone || '');
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide. Incluez l\'indicatif pays.' });
    }

    const rate = checkRateLimit(phone);
    if (!rate.allowed) {
      return res.status(429).json({ error: rate.message });
    }

    // Code à 6 chiffres aléatoire cryptographique
    const code = String(crypto.randomInt(100000, 1000000));
    const challengeToken = createChallenge(phone, code, config.hmacSecret);

    // Envoi par WAHA
    const cleanDigits = phone.replace(/\D/g, '');
    const message = `Djelia Academy : votre code de connexion sécurisé est ${code}.\nCe code expire dans 5 minutes. Ne le partagez avec personne.`;

    try {
      const wahaRes = await fetch(`${config.wahaBaseUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.wahaApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: config.wahaSession,
          chatId: `${cleanDigits}@c.us`,
          text: message,
        }),
      });

      if (!wahaRes.ok) {
        const errJson = await wahaRes.json().catch(() => ({}));
        console.error('Erreur WAHA sendText:', errJson);
        return res.status(502).json({
          error: 'Impossible d\'envoyer le message WhatsApp. Vérifiez que votre numéro a bien WhatsApp actif.',
        });
      }

      return res.status(200).json({
        success: true,
        phone,
        challengeToken,
        message: 'Code envoyé sur votre WhatsApp avec succès.',
      });
    } catch (err: any) {
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
    const studioName = String(body.studioName || '').trim().slice(0, 60);

    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone manquant ou invalide.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Le code doit comporter 6 chiffres.' });
    }

    const verification = verifyChallenge(challengeToken, config.hmacSecret);
    if (!verification.valid || !verification.payload) {
      return res.status(400).json({ error: verification.error || 'Session expirée ou invalide.' });
    }

    const { payload } = verification;
    if (payload.phone !== phone) {
      return res.status(400).json({ error: 'Incohérence entre le numéro et le jeton.' });
    }

    // Calcul du hash attendu
    const checkHash = crypto.createHmac('sha256', config.hmacSecret).update(`${phone}:${code}`).digest('hex');
    if (checkHash !== payload.codeHash) {
      payload.attemptsLeft -= 1;
      const updatedB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const updatedSig = crypto.createHmac('sha256', config.hmacSecret).update(updatedB64).digest('base64url');
      const updatedChallenge = `${updatedB64}.${updatedSig}`;

      return res.status(400).json({
        error: `Code incorrect. Il vous reste ${payload.attemptsLeft} tentative(s).`,
        challengeToken: updatedChallenge,
      });
    }

    // Code valide -> génération de la session Supabase
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
