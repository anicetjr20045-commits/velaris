/**
 * Service de production musicale Suno V6 via Kie.ai et livraison WhatsApp.
 *
 * Déclenché par la réaction emoji 🎵 (confirm_and_produce).
 * - Formate les paroles selon les conventions Suno V6 ([Verse], [Chorus]...)
 * - Envoie la requête de génération à l'API officielle Kie.ai (POST /generate)
 * - Suit la génération en arrière-plan via polling périodique (record-info)
 * - Dès que le morceau est prêt :
 *     1. Fait progresser la commande vers 'delivery_sent' (agent_transition_order)
 *     2. Met en file WhatsApp (outbox) la note vocale pour livraison au client
 * - Respecte strictement la protection des sessions sensibles (ex: anicet2)
 */

import type { Db } from '../db/rest.js';

export const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';

export interface KieSongInput {
  lyrics: string;
  voice?: 'male' | 'female' | 'duo' | string | null | undefined;
  style?: string | null | undefined;
  title?: string | null | undefined;
  orderId?: string | null | undefined;
}

export interface KieGenerateResponse {
  success: boolean;
  taskId?: string | undefined;
  error?: string | undefined;
}

export interface KiePollResponse {
  status: 'pending' | 'running' | 'success' | 'failed';
  audioUrl?: string | undefined;
  duration?: number | undefined;
  error?: string | undefined;
}

/**
 * Met des paroles rédigées au format attendu par Suno V6 :
 * sections entre crochets ([Verse 1], [Chorus]…), métadonnées retirées, longueur bornée.
 */
export function formatLyricsForSuno(raw: string): string {
  const SECTION: [RegExp, string][] = [
    [/^\(?\s*couplet\s*(\d*)\s*\)?$/i, 'Verse'],
    [/^\(?\s*refrain\s*\)?$/i, 'Chorus'],
    [/^\(?\s*pont\s*\)?$/i, 'Bridge'],
    [/^\(?\s*outro\s*\)?$/i, 'Outro'],
    [/^\(?\s*intro\s*\)?$/i, 'Intro'],
  ];
  return raw
    .split('\n')
    .filter((line) => !/^\[(titre|style|voix)\s*:/i.test(line.trim()))
    .map((line) => {
      const t = line.trim();
      for (const [re, tag] of SECTION) {
        const m = re.exec(t);
        if (m) return `[${tag}${m[1] ? ` ${m[1]}` : ''}]`;
      }
      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4900);
}

/**
 * Lance la génération d'un morceau Suno V6 sur l'API Kie.ai
 */
export async function generateKieSong(
  apiKey: string,
  input: KieSongInput,
  fetchImpl: typeof fetch = fetch,
): Promise<KieGenerateResponse> {
  const lyrics = formatLyricsForSuno(input.lyrics);
  const voiceHint = input.voice ? (input.voice === 'female' ? 'voix féminine' : input.voice === 'male' ? 'voix masculine' : 'voix duo') : null;
  const rawStyle = input.style || 'Afropop doux';
  const fullStyle = [rawStyle, voiceHint].filter(Boolean).join(', ').slice(0, 1000);
  const title = (input.title || 'Chanson personnalisée').slice(0, 80);

  try {
    const res = await fetchImpl(`${KIE_API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: lyrics,
        style: fullStyle,
        title,
        customMode: true,
        instrumental: false,
        model: 'V6',
        callBackUrl: 'https://waha.velarisagent.life/api/suno-callback',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: { taskId?: string };
    } | null;

    if (!res.ok || !json || json.code !== 200 || !json.data?.taskId) {
      const errMsg = json?.msg || `HTTP ${res.status}`;
      return { success: false, error: `Kie generate failed: ${errMsg}` };
    }

    return { success: true, taskId: String(json.data.taskId) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Interroge l'état d'avancement d'une tâche Suno V6
 */
export async function pollKieSongStatus(
  apiKey: string,
  taskId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KiePollResponse> {
  try {
    const res = await fetchImpl(`${KIE_API_BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: {
        status?: string;
        errorMessage?: string;
        failReason?: string;
        response?: { sunoData?: Array<{ audioUrl?: string; audio_url?: string; streamAudioUrl?: string; duration?: number }> };
        sunoData?: Array<{ audioUrl?: string; audio_url?: string; streamAudioUrl?: string; duration?: number }>;
      };
    } | null;

    if (!res.ok || !json || json.code !== 200) {
      return { status: 'pending', error: json?.msg || `HTTP ${res.status}` };
    }

    const data = json.data;
    if (!data) return { status: 'pending' };

    const rawStatus = String(data.status || '').toUpperCase();
    const sunoData = data.response?.sunoData || data.sunoData || [];

    if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETE') {
      const firstTrack = Array.isArray(sunoData) && sunoData.length > 0 ? sunoData[0] : null;
      const audioUrl = firstTrack?.audioUrl || firstTrack?.audio_url || firstTrack?.streamAudioUrl;
      const duration = firstTrack?.duration ? Math.round(Number(firstTrack.duration)) : 180;
      return { status: 'success', audioUrl: audioUrl || undefined, duration };
    }

    if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
      return { status: 'failed', error: data.errorMessage || data.failReason || 'generation_interrupted' };
    }

    return { status: 'running' };
  } catch (err) {
    return { status: 'pending', error: (err as Error).message };
  }
}

export interface BackgroundProductionOpts {
  apiKey: string;
  db: Db;
  orderId: string;
  userId: string;
  conversationId: string;
  sessionName: string;
  chatId: string;
  title: string;
  style: string;
  voice?: string | null | undefined;
  lyrics: string;
  protectedSessions?: readonly string[] | undefined;
  log: (line: string, data?: Record<string, unknown>) => void;
}

/**
 * Lance la production en arrière-plan et gère la livraison WhatsApp dès finalisation.
 */
export async function startBackgroundProduction(opts: BackgroundProductionOpts): Promise<void> {
  const { apiKey, db, orderId, userId, conversationId, sessionName, chatId, title, style, voice, lyrics, protectedSessions = [], log } = opts;

  log('🎵 starting music production via Kie.ai Suno V6', { orderId, style, voice });

  const gen = await generateKieSong(apiKey, { lyrics, voice, style, title, orderId });
  if (!gen.success || !gen.taskId) {
    log('🎵 Kie music generation launch failed', { orderId, error: gen.error });
    return;
  }

  const taskId = gen.taskId;
  log('🎵 Kie taskId obtained, polling started', { orderId, taskId });

  // Boucle de polling (toutes les 10s jusqu'à 8 minutes max)
  const maxPolls = 48; // 48 * 10s = 480s = 8 min
  let polls = 0;

  const poller = setInterval(async () => {
    polls++;
    if (polls > maxPolls) {
      clearInterval(poller);
      log('🎵 Kie polling timed out after 8 minutes', { orderId, taskId });
      return;
    }

    try {
      const pollRes = await pollKieSongStatus(apiKey, taskId);
      if (pollRes.status === 'running' || pollRes.status === 'pending') {
        return; // continue polling
      }

      clearInterval(poller);

      if (pollRes.status === 'failed') {
        log('🎵 Kie generation failed', { orderId, taskId, error: pollRes.error });
        return;
      }

      if (pollRes.status === 'success' && pollRes.audioUrl) {
        const audioUrl = pollRes.audioUrl;
        const duration = pollRes.duration || 180;
        log('🎵 Kie generation SUCCEEDED!', { orderId, taskId, audioUrl, duration });

        // A. Avancer la commande vers delivered
        const currentOrders = await db.queryTable?.<Array<{ version: number; stage: string }>>(
          'orders',
          `id=eq.${orderId}&select=version,stage&limit=1`,
        ).catch(() => []);
        const curOrder = currentOrders?.[0];
        if (curOrder) {
          await db.rpc('agent_transition_order', {
            p_order: orderId,
            p_expected_version: curOrder.version,
            p_track: 'creative',
            p_event: 'delivery_sent',
            p_actor: 'system',
            p_turn: null,
            p_data: { via: 'kie_music_completion', taskId, audioUrl },
            p_inferred: false,
          }).catch(() => undefined);
        }

        // B. Livraison sur WhatsApp au client si la session n'est pas protégée
        if (protectedSessions.includes(sessionName)) {
          log('🎵 delivery skipped: session is protected', { session: sessionName });
          return;
        }

        const caption = `Votre chanson personnalisée « *${title}* » (${style}) vient de sortir du studio ! Bonne écoute 🎵`;

        await db.rpc('agent_enqueue_outbox', {
          p_user: userId,
          p_conversation: conversationId,
          p_order: orderId,
          p_turn: null,
          p_origin: 'delivery',
          p_kind: 'voice',
          p_purpose: 'song_delivery',
          p_is_relay: false,
          p_session: sessionName,
          p_chat_id: chatId,
          p_body: null,
          p_media_path: audioUrl,
          p_caption: caption,
          p_idempotency_key: `song_delivery_audio_${orderId}_${taskId}`,
          p_status: 'pending',
        }).catch((e) => log('failed to enqueue audio delivery', { error: (e as Error).message }));

        log('🎵 song delivery enqueued to outbox', { orderId, chatId });
      }
    } catch (err) {
      log('🎵 error in polling tick', { error: (err as Error).message });
    }
  }, 10_000);
}
