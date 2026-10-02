/**
 * Automatisation Génération & Livraison de Chansons
 * - Réaction emoji WhatsApp (ex. note de musique) sur un brief -> génération Kie.ai
 * - Reconnaissance anciens vs nouveaux clients
 * - Une commande = un identifiant : un même brief ne peut pas être produit deux fois en parallèle
 * - Livraison du master audio sur la ligne WhatsApp du client, uniquement s'il a été réellement produit
 *
 * Le déclenchement par réaction reçue sur WhatsApp est exécuté par le moteur serveur
 * (velaris-agent) ; ce module sert au déclenchement depuis le Studio et au test à blanc.
 */

import type { Order } from '../types';
import type { SongAutomationConfig, KieSongResult } from '../types/billing';
import { generateKieSong, deliverSongToWhatsApp, waitForKieSong } from './kie';
import { getStudioCredits } from './billing';
import { phoneMatches } from './supabase';

const AUTOMATION_CONFIG_KEY = 'velaris_song_automation_config_v1';

export const SONG_TRIGGER_DEFAULT = '\u{1F3B5}'; // note de musique

const DEFAULT_CONFIG: SongAutomationConfig = {
  enabled: true,
  reactionEmoji: SONG_TRIGGER_DEFAULT,
  autoDeliverWhatsApp: true,
  notifyOnComplete: true,
  ordersCreatedCount: 0,
};

export function getSongAutomationConfig(): SongAutomationConfig {
  try {
    const raw = localStorage.getItem(AUTOMATION_CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveSongAutomationConfig(cfg: SongAutomationConfig): void {
  try {
    localStorage.setItem(AUTOMATION_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // stockage indisponible
  }
}

/* Compare deux emojis en ignorant les sélecteurs de variante et teintes de peau */
export function sameEmoji(a?: string | null, b?: string | null): boolean {
  const norm = (s?: string | null) => (s || '').replace(/[\u{FE0E}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
  return !!norm(a) && norm(a) === norm(b);
}

/**
 * Analyse l'historique pour déterminer si c'est un nouveau client ou un client fidèle
 */
export function checkClientStatus(phone: string, existingOrders: Order[]): {
  isNewClient: boolean;
  orderCount: number;
  lastOrder?: Order;
} {
  const digits = phone.replace(/\D/g, '');
  const matches = digits ? existingOrders.filter(o => phoneMatches(o.clientPhone, digits)) : [];
  // Un client déjà livré au moins une fois est un client fidèle
  const delivered = matches.filter(o => o.status === 'livre').length;
  return { isNewClient: delivered === 0, orderCount: matches.length, lastOrder: matches[0] };
}

/* Commandes en cours de production : une réaction posée deux fois ne lance pas deux chansons */
const inFlight = new Set<string>();

export interface SongTriggerInput {
  emoji?: string;
  clientName: string;
  clientPhone: string;
  title: string;
  lyrics: string;
  style: string;
  orderId?: string;
  existingOrders?: Order[];
  sessionName: string;
  /** Test à blanc : vérifie toute la chaîne sans appel réseau, sans débit, sans envoi */
  dryRun?: boolean;
}

export interface SongTriggerResult {
  triggered: boolean;
  reason?: string;
  steps?: string[];
  result?: KieSongResult;
  deliverySuccess?: boolean;
}

export async function triggerSongAutomation(input: SongTriggerInput): Promise<SongTriggerResult> {
  const config = getSongAutomationConfig();
  const steps: string[] = [];

  if (!config.enabled) return { triggered: false, reason: 'Automatisation désactivée dans les paramètres.' };
  if (input.emoji && !sameEmoji(input.emoji, config.reactionEmoji)) {
    return { triggered: false, reason: 'La réaction reçue ne correspond pas au déclencheur configuré.' };
  }
  steps.push('Réaction reconnue');

  if (input.lyrics.trim().length < 40) return { triggered: false, reason: 'Paroles absentes ou trop courtes : validez le texte avant de lancer la production.', steps };
  steps.push('Paroles validées');

  const credits = getStudioCredits();
  if (credits.source !== 'pending' && credits.balance < credits.songCostCredits) {
    return { triggered: false, reason: `Solde insuffisant (${credits.balance.toFixed(2)} crédit). Rechargez depuis le Profil.`, steps };
  }
  steps.push(`Solde suffisant (${credits.balance.toFixed(2)} crédit)`);

  const client = checkClientStatus(input.clientPhone, input.existingOrders || []);
  steps.push(client.isNewClient ? 'Nouveau client' : `Client fidèle (${client.orderCount} commande(s))`);

  const orderId = input.orderId || `ORD-${Date.now().toString(36).toUpperCase()}`;
  if (inFlight.has(orderId)) return { triggered: false, reason: `La commande ${orderId} est déjà en production.`, steps };

  if (input.dryRun) {
    steps.push(config.autoDeliverWhatsApp ? `Livraison automatique prévue sur ${input.sessionName}` : 'Livraison manuelle');
    return { triggered: false, reason: 'Test à blanc réussi : la chaîne est prête, rien n’a été débité ni envoyé.', steps };
  }

  inFlight.add(orderId);
  try {
    const gen = await generateKieSong(
      {
        prompt: input.lyrics,
        lyrics: input.lyrics,
        style: input.style || 'Afro-Love acoustique',
        title: input.title || `Chanson pour ${input.clientName}`,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        orderId,
      },
      { isNewClient: client.isNewClient }
    );
    if (!gen.success || !gen.result) return { triggered: false, reason: gen.error || 'Échec de la génération Kie.ai.', steps };
    steps.push('Production lancée');

    const result = await waitForKieSong(gen.result);
    let deliverySuccess = false;
    if (result.status === 'success' && config.autoDeliverWhatsApp && !result.isSimulation) {
      deliverySuccess = (await deliverSongToWhatsApp(result, input.sessionName)).success;
      steps.push(deliverySuccess ? 'Livrée sur WhatsApp' : 'Livraison WhatsApp échouée');
    }

    saveSongAutomationConfig({ ...config, ordersCreatedCount: config.ordersCreatedCount + 1, lastTriggeredAt: new Date().toISOString() });
    return { triggered: true, result, deliverySuccess, steps };
  } finally {
    inFlight.delete(orderId);
  }
}
