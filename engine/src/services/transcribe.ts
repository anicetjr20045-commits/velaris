/**
 * Service de transcription audio haute fidélité pour les notes vocales WhatsApp.
 * Utilise le modèle multimodal fiable et économique Gemini 3.6 Flash via Kie.ai (OpenAI-compatible).
 * Fallback résilient sur Faster-Whisper local si disponible.
 */

import { spawn } from 'node:child_process';
import type { Db } from '../db/rest.js';

export interface AudioTranscriberOpts {
  wahaUrl: string;
  wahaApiKey: string;
  sttUrl?: string | undefined;
  kieApiKey?: string | undefined;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  db?: Db | undefined;
  log?: ((msg: string, data?: Record<string, unknown>) => void) | undefined;
}

/**
 * Transcode un buffer audio (OGG Opus de WhatsApp) en MP3 léger en mémoire via ffmpeg.
 */
export async function convertAudioToMp3(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-i', 'pipe:0',
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '32k',
      '-f', 'mp3',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ff.on('error', (err) => reject(err));
    ff.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg a quitté avec le code ${code}`));
      }
    });

    ff.stdin.write(inputBuffer);
    ff.stdin.end();
  });
}

export class AudioTranscriber {
  private readonly wahaUrl: string;
  private readonly wahaApiKey: string;
  private readonly sttUrl?: string | undefined;
  private readonly kieApiKey?: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly db?: Db | undefined;
  private readonly log?: ((msg: string, data?: Record<string, unknown>) => void) | undefined;

  constructor(opts: AudioTranscriberOpts) {
    this.wahaUrl = opts.wahaUrl.replace(/\/$/, '');
    this.wahaApiKey = opts.wahaApiKey;
    this.sttUrl = opts.sttUrl ? opts.sttUrl.replace(/\/$/, '') : undefined;
    this.kieApiKey = opts.kieApiKey;
    this.model = opts.model ?? 'gemini-3-6-flash';
    this.timeoutMs = opts.timeoutMs ?? 25_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.db = opts.db;
    this.log = opts.log;
  }

  /**
   * Télécharge le média audio depuis WAHA en réécrivant si nécessaire l'hôte
   * pour utiliser l'URL interne du réseau Docker (ex: http://waha:3000).
   */
  async downloadAudio(session: string, mediaUrl: string, waMessageId?: string, chatId?: string): Promise<Buffer | null> {
    try {
      let targetUrl = mediaUrl;
      try {
        const parsed = new URL(mediaUrl);
        targetUrl = `${this.wahaUrl}${parsed.pathname}${parsed.search}`;
      } catch {
        if (!mediaUrl.startsWith('http')) {
          const slash = mediaUrl.startsWith('/') ? '' : '/';
          targetUrl = `${this.wahaUrl}${slash}${mediaUrl}`;
        }
      }

      let res = await this.fetchImpl(targetUrl, {
        method: 'GET',
        headers: { 'X-Api-Key': this.wahaApiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (res.status === 404 && chatId && waMessageId) {
        try {
          const reloadUrl = `${this.wahaUrl}/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(waMessageId)}?downloadMedia=true`;
          const reloadRes = await this.fetchImpl(reloadUrl, {
            method: 'GET',
            headers: { 'X-Api-Key': this.wahaApiKey, Accept: 'application/json' },
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (reloadRes.ok) {
            const msgData = (await reloadRes.json()) as { media?: { url?: string } };
            if (msgData.media?.url) {
              const freshUrl = new URL(msgData.media.url);
              targetUrl = `${this.wahaUrl}${freshUrl.pathname}${freshUrl.search}`;
              res = await this.fetchImpl(targetUrl, {
                method: 'GET',
                headers: { 'X-Api-Key': this.wahaApiKey },
                signal: AbortSignal.timeout(this.timeoutMs),
              });
            }
          }
        } catch {
          // Ignoré, repli sur l'échec initial
        }
      }

      if (!res.ok) {
        this.log?.('audio download failed', { targetUrl, status: res.status });
        return null;
      }

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length === 0) return null;
      return buf;
    } catch (err) {
      this.log?.('audio download error', { error: (err as Error).message, mediaUrl });
      return null;
    }
  }

  /**
   * Transcription via l'API Kie.ai avec modèle multimodal économique (Gemini 3.6 Flash).
   * Utilise le streaming SSE conforme OpenAI et la structure Unified Media Structure.
   */
  async transcribeWithKie(buffer: Buffer, mimeType: string): Promise<string | null> {
    if (!this.kieApiKey) return null;

    try {
      const lower = mimeType.toLowerCase();
      let audioBuffer = buffer;
      let targetMime = 'audio/mp3';

      if (lower.includes('wav')) {
        targetMime = 'audio/wav';
      } else if (lower.includes('mp3') || lower.includes('mpeg')) {
        targetMime = 'audio/mp3';
      } else {
        // OGG/Opus WhatsApp -> conversion MP3
        try {
          audioBuffer = await convertAudioToMp3(buffer);
          targetMime = 'audio/mp3';
        } catch (convErr) {
          this.log?.('transcribeWithKie audio conversion error, attempting raw buffer', {
            error: (convErr as Error).message,
          });
        }
      }

      const base64 = audioBuffer.toString('base64');
      const dataUri = `data:${targetMime};base64,${base64}`;
      const endpoint = `https://api.kie.ai/${this.model}-openai/v1/chat/completions`;

      const prompt = "Transcris fidèlement ce message vocal WhatsApp en français. Renvoie uniquement le texte transcrit brut, sans aucun commentaire, sans guillemets, sans formule d'introduction ni de conclusion.";

      const res = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.kieApiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUri } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.log?.('kie stt http error', { status: res.status, body: text.slice(0, 200) });
        return null;
      }

      // Lecture du flux SSE
      let fullText = '';
      if (res.body && typeof (res.body as any).getReader === 'function') {
        const reader = (res.body as any).getReader();
        const decoder = new TextDecoder();
        let sseBuf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });
          const lines = sseBuf.split('\n');
          sseBuf = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullText += delta;
            } catch {
              // chunk SSE non JSON ignoré
            }
          }
        }
      } else {
        const fullResp = await res.text().catch(() => '');
        if (fullResp.includes('data: ')) {
          const lines = fullResp.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) fullText += delta;
              } catch {}
            }
          }
        } else {
          try {
            const parsed = JSON.parse(fullResp);
            fullText = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.delta?.content || '';
          } catch {}
        }
      }

      let cleaned = fullText.trim();
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('«') && cleaned.endsWith('»'))) {
        cleaned = cleaned.slice(1, -1).trim();
      }

      if (cleaned) {
        this.log?.('kie stt transcribed successfully', {
          model: this.model,
          length: cleaned.length,
          preview: cleaned.slice(0, 50),
        });
        return cleaned;
      }
      return null;
    } catch (err) {
      this.log?.('kie stt failed', { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Transcription via le service Faster-Whisper local (repli de secours).
   */
  async transcribeWithWhisper(buffer: Buffer, mimeType: string): Promise<string | null> {
    if (!this.sttUrl) return null;
    try {
      const form = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      form.append('audio', blob, 'voice.ogg');
      const sttEndpoint = `${this.sttUrl}/transcribe`;

      const res = await this.fetchImpl(sttEndpoint, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        if (data.text && typeof data.text === 'string' && data.text.trim()) {
          let cleaned = data.text.trim();
          if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('«') && cleaned.endsWith('»'))) {
            cleaned = cleaned.slice(1, -1).trim();
          }
          if (cleaned) {
            this.log?.('whisper fallback transcribed successfully', { length: cleaned.length, preview: cleaned.slice(0, 50) });
            return cleaned;
          }
        }
      } else {
        this.log?.('whisper stt http error', { status: res.status });
      }
    } catch (sttErr) {
      this.log?.('whisper stt failed', { error: (sttErr as Error).message });
    }
    return null;
  }

  /**
   * Transcrit fidèlement un tampon audio.
   * Priorité : API Kie.ai (modèle économique Gemini 3.6 Flash).
   * Repli : Faster-Whisper local.
   */
  async transcribeBuffer(buffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string | null> {
    // 1. Priorité API Kie.ai
    if (this.kieApiKey) {
      const kieResult = await this.transcribeWithKie(buffer, mimeType);
      if (kieResult) return kieResult;
      this.log?.('kie stt unavailable or failed, attempting local whisper fallback');
    }

    // 2. Repli de secours : Faster-Whisper local
    if (this.sttUrl) {
      const whisperResult = await this.transcribeWithWhisper(buffer, mimeType);
      if (whisperResult) return whisperResult;
    }

    return null;
  }

  /**
   * Transcrit un message complet et met à jour son statut dans PostgreSQL.
   */
  async transcribeMessage(
    messageId: string,
    session: string,
    mediaUrl: string | null,
    mediaKind: string | null,
    waMessageId?: string,
    chatId?: string,
    quotedText?: string | null
  ): Promise<string | null> {
    if (mediaKind !== 'audio' || !mediaUrl) return null;

    try {
      this.log?.('transcription starting', { messageId, session, mediaUrl });
      const buffer = await this.downloadAudio(session, mediaUrl, waMessageId, chatId);
      if (!buffer) {
        if (this.db) {
          await this.db.rpc('agent_set_transcript', {
            p_message: messageId,
            p_transcript: '',
            p_status: 'failed',
            p_media_path: mediaUrl,
          }).catch(() => undefined);
        }
        return null;
      }

      let transcript = await this.transcribeBuffer(buffer);
      if (transcript) {
        if (quotedText) {
          const singleLine = quotedText.replace(/\s+/g, ' ').trim();
          if (singleLine) {
            const truncated = singleLine.length > 120 ? singleLine.slice(0, 120) + '…' : singleLine;
            transcript = `[En réponse à : "${truncated}"]
${transcript}`;
          }
        }
        if (this.db) {
          await this.db.rpc('agent_set_transcript', {
            p_message: messageId,
            p_transcript: transcript,
            p_status: 'done',
            p_media_path: mediaUrl,
          }).catch(() => undefined);
        }
        this.log?.('transcription completed', { messageId, length: transcript.length, preview: transcript.slice(0, 60) });
        return transcript;
      }

      if (this.db) {
        await this.db.rpc('agent_set_transcript', {
          p_message: messageId,
          p_transcript: '',
          p_status: 'failed',
          p_media_path: mediaUrl,
        }).catch(() => undefined);
      }
      return null;
    } catch (err) {
      this.log?.('transcribeMessage failed', { messageId, error: (err as Error).message });
      if (this.db) {
        await this.db.rpc('agent_set_transcript', {
          p_message: messageId,
          p_transcript: '',
          p_status: 'failed',
          p_media_path: mediaUrl,
        }).catch(() => undefined);
      }
      return null;
    }
  }
}
