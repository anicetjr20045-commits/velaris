import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const KIE_BASE_URL = 'https://api.kie.ai/api/v1';
const CALLBACK_URL = 'https://waha.velarisagent.life/api/suno-callback';

function getKieApiKey(): string {
  let key = process.env.KIE_API_KEY || process.env.SUNO_API_KEY || process.env.VITE_KIE_API_KEY || '';
  if (!key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m && ['KIE_API_KEY', 'SUNO_API_KEY', 'VITE_KIE_API_KEY'].includes(m[1].trim())) {
            key = m[2].trim();
            if (key) break;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return key || '9c8965ca1c39ef43b6835599b42c8951';
}

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractMeta(html: string, prop: string): string {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m?.[1]?.trim() || '';
}

async function resolveSunoEntry(rawInput: string) {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  let uuidMatch = trimmed.match(uuidRegex);
  let resolvedUrl = trimmed;

  // Résolution des liens courts suno.com/s/... via redirection HTTP
  if (!uuidMatch && /^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        },
        signal: AbortSignal.timeout(8000),
      });
      resolvedUrl = res.url || trimmed;
      uuidMatch = resolvedUrl.match(uuidRegex);
      if (!uuidMatch && res.ok) {
        const html = await res.text();
        uuidMatch = html.match(uuidRegex);
      }
    } catch {
      // Repli silencieux
    }
  }

  if (!uuidMatch) {
    return null;
  }

  const uuid = uuidMatch[1].toLowerCase();
  let title = `Chanson Suno ${uuid.slice(0, 8)}`;
  let audioUrl = `https://cdn1.suno.ai/${uuid}.mp3`;
  let coverUrl = `https://cdn2.suno.ai/image_${uuid}.jpeg`;
  let style = '';
  let duration: number | undefined = undefined;

  // 1. Tentative via l'API publique clip de Suno
  try {
    const clipRes = await fetch(`https://studio-api.prod.suno.com/api/clip/${uuid}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (clipRes.ok) {
      const clip: any = await clipRes.json().catch(() => null);
      if (clip) {
        if (clip.title) title = String(clip.title).trim();
        if (clip.audio_url) audioUrl = String(clip.audio_url);
        if (clip.image_large_url || clip.image_url) coverUrl = String(clip.image_large_url || clip.image_url);
        if (clip.metadata?.tags) style = String(clip.metadata.tags);
        if (clip.metadata?.duration) duration = Math.round(Number(clip.metadata.duration));
      }
    }
  } catch {
    // Repli sur OpenGraph HTML
  }

  // 2. Enrichissement OpenGraph depuis suno.com/song/<uuid> si le titre est encore générique
  if (title.startsWith('Chanson Suno ')) {
    try {
      const pageRes = await fetch(`https://suno.com/song/${uuid}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const ogTitle = extractMeta(html, 'og:title');
        const ogAudio = extractMeta(html, 'og:audio');
        const ogImage = extractMeta(html, 'og:image');
        if (ogTitle && !ogTitle.toLowerCase().includes('suno')) {
          title = ogTitle.replace(/\s*\|\s*Suno.*$/i, '').trim();
        }
        if (ogAudio) audioUrl = ogAudio;
        if (ogImage) coverUrl = ogImage;
      }
    } catch {
      // Conserver les URLs CDN officielles
    }
  }

  return {
    uuid,
    title,
    audioUrl,
    coverUrl,
    style,
    duration,
    sourceUrl: `https://suno.com/song/${uuid}`,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = String(req.query?.action || req.body?.action || '').trim();
  const apiKey = getKieApiKey();

  try {
    // 1. GÉNÉRATION DE CHANSON SUNO VIA KIE.AI
    if (req.method === 'POST' && action === 'generate') {
      const body = req.body || {};
      const customMode = body.customMode !== false;
      const instrumental = Boolean(body.instrumental);
      const model = String(body.model || 'V4_5');
      const rawTitle = stripEmojis(String(body.title || 'Chanson Personnalisée'));
      const rawStyle = stripEmojis(String(body.style || 'Afro-Love acoustique'));
      const rawPrompt = stripEmojis(String(body.prompt || body.lyrics || ''));
      const vocalGenderRaw = String(body.vocalGender || '').toLowerCase();

      if (rawTitle.length > 80) {
        return res.status(400).json({ error: `Le titre dépasse la limite Kie.ai de 80 caractères (${rawTitle.length}/80).` });
      }
      if (rawStyle.length > 1000) {
        return res.status(400).json({ error: `Le style musical dépasse la limite Kie.ai de 1000 caractères (${rawStyle.length}/1000).` });
      }
      if (customMode && !instrumental && rawPrompt.length > 5000) {
        return res.status(400).json({ error: `Les paroles dépassent la limite Kie.ai de 5000 caractères (${rawPrompt.length}/5000).` });
      }
      if (!customMode && rawPrompt.length > 400) {
        return res.status(400).json({ error: `Le prompt simple dépasse la limite de 400 caractères (${rawPrompt.length}/400).` });
      }

      let finalStyle = rawStyle;
      let vocalGender: 'm' | 'f' | undefined = undefined;
      if (vocalGenderRaw === 'f' || vocalGenderRaw === 'femme' || vocalGenderRaw === 'féminine') {
        vocalGender = 'f';
        if (!finalStyle.toLowerCase().includes('female vocals')) {
          finalStyle = `female vocals, ${finalStyle}`.slice(0, 1000);
        }
      } else if (vocalGenderRaw === 'm' || vocalGenderRaw === 'homme' || vocalGenderRaw === 'masculine') {
        vocalGender = 'm';
        if (!finalStyle.toLowerCase().includes('male vocals')) {
          finalStyle = `male vocals, ${finalStyle}`.slice(0, 1000);
        }
      } else if (vocalGenderRaw === 'duo' || vocalGenderRaw === 'duet') {
        if (!finalStyle.toLowerCase().includes('duet')) {
          finalStyle = `duet, male and female vocals, ${finalStyle}`.slice(0, 1000);
        }
      }

      const payload: Record<string, any> = {
        prompt: rawPrompt,
        style: finalStyle,
        title: rawTitle,
        customMode,
        instrumental,
        model,
        callBackUrl: CALLBACK_URL,
      };
      if (vocalGender) payload.vocalGender = vocalGender;

      const kieRes = await fetch(`${KIE_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });

      const json: any = await kieRes.json().catch(() => ({}));
      if (!kieRes.ok || (json?.code && json.code !== 200)) {
        const rawMsg = String(json?.msg || json?.message || json?.error || `HTTP ${kieRes.status}`);
        const low = rawMsg.toLowerCase();
        const friendly =
          kieRes.status === 402 || low.includes('credit') || low.includes('balance') || low.includes('insufficient')
            ? 'Crédits Kie.ai insuffisants pour lancer la génération Suno. Rechargez votre solde Kie.ai.'
            : rawMsg;
        return res.status(kieRes.status >= 400 ? kieRes.status : 400).json({ error: friendly, raw: json });
      }

      return res.status(200).json({
        success: true,
        taskId: json?.data?.taskId || json?.taskId,
        data: json?.data,
      });
    }

    // 2. STATUT GÉNÉRATION CHANSON
    if (req.method === 'GET' && action === 'status') {
      const taskId = String(req.query?.taskId || '').trim();
      if (!taskId) return res.status(400).json({ error: 'taskId manquant' });

      const kieRes = await fetch(`${KIE_BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      const json: any = await kieRes.json().catch(() => ({}));
      return res.status(kieRes.status).json(json);
    }

    // 3. CRÉATION VIDÉO LYRICS / MP4 VIA KIE.AI
    if (req.method === 'POST' && action === 'music-video') {
      const { taskId, audioId, author, domainName } = req.body || {};
      if (!taskId || !audioId) {
        return res.status(400).json({ error: 'taskId et audioId sont requis pour générer la vidéo lyrics.' });
      }

      const kieRes = await fetch(`${KIE_BASE_URL}/mp4/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: String(taskId),
          audioId: String(audioId),
          author: stripEmojis(String(author || 'Djelia Studio')).slice(0, 50),
          domainName: String(domainName || 'djelia.store').slice(0, 50),
          callBackUrl: CALLBACK_URL,
        }),
        signal: AbortSignal.timeout(25000),
      });

      const json: any = await kieRes.json().catch(() => ({}));
      if (!kieRes.ok || (json?.code && json.code !== 200)) {
        const rawMsg = String(json?.msg || json?.message || json?.error || `HTTP ${kieRes.status}`);
        const low = rawMsg.toLowerCase();
        const friendly =
          kieRes.status === 402 || low.includes('credit') || low.includes('balance') || low.includes('insufficient')
            ? 'Crédits Kie.ai insuffisants pour générer la vidéo lyrics MP4.'
            : rawMsg;
        return res.status(kieRes.status >= 400 ? kieRes.status : 400).json({ error: friendly, raw: json });
      }

      return res.status(200).json({
        success: true,
        taskId: json?.data?.taskId || json?.taskId,
      });
    }

    // 4. STATUT VIDÉO LYRICS MP4
    if (req.method === 'GET' && action === 'video-status') {
      const taskId = String(req.query?.taskId || '').trim();
      if (!taskId) return res.status(400).json({ error: 'taskId manquant' });

      const kieRes = await fetch(`${KIE_BASE_URL}/mp4/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      const json: any = await kieRes.json().catch(() => ({}));
      return res.status(kieRes.status).json(json);
    }

    // 5. EXTRACTEUR DE LIENS SUNO (supporte suno.com/song/..., suno.com/s/..., UUID)
    if (req.method === 'POST' && action === 'extract') {
      const rawInputs: string[] = Array.isArray(req.body?.urls)
        ? req.body.urls
        : String(req.body?.text || '')
            .split(/[\n,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);

      if (rawInputs.length === 0) {
        return res.status(400).json({ error: 'Aucun lien Suno fourni.' });
      }

      const settled = await Promise.all(rawInputs.slice(0, 20).map((u) => resolveSunoEntry(u)));
      const tracks = settled.filter((t): t is NonNullable<typeof t> => t !== null);
      const seen = new Set<string>();
      const unique = tracks.filter((t) => {
        if (seen.has(t.uuid)) return false;
        seen.add(t.uuid);
        return true;
      });

      if (unique.length === 0) {
        return res.status(400).json({ error: 'Aucun identifiant ou lien Suno valide détecté.' });
      }

      return res.status(200).json({ success: true, tracks: unique });
    }

    // 6. TÉLÉCHARGEMENT FORCÉ SANS OUVERTURE D'ONGLET
    if (req.method === 'GET' && action === 'download') {
      const targetUrl = String(req.query?.url || '').trim();
      const rawFilename = String(req.query?.filename || 'chanson_djelia.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ error: 'URL invalide' });
      }

      const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(30000) });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: `Impossible de récupérer le fichier (${upstream.status})` });
      }

      const arrayBuf = await upstream.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${rawFilename}"`);
      res.setHeader('Content-Length', buf.length);
      return res.status(200).send(buf);
    }

    return res.status(400).json({ error: 'Action non reconnue.' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erreur interne Suno / Kie.ai' });
  }
}
