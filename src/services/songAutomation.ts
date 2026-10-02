/**
 * Service d'Automatisation de Génération & Livraison de Chansons
 * - Réaction emoji WhatsApp (ex: 🎵) -> Déclenchement automatique de la génération Kie.ai
 * - Reconnaissance anciens vs nouveaux clients
 * - Multi-commandes par client avec suivi par Order ID
 * - Livraison instantanée du master audio sur la ligne WhatsApp du client
 */

import type { Order } from '../types';
import type { SongAutomationConfig, KieSongResult } from '../types/billing';
import { generateKieSong, deliverSongToWhatsApp } from './kie';
import { phoneMatches } from './supabase';

const AUTOMATION_CONFIG_KEY = 'velaris_song_automation_config_v1';

const DEFAULT_CONFIG: SongAutomationConfig = {
  enabled: true,
  reactionEmoji: '🎵',
  autoDeliverWhatsApp: true,
  notifyOnComplete: true,
  ordersCreatedCount: 14,
  lastTriggeredAt: new Date(Date.now() - 3600000 * 2).toISOString()
};

export function getSongAutomationConfig(): SongAutomationConfig {
  try {
    const raw = localStorage.getItem(AUTOMATION_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveSongAutomationConfig(cfg: SongAutomationConfig): void {
  try {
    localStorage.setItem(AUTOMATION_CONFIG_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.warn('[songAutomation] Failed to save config', err);
  }
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
  const matches = existingOrders.filter(o => phoneMatches(o.clientPhone, digits));
  return {
    isNewClient: matches.length <= 1, // 0 ou 1 commande en cours
    orderCount: matches.length,
    lastOrder: matches[0]
  };
}

/**
 * Déclenche l'automatisation suite à une réaction emoji ou demande directe
 */
export async function triggerSongAutomation({
  emoji,
  clientName,
  clientPhone,
  title,
  lyrics,
  style,
  orderId,
  existingOrders = [],
  sessionName = 'Test'
}: {
  emoji?: string;
  clientName: string;
  clientPhone: string;
  title: string;
  lyrics: string;
  style: string;
  orderId?: string;
  existingOrders?: Order[];
  sessionName?: string;
}): Promise<{
  triggered: boolean;
  reason?: string;
  result?: KieSongResult;
  deliverySuccess?: boolean;
}> {
  const config = getSongAutomationConfig();

  if (!config.enabled) {
    return { triggered: false, reason: 'Automatisation désactivée dans les paramètres.' };
  }

  if (emoji && emoji !== config.reactionEmoji) {
    return { triggered: false, reason: `Emoji ${emoji} ne correspond pas au déclencheur ${config.reactionEmoji}.` };
  }

  // 1. Détection nouveau vs ancien client
  const clientStatus = checkClientStatus(clientPhone, existingOrders);

  // 2. Lancer la génération Kie
  const genResponse = await generateKieSong(
    {
      prompt: lyrics,
      lyrics,
      style: style || 'Afro-Love acoustique',
      title: title || `Chanson pour ${clientName}`,
      clientName,
      clientPhone,
      orderId: orderId || `ORD-${Date.now().toString().slice(-4)}`
    },
    {
      isNewClient: clientStatus.isNewClient
    }
  );

  if (!genResponse.success || !genResponse.result) {
    return { triggered: false, reason: genResponse.error || 'Échec de la génération Kie.ai.' };
  }

  const result = genResponse.result;

  // 3. Si livraison automatique activée, expédier vers WhatsApp
  let deliverySuccess = false;
  if (config.autoDeliverWhatsApp && (result.audioUrl || result.streamAudioUrl)) {
    const delivery = await deliverSongToWhatsApp(result, sessionName);
    deliverySuccess = delivery.success;
  }

  // Mettre à jour les statistiques de l'automatisation
  config.ordersCreatedCount += 1;
  config.lastTriggeredAt = new Date().toISOString();
  saveSongAutomationConfig(config);

  return {
    triggered: true,
    result,
    deliverySuccess
  };
}
