import type { WahaClient } from '../send/waha-client.js';
import type { Db } from '../db/rest.js';
import type { DeepSeekProvider } from '../llm/deepseek.js';
import {
  extractLyricsBriefFromChat,
  composeLyrics,
  type ChatMessageForBrief,
} from '../llm/lyrics-composer.js';
import { startBackgroundProduction, parseLyricsHeader } from '../services/music.js';

export interface EmojiAutomationContext {
  waha?: WahaClient | undefined;
  db?: Db | undefined;
  llmProvider?: DeepSeekProvider | undefined;
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;
  signMedia?: ((path: string) => Promise<{ url: string; mimetype: string; filename: string }>) | undefined;
}

export interface EmojiAction {
  type: 'text' | 'voice' | 'video' | 'custom';
  label: string;
  content?: string;
  url?: string;
  execute?: (
    ctx: EmojiAutomationContext,
    session: string,
    chatId: string,
    reactedKey: string,
  ) => Promise<{ executed: boolean; action?: string; error?: string }>;
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
- Chanson + vidéo montage avec vos photos : 3 000 F

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
  // 6. ✍️ — Génération autonome et livraison directe des paroles au client (Option B)
  [cleanEmoji('✍️')]: {
    type: 'custom',
    label: 'Génération et livraison des paroles',
    content: `Merci de me donner votre retour sur le texte. Une fois la validation faite, la chanson sera finalisée et aucune modification ne pourra être apportée.`,
    execute: async (ctx, session, chatId, reactedKey) =>
      handleAutonomousLyricsGenerationAndDelivery(ctx, session, chatId, reactedKey),
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
  // 10. 🎉 — Clôture officielle de commande & confirmation de livraison
  [cleanEmoji('🎉')]: {
    type: 'custom',
    label: 'Confirmation livraison & clôture commande',
    execute: async (ctx, session, chatId, reactedKey) =>
      handleMarkDelivered(ctx, session, chatId, reactedKey),
  },
  // 11. ⭐ — Lancer la production musicale Suno V6 (avec délai de livraison différé 12-15 min)
  [cleanEmoji('⭐')]: {
    type: 'custom',
    label: 'Production musicale Suno V6',
    execute: async (ctx, session, chatId, reactedKey) =>
      handleConfirmAndProduceSong(ctx, session, chatId, reactedKey),
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

export interface ResolvedAutomationContext {
  realChatId: string;
  contactId?: string;
  userId?: string;
  conversationId?: string;
  focusOrderId?: string | null;
}

/**
 * Résolution haute fidélité du destinataire et du contexte conversationnel.
 * Permet d'immuniser les automatisations contre les identifiants LID WhatsApp (@lid)
 * envoyés lors des réactions en résolvant le vrai numéro de téléphone (@c.us)
 * à partir du message ciblé (reactedKey) ou de la conversation en base.
 */
export async function resolveAutomationContext(
  ctx: EmojiAutomationContext,
  chatId: string,
  reactedKey?: string | null,
): Promise<ResolvedAutomationContext> {
  const result: ResolvedAutomationContext = { realChatId: chatId };
  if (!ctx.db) return result;

  try {
    // 1. Résolution prioritaire par le message réagi (wa_message_key)
    if (reactedKey) {
      const msgs = await ctx.db.queryTable?.<Array<{ id: string; conversation_id: string; user_id: string }>>(
        'messages',
        `wa_message_key=eq.${encodeURIComponent(reactedKey)}&select=id,conversation_id,user_id&limit=1`,
      ).catch(() => []);

      const msg = msgs?.[0];
      if (msg?.conversation_id) {
        result.conversationId = msg.conversation_id;
        if (msg.user_id) result.userId = msg.user_id;

        const convs = await ctx.db.queryTable?.<
          Array<{ id: string; user_id: string; contact_id: string; chat_id: string; focus_order_id: string | null }>
        >(
          'conversations',
          `id=eq.${encodeURIComponent(msg.conversation_id)}&select=id,user_id,contact_id,chat_id,focus_order_id&limit=1`,
        ).catch(() => []);

        const conv = convs?.[0];
        if (conv) {
          result.contactId = conv.contact_id;
          result.focusOrderId = conv.focus_order_id;
          if (conv.user_id) result.userId = conv.user_id;
          if (conv.chat_id && conv.chat_id.endsWith('@c.us')) {
            result.realChatId = conv.chat_id;
            return result;
          }
        }
      }
    }

    // 2. Si le chatId est déjà un numéro standard @c.us, chercher directement le contact
    if (chatId.includes('@c.us')) {
      const contacts = await ctx.db.queryTable?.<Array<{ id: string; user_id: string }>>(
        'contacts',
        `wa_jid=eq.${encodeURIComponent(chatId)}&select=id,user_id&limit=1`,
      ).catch(() => []);

      if (contacts?.[0]) {
        result.contactId = contacts[0].id;
        result.userId = contacts[0].user_id;

        const convs = await ctx.db.queryTable?.<Array<{ id: string; focus_order_id: string | null; chat_id: string }>>(
          'conversations',
          `contact_id=eq.${encodeURIComponent(contacts[0].id)}&order=created_at.desc&limit=1`,
        ).catch(() => []);
        if (convs?.[0]) {
          result.conversationId = convs[0].id;
          result.focusOrderId = convs[0].focus_order_id;
          if (convs[0].chat_id && convs[0].chat_id.endsWith('@c.us')) {
            result.realChatId = convs[0].chat_id;
          }
        }
        return result;
      }
    }

    // 3. Si chatId est un @lid ou si le contact direct n'a pas été trouvé, chercher dans conversations
    const convsByChat = await ctx.db.queryTable?.<
      Array<{ id: string; user_id: string; contact_id: string; chat_id: string; focus_order_id: string | null }>
    >(
      'conversations',
      `chat_id=eq.${encodeURIComponent(chatId)}&order=created_at.desc&limit=1`,
    ).catch(() => []);

    if (convsByChat?.[0]) {
      const conv = convsByChat[0];
      result.conversationId = conv.id;
      result.contactId = conv.contact_id;
      result.userId = conv.user_id;
      result.focusOrderId = conv.focus_order_id;
      if (conv.chat_id && conv.chat_id.endsWith('@c.us')) {
        result.realChatId = conv.chat_id;
      }
      return result;
    }

    // 4. Si contactId est résolu mais realChatId reste en @lid, interroger le contact pour obtenir son wa_jid
    if (result.contactId && result.realChatId.includes('@lid')) {
      const contactRows = await ctx.db.queryTable?.<Array<{ wa_jid: string }>>(
        'contacts',
        `id=eq.${encodeURIComponent(result.contactId)}&select=wa_jid&limit=1`,
      ).catch(() => []);
      if (contactRows?.[0]?.wa_jid && contactRows[0].wa_jid.endsWith('@c.us')) {
        result.realChatId = contactRows[0].wa_jid;
      }
    }
  } catch (err: any) {
    ctx.log?.(`⚠️ [resolveAutomationContext] Erreur de résolution pour ${chatId}: ${err?.message || err}`);
  }

  return result;
}

/**
 * Traite la réaction ✍️ : analyse les messages et vocaux transcrits, résout les rôles,
 * compose les paroles avec le style d'élite du studio et livre directement au client en 2 bulles.
 */
async function handleAutonomousLyricsGenerationAndDelivery(
  ctx: EmojiAutomationContext,
  session: string,
  chatId: string,
  reactedKey: string,
): Promise<{ executed: boolean; action?: string; error?: string }> {
  const log = ctx.log ?? console.log;

  if (!ctx.waha) {
    return { executed: false, error: 'missing_waha_client' };
  }

  // Si db ou llmProvider n'est pas fourni (ex: tests unitaires légers), repli propre sur le texte statique
  if (!ctx.db || !ctx.llmProvider) {
    const fallbackText = EMOJI_AUTOMATIONS[cleanEmoji('✍️')]?.content;
    if (fallbackText) {
      await ctx.waha.send(session, chatId, { kind: 'text', text: fallbackText });
      return { executed: true, action: 'Validation des paroles (fallback)' };
    }
    return { executed: false, error: 'missing_dependencies' };
  }

  log(`✍️ [RÉACTION PAROLES] Début de l'analyse autonome pour ${chatId}`);

  try {
    const resolved = await resolveAutomationContext(ctx, chatId, reactedKey);
    const targetChatId = resolved.realChatId || chatId;

    // 1. Trouver le contact
    let contactId = resolved.contactId;
    let userId = resolved.userId;
    if (!contactId) {
      const contacts = await ctx.db.queryTable?.<Array<{ id: string; user_id: string }>>(
        'contacts',
        `wa_jid=eq.${encodeURIComponent(targetChatId)}&select=id,user_id&limit=1`,
      ).catch(() => []);
      const contact = contacts?.[0];
      if (contact) {
        contactId = contact.id;
        userId = contact.user_id;
      }
    }

    if (!contactId) {
      log(`✍️ Contact introuvable pour ${targetChatId}, envoi du texte de secours`);
      await ctx.waha.send(session, targetChatId, {
        kind: 'text',
        text: EMOJI_AUTOMATIONS[cleanEmoji('✍️')]?.content || 'Merci de me donner votre retour sur le texte.',
      });
      return { executed: true, action: 'Validation des paroles (fallback sans contact)' };
    }

    // 2. Trouver la conversation
    let convId = resolved.conversationId;
    let focusOrderId = resolved.focusOrderId;
    if (!convId) {
      const convs = await ctx.db.queryTable?.<Array<{ id: string; user_id: string; focus_order_id: string | null }>>(
        'conversations',
        `contact_id=eq.${encodeURIComponent(contactId)}&order=created_at.desc&limit=1`,
      ).catch(() => []);
      const conv = convs?.[0];
      if (conv) {
        convId = conv.id;
        if (!userId) userId = conv.user_id;
        focusOrderId = conv.focus_order_id;
      }
    }

    if (!convId) {
      log(`✍️ Conversation introuvable pour contact ${contactId}`);
      return { executed: false, error: 'conversation_not_found' };
    }

    // 3. Récupération des messages récents pour analyse du brief
    const rawMessages = await ctx.db.queryTable?.<
      Array<{
        id: string;
        direction?: string | null;
        role?: string | null;
        body: string | null;
        transcript: string | null;
        media_kind: string | null;
        wa_message_key: string | null;
        created_at: string;
      }>
    >('messages', `conversation_id=eq.${encodeURIComponent(convId)}&order=created_at.desc&limit=50`).catch(() => []);

    const messages = (rawMessages || []).reverse();

    // 4. Identifier l'ancre spécifique si la réaction a été posée sur un message particulier
    let reactedText: string | null = null;
    if (reactedKey) {
      const targetMsg = messages.find((m) => m.wa_message_key === reactedKey);
      if (targetMsg) {
        reactedText = targetMsg.transcript || targetMsg.body || null;
      }
    }

    // 5. Préparer les messages pour l'extracteur
    const chatForBrief: ChatMessageForBrief[] = messages
      .map((m) => {
        const isMerchant = m.direction === 'outbound' || m.role === 'merchant' || m.role === 'agent';
        return {
          role: isMerchant ? ('merchant' as const) : ('client' as const),
          text: (m.transcript || m.body || '').trim(),
          createdAt: m.created_at,
          isVoice: m.media_kind === 'audio' || Boolean(m.transcript),
        };
      })
      .filter((m) => m.text.length > 0);

    log(`✍️ Analyse de ${chatForBrief.length} messages (textes et vocaux transcrits)...`);

    // 6. Extraction intelligente des rôles et des données de brief
    const extracted = await extractLyricsBriefFromChat(ctx.llmProvider, {
      messages: chatForBrief,
      reactedText,
      studioName: 'Velaris Studio',
    });

    log(`✍️ Briefs extraits : ${extracted.briefs.length} chanson(s) détectée(s)`, {
      isMultiSong: extracted.isMultiSong,
      briefs: extracted.briefs.map((b) => ({
        recipient: b.recipientName,
        sender: b.senderName,
        occasion: b.occasion,
      })),
    });

    // 7. Composition et livraison pour chaque chanson
    for (let i = 0; i < extracted.briefs.length; i++) {
      const brief = extracted.briefs[i]!;

      log(`✍️ Rédaction de la chanson ${i + 1}/${extracted.briefs.length} pour ${brief.recipientName}...`);
      const composed = await composeLyrics(ctx.llmProvider, {
        recipientName: brief.recipientName,
        recipientRelation: brief.recipientRelation,
        senderName: brief.senderName,
        occasion: brief.occasion,
        style: brief.style,
        voice: brief.voice,
        language: brief.language,
        memories: brief.memories,
        studioName: 'Velaris Studio',
      });

      // Bulle 1 : Le texte intégral de la chanson avec en-tête structuré
      const multiLabel = extracted.briefs.length > 1 ? ` (Option ${i + 1}/${extracted.briefs.length})` : '';
      const voiceLabel = brief.voice === 'male' ? 'voix masculine' : brief.voice === 'duo' ? 'voix duo' : 'voix féminine';
      const metaHeader = `Style : ${brief.style || 'Afro-pop acoustique douce'} | Voix : ${voiceLabel}`;
      const hasHeaderAlready = /\[\s*style\b/i.test(composed.lyrics) || /style\s*[:=\s]/i.test(composed.lyrics);
      const lyricsWithHeader = hasHeaderAlready ? composed.lyrics : `${metaHeader}\n\n${composed.lyrics}`;
      const lyricsMessage = `*« ${composed.title.toUpperCase()} »*${multiLabel}\n\n${lyricsWithHeader}`;
      await ctx.waha.send(session, targetChatId, {
        kind: 'text',
        text: lyricsMessage,
      });

      // Petite respiration humaine de 1.5s entre les deux bulles
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Bulle 2 : Message de politesse et validation
      const validationMessage = `Merci de me donner votre retour sur le texte. Une fois la validation faite, la chanson sera finalisée et aucune modification ne pourra être apportée. 🙏`;
      await ctx.waha.send(session, targetChatId, {
        kind: 'text',
        text: validationMessage,
      });

      // 8. Persistance dans la commande en base de données
      let orderId = focusOrderId;
      if (!orderId || i > 0) {
        try {
          orderId = await ctx.db.rpc<string>('agent_open_order', { p_conversation: convId });
        } catch {
          // ignore
        }
      }

      if (orderId) {
        await ctx.db.updateRows?.(
          'orders',
          `id=eq.${orderId}`,
          {
            lyrics: composed.lyrics,
            style: brief.style || null,
            voice: brief.voice || null,
            lyrics_source: 'ai_autonomous_composer',
          },
        ).catch(() => undefined);

        await ctx.db.rpc('agent_transition_order', {
          p_order: orderId,
          p_track: 'creative',
          p_event: 'lyrics_sent',
          p_actor: 'merchant',
          p_data: { via: 'emoji_automation_writing_hand', title: composed.title },
          p_inferred: false,
        }).catch(() => undefined);
      }
    }

    log(`✅ [RÉACTION PAROLES ✍️ TERMINÉE AVEC SUCCÈS] : Paroles livrées à ${targetChatId}`);
    return { executed: true, action: 'Génération et livraison des paroles réussie' };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log(`❌ Erreur dans handleAutonomousLyricsGenerationAndDelivery: ${errorMsg}`);
    return { executed: false, error: errorMsg };
  }
}

/**
 * Traite la réaction 🎉 : confirme la livraison, clôture la commande ouverte et marque
 * la frontière nette pour que les futures discussions soient rattachées au cycle suivant.
 */
async function handleMarkDelivered(
  ctx: EmojiAutomationContext,
  _session: string,
  chatId: string,
  _reactedKey: string,
): Promise<{ executed: boolean; action?: string; error?: string }> {
  const log = ctx.log ?? console.log;

  log(`🎉 [RÉACTION LIVRAISON CONFIRMÉE] Traitement pour ${chatId}`);

  if (!ctx.db) {
    return { executed: true, action: 'Confirmation livraison (simulation)' };
  }

  try {
    const resolved = await resolveAutomationContext(ctx, chatId, _reactedKey);
    const targetChatId = resolved.realChatId || chatId;

    // 1. Trouver le contact
    let contactId = resolved.contactId;
    if (!contactId) {
      const contacts = await ctx.db.queryTable?.<Array<{ id: string; user_id: string }>>(
        'contacts',
        `wa_jid=eq.${encodeURIComponent(targetChatId)}&select=id,user_id&limit=1`,
      ).catch(() => []);
      contactId = contacts?.[0]?.id;
    }

    if (!contactId) {
      log(`🎉 Contact introuvable pour ${targetChatId}`);
      return { executed: false, error: 'contact_not_found' };
    }

    // 2. Trouver la conversation
    let convId = resolved.conversationId;
    if (!convId) {
      const convs = await ctx.db.queryTable?.<Array<{ id: string }>>(
        'conversations',
        `contact_id=eq.${encodeURIComponent(contactId)}&order=created_at.desc&limit=1`,
      ).catch(() => []);
      convId = convs?.[0]?.id;
    }

    if (!convId) {
      log(`🎉 Conversation introuvable pour ${targetChatId}`);
      return { executed: false, error: 'conversation_not_found' };
    }

    // 3. Trouver la commande ouverte non livrée
    const openOrders = await ctx.db.queryTable?.<Array<{ id: string; version: number; stage: string }>>(
      'orders',
      `conversation_id=eq.${encodeURIComponent(convId)}&stage=not.in.(delivered,closed,cancelled)&order=created_at.desc&limit=1`,
    ).catch(() => []);
    const orderToClose = openOrders?.[0];

    // Calcul de la frontière temporelle exacte : si réagi sur un message précis,
    // on utilise la date exacte de ce message comme frontière absolue
    let boundaryTimestamp = new Date().toISOString();
    if (_reactedKey) {
      const reactedRows = await ctx.db.queryTable?.<Array<{ created_at: string }>>(
        'messages',
        `wa_message_key=eq.${encodeURIComponent(_reactedKey)}&select=created_at&limit=1`,
      ).catch(() => []);
      if (reactedRows?.[0]?.created_at) {
        boundaryTimestamp = reactedRows[0].created_at;
      }
    }

    if (orderToClose) {
      // Tenter la transition officielle
      await ctx.db.rpc<string>('agent_transition_order', {
        p_order: orderToClose.id,
        p_expected_version: orderToClose.version,
        p_track: 'creative',
        p_event: 'delivery_sent',
        p_actor: 'merchant',
        p_data: { via: 'emoji_automation_tada', emoji: '🎉', reacted_key: _reactedKey },
        p_inferred: false,
      }).catch(() => null);

      // Sceller la frontière exacte sur la commande
      await ctx.db.updateRows?.(
        'orders',
        `id=eq.${orderToClose.id}`,
        { stage: 'delivered', updated_at: boundaryTimestamp },
      ).catch(() => undefined);

      log(`🎉 Commande ${orderToClose.id} passée au statut livré/terminé (date frontière : ${boundaryTimestamp})`);
    } else {
      // Si la commande était déjà passée en livraison (ex: via le délai Suno),
      // ancrer la frontière exacte sur la commande la plus récente
      const recentOrders = await ctx.db.queryTable?.<Array<{ id: string }>>(
        'orders',
        `conversation_id=eq.${encodeURIComponent(convId)}&order=created_at.desc&limit=1`,
      ).catch(() => []);
      if (recentOrders?.[0]?.id) {
        await ctx.db.updateRows?.(
          'orders',
          `id=eq.${recentOrders[0].id}`,
          { stage: 'delivered', updated_at: boundaryTimestamp },
        ).catch(() => undefined);
        log(`🎉 Commande récente ${recentOrders[0].id} scellée avec la date frontière ${boundaryTimestamp}`);
      }
    }

    // 4. Inscrire le contact comme client fidèle (is_returning = true)
    await ctx.db.updateRows?.(
      'contacts',
      `id=eq.${encodeURIComponent(contactId)}`,
      { is_returning: true },
    ).catch(() => undefined);

    log(`✅ [COMMANDE CLÔTURÉE AVEC SUCCÈS 🎉] : Commande marquée terminée pour ${targetChatId}`);
    return { executed: true, action: 'Confirmation livraison & clôture commande' };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log(`❌ Erreur dans handleMarkDelivered: ${errorMsg}`);
    return { executed: false, error: errorMsg };
  }
}

/**
 * Traite la réaction ⭐ : extrait les paroles, le style et la voix,
 * et lance la production musicale Suno V6 en arrière-plan avec livraison différée 12-15 min.
 */
async function handleConfirmAndProduceSong(
  ctx: EmojiAutomationContext,
  session: string,
  chatId: string,
  reactedKey: string,
): Promise<{ executed: boolean; action?: string; error?: string }> {
  const log = ctx.log ?? console.log;
  const apiKey = process.env.KIE_API_KEY || '';

  if (!apiKey) {
    log('❌ KIE_API_KEY manquante pour la production musicale ⭐');
    return { executed: false, error: 'missing_kie_api_key' };
  }

  if (!ctx.db) {
    log('❌ Base de données manquante pour la production musicale ⭐');
    return { executed: false, error: 'missing_db' };
  }

  log(`⭐ [RÉACTION PRODUCTION MUSICALE] Traitement pour ${chatId} (clé réagie : ${reactedKey || 'aucune'})`);

  try {
    const resolved = await resolveAutomationContext(ctx, chatId, reactedKey);
    const targetChatId = resolved.realChatId || chatId;

    // 1. Trouver le contact
    let contactId = resolved.contactId;
    let userId = resolved.userId;
    if (!contactId) {
      const contacts = await ctx.db.queryTable?.<Array<{ id: string; user_id: string }>>(
        'contacts',
        `wa_jid=eq.${encodeURIComponent(targetChatId)}&select=id,user_id&limit=1`,
      ).catch(() => []);
      const contact = contacts?.[0];
      if (contact) {
        contactId = contact.id;
        userId = contact.user_id;
      }
    }

    if (!contactId) {
      log(`⭐ Contact introuvable pour ${targetChatId}`);
      return { executed: false, error: 'contact_not_found' };
    }

    // 2. Trouver la conversation
    let convId = resolved.conversationId;
    let focusOrderId = resolved.focusOrderId;
    if (!convId) {
      const convs = await ctx.db.queryTable?.<Array<{ id: string; user_id: string; focus_order_id: string | null }>>(
        'conversations',
        `contact_id=eq.${encodeURIComponent(contactId)}&order=created_at.desc&limit=1`,
      ).catch(() => []);
      const conv = convs?.[0];
      if (conv) {
        convId = conv.id;
        if (!userId) userId = conv.user_id;
        focusOrderId = conv.focus_order_id;
      }
    }

    if (!convId) {
      log(`⭐ Conversation introuvable pour ${targetChatId}`);
      return { executed: false, error: 'conversation_not_found' };
    }

    // 3. Récupérer le message réagi (ou chercher un message de paroles récent)
    let lyrics: string | null = null;
    let reactedId: string | null = null;

    if (reactedKey) {
      const msgRows = await ctx.db.queryTable?.<Array<{ id: string; body: string | null; transcript: string | null }>>(
        'messages',
        `wa_message_key=eq.${encodeURIComponent(reactedKey)}&select=id,body,transcript&limit=1`,
      ).catch(() => []);
      if (msgRows?.[0]) {
        lyrics = msgRows[0].transcript || msgRows[0].body || null;
        reactedId = msgRows[0].id;
      }
    }

    // Si pas de message ciblé ou corps trop court, chercher le dernier message contenant des paroles
    if (!lyrics || lyrics.length < 50) {
      const recentMsgs = await ctx.db.queryTable?.<Array<{ id: string; body: string | null; transcript: string | null }>>(
        'messages',
        `conversation_id=eq.${encodeURIComponent(convId)}&order=created_at.desc&limit=15&select=id,body,transcript`,
      ).catch(() => []);
      const candidate = (recentMsgs || []).find((m) => {
        const text = m.transcript || m.body || '';
        return (
          text.length > 50 &&
          (/couplet|refrain|verse|chorus|\[intro\]/i.test(text) || text.split('\n').length >= 4)
        );
      });
      if (candidate) {
        lyrics = candidate.transcript || candidate.body || null;
        reactedId = candidate.id;
      }
    }

    if (!lyrics) {
      log(`⭐ Aucune parole trouvée pour lancer la production musicale vers ${targetChatId}`);
      return { executed: false, error: 'lyrics_not_found' };
    }

    // 4. Analyse de l'en-tête (style, voix, titre)
    const header = parseLyricsHeader(lyrics);
    const cleanedLyrics = header.lyrics || lyrics;
    let style = header.style;
    let voice = header.voice;

    // Si le style ou la voix ne sont pas indiqués dans le message de paroles,
    // interroger la commande existante et les derniers messages de la discussion
    if (!style || !voice) {
      if (focusOrderId) {
        const orderRows = await ctx.db.queryTable?.<Array<{ style: string | null; voice: string | null }>>(
          'orders',
          `id=eq.${encodeURIComponent(focusOrderId)}&select=style,voice&limit=1`,
        ).catch(() => []);
        if (orderRows?.[0]) {
          if (!style && orderRows[0].style) style = orderRows[0].style;
          if (!voice && orderRows[0].voice) {
            const v = orderRows[0].voice.toLowerCase();
            if (v.includes('fem')) voice = 'female';
            else if (v.includes('masc') || v.includes('homme')) voice = 'male';
            else if (v.includes('duo')) voice = 'duo';
          }
        }
      }

      const recentMsgs = await ctx.db.queryTable?.<Array<{ body: string | null; transcript: string | null; direction: string }>>(
        'messages',
        `conversation_id=eq.${encodeURIComponent(convId)}&order=created_at.desc&limit=25&select=body,transcript,direction`,
      ).catch(() => []);

      for (const m of (recentMsgs || [])) {
        const text = (m.transcript || m.body || '').trim();
        if (!text) continue;

        if (!voice) {
          if (/\b(?:voix\s*(?:d'homme|homme|masculin(?:e)?)|chanteur|voix\s*male)\b/i.test(text)) {
            voice = 'male';
          } else if (/\b(?:voix\s*(?:de\s*femme|femme|féminin(?:e)?)|chanteuse|voix\s*female)\b/i.test(text)) {
            voice = 'female';
          } else if (/\b(?:duo|duet|mixte)\b/i.test(text)) {
            voice = 'duo';
          }
        }

        if (!style) {
          const styleMatch = text.match(/(?:style|rythme|genre)\s*[:=\s-]\s*([a-zA-ZÀ-ÿ0-9\s\-]+)/i);
          if (styleMatch && styleMatch[1]) {
            const cs = styleMatch[1].trim();
            if (cs.length >= 3 && !/^(?:oui|non|ok|merci|svp|doux|dansant)\b/i.test(cs)) {
              style = cs;
            }
          }
          if (!style) {
            const genreMatch = text.match(/\b(afrobeat(?:\s+nigerian)?|afro-love|amapiano|rumba(?:\s+congolaise)?|zouk|gospel|reggae|coupé-décalé|highlife)\b/i);
            if (genreMatch && genreMatch[1]) {
              style = genreMatch[1];
            }
          }
        }
      }
    }

    const finalStyle = style || 'Afro-pop acoustique douce';
    const finalVoice = voice || 'female';

    // Trouver le titre
    let title = header.title;
    if (!title) {
      const firstLine = cleanedLyrics.split('\n').map((l) => l.trim()).filter(Boolean)[0];
      if (firstLine && !firstLine.startsWith('[') && firstLine.length <= 80) {
        title = firstLine.replace(/^[#*«»_"\s]+|[#*«»_"\s]+$/g, '');
      } else {
        title = 'Chanson personnalisée';
      }
    }

    // 5. Trouver ou créer la commande cible
    let orderId = focusOrderId;
    if (!orderId) {
      const openOrders = await ctx.db.queryTable?.<Array<{ id: string }>>(
        'orders',
        `conversation_id=eq.${encodeURIComponent(convId)}&stage=not.in.(delivered,closed,cancelled)&order=created_at.desc&limit=1`,
      ).catch(() => []);
      orderId = openOrders?.[0]?.id || null;
    }
    if (!orderId) {
      try {
        orderId = await ctx.db.rpc<string>('agent_open_order', { p_conversation: convId });
      } catch {
        // ignore
      }
    }

    if (orderId) {
      await ctx.db.updateRows?.(
        'orders',
        `id=eq.${orderId}`,
        {
          lyrics: cleanedLyrics,
          lyrics_message_id: reactedId,
          lyrics_source: 'merchant_reaction_star',
          style: finalStyle,
          voice: finalVoice,
          stage: 'lyrics_validated',
        },
      ).catch(() => undefined);
    }

    log(`🎵 [LANCEMENT PRODUCTION SUNO V6] Titre : "${title}" | Voix : ${finalVoice} | Style : ${finalStyle} | Commande : ${orderId || 'sans_id'}`);

    // 6. Lancer la production en arrière-plan (génération Kie + polling + enfilage différé 12-15m)
    void startBackgroundProduction({
      apiKey,
      db: ctx.db,
      orderId: orderId || convId,
      userId: userId || '',
      conversationId: convId,
      sessionName: session,
      chatId: targetChatId,
      title,
      style: finalStyle,
      voice: finalVoice,
      lyrics: cleanedLyrics,
      protectedSessions: ['anicet2'],
      log,
    });

    return { executed: true, action: `Production musicale lancée : "${title}" (⭐)` };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log(`❌ Erreur dans handleConfirmAndProduceSong: ${errorMsg}`);
    return { executed: false, error: errorMsg };
  }
}

export async function executeEmojiAutomation(
  session: string,
  chatId: string,
  rawEmoji: string,
  reactedKey: string,
  wahaOrCtx: WahaClient | EmojiAutomationContext | undefined,
  logFn?: (msg: string, meta?: Record<string, unknown>) => void,
): Promise<{ executed: boolean; action?: string; error?: string }> {
  const emoji = cleanEmoji(rawEmoji);

  // Normaliser le contexte
  const ctx: EmojiAutomationContext =
    wahaOrCtx && typeof (wahaOrCtx as any).send === 'function'
      ? { waha: wahaOrCtx as WahaClient, ...(logFn !== undefined ? { log: logFn } : {}) }
      : (wahaOrCtx as EmojiAutomationContext) || (logFn !== undefined ? { log: logFn } : {});

  const log = ctx.log ?? logFn;

  if (!shouldProcessReaction(reactedKey || chatId, emoji)) {
    log?.('[reaction-automation] Doublon ignoré', { reactedKey, emoji });
    return { executed: false, action: 'deduplicated' };
  }

  const defaultAction = EMOJI_AUTOMATIONS[emoji];

  // OPTIMISATION ULTRA-RÉACTIVE (0ms de latence DB) :
  // Si l'action est l'une des actions directes standard du studio (texte, vocal, vidéo)
  // et que le destinataire est déjà un numéro standard WhatsApp (@c.us), on expédie instantanément.
  if (defaultAction && defaultAction.type !== 'custom' && !chatId.includes('@lid')) {
    log?.(`⚡ [ACTION DIRECTE STUDIO ${rawEmoji}] : "${defaultAction.label}" vers ${chatId}`);

    if (!ctx.waha) {
      log?.('[reaction-automation] WahaClient manquant');
      return { executed: false, error: 'missing_waha_client' };
    }

    try {
      if (defaultAction.type === 'text' && defaultAction.content) {
        await ctx.waha.send(session, chatId, { kind: 'text', text: defaultAction.content });
      } else if (defaultAction.type === 'voice' && defaultAction.url) {
        await ctx.waha.send(session, chatId, {
          kind: 'voice',
          url: defaultAction.url,
          mimetype: 'audio/ogg; codecs=opus',
        });
      } else if (defaultAction.type === 'video' && defaultAction.url) {
        await ctx.waha.send(session, chatId, {
          kind: 'video',
          url: defaultAction.url,
          mimetype: 'video/mp4',
          filename: 'video-demo.mp4',
          caption: 'Vidéo Démo',
        });
      }
      return { executed: true, action: defaultAction.label };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      log?.(`❌ Erreur exécution action ${rawEmoji} :`, { error: errorMsg });
      return { executed: false, error: errorMsg };
    }
  }

  // RECHERCHE DYNAMIQUE DANS LA TABLE automation_rules (pour déclencheurs personnalisés ou actions complexes)
  let customRule: {
    id: string;
    name: string;
    trigger_value: string;
    action_type: string;
    text_body: string | null;
    media_path: string | null;
    caption: string | null;
  } | null = null;

  if (ctx.db?.queryTable) {
    try {
      const dbRules = await ctx.db.queryTable<Array<{
        id: string;
        name: string;
        trigger_value: string;
        action_type: string;
        text_body: string | null;
        media_path: string | null;
        caption: string | null;
      }>>(
        'automation_rules',
        `trigger_type=eq.reaction&enabled=eq.true&select=id,name,trigger_value,action_type,text_body,media_path,caption&limit=100`,
      ).catch(() => []);
      customRule = dbRules?.find((r) => cleanEmoji(r.trigger_value) === emoji) || null;
    } catch (err: any) {
      log?.(`⚠️ [reaction-automation] Erreur consultation automation_rules: ${err?.message || err}`);
    }
  }

  if (!customRule && !defaultAction) {
    return { executed: false };
  }

  // Résolution du destinataire standard (@c.us) en cas d'identifiant LID WhatsApp
  let targetChatId = chatId;
  if (chatId.includes('@lid') || defaultAction?.type === 'custom') {
    const resolved = await resolveAutomationContext(ctx, chatId, reactedKey);
    targetChatId = resolved.realChatId || chatId;
  }

  // EXÉCUTION D'UNE RÈGLE DYNAMIQUE CRÉÉE PAR L'UTILISATEUR
  if (customRule) {
    log?.(`⚡ [AUTOMATISATION DYNAMIQUE DÉCLENCHÉE ${rawEmoji}] : "${customRule.name}" (${customRule.action_type}) vers ${targetChatId} (source: ${chatId})`);

    if (!ctx.waha) {
      log?.('[reaction-automation] WahaClient manquant pour règle personnalisée');
      return { executed: false, error: 'missing_waha_client' };
    }

    try {
      if (customRule.action_type === 'send_text') {
        const text = customRule.text_body || customRule.caption || '';
        if (text) {
          await ctx.waha.send(session, targetChatId, { kind: 'text', text });
        }
        return { executed: true, action: customRule.name };
      }

      if (customRule.action_type === 'send_voice') {
        let mediaUrl = customRule.media_path || '';
        if (mediaUrl && !mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
          if (ctx.signMedia) {
            try {
              const signed = await ctx.signMedia(mediaUrl);
              mediaUrl = signed.url;
            } catch (signErr: any) {
              log?.(`⚠️ [reaction-automation] Erreur signature vocal: ${signErr?.message || signErr}`);
            }
          }
        }
        if (mediaUrl) {
          await ctx.waha.send(session, targetChatId, {
            kind: 'voice',
            url: mediaUrl,
            mimetype: 'audio/ogg; codecs=opus',
          });
        }
        return { executed: true, action: customRule.name };
      }

      if (customRule.action_type === 'send_media') {
        let mediaUrl = customRule.media_path || '';
        let mime = 'application/octet-stream';
        let filename = mediaUrl.split('/').pop() || 'media';

        if (mediaUrl && !mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
          if (ctx.signMedia) {
            try {
              const signed = await ctx.signMedia(mediaUrl);
              mediaUrl = signed.url;
              mime = signed.mimetype;
              filename = signed.filename;
            } catch (signErr: any) {
              log?.(`⚠️ [reaction-automation] Erreur signature média: ${signErr?.message || signErr}`);
            }
          }
        }

        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const isVideo = ['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(ext);
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
        const caption = customRule.caption || customRule.text_body || '';
        const captionObj = caption ? { caption } : {};

        const MIME_BY_EXT: Record<string, string> = {
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          m4a: 'audio/mp4',
          ogg: 'audio/ogg',
          opus: 'audio/ogg; codecs=opus',
          pdf: 'application/pdf',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          mp4: 'video/mp4',
        };
        const finalMime = mime && mime !== 'application/octet-stream' ? mime : (MIME_BY_EXT[ext] || 'application/octet-stream');

        if (isVideo) {
          await ctx.waha.send(session, targetChatId, {
            kind: 'video',
            url: mediaUrl,
            mimetype: 'video/mp4',
            filename,
            ...captionObj,
          });
        } else if (isImage) {
          await ctx.waha.send(session, targetChatId, {
            kind: 'image',
            url: mediaUrl,
            mimetype: finalMime,
            ...captionObj,
          });
        } else {
          // Musique / Chanson audio ou Document PDF
          await ctx.waha.send(session, targetChatId, {
            kind: 'file',
            url: mediaUrl,
            mimetype: finalMime,
            filename,
            ...captionObj,
          });
        }
        return { executed: true, action: customRule.name };
      }

      return { executed: true, action: customRule.name };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      log?.(`❌ Erreur exécution règle dynamique ${rawEmoji}: ${errorMsg}`);
      return { executed: false, error: errorMsg };
    }
  }

  // EXÉCUTION D'UNE RÈGLE HARDCODÉE PAR DÉFAUT (si pas de règle personnalisée)
  const action = defaultAction!;
  log?.(`⚡ [ACTION DÉCLENCHÉE PAR RÉACTION ${rawEmoji}] : "${action.label}" vers ${targetChatId} (source: ${chatId})`);

  try {
    if (action.type === 'custom' && action.execute) {
      return await action.execute(ctx, session, targetChatId, reactedKey);
    }

    if (!ctx.waha) {
      log?.('[reaction-automation] WahaClient manquant');
      return { executed: false, error: 'missing_waha_client' };
    }

    if (action.type === 'text' && action.content) {
      await ctx.waha.send(session, targetChatId, { kind: 'text', text: action.content });
    } else if (action.type === 'voice' && action.url) {
      await ctx.waha.send(session, targetChatId, {
        kind: 'voice',
        url: action.url,
        mimetype: 'audio/ogg; codecs=opus',
      });
    } else if (action.type === 'video' && action.url) {
      await ctx.waha.send(session, targetChatId, {
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
