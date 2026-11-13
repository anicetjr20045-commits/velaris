/**
 * Service de clonage vocal Fish Audio (modèle gratuit s2.1-pro-free)
 * et gestionnaire du mode Brouillon WhatsApp (Studio Voix Féminine Sœur).
 *
 * Permet au gérant, depuis sa conversation brouillon / note à soi-même ou toute discussion dédiée :
 * 1. D'armer le mode avec /vocal ou /on
 * 2. De recevoir instantanément tout texte envoyé sous forme de note vocale WhatsApp native (PTT)
 * 3. De recevoir instantanément toute note vocale qu'il enregistre transcrite puis resynthétisée avec la voix de la sœur
 * 4. D'exécuter des synthèses directes one-shot via /vocal <texte>
 * 5. De désactiver le mode avec /stop ou /off pour que la discussion redevienne normale
 */

import { encode } from '@msgpack/msgpack';
import fs from 'node:fs';
import path from 'node:path';
import type { WahaClient } from '../send/waha-client.js';
import type { AudioTranscriber } from './transcribe.js';
import type { NormalizedEvent } from '../ingest/normalize.js';

export interface VoiceClonerOpts {
  apiKey?: string | undefined;
  referencePath?: string | undefined;
  model?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;
}

export class VoiceClonerService {
  private readonly apiKey: string;
  private referenceBuffer: Buffer;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;

  constructor(opts: VoiceClonerOpts = {}) {
    this.apiKey = opts.apiKey || process.env.FISH_API_KEY || 'sk-fish-rqWm8BgYyKZROEpKmgfZYfwpDp6x6cKy6oDCDncbq-w';
    this.model = opts.model || 's2.1-pro-free';
    this.fetchImpl = opts.fetchImpl || fetch;
    this.log = opts.log;

    this.referenceBuffer = Buffer.alloc(0);
    this.loadReferenceAudio(opts.referencePath);
  }

  private loadReferenceAudio(customPath?: string): void {
    const candidates = [
      customPath,
      path.resolve(process.cwd(), 'src/assets/sample_sister_reference.mp3'),
      path.resolve(process.cwd(), 'dist/src/assets/sample_sister_reference.mp3'),
      '/root/projets/velaris/engine/src/assets/sample_sister_reference.mp3',
      '/app/src/assets/sample_sister_reference.mp3',
      '/srv/qr/assets/sample_sister_reference.mp3',
    ].filter((p): p is string => Boolean(p));

    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand)) {
          this.referenceBuffer = fs.readFileSync(cand);
          this.log?.('VoiceCloner reference audio loaded', { path: cand, bytes: this.referenceBuffer.length });
          return;
        }
      } catch {
        // continue
      }
    }

    this.log?.('VoiceCloner WARNING: reference audio file not found in candidates', { candidates });
  }

  /**
   * Synthétise un texte avec la voix de la sœur en appelant Fish Audio TTS (s2.1-pro-free).
   * Retourne le buffer binaire OGG/Opus natif WhatsApp.
   */
  async synthesize(text: string): Promise<Buffer> {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Texte vide pour la synthèse vocale');
    }
    if (!this.referenceBuffer || this.referenceBuffer.length === 0) {
      throw new Error('Fichier audio de référence introuvable');
    }

    const payload = {
      text: cleanText,
      references: [
        {
          audio: new Uint8Array(this.referenceBuffer),
          text: '',
        },
      ],
      format: 'opus',
    };

    const packed = encode(payload);

    const res = await this.fetchImpl('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        model: this.model,
        'Content-Type': 'application/msgpack',
      },
      body: packed,
      signal: AbortSignal.timeout(35_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Fish Audio TTS HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }
}

export interface DraftClonerManagerOpts {
  cloner: VoiceClonerService;
  storagePath?: string | undefined;
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;
}

export class DraftClonerManager {
  private readonly armedChats = new Set<string>();
  private readonly storagePath?: string | undefined;
  private readonly cloner: VoiceClonerService;
  private readonly log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;

  constructor(opts: DraftClonerManagerOpts) {
    this.cloner = opts.cloner;
    this.storagePath = opts.storagePath;
    this.log = opts.log;

    this.loadState();
  }

  private loadState(): void {
    if (!this.storagePath) return;
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        if (Array.isArray(data)) {
          for (const id of data) {
            if (typeof id === 'string') this.armedChats.add(id);
          }
        }
      }
    } catch (err: any) {
      this.log?.('DraftClonerManager loadState error', { error: err.message });
    }
  }

  private persistState(): void {
    if (!this.storagePath) return;
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(Array.from(this.armedChats)), 'utf8');
    } catch (err: any) {
      this.log?.('DraftClonerManager persistState error', { error: err.message });
    }
  }

  isArmed(chatId: string): boolean {
    return this.armedChats.has(chatId);
  }

  arm(chatId: string): void {
    this.armedChats.add(chatId);
    this.persistState();
  }

  disarm(chatId: string): void {
    this.armedChats.delete(chatId);
    this.persistState();
  }

  /**
   * Traite un message dans une discussion brouillon si une commande ou si le mode armé est actif.
   * Retourne handled: true si le message a été absorbé et répondu.
   */
  async handleDraftMessage(
    ev: NormalizedEvent,
    waha?: WahaClient,
    transcriber?: AudioTranscriber
  ): Promise<{ handled: boolean; outcome?: string }> {
    if (ev.kind !== 'message' || !waha) {
      return { handled: false };
    }

    const rawBody = typeof ev.body === 'string' ? ev.body.trim() : '';
    const lowerBody = rawBody.toLowerCase();

    // 1. Commande d'activation : /vocal ou /on
    if (lowerBody === '/vocal' || lowerBody === '/on' || lowerBody === '#vocal' || lowerBody === '!vocal') {
      this.arm(ev.chatId);
      await waha.send(ev.session, ev.chatId, {
        kind: 'text',
        text: '🟢 *Mode Voix Féminine activé.*\n\nTout message texte ou vocal envoyé dans cette discussion sera automatiquement transformé en note vocale WhatsApp avec la voix de la sœur.\n\n_Tapez /stop ou /off pour désactiver à tout moment._',
      });
      return { handled: true, outcome: 'draft_armed' };
    }

    // 2. Commande de désactivation : /stop ou /off
    if (lowerBody === '/stop' || lowerBody === '/off' || lowerBody === '#stop' || lowerBody === '!stop' || lowerBody === '/cancel') {
      this.disarm(ev.chatId);
      await waha.send(ev.session, ev.chatId, {
        kind: 'text',
        text: '🔴 *Mode Voix Féminine désactivé.*\n\nLa discussion redevient un brouillon normal.',
      });
      return { handled: true, outcome: 'draft_disarmed' };
    }

    // 3. Commande d'aide ou de statut : /aide ou /help ou /statut
    if (lowerBody === '/aide' || lowerBody === '/help' || lowerBody === '/statut') {
      const active = this.isArmed(ev.chatId);
      await waha.send(ev.session, ev.chatId, {
        kind: 'text',
        text: active
          ? '🟢 *Mode Voix Féminine : ACTIF*\n\nCommandes disponibles :\n• Envoyez du texte ou un vocal pour générer la voix\n• /vocal <texte> : Synthèse one-shot\n• /stop ou /off : Désactiver le mode'
          : '⚪ *Mode Voix Féminine : INACTIF*\n\nCommandes disponibles :\n• /vocal ou /on : Activer le mode automatique\n• /vocal <texte> : Synthèse one-shot sans armer',
      });
      return { handled: true, outcome: 'draft_status' };
    }

    // 4. Synthèse directe one-shot : /vocal <texte> ou /voice <texte>
    if (lowerBody.startsWith('/vocal ') || lowerBody.startsWith('/voice ')) {
      const promptText = rawBody.slice(rawBody.indexOf(' ') + 1).trim();
      if (!promptText) {
        await waha.send(ev.session, ev.chatId, {
          kind: 'text',
          text: 'Veuillez préciser le texte à convertir : /vocal <votre texte>',
        });
        return { handled: true, outcome: 'draft_oneshot_empty' };
      }

      try {
        const audioBuf = await this.cloner.synthesize(promptText);
        await waha.send(ev.session, ev.chatId, {
          kind: 'voice',
          data: audioBuf.toString('base64'),
          mimetype: 'audio/ogg; codecs=opus',
        });
        return { handled: true, outcome: 'draft_oneshot_success' };
      } catch (err: any) {
        this.log?.('draft oneshot error', { error: err.message });
        await waha.send(ev.session, ev.chatId, {
          kind: 'text',
          text: `⚠️ Erreur de synthèse vocale : ${err.message}`,
        });
        return { handled: true, outcome: 'draft_oneshot_error' };
      }
    }

    // 5. Si le chat n'est pas armé, laisser passer le message
    if (!this.isArmed(ev.chatId)) {
      return { handled: false };
    }

    // 6. Chat ARMÉ : Traitement automatique

    // Cas 6A : L'utilisateur a envoyé une note vocale (micro)
    if (ev.mediaKind === 'audio') {
      if (!transcriber) {
        await waha.send(ev.session, ev.chatId, {
          kind: 'text',
          text: '⚠️ Service de transcription non disponible pour transcrire la note vocale.',
        });
        return { handled: true, outcome: 'draft_no_transcriber' };
      }

      try {
        // Téléchargement du vocal entrant
        const downloadedBuf = await transcriber.downloadAudio(
          ev.session,
          ev.mediaUrl ?? '',
          ev.waMessageId,
          ev.chatId
        );

        if (!downloadedBuf) {
          await waha.send(ev.session, ev.chatId, {
            kind: 'text',
            text: '⚠️ Impossible de télécharger votre note vocale.',
          });
          return { handled: true, outcome: 'draft_audio_download_failed' };
        }

        // Transcription du vocal
        const transcript = await transcriber.transcribeBuffer(downloadedBuf, ev.mediaMime ?? 'audio/ogg');
        if (!transcript || !transcript.trim()) {
          await waha.send(ev.session, ev.chatId, {
            kind: 'text',
            text: '⚠️ La transcription de votre note vocale n\'a rien donné ou est inaudible.',
          });
          return { handled: true, outcome: 'draft_audio_empty_transcript' };
        }

        // Synthèse avec la voix de la sœur
        const synthesizedBuf = await this.cloner.synthesize(transcript);
        await waha.send(ev.session, ev.chatId, {
          kind: 'voice',
          data: synthesizedBuf.toString('base64'),
          mimetype: 'audio/ogg; codecs=opus',
        });

        return { handled: true, outcome: 'draft_audio_transformed' };
      } catch (err: any) {
        this.log?.('draft audio transform error', { error: err.message });
        await waha.send(ev.session, ev.chatId, {
          kind: 'text',
          text: `⚠️ Erreur lors de la transformation vocale : ${err.message}`,
        });
        return { handled: true, outcome: 'draft_audio_error' };
      }
    }

    // Cas 6B : L'utilisateur a envoyé un message texte
    if (rawBody) {
      try {
        const synthesizedBuf = await this.cloner.synthesize(rawBody);
        await waha.send(ev.session, ev.chatId, {
          kind: 'voice',
          data: synthesizedBuf.toString('base64'),
          mimetype: 'audio/ogg; codecs=opus',
        });
        return { handled: true, outcome: 'draft_text_transformed' };
      } catch (err: any) {
        this.log?.('draft text transform error', { error: err.message });
        await waha.send(ev.session, ev.chatId, {
          kind: 'text',
          text: `⚠️ Erreur de synthèse vocale : ${err.message}`,
        });
        return { handled: true, outcome: 'draft_text_error' };
      }
    }

    return { handled: false };
  }
}
