/**
 * Service de transcription audio haute fidélité pour les notes vocales WhatsApp.
 * Utilise le modèle multimodal Gemini 3.8 Flash via l'API native Kie.ai.
 *
 * Spécifications :
 *  - Télécharge le flux audio brut (OGG/Opus) depuis WAHA avec authentification X-Api-Key.
 *  - Envoie les octets base64 inlineData (audio/ogg) directement à Gemini sans transcodage.
 *  - Transcrit fidèlement le français ouest-africain / ivoirien / burkinabè sans fioritures.
 *  - Met à jour atomiquement la table messages via agent_set_transcript.
 */

import type { Db } from '../db/rest.js';

export interface AudioTranscriberOpts {
  wahaUrl: string;
  wahaApiKey: string;
  kieApiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  db?: Db | undefined;
  log?: ((msg: string, data?: Record<string, unknown>) => void) | undefined;
}

export class AudioTranscriber {
  private readonly wahaUrl: string;
  private readonly wahaApiKey: string;
  private readonly kieApiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly db?: Db | undefined;
  private readonly log?: ((msg: string, data?: Record<string, unknown>) => void) | undefined;

  constructor(opts: AudioTranscriberOpts) {
    this.wahaUrl = opts.wahaUrl.replace(/\/$/, '');
    this.wahaApiKey = opts.wahaApiKey;
    this.kieApiKey = opts.kieApiKey;
    this.model = opts.model ?? 'gemini-3-8-flash';
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
        // Réécrit pour pointer vers l'instance WAHA configurée
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

      // Si 404 (ex: fichier purgé du cache temporaire WAHA) et que nous disposons de chatId et waMessageId,
      // on demande à WAHA de recharger le média depuis les serveurs WhatsApp
      if (res.status === 404 && chatId && waMessageId) {
        try {
          const reloadUrl = `${this.wahaUrl}/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(waMessageId)}?downloadMedia=true`;
          const reloadRes = await this.fetchImpl(reloadUrl, {
            method: 'GET',
            headers: { 'X-Api-Key': this.wahaApiKey, Accept: 'application/json' },
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (reloadRes.ok) {
            const msgData = await reloadRes.json() as { media?: { url?: string } };
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
   * Transcrit fidèlement un tampon audio via l'API native Gemini de Kie.ai.
   */
  async transcribeBuffer(buffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string | null> {
    try {
      const lower = mimeType.toLowerCase();
      let cleanMime = 'audio/ogg';
      if (lower.includes('mp4') || lower.includes('m4a')) cleanMime = 'audio/mp4';
      else if (lower.includes('mp3') || lower.includes('mpeg')) cleanMime = 'audio/mp3';
      else if (lower.includes('wav')) cleanMime = 'audio/wav';

      const base64 = buffer.toString('base64');
      const endpoint = `https://api.kie.ai/gemini/v1/models/${this.model}:generateContent`;

      const prompt = "Transcris fidèlement ce message vocal WhatsApp en français. Renvoie uniquement le texte transcrit brut, sans aucun commentaire, sans guillemets, sans formule d'introduction ni de conclusion.";

      const res = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.kieApiKey}`,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.log?.('gemini transcription http error', { status: res.status, body: text.slice(0, 200) });
        return null;
      }

      const json = await res.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText || typeof rawText !== 'string') {
        this.log?.('gemini transcription empty output', { json });
        return null;
      }

      let cleaned = rawText.trim();
      // Retirer les guillemets englobants si l'IA en a ajouté
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('«') && cleaned.endsWith('»'))) {
        cleaned = cleaned.slice(1, -1).trim();
      }

      return cleaned || null;
    } catch (err) {
      this.log?.('gemini transcription error', { error: (err as Error).message });
      return null;
    }
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
    chatId?: string
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

      const transcript = await this.transcribeBuffer(buffer);
      if (transcript) {
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
