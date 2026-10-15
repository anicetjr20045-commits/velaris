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
 * Moteur d'enrichissement acoustique professionnel pour Suno V6.
 * Transforme les styles bruts en prompts calibrés avec instruments réels,
 * tempo (BPM), timbre et texture studio.
 * Basé sur l'ADN musical Velaris et le référentiel des styles Suno V6.
 */
export function optimizeSunoStylePrompt(
  rawStyle?: string | null,
  voice?: 'male' | 'female' | 'duo' | string | null,
): string {
  const s = (rawStyle || '').trim().toLowerCase();
  const v = (voice || '').trim().toLowerCase();

  // 1. Timbre vocal riche et naturel
  let vocalTag = 'warm soulful vocal';
  if (v === 'female' || v.includes('femme') || v.includes('féminine') || s.includes('femme') || s.includes('féminine') || s.includes('voix féminine')) {
    vocalTag = 'warm soulful female lead vocal, expressive and clear';
  } else if (v === 'male' || v.includes('homme') || v.includes('masculin') || s.includes('homme') || s.includes('masculin') || s.includes('voix masculine')) {
    vocalTag = 'warm soulful male lead vocal, rich tone';
  } else if (v === 'duo' || v.includes('duo') || s.includes('duo')) {
    vocalTag = 'male and female duet, tender vocal harmonies';
  }

  // 2. Base instrumentale acoustique ouest-africaine
  let acousticBase: string;

  if (s.includes('gospel') || s.includes('louange') || s.includes('priere') || s.includes('prière') || s.includes('chretien') || s.includes('chrétien')) {
    acousticBase = 'African gospel, warm organ, uplifting choir, hand claps, emotional praise, 96 bpm';
  } else if (s.includes('zouk')) {
    acousticBase = 'Zouk love, smooth acoustic guitar, soft synth pads, gentle drums, tender ballad, 90 bpm';
  } else if (s.includes('rumba')) {
    acousticBase = 'Congolese rumba, clean electric guitar arpeggios, melodic bassline, authentic acoustic groove, 88 bpm';
  } else if (s.includes('mandingue') || s.includes('kora') || s.includes('balafon') || s.includes('tradition')) {
    acousticBase = 'Manding acoustic, kora and balafon undertones, acoustic guitar, soulful West African storytelling, 82 bpm';
  } else if (s.includes('afrobeat') || s.includes('afropop') || s.includes('afro-pop')) {
    acousticBase = 'Afropop, acoustic guitar, soft percussion, emotional melody, gentle West African groove, 92 bpm';
  } else if (s.includes('ballade') || s.includes('calme') || s.includes('intime') || s.includes('piano')) {
    acousticBase = 'Acoustic guitar ballad, soft piano, warm shaker, intimate and heartfelt, 80 bpm';
  } else if (s.includes('ambiance') || s.includes('fete') || s.includes('fête') || s.includes('danse') || s.includes('rythme')) {
    acousticBase = 'Joyful Afropop celebration, rhythmic acoustic guitar, uplifting West African percussion, 104 bpm';
  } else if (rawStyle && rawStyle.trim().length > 2 && !rawStyle.toLowerCase().includes('défaut') && !rawStyle.toLowerCase().includes('auto')) {
    acousticBase = `${rawStyle.trim()}, acoustic guitar, gentle West African percussion, emotional melody, 85 bpm`;
  } else {
    // Style de prédilection maison : Afro-love acoustique Velaris
    acousticBase = 'Afro-love, acoustic guitar, gentle West African percussion, romantic ballad, emotional, 85 bpm';
  }

  // 3. Finition mastering acoustique studio
  const studioMastering = 'studio acoustic recording, clean mix';

  return `${acousticBase}, ${vocalTag}, ${studioMastering}`.slice(0, 1000);
}

export async function generateKieSong(
  apiKey: string,
  input: KieSongInput,
  fetchImpl: typeof fetch = fetch,
): Promise<KieGenerateResponse> {
  const lyrics = formatLyricsForSuno(input.lyrics);
  const fullStyle = optimizeSunoStylePrompt(input.style, input.voice);
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
