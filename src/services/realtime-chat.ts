/**
 * Service Temps Réel & Opérations WhatsApp Super Cockpit
 * 
 * Assure la communication sub-50ms avec Supabase Realtime,
 * la gestion du mode IA (Pilote Auto vs Manuel),
 * et la résolution déterministe des coordonnées de paiement par pays.
 */

import { supabase } from './supabase';
import { WAHA_CONFIG, toChatId, type WahaSendTextResponse } from './waha';

export interface CountryPaymentInfo {
  countryName: string;
  code: string;
  flag: string;
  primaryMethod: string;
  recipientName: string;
  accountNumber: string;
  instructions: string;
  formattedBubble: string;
}

/**
 * Détermine les coordonnées de paiement Mobile Money selon l'indicatif du numéro client
 */
export function resolvePaymentInfoByPhone(phone: string): CountryPaymentInfo {
  const clean = phone.replace(/[^0-9]/g, '');

  // 1. Côte d'Ivoire (+225)
  if (clean.startsWith('225') || clean.startsWith('00225')) {
    return {
      countryName: "Côte d'Ivoire",
      code: 'CI',
      flag: '🇨🇮',
      primaryMethod: 'Wave CI',
      recipientName: 'Wendyam Anicet junior Sekongo',
      accountNumber: '+226 05 77 73 08',
      instructions: 'Paiement direct Wave vers le numéro Burkinabé (sans frais internationaux).',
      formattedBubble: `Vous pouvez donc passer au paiement Wave au +226 05 77 73 08 (Wendyam Anicet junior Sekongo).\nNos clients de Côte d'Ivoire nous payent par Wave sans aucun problème ! Svp une capture d'écran dès que c'est fait pour lancer la confection au studio 🙏`,
    };
  }

  // 2. Sénégal (+221)
  if (clean.startsWith('221') || clean.startsWith('00221')) {
    return {
      countryName: 'Sénégal',
      code: 'SN',
      flag: '🇸🇳',
      primaryMethod: 'Wave Sénégal',
      recipientName: 'Wendyam Anicet junior Sekongo',
      accountNumber: '+226 05 77 73 08',
      instructions: 'Paiement Wave direct.',
      formattedBubble: `Vous pouvez effectuer le règlement par Wave direct au +226 05 77 73 08 (Wendyam Anicet junior Sekongo).\nMerci de m'envoyer la capture d'écran du transfert dès validation 🙏`,
    };
  }

  // 3. Mali (+223)
  if (clean.startsWith('223') || clean.startsWith('00223')) {
    return {
      countryName: 'Mali',
      code: 'ML',
      flag: '🇲🇱',
      primaryMethod: 'Orange Money / Wave',
      recipientName: 'Wendyam Anicet junior Sekongo',
      accountNumber: '+226 05 77 73 08',
      instructions: 'Transfert d\'argent vers le Burkina Faso.',
      formattedBubble: `Vous pouvez effectuer le transfert Orange Money ou Wave vers le Burkina Faso au +226 05 77 73 08 (Wendyam Anicet junior Sekongo).\nSvp une capture pour confirmer et lancer la production au studio 🙏`,
    };
  }

  // 4. France & Diaspora (+33, +32, +1, etc.)
  if (clean.startsWith('33') || clean.startsWith('32') || clean.startsWith('1')) {
    return {
      countryName: 'International / Diaspora',
      code: 'INTL',
      flag: '🌍',
      primaryMethod: 'Wave / TapTap Send / Sendwave',
      recipientName: 'Wendyam Anicet junior Sekongo',
      accountNumber: '+226 05 77 73 08',
      instructions: 'TapTap Send, Sendwave ou Wave vers le Burkina Faso.',
      formattedBubble: `Pour la diaspora, vous pouvez transférer facilement via l'application TapTap Send, Sendwave ou Wave vers le Burkina Faso au +226 05 77 73 08 (Wendyam Anicet junior Sekongo).\nEnvoyez-moi la quittance dès que c'est validé pour lancer l'enregistrement immédiat 🙏`,
    };
  }

  // 5. Par défaut : Burkina Faso (+226)
  return {
    countryName: 'Burkina Faso',
    code: 'BF',
    flag: '🇧🇫',
    primaryMethod: 'Orange Money BF',
    recipientName: 'Wendyam Anicet junior Sekongo',
    accountNumber: '+226 05 77 73 08',
    instructions: 'Dépôt Orange Money ou Wave direct.',
    formattedBubble: `Vous pouvez donc passer au paiement +226 05 77 73 08 Wendyam Anicet junior Sekongo (Orange Money ou Wave) svp une capture pour vérifier le paiement et lancer la fabrication au studio 🙏`,
  };
}

/**
 * Met à jour le mode de pilotage IA sur une conversation
 */
export async function updateConversationAiMode(conversationId: string, aiEnabled: boolean): Promise<boolean> {
  if (!conversationId) return false;
  // 1. Relais direct vers le moteur de contrôle VPS (avec clé de service pour contourner la RLS anon)
  try {
    const res = await fetch('/api/control-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        mode: aiEnabled ? 'ai' : 'human',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok) return true;
    }
  } catch {
    // repli
  }

  // 2. Repli Supabase direct
  try {
    const { error } = await supabase
      .from('conversations')
      .update({
        control_mode: aiEnabled ? 'ai' : 'human',
        ai_paused: !aiEnabled,
        pause_reason: aiEnabled ? null : 'human_takeover_from_cockpit',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Récupère le statut de pause de l'IA pour une conversation donnée
 */
export async function fetchConversationAiMode(conversationId: string): Promise<{ controlMode: 'ai' | 'human'; isPaused: boolean }> {
  if (!conversationId) return { controlMode: 'ai', isPaused: false };
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('control_mode, ai_paused')
      .eq('id', conversationId)
      .maybeSingle();
    if (error || !data) return { controlMode: 'ai', isPaused: false };
    return {
      controlMode: data.control_mode === 'human' ? 'human' : 'ai',
      isPaused: Boolean(data.ai_paused),
    };
  } catch {
    return { controlMode: 'ai', isPaused: false };
  }
}

/**
 * Sauvegarde une note interne privée pour un contact (invisible côté WhatsApp client)
 */
export async function savePrivateContactNote(phone: string, noteText: string): Promise<boolean> {
  if (!phone) return false;
  try {
    const digits = phone.replace(/\D/g, '');
    const tail = digits.slice(-6);
    const { error } = await supabase
      .from('contacts')
      .update({
        notes: noteText.trim(),
        updated_at: new Date().toISOString(),
      })
      .ilike('phone', `%${tail}%`);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Envoie une réaction emoji à un message spécifique sur WhatsApp via WAHA
 */
export async function sendWahaReaction(
  chatId: string,
  messageId: string,
  emoji: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  try {
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/sendReaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        session: sessionName,
        chatId: toChatId(chatId),
        messageId,
        reaction: emoji,
      }),
    });
    if (!res.ok) {
      return { success: false, error: `Erreur WAHA (${res.status})` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Impossible d\'envoyer la réaction' };
  }
}
