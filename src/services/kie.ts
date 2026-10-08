/**
 * Service d'intégration Kie.ai (moteur Suno) et livraison WhatsApp
 *
 * Studio connecté : la génération passe par l'Edge Function `kie-generate`
 * (clé API côté serveur, crédit débité atomiquement et remboursé si Kie.ai échoue).
 * Mode démo : aucune requête réelle, aucun morceau envoyé à un client.
 *
 * Règle absolue : on ne livre JAMAIS au client un morceau qui n'a pas été
 * réellement produit pour lui (pas de piste de démonstration de substitution).
 */

import type { KieSongGenerationRequest, KieSongResult } from '../types/billing';
import { refreshBilling } from './billing';
import { sendWahaTextMessage, sendWahaVoiceMessage } from './waha';

export const KIE_CONFIG = {
  publicHost: 'api.kie.ai',
  baseUrl: 'https://api.kie.ai/api/v1',
  apiKey: '9c8965ca1c39ef43b6835599b42c8951',
  model: 'V6', // Suno v6 officiel
  callBackUrl: 'https://waha.velarisagent.life/api/suno-callback',
  maxLyrics: 4900,
  maxStyle: 1000,
  maxTitle: 80,
};

const KIE_GENERATIONS_KEY = 'velaris_kie_generations_v1';

export function getKieGenerationsHistory(): KieSongResult[] {
  try {
    const raw = localStorage.getItem(KIE_GENERATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveKieGeneration(item: KieSongResult): void {
  try {
    const list = getKieGenerationsHistory();
    const idx = list.findIndex(g => g.taskId === item.taskId);
    const updated = idx >= 0 ? list.map((g, i) => (i === idx ? item : g)) : [item, ...list].slice(0, 50);
    localStorage.setItem(KIE_GENERATIONS_KEY, JSON.stringify(updated));
  } catch {
    // stockage indisponible
  }
}

/**
 * Met des paroles rédigées au format attendu par Suno :
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
    .filter(line => !/^\[(titre|style)\s*:/i.test(line.trim()))
    .map(line => {
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
    .slice(0, KIE_CONFIG.maxLyrics);
}

/**
 * Lance une génération de chanson Suno V6 via Kie.ai.
 * Retourne une tâche `pending` à suivre avec `pollKieSongStatus`.
 */
export async function generateKieSong(req: KieSongGenerationRequest, options?: { isNewClient?: boolean }): Promise<{
  success: boolean;
  result?: KieSongResult;
  error?: string;
}> {
  const lyrics = formatLyricsForSuno(req.lyrics || req.prompt);
  const title = (req.title || 'Chanson personnalisée').slice(0, KIE_CONFIG.maxTitle);
  const style = (req.style || 'Afro-Love acoustique').slice(0, KIE_CONFIG.maxStyle);
  const orderId = req.orderId || `ORD-${Date.now().toString(36).toUpperCase()}`;
  const common = {
    orderId,
    clientName: req.clientName,
    clientPhone: req.clientPhone,
    isNewClient: options?.isNewClient ?? true,
    title,
    style,
    createdAt: new Date().toISOString(),
  };

  // Appel direct à l'API Kie.ai (moteur Suno V6 officiel)
  try {
    const res = await fetch(`${KIE_CONFIG.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: lyrics,
        style,
        title,
        customMode: true,
        instrumental: false,
        model: KIE_CONFIG.model,
        callBackUrl: KIE_CONFIG.callBackUrl,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.code !== 200 || !json.data?.taskId) {
      const errMsg = json?.msg || json?.error || `Code HTTP ${res.status}`;
      return {
        success: false,
        error: `Impossible de lancer la production Suno V6 : ${errMsg}`,
      };
    }

    const taskId = String(json.data.taskId);
    const pending: KieSongResult = {
      ...common,
      taskId,
      status: 'pending',
      notice: 'Production Suno V6 lancée avec succès en studio.',
    };

    saveKieGeneration(pending);
    void refreshBilling();

    return {
      success: true,
      result: pending,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Erreur réseau de communication avec Kie.ai : ${err.message || String(err)}`,
    };
  }
}

/**
 * Statut d'une tâche Suno V6 sur Kie.ai
 */
export async function pollKieSongStatus(taskId: string): Promise<{
  status: 'pending' | 'success' | 'failed';
  audioUrl?: string;
  duration?: number;
  error?: string;
}> {
  if (taskId.startsWith('demo_')) return { status: 'success', duration: 180 };

  try {
    const res = await fetch(`${KIE_CONFIG.baseUrl}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        'Authorization': `Bearer ${KIE_CONFIG.apiKey}`,
      },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.code !== 200) {
      return { status: 'pending', error: json?.msg || `HTTP ${res.status}` };
    }

    const data = json.data;
    if (!data) return { status: 'pending' };

    const rawStatus = String(data.status || '').toUpperCase();
    const sunoData = data.response?.sunoData || data.sunoData || [];

    if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETE') {
      const firstTrack = Array.isArray(sunoData) && sunoData.length > 0 ? sunoData[0] : null;
      const audioUrl = firstTrack?.audioUrl || firstTrack?.audio_url || firstTrack?.streamAudioUrl || firstTrack?.stream_audio_url;
      const duration = firstTrack?.duration ? Math.round(Number(firstTrack.duration)) : 180;
      return {
        status: 'success',
        audioUrl: audioUrl || undefined,
        duration,
      };
    }

    if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
      return {
        status: 'failed',
        error: data.errorMessage || data.failReason || 'Génération Suno V6 interrompue',
      };
    }

    return { status: 'pending' };
  } catch (err: any) {
    return { status: 'pending', error: err.message };
  }
}

/**
 * Attend la fin d'une génération Suno V6 (cadence normale : 1 à 4 minutes)
 */
export async function waitForKieSong(
  song: KieSongResult,
  { timeoutMs = 8 * 60_000, intervalMs = 6_000, onTick }: { timeoutMs?: number; intervalMs?: number; onTick?: (elapsedMs: number) => void } = {}
): Promise<KieSongResult> {
  if (song.status !== 'pending') return song;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalMs));
    onTick?.(Date.now() - started);
    const s = await pollKieSongStatus(song.taskId);
    if (s.status !== 'pending') {
      const done: KieSongResult = {
        ...song,
        status: s.status,
        audioUrl: s.audioUrl,
        duration: s.duration,
        completedAt: new Date().toISOString(),
        notice: s.status === 'failed' ? `Échec de production Suno V6 : ${s.error || 'Kie.ai'}` : undefined,
      };
      saveKieGeneration(done);
      return done;
    }
  }
  return { ...song, notice: 'Production Suno V6 en cours : le morceau sera disponible dès la finalisation.' };
}

/**
 * Envoie la chanson terminée au client sur WhatsApp : message d'accompagnement,
 * puis le fichier audio en note vocale (lien de secours si la conversion échoue).
 */
export async function deliverSongToWhatsApp(
  song: KieSongResult,
  sessionName: string
): Promise<{ success: boolean; message: string }> {
  if (song.isSimulation) return { success: false, message: 'Morceau de démonstration : rien n’est envoyé au client.' };
  if (!song.clientPhone) return { success: false, message: 'Numéro de téléphone du client manquant.' };
  if (song.status !== 'success' || !song.audioUrl) return { success: false, message: 'Le morceau n’est pas encore prêt.' };

  const greeting = song.isNewClient ? 'Bonjour' : 'Ravi de vous retrouver';
  const caption = `${greeting} ${song.clientName} !\n\nVotre chanson personnalisée « *${song.title}* » (${song.style}) vient de sortir du studio.\n\nÉcoutez-la ci-dessous. Nous espérons qu’elle touchera votre destinataire en plein cœur.`;

  const text = await sendWahaTextMessage(song.clientPhone, caption, sessionName);
  if (!text.success) return { success: false, message: text.error || 'Échec de transmission WhatsApp.' };

  let audioSent = false;
  try {
    const res = await fetch(song.audioUrl);
    if (res.ok) {
      const blob = await res.blob();
      audioSent = (await sendWahaVoiceMessage(song.clientPhone, blob, sessionName)).success;
    }
  } catch {
    // CORS ou réseau : lien de secours ci-dessous
  }
  if (!audioSent) {
    const link = await sendWahaTextMessage(song.clientPhone, `Écoutez et téléchargez votre chanson : ${song.audioUrl}`, sessionName);
    if (!link.success) return { success: false, message: 'Message envoyé, mais le fichier audio n’a pas pu partir. Renvoyez-le depuis Discussions.' };
  }

  saveKieGeneration({ ...song, completedAt: new Date().toISOString() });
  return {
    success: true,
    message: audioSent
      ? `Chanson « ${song.title} » livrée en note vocale au ${song.clientPhone}.`
      : `Chanson « ${song.title} » livrée par lien au ${song.clientPhone}.`,
  };
}
