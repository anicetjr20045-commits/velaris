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

const DISABLED_PREFIX = 'disabled::';

function isRowDisabled(row: any): boolean {
  return typeof row?.track1_url === 'string' && row.track1_url.startsWith(DISABLED_PREFIX);
}

function cleanTrackUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith(DISABLED_PREFIX) ? url.slice(DISABLED_PREFIX.length) : url;
}

function canUserManageRow(row: any, user: any): boolean {
  if (!row || !user) return false;
  if (row.user_id === user.id) return true;
  if (row.user_id === null) {
    const userStudio = String(user.user_metadata?.studio_name || '').trim().toLowerCase();
    const rowStudio = String(row.studio_name || '').trim().toLowerCase();
    const isOwnerAccount =
      user.id === '5756a961-04ce-467d-be49-311ccff6bad9' ||
      String(user.email || '').includes('05777308');
    if (isOwnerAccount) return true;
    if (userStudio && rowStudio && userStudio === rowStudio) return true;
  }
  return false;
}

async function resolveAuthUser(admin: any, req: any) {
  const authHeader = String(req.headers['authorization'] || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req: any, res: any) {
  const { supabaseUrl, supabaseSecretKey, hmacSecret } = getConfig();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Djelia-Player');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabaseSecretKey) {
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const mode = String(req.query?.mode || req.body?.mode || 'meta').trim();

  // MODE 0A : LISTER LES LIENS D'ÉCOUTE DU STUDIO (y compris les anciens déjà envoyés)
  if (mode === 'list') {
    const user = await resolveAuthUser(admin, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const { data: rows, error } = await admin
      .from('shared_tracks')
      .select('id, user_id, recipient, occasion, studio_name, allow_download, plays_count, created_at, track1_url, track1_title, track2_title')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const filtered = (rows || [])
      .filter((r: any) => canUserManageRow(r, user))
      .map((r: any) => ({
        id: r.id,
        recipient: r.recipient,
        occasion: r.occasion,
        studioName: r.studio_name,
        allowDownload: Boolean(r.allow_download),
        active: !isRowDisabled(r),
        playsCount: r.plays_count || 0,
        track1Title: r.track1_title || 'Version 01',
        track2Title: r.track2_title || undefined,
        createdAt: r.created_at,
      }));

    return res.status(200).json({ success: true, links: filtered });
  }

  // MODE 0B : GÉRER UN OU PLUSIEURS LIENS (désactiver, réactiver, rendre téléchargeable, supprimer)
  if (mode === 'manage' && req.method === 'POST') {
    const user = await resolveAuthUser(admin, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const body = req.body || {};
    const action = String(body.action || '').trim();
    const id = String(body.id || '').trim();

    if (action === 'bulk-download') {
      const allow = Boolean(body.allowDownload);
      const { data: rows } = await admin.from('shared_tracks').select('id, user_id, studio_name');
      const ids = (rows || []).filter((r: any) => canUserManageRow(r, user)).map((r: any) => r.id);
      if (ids.length > 0) {
        const { error: upErr } = await admin
          .from('shared_tracks')
          .update({ allow_download: allow })
          .in('id', ids);
        if (upErr) return res.status(500).json({ error: upErr.message });
      }
      return res.status(200).json({ success: true, updatedCount: ids.length, allowDownload: allow });
    }

    if (!id) {
      return res.status(400).json({ error: 'Identifiant du lien manquant' });
    }

    const { data: row, error: fetchErr } = await admin
      .from('shared_tracks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !row) {
      return res.status(404).json({ error: 'Lien introuvable' });
    }

    if (!canUserManageRow(row, user)) {
      return res.status(403).json({ error: 'Accès non autorisé à ce lien' });
    }

    if (action === 'delete') {
      const { error: delErr } = await admin.from('shared_tracks').delete().eq('id', id);
      if (delErr) return res.status(500).json({ error: delErr.message });
      return res.status(200).json({ success: true, deleted: true });
    }

    if (action === 'toggle-download') {
      const nextDownload = typeof body.allowDownload === 'boolean' ? body.allowDownload : !Boolean(row.allow_download);
      const { error: upErr } = await admin
        .from('shared_tracks')
        .update({ allow_download: nextDownload })
        .eq('id', id);
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.status(200).json({ success: true, allowDownload: nextDownload });
    }

    if (action === 'toggle-active') {
      const currentlyDisabled = isRowDisabled(row);
      const nextActive = typeof body.active === 'boolean' ? body.active : currentlyDisabled;
      const baseTrack1 = cleanTrackUrl(row.track1_url);
      const nextTrack1 = nextActive ? baseTrack1 : `${DISABLED_PREFIX}${baseTrack1}`;

      const { error: upErr } = await admin
        .from('shared_tracks')
        .update({ track1_url: nextTrack1 })
        .eq('id', id);
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.status(200).json({ success: true, active: nextActive });
    }

    return res.status(400).json({ error: 'Action de gestion non reconnue' });
  }

  const id = String(req.query?.id || '').trim();
  if (!id) {
    return res.status(400).json({ error: 'Identifiant d’audition manquant' });
  }

  const { data: row, error } = await admin
    .from('shared_tracks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) {
    return res.status(404).json({ error: 'Audition introuvable ou supprimée' });
  }

  if (isRowDisabled(row)) {
    return res.status(410).json({
      disabled: true,
      error: 'Ce lien d’écoute privée a été désactivé par le studio.',
    });
  }

  // MODE 1 : Retourne les métadonnées protégées (sans exposer les URLs audio brutes si allow_download === false)
  if (mode === 'meta') {
    const tracks: Array<{ index: number; title: string; streamUrl: string; downloadUrl?: string }> = [];
    const t1Url = cleanTrackUrl(row.track1_url);
    const t2Url = cleanTrackUrl(row.track2_url);

    if (t1Url) {
      const token1 = signStreamToken(id, 1, hmacSecret);
      tracks.push({
        index: 1,
        title: row.track1_title || 'Version 01',
        streamUrl: `/api/audio-stream?mode=stream&id=${encodeURIComponent(id)}&v=1&t=${encodeURIComponent(token1)}`,
        downloadUrl: row.allow_download ? t1Url : undefined,
      });
    }
    if (t2Url) {
      const token2 = signStreamToken(id, 2, hmacSecret);
      tracks.push({
        index: 2,
        title: row.track2_title || 'Version 02',
        streamUrl: `/api/audio-stream?mode=stream&id=${encodeURIComponent(id)}&v=2&t=${encodeURIComponent(token2)}`,
        downloadUrl: row.allow_download ? t2Url : undefined,
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

    const rawUrl = v === 2 ? row.track2_url : row.track1_url;
    const targetUrl = cleanTrackUrl(rawUrl);
    if (!targetUrl) {
      return res.status(404).json({ error: 'Piste introuvable' });
    }

    const resolvedUrl = targetUrl.startsWith('/')
      ? `https://app.djelia.store${targetUrl}`
      : targetUrl;

    const upstream = await fetch(resolvedUrl, { signal: AbortSignal.timeout(30000) });
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
