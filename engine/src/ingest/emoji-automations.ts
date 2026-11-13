import type { WahaClient } from '../send/waha-client.js';

export interface EmojiAction {
  type: 'text' | 'voice' | 'video';
  label: string;
  content?: string;
  url?: string;
}

export const cleanEmoji = (s: string): string => (s || '').replace(/\uFE0F/g, '').trim();

export const EMOJI_AUTOMATIONS: Record<string, EmojiAction> = {
  // 1. 😊 — Message texte (accueil)
  [cleanEmoji('😊')]: {
    type: 'text',
    label: 'Accueil Djelia',
    content: `Bonjour et bienvenue chez Djelia . Nous faisons des chansons personnalisées pour tout type d'occasion.(Déclaration, anniversaire etc..) . C'est pour quelle occasion ?`,
  },
  // 2. ✨ — Message texte (présentation des offres)
  [cleanEmoji('✨')]: {
    type: 'text',
    label: 'Présentation des offres',
    content: `Nous avons deux formules pour vous :

- Chanson personnalisée : 1 200 F
- Chanson + vidéo montage avec vos photos : 3 500 F

Laquelle vous convient ?`,
  },
  // 3. 🙏 — Message texte (paiement Orange Money)
  [cleanEmoji('🙏')]: {
    type: 'text',
    label: 'Paiement Orange Money',
    content: `Vous pouvez donc passer au paiement +226 56240533 Wendyam Anicet junior Sekongo svp une capture pour vérifier le paiement 🙏`,
  },
  // 4. 💢 — Message texte (paiement Wave)
  [cleanEmoji('💢')]: {
    type: 'text',
    label: 'Paiement Wave',
    content: `Vous pouvez donc passer au paiement WAVE +225 0759600590
 Digital Starter svp une capture pour vérifier le paiement 🙏`,
  },
  // 5. 🥰 — Message texte (demande d'avis Facebook)
  [cleanEmoji('🥰')]: {
    type: 'text',
    label: 'Demande avis Facebook',
    content: `N'hésitez pas dès que vous pourrez de nous laisser un commentaire sur Facebook. Beaucoup souvent doutent 🙏😊
https://www.facebook.com/share/v/1DWErPGbXx/`,
  },
  // 6. ✍️ — Message texte (validation des paroles)
  [cleanEmoji('✍️')]: {
    type: 'text',
    label: 'Validation des paroles',
    content: `Merci de me donner votre retour sur le texte. Une fois la validation faite, la chanson sera finalisée et aucune modification ne pourra être apportée.`,
  },
  // 7. ☺️ — Message vocal WhatsApp prise de commande (Voix féminine clonée)
  [cleanEmoji('☺️')]: {
    type: 'voice',
    label: 'Vocal prise de commande',
    url: 'https://waha.velarisagent.life/qr/assets/vocal_commande_soeur.opus',
  },
  // 8. 🎥 — Vidéo démo
  [cleanEmoji('🎥')]: {
    type: 'video',
    label: 'Vidéo démo',
    url: 'https://waha.velarisagent.life/qr/assets/324048.mp4',
  },
  // 9. 🎵 — Message vocal WhatsApp procédure (Voix féminine clonée)
  [cleanEmoji('🎵')]: {
    type: 'voice',
    label: 'Vocal procédure',
    url: 'https://waha.velarisagent.life/qr/assets/vocal_procedure_soeur.opus',
  },
};

const handledReactions = new Set<string>();

export function shouldProcessReaction(msgId: string, emoji: string): boolean {
  const key = `${msgId}_${emoji}_${Math.floor(Date.now() / 4000)}`;
  if (handledReactions.has(key)) return false;
  handledReactions.add(key);
  setTimeout(() => handledReactions.delete(key), 10000);
  return true;
}

export async function executeEmojiAutomation(
  session: string,
  chatId: string,
  rawEmoji: string,
  reactedKey: string,
  waha: WahaClient | undefined,
  log?: (msg: string, meta?: Record<string, unknown>) => void
): Promise<{ executed: boolean; action?: string; error?: string }> {
  const emoji = cleanEmoji(rawEmoji);
  const action = EMOJI_AUTOMATIONS[emoji];
  if (!action) return { executed: false };

  if (!shouldProcessReaction(reactedKey, emoji)) {
    log?.('[reaction-automation] Doublon ignoré', { reactedKey, emoji });
    return { executed: false, action: 'deduplicated' };
  }

  if (!waha) {
    log?.('[reaction-automation] WahaClient manquant');
    return { executed: false, error: 'missing_waha_client' };
  }

  log?.(`⚡ [ACTION DÉCLENCHÉE PAR RÉACTION ${rawEmoji}] : "${action.label}" vers ${chatId}`);

  try {
    if (action.type === 'text' && action.content) {
      await waha.send(session, chatId, { kind: 'text', text: action.content });
    } else if (action.type === 'voice' && action.url) {
      await waha.send(session, chatId, {
        kind: 'voice',
        url: action.url,
        mimetype: 'audio/ogg; codecs=opus',
      });
    } else if (action.type === 'video' && action.url) {
      await waha.send(session, chatId, {
        kind: 'video',
        url: action.url,
        mimetype: 'video/mp4',
        filename: 'video-demo.mp4',
        caption: 'Vidéo Démo',
      });
    }
    return { executed: true, action: action.label };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log?.(`❌ Erreur exécution action ${rawEmoji} :`, { error: errorMsg });
    return { executed: false, error: errorMsg };
  }
}
