import crypto from 'node:crypto';
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

function sanitizeSunoStyle(raw: string): string {
  let cleaned = stripEmojis(raw).replace(/\bskank(?:ing)?\b/gi, 'upbeat offbeat guitar chops');
  const ARTIST_REPLACEMENTS: [RegExp, string][] = [
    [/burna\s*boy/gi, 'modern Afropop star sound'],
    [/wizkid/gi, 'smooth Afrobeats sound'],
    [/davido/gi, 'uplifting Afropop anthem sound'],
    [/rema/gi, 'Afrorave melodic sound'],
    [/asake/gi, 'Fuji-infused energetic Afrobeats sound'],
    [/fally\s*ipupa/gi, 'modern Congolese rumba style'],
    [/koffi\s*olomide/gi, 'Tcha-Tcho rumba style'],
    [/magic\s*system/gi, 'festive Zouglou style'],
    [/dj\s*arafat/gi, 'high-energy Coupé-Décalé style'],
    [/serge\s*beynaud/gi, 'melodic Coupé-Décalé dance sound'],
    [/aya\s*nakamura/gi, 'modern French Afro-R&B pop sound'],
    [/dadju/gi, 'smooth French Afro-Love sound'],
    [/tayc/gi, 'sensual Afro-Love acoustic sound'],
    [/bob\s*marley/gi, 'classic warm Roots Reggae sound'],
  ];
  for (const [re, repl] of ARTIST_REPLACEMENTS) {
    cleaned = cleaned.replace(re, repl);
  }
  return cleaned.trim().slice(0, 1000);
}

function applyVocalToStyle(rawStyle: string, rawVoice: string): { finalStyle: string; vocalGender?: 'm' | 'f' } {
  const voiceNorm = rawVoice
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const base = sanitizeSunoStyle(rawStyle)
    .replace(/\b(male and female vocals?|female lead vocals?|male lead vocals?|female vocals?|male vocals?|duet)\b[,.]?\s*/gi, '')
    .trim();

  if (voiceNorm === 'f' || voiceNorm.includes('fem')) {
    return {
      vocalGender: 'f',
      finalStyle: `female vocals, expressive female lead vocal, ${base}`.slice(0, 1000),
    };
  }
  if (voiceNorm === 'm' || voiceNorm.includes('masc') || voiceNorm.includes('homme')) {
    return {
      vocalGender: 'm',
      finalStyle: `male vocals, expressive male lead vocal, ${base}`.slice(0, 1000),
    };
  }
  if (voiceNorm.includes('duo') || voiceNorm.includes('duet')) {
    return {
      finalStyle: `duet, male and female vocals, ${base}`.slice(0, 1000),
    };
  }
  return { finalStyle: base };
}

async function callKiePost(endpoint: string, apiKey: string, payload: Record<string, any>) {
  const kieRes = await fetch(`${KIE_BASE_URL}${endpoint}`, {
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
        ? 'Crédits de génération insuffisants. Rechargez votre solde.'
        : rawMsg;
    return { ok: false as const, status: kieRes.status >= 400 ? kieRes.status : 400, error: friendly, raw: json };
  }
  return {
    ok: true as const,
    taskId: String(json?.data?.taskId || json?.taskId || ''),
    data: json?.data,
  };
}

function extractMeta(html: string, prop: string): string {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m?.[1]?.trim() || '';
}

async function decryptSunoMangoAudio(uuid: string): Promise<{ buffer: Buffer; mimeType: string; ext: string } | null> {
  // 1. Pipeline Suno Mango officiel (AES-256-GCM key unwrap + AES-128-CTR decrypt sur CloudFront M4A)
  try {
    const rightsRes = await fetch('https://studio-api-prod.suno.com/api/mango/rights', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content_params: { content_id: uuid, content_type: 'clip' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (rightsRes.ok) {
      const rights: any = await rightsRes.json().catch(() => null);
      if (rights?.glt && rights?.key && rights?.iv) {
        const userKeyBytes = crypto.createHash('sha256').update(String(rights.glt)).digest();
        const aad = Buffer.from(uuid);
        const unwrap = (b64: string) => {
          const raw = Buffer.from(b64, 'base64');
          const iv = raw.subarray(0, 12);
          const ciphertext = raw.subarray(12, raw.length - 16);
          const tag = raw.subarray(raw.length - 16);
          const decipher = crypto.createDecipheriv('aes-256-gcm', userKeyBytes, iv);
          decipher.setAAD(aad);
          decipher.setAuthTag(tag);
          return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        };

        const contentKey = unwrap(rights.key);
        const contentIv = unwrap(rights.iv);

        const encRes = await fetch(`https://d2lwuy8qc234o3.cloudfront.net/1/clip/${uuid}.m4a`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(25000),
        });
        if (encRes.ok) {
          const encBuf = Buffer.from(await encRes.arrayBuffer());
          const dec = crypto.createDecipheriv('aes-128-ctr', contentKey, contentIv);
          const decBuf = Buffer.concat([dec.update(encBuf), dec.final()]);
          if (decBuf.length > 10000) {
            return { buffer: decBuf, mimeType: 'audio/mp4', ext: 'm4a' };
          }
        }
      }
    }
  } catch {
    // Repli sur CDN classique
  }

  // 2. Repli CDN classique pour anciens morceaux non chiffrés
  for (const candidate of [`https://cdn1.suno.ai/${uuid}.mp3`, `https://cdn2.suno.ai/${uuid}.mp3`]) {
    try {
      const res = await fetch(candidate, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 10000) {
          return { buffer: buf, mimeType: 'audio/mpeg', ext: 'mp3' };
        }
      }
    } catch {
      // essayer suivant
    }
  }

  return null;
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
  let coverUrl = `https://cdn2.suno.ai/image_${uuid}.jpeg`;
  let style = '';
  let duration: number | undefined = undefined;

  // 1. Récupération des métadonnées via suno.com/song/<uuid> (OpenGraph + titre)
  try {
    const pageRes = await fetch(`https://suno.com/song/${uuid}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const ogTitle = extractMeta(html, 'og:title');
      const ogImage = extractMeta(html, 'og:image');
      if (ogTitle && ogTitle.toLowerCase() !== 'suno') {
        title = ogTitle.replace(/\s*\|\s*Suno.*$/i, '').trim();
      } else {
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        if (titleTag) {
          title = titleTag.replace(/\s*\|\s*Suno.*$/i, '').trim();
        }
      }
      if (ogImage) coverUrl = ogImage;
    }
  } catch {
    // Conserver couverture par défaut
  }

  // URL audio garantie via notre déchiffreur Mango intégré
  const audioUrl = `/api/suno?action=suno-audio&uuid=${uuid}&title=${encodeURIComponent(title)}`;

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
    // 0. OPTIMISATION DE STYLE PAR IA (SANS TERMES BANNIS)
    if (req.method === 'POST' && action === 'optimize-style') {
      const rawStyle = sanitizeSunoStyle(String(req.body?.style || ''));
      const voiceRaw = String(req.body?.voice || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (!rawStyle) {
        return res.status(400).json({ error: 'Veuillez saisir un style à optimiser.' });
      }
      const voiceHint =
        voiceRaw.includes('fem') || voiceRaw === 'f'
          ? 'Expressive female lead vocal, clear French pronunciation'
          : voiceRaw.includes('masc') || voiceRaw === 'm'
          ? 'Expressive soulful male lead vocal, clear French pronunciation'
          : 'Emotional male and female duet vocals, clear French pronunciation';

      const optRes = await fetch('https://api.kie.ai/openai/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-1-flash',
          stream: false,
          temperature: 0.3,
          reasoning: { effort: 'none' },
          input: [
            'Tu es un directeur musical expert en production audio.',
            `Transforme cette demande de style en une description de production musicale professionnelle en ANGLAIS (max 450 caractères) : "${rawStyle}".`,
            `Inclus impérativement le choix vocal : ${voiceHint}.`,
            'Précise le BPM, les instruments clés, le groove, le mixage et l\'ambiance.',
            'INTERDIT : aucun nom d\'artiste réel, aucun mot vulgaire/banni (comme "skank"), aucun emoji.',
            'Réponds UNIQUEMENT par la description finale brute, sans guillemets ni explication.',
          ].join('\n'),
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!optRes.ok) {
        return res.status(502).json({ error: 'Impossible d\'optimiser le style pour le moment.' });
      }
      const optJson: any = await optRes.json().catch(() => ({}));
      const rawOut =
        optJson?.output_text ||
        optJson?.output?.[0]?.content?.[0]?.text ||
        optJson?.choices?.[0]?.message?.content ||
        '';
      const optimizedStyle = sanitizeSunoStyle(String(rawOut).replace(/^["']|["']$/g, ''));
      if (!optimizedStyle) {
        return res.status(502).json({ error: 'Réponse vide lors de l\'optimisation du style.' });
      }
      return res.status(200).json({ success: true, optimizedStyle });
    }

    // 1. GÉNÉRATION DE CHANSON
    if (req.method === 'POST' && action === 'generate') {
      const body = req.body || {};
      const customMode = body.customMode !== false;
      const instrumental = Boolean(body.instrumental);
      const model = String(body.model || 'V6');
      const rawTitle = stripEmojis(String(body.title || 'Chanson Personnalisée'));
      const rawStyle = String(body.style || 'Afro-Love acoustique');
      const rawPrompt = stripEmojis(String(body.prompt || body.lyrics || ''));

      if (rawTitle.length > 80) {
        return res.status(400).json({ error: `Le titre dépasse la limite de 80 caractères (${rawTitle.length}/80).` });
      }
      if (rawStyle.length > 1000) {
        return res.status(400).json({ error: `Le style musical dépasse la limite de 1000 caractères (${rawStyle.length}/1000).` });
      }
      if (customMode && !instrumental && rawPrompt.length > 5000) {
        return res.status(400).json({ error: `Les paroles dépassent la limite de 5000 caractères (${rawPrompt.length}/5000).` });
      }

      const { finalStyle, vocalGender } = applyVocalToStyle(rawStyle, String(body.vocalGender || ''));
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

      const result = await callKiePost('/generate', apiKey, payload);
      if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw });
      return res.status(200).json({ success: true, taskId: result.taskId, data: result.data });
    }

    // 1B. REMIX / REPRISE (MÊME MÉLODIE, NOUVELLES PAROLES & NOUVELLE VOIX)
    if (req.method === 'POST' && action === 'remix') {
      const body = req.body || {};
      let uploadUrl = String(body.uploadUrl || '').trim();
      if (uploadUrl.startsWith('/')) {
        uploadUrl = `https://app.djelia.store${uploadUrl}`;
      }
      const sourceTaskId = String(body.taskId || '').trim();
      const sourceAudioId = String(body.audioId || '').trim();
      if (!uploadUrl && !(sourceTaskId && sourceAudioId)) {
        return res.status(400).json({ error: 'Fournissez une URL audio ou une chanson de votre discothèque à remixer.' });
      }
      if (uploadUrl && !uploadUrl.includes('redpandaai.co') && !uploadUrl.includes('kie.ai')) {
        try {
          const upRes = await fetch('https://kieai.redpandaai.co/api/file-url-upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl: uploadUrl, uploadPath: 'velaris/remix' }),
            signal: AbortSignal.timeout(20000),
          });
          const upJson: any = await upRes.json().catch(() => null);
          if (upJson?.data?.downloadUrl) {
            uploadUrl = String(upJson.data.downloadUrl);
          }
        } catch {
          // Repli sur uploadUrl original
        }
      }
      const rawTitle = stripEmojis(String(body.title || 'Remix Studio')).slice(0, 80);
      const rawPrompt = stripEmojis(String(body.prompt || body.lyrics || '')).slice(0, 5000);
      const instrumental = Boolean(body.instrumental) || !rawPrompt;
      const { finalStyle, vocalGender } = applyVocalToStyle(String(body.style || 'Afro-Love acoustique'), String(body.vocalGender || ''));

      const payload: Record<string, any> = {
        ...(uploadUrl ? { uploadUrl } : { taskId: sourceTaskId, audioId: sourceAudioId }),
        prompt: rawPrompt,
        style: finalStyle,
        title: rawTitle,
        customMode: true,
        instrumental,
        model: String(body.model || 'V6'),
        callBackUrl: CALLBACK_URL,
      };
      if (vocalGender && !instrumental) payload.vocalGender = vocalGender;

      const result = await callKiePost('/generate/upload-cover', apiKey, payload);
      if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw });
      return res.status(200).json({ success: true, taskId: result.taskId, data: result.data });
    }

    // 1C. PROLONGER UN MORCEAU (EXTEND)
    if (req.method === 'POST' && action === 'extend') {
      const body = req.body || {};
      const audioId = String(body.audioId || '').trim();
      if (!audioId) return res.status(400).json({ error: 'Identifiant audio manquant pour prolonger le morceau.' });
      const continueAt = Math.max(5, Number(body.continueAt || 120));
      const { finalStyle } = applyVocalToStyle(String(body.style || 'Afro-Love'), String(body.vocalGender || ''));
      const payload: Record<string, any> = {
        audioId,
        defaultParamFlag: true,
        continueAt,
        prompt: stripEmojis(String(body.prompt || '')).slice(0, 5000),
        style: finalStyle,
        title: stripEmojis(String(body.title || 'Suite Studio')).slice(0, 80),
        model: String(body.model || 'V6'),
        callBackUrl: CALLBACK_URL,
      };
      const result = await callKiePost('/generate/extend', apiKey, payload);
      if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw });
      return res.status(200).json({ success: true, taskId: result.taskId, data: result.data });
    }

    // 1D. CORRIGER UN PASSAGE (REPLACE SECTION)
    if (req.method === 'POST' && action === 'replace-section') {
      const body = req.body || {};
      const taskId = String(body.taskId || '').trim();
      const audioId = String(body.audioId || '').trim();
      const infillStartS = Number(body.infillStartS);
      const infillEndS = Number(body.infillEndS);
      if (!taskId || !audioId) {
        return res.status(400).json({ error: 'Identifiants de piste requis pour corriger un passage.' });
      }
      if (!Number.isFinite(infillStartS) || !Number.isFinite(infillEndS) || infillEndS - infillStartS < 10) {
        return res.status(400).json({ error: 'La zone à corriger doit durer au moins 10 secondes (ex: 30s à 45s).' });
      }
      const { finalStyle } = applyVocalToStyle(String(body.style || 'Afro-Love'), String(body.vocalGender || ''));
      const payload: Record<string, any> = {
        taskId,
        audioId,
        infillStartS: Number(infillStartS.toFixed(2)),
        infillEndS: Number(infillEndS.toFixed(2)),
        prompt: stripEmojis(String(body.prompt || '')).slice(0, 5000),
        tags: finalStyle,
        title: stripEmojis(String(body.title || 'Correction Studio')).slice(0, 80),
        fullLyrics: stripEmojis(String(body.fullLyrics || body.prompt || '')).slice(0, 5000),
        callBackUrl: CALLBACK_URL,
      };
      const result = await callKiePost('/generate/replace-section', apiKey, payload);
      if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw });
      return res.status(200).json({ success: true, taskId: result.taskId, data: result.data });
    }

    // 1E. SÉPARATION VOIX & INSTRUMENTAL (STEMS)
    if (req.method === 'POST' && action === 'separate-vocals') {
      const { taskId, audioId } = req.body || {};
      if (!taskId || !audioId) {
        return res.status(400).json({ error: 'Identifiants de piste requis pour séparer voix et instrumental.' });
      }
      const result = await callKiePost('/vocal-removal/generate', apiKey, {
        taskId: String(taskId),
        audioId: String(audioId),
        type: 'separate_vocal',
        callBackUrl: CALLBACK_URL,
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw });
      return res.status(200).json({ success: true, taskId: result.taskId });
    }

    if (req.method === 'GET' && action === 'vocal-status') {
      const taskId = String(req.query?.taskId || '').trim();
      if (!taskId) return res.status(400).json({ error: 'taskId manquant' });
      const kieRes = await fetch(`${KIE_BASE_URL}/vocal-removal/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      const json: any = await kieRes.json().catch(() => ({}));
      return res.status(kieRes.status).json(json);
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
            ? 'Crédits de génération insuffisants pour créer la vidéo lyrics MP4.'
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

    // 5B. LECTURE & TÉLÉCHARGEMENT AUDIO SUNO DÉCHIFFRÉ (PROTOCOLE MANGO)
    if (req.method === 'GET' && action === 'suno-audio') {
      const uuid = String(req.query?.uuid || '').trim().toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
        return res.status(400).json({ error: 'UUID Suno invalide' });
      }
      const isDownload = String(req.query?.download || '') === '1';
      const rawTitle = String(req.query?.title || `chanson_${uuid.slice(0, 8)}`)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._ -]/g, '_')
        .trim()
        .slice(0, 80) || 'chanson_suno';

      const decoded = await decryptSunoMangoAudio(uuid);
      if (!decoded) {
        return res.status(404).json({ error: 'Audio Suno introuvable ou protégé' });
      }

      res.setHeader('Content-Type', decoded.mimeType);
      res.setHeader('Content-Length', decoded.buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader(
        'Content-Disposition',
        isDownload
          ? `attachment; filename="${rawTitle}.${decoded.ext}"`
          : `inline; filename="${rawTitle}.${decoded.ext}"`
      );
      return res.status(200).send(decoded.buffer);
    }

    // 6. TÉLÉCHARGEMENT FORCÉ SANS OUVERTURE D'ONGLET
    if (req.method === 'GET' && action === 'download') {
      const targetUrl = String(req.query?.url || '').trim();
      const rawFilename = String(req.query?.filename || 'chanson_djelia.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ error: 'URL invalide' });
      }

      const upstream = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(30000),
      });
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
