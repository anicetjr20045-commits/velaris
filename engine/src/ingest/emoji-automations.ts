import type { WahaClient } from '../send/waha-client.js';
import type { Db } from '../db/rest.js';
import type { DeepSeekProvider } from '../llm/deepseek.js';
import {
  extractLyricsBriefFromChat,
  composeLyrics,
  type ChatMessageForBrief,
} from '../llm/lyrics-composer.js';

export interface EmojiAutomationContext {
  waha?: WahaClient | undefined;
  db?: Db | undefined;
  llmProvider?: DeepSeekProvider | undefined;
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;
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
};

const handledReactions = new Set<string>();

export function shouldProcessReaction(msgId: string, emoji: string): boolean {
  const key = `${msgId}_${emoji}_${Math.floor(Date.now() / 4000)}`;
  if (handledReactions.has(key)) return false;
  handledReactions.add(key);
  setTimeout(() => handledReactions.delete(key), 10000);
  return true;
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
    // 1. Trouver le contact
    const contacts = await ctx.db.queryTable?.<Array<{ id: string; user_id: string }>>(
      'contacts',
      `wa_jid=eq.${encodeURIComponent(chatId)}&select=id,user_id&limit=1`,
    ).catch(() => []);
    const contact = contacts?.[0];
    if (!contact) {
      log(`✍️ Contact introuvable pour ${chatId}, envoi du texte de secours`);
      await ctx.waha.send(session, chatId, {
        kind: 'text',
        text: EMOJI_AUTOMATIONS[cleanEmoji('✍️')]?.content || 'Merci de me donner votre retour sur le texte.',
      });
      return { executed: true, action: 'Validation des paroles (fallback sans contact)' };
    }

    // 2. Trouver la conversation
    const convs = await ctx.db.queryTable?.<Array<{ id: string; user_id: string; focus_order_id: string | null }>>(
      'conversations',
      `contact_id=eq.${contact.id}&order=created_at.desc&limit=1`,
    ).catch(() => []);
    const conv = convs?.[0];
    if (!conv) {
      log(`✍️ Conversation introuvable pour contact ${contact.id}`);
      return { executed: false, error: 'conversation_not_found' };
    }

    // 3. Fenêtrage temporel déterministe (Ancienne commande vs Nouvelle commande)
    const closedOrders = await ctx.db.queryTable?.<Array<{ id: string; updated_at: string }>>(
      'orders',
      `conversation_id=eq.${conv.id}&stage=in.(delivered,closed)&order=updated_at.desc&limit=1`,
    ).catch(() => []);
    const lastClosed = closedOrders?.[0];

    let messageFilter = `conversation_id=eq.${conv.id}&order=created_at.desc&limit=40`;
    if (lastClosed?.updated_at) {
      messageFilter += `&created_at=gt.${encodeURIComponent(lastClosed.updated_at)}`;
    }

    const rawMessages = await ctx.db.queryTable?.<
      Array<{
        id: string;
        from_me: boolean;
        body: string | null;
        transcript: string | null;
        media_kind: string | null;
        wa_message_key: string | null;
        created_at: string;
      }>
    >('messages', messageFilter).catch(() => []);

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
      .map((m) => ({
        role: m.from_me ? ('merchant' as const) : ('client' as const),
        text: (m.transcript || m.body || '').trim(),
        createdAt: m.created_at,
        isVoice: m.media_kind === 'audio' || Boolean(m.transcript),
      }))
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
        language: brief.language,
        memories: brief.memories,
        studioName: 'Velaris Studio',
      });

      // Bulle 1 : Le texte intégral de la chanson
      const multiLabel = extracted.briefs.length > 1 ? ` (Option ${i + 1}/${extracted.briefs.length})` : '';
      const lyricsMessage = `*« ${composed.title.toUpperCase()} »*${multiLabel}\n\n${composed.lyrics}`;
      await ctx.waha.send(session, chatId, {
        kind: 'text',
        text: lyricsMessage,
      });

      // Petite respiration humaine de 1.5s entre les deux bulles
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Bulle 2 : Message de politesse et validation
      const validationMessage = `Merci de me donner votre retour sur le texte. Une fois la validation faite, la chanson sera finalisée et aucune modification ne pourra être apportée. 🙏`;
      await ctx.waha.send(session, chatId, {
        kind: 'text',
        text: validationMessage,
      });

      // 8. Persistance dans la commande en base de données
      let orderId = conv.focus_order_id;
      if (!orderId || i > 0) {
        try {
          orderId = await ctx.db.rpc<string>('agent_open_order', { p_conversation: conv.id });
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
            lyrics_title: composed.title,
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

    log(`✅ [RÉACTION PAROLES ✍️ TERMINÉE AVEC SUCCÈS] : Paroles livrées à ${chatId}`);
    return { executed: true, action: 'Génération et livraison des paroles réussie' };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log(`❌ Erreur dans handleAutonomousLyricsGenerationAndDelivery: ${errorMsg}`);
    // En cas d'erreur inattendue de génération, assurer l'envoi du message de politesse pour ne pas laisser le client sans réponse
    try {
      await ctx.waha.send(session, chatId, {
        kind: 'text',
        text: EMOJI_AUTOMATIONS[cleanEmoji('✍️')]?.content || 'Merci de me donner votre retour sur le texte.',
      });
    } catch {
      // ignore
    }
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
    // 1. Trouver le contact
    const contacts = await ctx.db.queryTable?.<Array<{ id: string; user_id: string }>>(
      'contacts',
      `wa_jid=eq.${encodeURIComponent(chatId)}&select=id,user_id&limit=1`,
    ).catch(() => []);
    const contact = contacts?.[0];
    if (!contact) {
      log(`🎉 Contact introuvable pour ${chatId}`);
      return { executed: false, error: 'contact_not_found' };
    }

    // 2. Trouver la conversation
    const convs = await ctx.db.queryTable?.<Array<{ id: string }>>(
      'conversations',
      `contact_id=eq.${contact.id}&order=created_at.desc&limit=1`,
    ).catch(() => []);
    const conv = convs?.[0];
    if (!conv) {
      log(`🎉 Conversation introuvable pour ${chatId}`);
      return { executed: false, error: 'conversation_not_found' };
    }

    // 3. Trouver la commande ouverte non livrée
    const openOrders = await ctx.db.queryTable?.<Array<{ id: string; version: number; stage: string }>>(
      'orders',
      `conversation_id=eq.${conv.id}&stage=not.in.(delivered,closed,cancelled)&order=created_at.desc&limit=1`,
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
        `conversation_id=eq.${conv.id}&order=created_at.desc&limit=1`,
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
      `id=eq.${contact.id}`,
      { is_returning: true },
    ).catch(() => undefined);

    log(`✅ [COMMANDE CLÔTURÉE AVEC SUCCÈS 🎉] : Commande marquée terminée pour ${chatId}`);
    return { executed: true, action: 'Confirmation livraison & clôture commande' };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log(`❌ Erreur dans handleMarkDelivered: ${errorMsg}`);
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
  const action = EMOJI_AUTOMATIONS[emoji];
  if (!action) return { executed: false };

  // Normaliser le contexte
  const ctx: EmojiAutomationContext =
    wahaOrCtx && typeof (wahaOrCtx as any).send === 'function'
      ? { waha: wahaOrCtx as WahaClient, ...(logFn !== undefined ? { log: logFn } : {}) }
      : (wahaOrCtx as EmojiAutomationContext) || (logFn !== undefined ? { log: logFn } : {});

  const log = ctx.log ?? logFn;

  if (!shouldProcessReaction(reactedKey, emoji)) {
    log?.('[reaction-automation] Doublon ignoré', { reactedKey, emoji });
    return { executed: false, action: 'deduplicated' };
  }

  log?.(`⚡ [ACTION DÉCLENCHÉE PAR RÉACTION ${rawEmoji}] : "${action.label}" vers ${chatId}`);

  try {
    if (action.type === 'custom' && action.execute) {
      return await action.execute(ctx, session, chatId, reactedKey);
    }

    if (!ctx.waha) {
      log?.('[reaction-automation] WahaClient manquant');
      return { executed: false, error: 'missing_waha_client' };
    }

    if (action.type === 'text' && action.content) {
      await ctx.waha.send(session, chatId, { kind: 'text', text: action.content });
    } else if (action.type === 'voice' && action.url) {
      await ctx.waha.send(session, chatId, {
        kind: 'voice',
        url: action.url,
        mimetype: 'audio/ogg; codecs=opus',
      });
    } else if (action.type === 'video' && action.url) {
      await ctx.waha.send(session, chatId, {
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
