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
import { debitDemoSongCredit, refreshBilling } from './billing';
import { sendWahaTextMessage, sendWahaVoiceMessage } from './waha';
import { supabase } from './supabase';

export const KIE_CONFIG = {
  publicHost: 'api.kie.ai',
  model: 'V3_5',
  maxLyrics: 3000,
  maxStyle: 200,
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

async function readFunctionError(error: unknown, data: any): Promise<string> {
  if (data?.error) return data.error;
  try {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json() : null;
    if (body?.error) return body.error;
  } catch {
    // corps illisible
  }
  return (error as Error)?.message || 'Moteur Kie.ai indisponible';
}

/**
 * Lance une génération. Retourne une tâche `pending` à suivre avec `pollKieSongStatus`
 * (studio connecté) ou une simulation explicite (démo).
 */
export async function generateKieSong(req: KieSongGenerationRequest, options?: { isNewClient?: boolean }): Promise<{
  success: boolean;
  result?: KieSongResult;
  error?: string;
}> {
  const lyrics = formatLyricsForSuno(req.lyrics || req.prompt);
  const title = req.title.slice(0, KIE_CONFIG.maxTitle);
  const style = req.style.slice(0, KIE_CONFIG.maxStyle);
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

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const debit = debitDemoSongCredit(req.clientName, title, orderId);
    if (!debit.success) return { success: false, error: debit.error };
    const sim: KieSongResult = {
      ...common,
      taskId: `demo_${Date.now()}`,
      status: 'success',
      duration: 180,
      completedAt: new Date().toISOString(),
      isSimulation: true,
      notice: 'Mode démo : aucune génération réelle ni envoi WhatsApp. Connectez votre studio pour produire le morceau.',
    };
    saveKieGeneration(sim);
    return { success: true, result: sim };
  }

  const { data, error } = await supabase.functions.invoke('kie-generate', {
    body: { action: 'generate', title, style, lyrics, clientName: req.clientName, clientPhone: req.clientPhone, orderRef: orderId },
  });
  void refreshBilling();

  if (error || !data?.taskId) {
    const message = await readFunctionError(error, data);
    return { success: false, error: `${message}. Aucun crédit n'a été conservé pour cette tentative.` };
  }

  const pending: KieSongResult = { ...common, taskId: String(data.taskId), status: 'pending' };
  saveKieGeneration(pending);
  return { success: true, result: pending };
}

/**
 * Statut d'une tâche (le serveur rembourse automatiquement une tâche échouée)
 */
export async function pollKieSongStatus(taskId: string): Promise<{
  status: 'pending' | 'success' | 'failed';
  audioUrl?: string;
  duration?: number;
  error?: string;
}> {
  if (taskId.startsWith('demo_')) return { status: 'success', duration: 180 };
  const { data, error } = await supabase.functions.invoke('kie-generate', { body: { action: 'status', taskId } });
  if (error || !data?.status) return { status: 'pending', error: data?.error || error?.message };
  if (data.status === 'failed') void refreshBilling();
  return { status: data.status, audioUrl: data.audioUrl || undefined, duration: data.duration ?? undefined, error: data.error };
}

/**
 * Attend la fin d'une génération (Suno produit en 1 à 4 minutes en moyenne)
 */
export async function waitForKieSong(
  song: KieSongResult,
  { timeoutMs = 6 * 60_000, intervalMs = 10_000, onTick }: { timeoutMs?: number; intervalMs?: number; onTick?: (elapsedMs: number) => void } = {}
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
        notice: s.status === 'failed' ? `Échec de production : ${s.error || 'Kie.ai'} (crédit remboursé)` : undefined,
      };
      saveKieGeneration(done);
      return done;
    }
  }
  return { ...song, notice: 'Production toujours en cours : le morceau apparaîtra dès que Kie.ai l’aura terminé.' };
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
