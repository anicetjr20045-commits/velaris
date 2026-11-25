import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';

function getConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let hmacSecret = process.env.AUTH_HMAC_SECRET || 'djelia-stream-shield-2026';

  if (!supabaseSecretKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m && m[1].trim() === 'SUPABASE_SECRET_KEY') {
            supabaseSecretKey = m[2].trim();
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return { supabaseUrl, supabaseSecretKey, hmacSecret };
}

function signStreamToken(trackId: string, trackIndex: number, secret: string): string {
  const exp = Date.now() + 2 * 3600 * 1000;
  const payload = `${trackId}:${trackIndex}:${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${exp}.${sig}`;
}

function verifyStreamToken(trackId: string, trackIndex: number, token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return false;
  const payload = `${trackId}:${trackIndex}:${exp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export default async function handler(req: any, res: any) {
  const { supabaseUrl, supabaseSecretKey, hmacSecret } = getConfig();

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Djelia-Player');
    return res.status(200).end();
  }

  const id = String(req.query?.id || '').trim();
  const mode = String(req.query?.mode || 'meta').trim();

  if (!id) {
    return res.status(400).json({ error: 'Identifiant d’audition manquant' });
  }

  if (!supabaseSecretKey) {
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error } = await admin
    .from('shared_tracks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) {
    return res.status(404).json({ error: 'Audition introuvable ou expirée' });
  }

  // MODE 1 : Retourne les métadonnées protégées (sans exposer les URLs audio brutes si allow_download === false)
  if (mode === 'meta') {
    const tracks: Array<{ index: number; title: string; streamUrl: string; downloadUrl?: string }> = [];
    if (row.track1_url) {
      const token1 = signStreamToken(id, 1, hmacSecret);
      tracks.push({
        index: 1,
        title: row.track1_title || 'Version 01',
        streamUrl: `/api/audio-stream?mode=stream&id=${encodeURIComponent(id)}&v=1&t=${encodeURIComponent(token1)}`,
        downloadUrl: row.allow_download ? row.track1_url : undefined,
      });
    }
    if (row.track2_url) {
      const token2 = signStreamToken(id, 2, hmacSecret);
      tracks.push({
        index: 2,
        title: row.track2_title || 'Version 02',
        streamUrl: `/api/audio-stream?mode=stream&id=${encodeURIComponent(id)}&v=2&t=${encodeURIComponent(token2)}`,
        downloadUrl: row.allow_download ? row.track2_url : undefined,
      });
    }

    return res.status(200).json({
      id: row.id,
      recipient: row.recipient,
      occasion: row.occasion,
      studio_name: row.studio_name || 'Studio Djelia',
      creator_phone: row.creator_phone || null,
      allow_download: Boolean(row.allow_download),
      created_at: row.created_at,
      tracks,
    });
  }

  // MODE 2 : Flux audio protégé (Web Audio API uniquement quand verrouillé)
  if (mode === 'stream') {
    const v = Number(req.query?.v || 1);
    const token = String(req.query?.t || '');
    const secFetchMode = String(req.headers['sec-fetch-mode'] || '');
    const playerHeader = String(req.headers['x-djelia-player'] || '');

    // Bloque toute ouverture directe dans un onglet navigateur ou gestionnaire de téléchargement
    if (!row.allow_download) {
      if (secFetchMode === 'navigate' || playerHeader !== '1') {
        return res.status(403).json({
          error: 'Téléchargement désactivé : lecture autorisée uniquement depuis le lecteur privé.',
        });
      }
    }

    if (!verifyStreamToken(id, v, token, hmacSecret)) {
      return res.status(403).json({ error: 'Jeton d’écoute expiré. Rechargez la page.' });
    }

    const targetUrl = v === 2 ? row.track2_url : row.track1_url;
    if (!targetUrl) {
      return res.status(404).json({ error: 'Piste introuvable' });
    }

    const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(30000) });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Flux audio temporairement indisponible' });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);
  }

  return res.status(400).json({ error: 'Mode non supporté' });
}
