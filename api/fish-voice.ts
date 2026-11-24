import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

function getFishApiKey(): string {
  let key = process.env.FISH_API_KEY || process.env.VITE_FISH_API_KEY || '';
  if (!key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m && (m[1].trim() === 'FISH_API_KEY' || m[1].trim() === 'VITE_FISH_API_KEY')) {
            key = m[2].trim();
            if (key) break;
          }
        }
      }
    } catch {}
  }
  return key || 'sk-fish-rqWm8BgYyKZROEpKmgfZYfwpDp6x6cKy6oDCDncbq-w';
}

export default async function handler(req: any, res: any) {
  // En-têtes CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
  }

  const { text, reference_id, voiceId, format = 'mp3' } = req.body || {};
  const cleanText = (text || '').trim();

  if (!cleanText) {
    return res.status(400).json({ error: 'Le texte est requis pour la synthèse vocale.' });
  }

  const targetVoice = reference_id || voiceId || '9bdcf5be57564499848e4ac474f365d5';
  const apiKey = getFishApiKey();

  try {
    const fishRes = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        model: 's2.1-pro-free',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        reference_id: targetVoice,
        format: format === 'opus' ? 'opus' : 'mp3',
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!fishRes.ok) {
      const errText = await fishRes.text().catch(() => '');
      return res.status(fishRes.status).json({
        error: `Erreur Fish Audio HTTP ${fishRes.status}: ${errText.slice(0, 300)}`,
      });
    }

    const arrayBuffer = await fishRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', format === 'opus' ? 'audio/ogg; codecs=opus' : 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Erreur interne lors de la synthèse vocale Fish Audio.',
    });
  }
}
