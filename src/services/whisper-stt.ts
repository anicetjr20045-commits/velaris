/**
 * Service de transcription audio Whisper en temps réel
 * Connecté au moteur Whisper du VPS Contabo (port 5001 / Caddy /api/stt/transcribe)
 */

export interface TranscriptionResult {
  text: string;
  language: string;
  durationMs?: number;
}

export async function transcribeAudioBlob(blob: Blob): Promise<TranscriptionResult> {
  const startTime = performance.now();
  const formData = new FormData();
  
  // Utilise un nom cohérent avec le type MIME réel
  const mimeType = blob.type || 'audio/ogg';
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('wav') ? 'wav' : 'ogg';
  formData.append('audio', blob, `recording.${ext}`);

  const endpoints = [
    'https://waha.velarisagent.life/api/stt/transcribe',
    '/api/stt/transcribe'
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Whisper HTTP ${res.status}`);
      }

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);
      return {
        text: (data.text || '').trim(),
        language: data.language || 'fr',
        durationMs: elapsed,
      };
    } catch (err: any) {
      lastError = err;
      // Essayer endpoint suivant
    }
  }

  throw lastError || new Error('Impossible de contacter le serveur Whisper');
}
