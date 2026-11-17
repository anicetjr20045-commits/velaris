/**
 * Service Concierge Djélia 24/7 (Web-First WhatsApp Onboarding & Support).
 *
 * Responsabilités :
 * 1. Détection déterministe et impérméable des NOUVEAUX LEADS vs ANCIENS CLIENTS :
 *    - Si le client est ancien (contacts.is_returning = true, commandes existantes, messages antérieurs,
 *      ou first_seen_at avant le début de campagne) : LE CONCIERGE NE S'EXÉCUTE JAMAIS (Silence absolu).
 * 2. Au premier message d'un nouveau lead :
 *    - Envoi du vocal d'accueil PTT (voix de la sœur clonée).
 *    - Envoi de la vidéo tutoriel smartphone (maquette écran + voix clonée, 136s, < 16 Mo).
 *    - Envoi du lien vers le studio web (https://djelia.store/studio.html) et message d'accompagnement.
 *    - Marquage en base : concierge_onboarding_sent = true.
 * 3. Aux messages et questions ultérieures du lead (blocage, question tarif, moyen de paiement Chariow...) :
 *    - Détection automatique du pays de provenance (+237 Cameroun, +225 Côte d'Ivoire...) et des paiements locaux.
 *    - Analyse visuelle multimodale par IA (Kie.ai Gemini Flash) si le client transmet une capture d'écran du site.
 *    - Compression roulante de l'historique pour les discussions longues (> 6 messages).
 *    - Temporisation humaine déterministe de 30 secondes (regroupement de toutes les rafales de messages).
 *    - Indicateur de présence « en train d'écrire... » (composing) pendant les 8 dernières secondes.
 *    - Génération de la réponse via concierge-brain (DeepSeek via Kie.ai).
 *    - Envoi du message et arrêt de l'indicateur de saisie.
 * 4. Débrayage immédiat si le gérant prend la main depuis son téléphone WhatsApp.
 */

import type { Db } from '../db/rest.js';
import type { WahaClient } from '../send/waha-client.js';
import type { DeepSeekProvider } from '../llm/deepseek.js';
import type { AudioTranscriber } from './transcribe.js';
import type { NormalizedEvent, MessageEvent } from '../ingest/normalize.js';
import {
  generateConciergeReply,
  describeScreenshotWithVision,
  isDirectSpecificQuestion,
  isAskingForProcedureOrTutorial,
  extractCleanPhone,
  isBurkinaFasoNumber,
} from '../llm/concierge-brain.js';

export interface ConciergeServiceDeps {
  db: Db;
  waha: WahaClient;
  wahaUrl?: string | undefined;
  wahaApiKey?: string | undefined;
  kieApiKey?: string | null | undefined;
  llmProvider: DeepSeekProvider;
  transcriber?: AudioTranscriber | undefined;
  protectedSessions?: readonly string[] | undefined;
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined;
  voiceUrl?: string | undefined;
  videoUrl?: string | undefined;
  delayMs?: number | undefined;
  typingDelayMs?: number | undefined;
  campaignStartDateIso?: string | undefined;
}

interface PendingSupportTurn {
  session: string;
  chatId: string;
  phone: string;
  conversationId: string;
  userId: string;
  accumulatedText: string;
  timer: NodeJS.Timeout;
  typingTimer: NodeJS.Timeout;
}

export class ConciergeService {
  private readonly pendingTurns = new Map<string, PendingSupportTurn>();
  private readonly voiceUrl: string;
  private readonly videoUrl: string;
  private readonly delayMs: number;
  private readonly typingDelayMs: number;
  private readonly wahaUrl: string;
  private readonly wahaApiKey: string;
  private readonly kieApiKey: string | null;
  private readonly campaignStartDate: number;

  constructor(private readonly deps: ConciergeServiceDeps) {
    this.voiceUrl = deps.voiceUrl || 'https://waha.velarisagent.life/qr/assets/vocal_accueil_concierge.opus';
    this.videoUrl = deps.videoUrl || 'https://waha.velarisagent.life/qr/assets/djelia_tuto_mobile.mp4';
    this.delayMs = deps.delayMs ?? 30_000;
    this.typingDelayMs = deps.typingDelayMs ?? 22_000;
    this.wahaUrl = (deps.wahaUrl || 'http://waha:3000').replace(/\/$/, '');
    this.wahaApiKey = deps.wahaApiKey || '';
    this.kieApiKey = deps.kieApiKey || null;
    this.campaignStartDate = deps.campaignStartDateIso
      ? new Date(deps.campaignStartDateIso).getTime()
      : new Date('2026-11-17T12:00:00Z').getTime();
  }

  /**
   * Annule tout tour en attente si le gérant écrit manuellement dans ce chat.
   */
  cancelPendingTurn(chatId: string): void {
    const existing = this.pendingTurns.get(chatId);
    if (existing) {
      clearTimeout(existing.timer);
      clearTimeout(existing.typingTimer);
      this.pendingTurns.delete(chatId);
      void this.deps.waha.typing(existing.session, chatId, false).catch(() => undefined);
      this.deps.log?.('[concierge] Tour en attente annulé pour cause d\'intervention gérant', { chatId });
    }
  }

  /**
   * Vérifie de façon multi-couches si un contact est un ancien client.
   * Si vrai, le concierge se tait et n'intervient jamais.
   */
  async checkIsReturningClient(
    _session: string,
    _chatId: string,
    contact: any,
    conversation: any
  ): Promise<{ isReturning: boolean; reason: string }> {
    // 1. Marqueur explicite sur la fiche contact
    if (contact?.is_returning === true) {
      return { isReturning: true, reason: 'contact_marked_returning' };
    }

    // 2. Marqueur explicite sur la conversation (ack_log)
    if (conversation?.ack_log?.returning_client || conversation?.ack_log?.is_returning) {
      return { isReturning: true, reason: 'conversation_ack_returning' };
    }

    // 3. Discussion sous contrôle gérant (human)
    if (conversation?.control_mode === 'human') {
      return { isReturning: true, reason: 'conversation_human_control' };
    }

    // 4. Échange historique déjà engagé par le gérant
    if (conversation?.last_merchant_at) {
      const merchantTime = new Date(conversation.last_merchant_at).getTime();
      if (merchantTime < this.campaignStartDate) {
        return { isReturning: true, reason: 'merchant_messaged_before_campaign' };
      }
    }

    // 5. Commandes existantes dans la table orders
    if (this.deps.db.queryTable) {
      if (contact?.id) {
        try {
          const orders = await this.deps.db.queryTable<any[]>(
            'orders',
            `contact_id=eq.${encodeURIComponent(contact.id)}&limit=1`
          );
          if (orders && orders.length > 0) {
            return { isReturning: true, reason: 'has_prior_orders' };
          }
        } catch {
          // continue
        }
      }
      if (conversation?.id) {
        try {
          const ordersByConv = await this.deps.db.queryTable<any[]>(
            'orders',
            `conversation_id=eq.${encodeURIComponent(conversation.id)}&limit=1`
          );
          if (ordersByConv && ordersByConv.length > 0) {
            return { isReturning: true, reason: 'has_prior_orders' };
          }
        } catch {
          // continue
        }
      }
    }

    // 6. Contact historique créé avant la campagne publicitaire actuelle
    const creationTime = contact?.created_at
      ? new Date(contact.created_at).getTime()
      : (contact?.first_seen_at ? new Date(contact.first_seen_at).getTime() : null);
    if (creationTime && creationTime < this.campaignStartDate) {
      return { isReturning: true, reason: 'contact_first_seen_before_campaign' };
    }

    // 7. Conversation créée avant la campagne actuelle
    if (conversation?.created_at) {
      const convCreationTime = new Date(conversation.created_at).getTime();
      if (convCreationTime < this.campaignStartDate) {
        return { isReturning: true, reason: 'conversation_created_before_campaign' };
      }
    }

    // 8. Messages historiques archivés dans la discussion antérieurs à aujourd'hui
    if (conversation?.id && this.deps.db.queryTable) {
      try {
        const priorMessages = await this.deps.db.queryTable<any[]>(
          'messages',
          `conversation_id=eq.${encodeURIComponent(conversation.id)}&created_at=lt.${new Date(this.campaignStartDate).toISOString()}&limit=1`
        );
        if (priorMessages && priorMessages.length > 0) {
          return { isReturning: true, reason: 'has_historical_messages' };
        }
      } catch {
        // continue
      }
    }

    return { isReturning: false, reason: 'new_lead' };
  }

  /**
   * Télécharge un média (image, vocal...) depuis WAHA.
   */
  async downloadMedia(mediaUrl: string, _waMessageId?: string, _chatId?: string): Promise<Buffer | null> {
    try {
      let targetUrl = mediaUrl;
      try {
        const parsed = new URL(mediaUrl);
        targetUrl = `${this.wahaUrl}${parsed.pathname}${parsed.search}`;
      } catch {
        if (!mediaUrl.startsWith('http')) {
          const slash = mediaUrl.startsWith('/') ? '' : '/';
          targetUrl = `${this.wahaUrl}${slash}${mediaUrl}`;
        }
      }

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: this.wahaApiKey ? { 'X-Api-Key': this.wahaApiKey } : {},
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        return null;
      }

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      return buf.length > 0 ? buf : null;
    } catch (err: any) {
      this.deps.log?.('[concierge] Erreur téléchargement média WAHA', { error: err?.message || err, mediaUrl });
      return null;
    }
  }

  /**
   * Évalue et traite un événement entrant pour le flux Concierge.
   * Retourne true si l'événement a été pris en charge par le concierge.
   */
  async handleEvent(ev: NormalizedEvent): Promise<{ handled: boolean; action?: string; reason?: string }> {
    if (ev.kind !== 'message') return { handled: false, reason: 'not_message' };
    if (this.deps.protectedSessions?.includes(ev.session)) return { handled: false, reason: 'protected_session' };

    // Si le message est tapé par le gérant (fromMe et non écho API) : annuler tout tour concierge en cours
    if (ev.fromMe) {
      this.cancelPendingTurn(ev.chatId);
      return { handled: false, reason: 'merchant_message' };
    }

    // 0. RÈGLE INVIOLABLE BURKINA FASO (+226) : 100% GÉRANT HUMAIN (ANCIENS COMME NOUVEAUX)
    // Aucun automate ni IA ne doit jamais répondre à un numéro du Burkina Faso.
    if (isBurkinaFasoNumber(ev.chatId)) {
      this.deps.log?.('[concierge] Numéro Burkina Faso (+226) détecté sur chatId -> 100% gérant humain', {
        chatId: ev.chatId,
      });
      return { handled: false, reason: 'burkina_faso_manual_handling' };
    }

    if (!this.deps.db.queryTable) {
      return { handled: false, reason: 'db_queryTable_not_available' };
    }

    // 1. Recherche du contact et de la conversation
    let contact: any = null;
    let conversation: any = null;

    try {
      const contacts = await this.deps.db.queryTable<any[]>(
        'contacts',
        `wa_jid=eq.${encodeURIComponent(ev.chatId)}&select=id,user_id,name,phone,wa_jid,created_at&limit=1`
      );
      contact = contacts?.[0] ?? null;

      if (!contact) {
        const cleanPhone = extractCleanPhone(ev.chatId);
        if (cleanPhone) {
          const byPhone = await this.deps.db.queryTable<any[]>(
            'contacts',
            `phone=eq.${encodeURIComponent(cleanPhone)}&select=id,user_id,name,phone,wa_jid,created_at&limit=1`
          );
          contact = byPhone?.[0] ?? null;
        }
      }

      // Si le contact en base a un numéro Burkinabé (+226), débrayage 100% humain immédiat
      if (contact?.phone && isBurkinaFasoNumber(contact.phone)) {
        this.deps.log?.('[concierge] Numéro Burkina Faso (+226) détecté sur fiche contact -> 100% gérant humain', {
          chatId: ev.chatId,
          phone: contact.phone,
        });
        return { handled: false, reason: 'burkina_faso_manual_handling' };
      }

      if (contact) {
        const convs = await this.deps.db.queryTable<any[]>(
          'conversations',
          `contact_id=eq.${encodeURIComponent(contact.id)}&select=id,user_id,control_mode,ack_log&order=created_at.desc&limit=1`
        );
        conversation = convs?.[0] ?? null;
      }

      if (!conversation) {
        const convsByChat = await this.deps.db.queryTable<any[]>(
          'conversations',
          `chat_id=eq.${encodeURIComponent(ev.chatId)}&select=id,user_id,contact_id,control_mode,ack_log&order=created_at.desc&limit=1`
        );
        conversation = convsByChat?.[0] ?? null;
      }
    } catch (err: any) {
      this.deps.log?.('[concierge] Erreur recherche contact/conversation', { error: err?.message || err });
      return { handled: false, reason: 'db_lookup_error' };
    }

    // 2. RÈGLE D'OR INVIOLABLE : Détection imperméable des anciens clients
    const returningCheck = await this.checkIsReturningClient(ev.session, ev.chatId, contact, conversation);
    if (returningCheck.isReturning) {
      this.deps.log?.('[concierge] Ancien client détecté -> Bipasse absolu du concierge', {
        chatId: ev.chatId,
        reason: returningCheck.reason,
      });
      return { handled: false, reason: returningCheck.reason };
    }

    // 3. Détermination : Nouveau Lead (Onboarding non reçu) vs Lead en Support
    const ackLog = conversation?.ack_log || {};
    const onboardingSent = Boolean(ackLog.concierge_onboarding_sent);

    if (!onboardingSent) {
      if (isDirectSpecificQuestion(ev.body)) {
        // Le client arrive avec une question directe et précise :
        // On ne balance pas la vidéo à l'aveugle ! On passe directement en mode Conseiller Support (30s) pour lui répondre précisément.
        this.deps.log?.('[concierge] Nouveau lead avec question directe -> Déviation vers Support Concierge', {
          chatId: ev.chatId,
          text: ev.body?.slice(0, 80),
        });
        if (conversation?.id && this.deps.db.updateRows) {
          const updatedAck = {
            ...(conversation.ack_log || {}),
            concierge_onboarding_sent: true,
            concierge_onboarding_sent_at: new Date().toISOString(),
            video_tutorial_sent: false,
          };
          await this.deps.db.updateRows('conversations', `id=eq.${conversation.id}`, { ack_log: updatedAck }).catch(() => undefined);
          conversation.ack_log = updatedAck;
        }
        await this.scheduleSupportReply(ev, conversation, contact);
        return { handled: true, action: 'support_scheduled_direct_question' };
      }

      // Étape A : Premier message d'un nouveau lead (accueil / pub générale) -> Envoi du pack d'accueil complet
      await this.sendOnboardingPack(ev.session, ev.chatId, conversation);
      return { handled: true, action: 'onboarding_pack_sent' };
    }

    // Étape B : Questions ultérieures du lead -> Support Concierge 24/7 avec temporisation
    await this.scheduleSupportReply(ev, conversation, contact);
    return { handled: true, action: 'support_scheduled' };
  }

  /**
   * Envoi du pack d'accueil : Note vocale PTT + Vidéo tutoriel smartphone + Message lien studio web.
   */
  private async sendOnboardingPack(session: string, chatId: string, conversation: any): Promise<void> {
    this.deps.log?.('[concierge] Envoi du pack d\'accueil au nouveau lead', { chatId, session });

    // 1. Note vocale d'accueil PTT
    await this.deps.waha.send(session, chatId, {
      kind: 'voice',
      url: this.voiceUrl,
      mimetype: 'audio/ogg; codecs=opus',
    }).catch((err) => {
      this.deps.log?.('[concierge] Erreur envoi vocal accueil', { error: err?.message || err });
    });

    // Pacing léger de 1.5s
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Vidéo tutoriel smartphone (maquette animée 136s, 4.4 Mo)
    await this.deps.waha.send(session, chatId, {
      kind: 'video',
      url: this.videoUrl,
      filename: 'djelia_tuto_mobile.mp4',
      mimetype: 'video/mp4',
      caption: 'Comment composer votre chanson personnalisée en 2 minutes sur Djélia',
    }).catch((err) => {
      this.deps.log?.('[concierge] Erreur envoi vidéo tutoriel', { error: err?.message || err });
    });

    // Pacing léger de 1.5s
    await new Promise((r) => setTimeout(r, 1500));

    // 3. Message texte officiel avec lien direct vers le studio
    const onboardingText =
      "Voici le lien de notre studio en ligne pour composer votre chanson en quelques clics : https://djelia.store/studio.html\n\n" +
      "Si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner.";

    await this.deps.waha.send(session, chatId, {
      kind: 'text',
      text: onboardingText,
    }).catch((err) => {
      this.deps.log?.('[concierge] Erreur envoi texte accueil', { error: err?.message || err });
    });

    // 4. Mettre à jour l'état en base pour ne jamais réexpédier l'onboarding ni la vidéo (verrou d'unicité)
    if (conversation?.id && this.deps.db.updateRows) {
      const updatedAck = {
        ...(conversation.ack_log || {}),
        concierge_onboarding_sent: true,
        concierge_onboarding_sent_at: new Date().toISOString(),
        video_tutorial_sent: true,
        video_tutorial_sent_at: new Date().toISOString(),
      };
      await this.deps.db.updateRows('conversations', `id=eq.${conversation.id}`, {
        ack_log: updatedAck,
      }).catch(() => undefined);
    }
  }

  /**
   * Planifie la réponse du concierge avec une temporisation humaine de 30s,
   * vision multimodale sur capture d'écran et indicateur de frappe.
   */
  private async scheduleSupportReply(ev: MessageEvent, conversation: any, contact: any): Promise<void> {
    const chatId = ev.chatId;
    let messageText = ev.body?.trim() || '';

    // Analyse visuelle si le client a envoyé une capture d'écran
    if (ev.mediaKind === 'image' && ev.mediaUrl && this.kieApiKey) {
      try {
        const imageBuffer = await this.downloadMedia(ev.mediaUrl, ev.waMessageId, chatId);
        if (imageBuffer) {
          const visionDesc = await describeScreenshotWithVision(this.kieApiKey, imageBuffer, ev.mediaMime || 'image/jpeg');
          if (visionDesc) {
            const visionTag = `[Capture d'écran envoyée par le client : ${visionDesc}]`;
            messageText = messageText ? `${visionTag}\n${messageText}` : visionTag;
            this.deps.log?.('[concierge] Capture d\'écran analysée par Vision IA', { chatId, visionDesc });
          }
        }
      } catch (visErr: any) {
        this.deps.log?.('[concierge] Erreur analyse vision capture', { error: visErr?.message || visErr });
      }
    } else if (ev.mediaKind === 'audio' && !messageText) {
      messageText = '[Note vocale reçue du client]';
    }

    const existing = this.pendingTurns.get(chatId);
    if (existing) {
      // Réinitialiser les timers et concaténer le message pour regrouper la rafale
      clearTimeout(existing.timer);
      clearTimeout(existing.typingTimer);
      existing.accumulatedText += '\n' + messageText;
    }

    const accumulatedText = existing ? existing.accumulatedText : messageText;
    const session = ev.session;
    const conversationId = conversation?.id;
    const userId = conversation?.user_id;
    const phone = contact?.phone || ev.chatId;

    // Déclencheur typing à T - 8s (22s après le début de la temporisation)
    const typingTimer = setTimeout(() => {
      this.deps.log?.('[concierge] Déclenchement indicateur de frappe (typing)...', { chatId });
      void this.deps.waha.typing(session, chatId, true).catch(() => undefined);
    }, this.typingDelayMs);

    // Déclencheur d'envoi final à T = 30s
    const timer = setTimeout(async () => {
      this.pendingTurns.delete(chatId);
      await this.executeSupportReply(session, chatId, phone, accumulatedText, conversationId, userId, contact?.name);
    }, this.delayMs);

    this.pendingTurns.set(chatId, {
      session,
      chatId,
      phone,
      conversationId,
      userId,
      accumulatedText,
      timer,
      typingTimer,
    });

    this.deps.log?.('[concierge] Tour de support programmé (fenêtre 30s)', { chatId, preview: messageText.slice(0, 60) });
  }

  /**
   * Génération et expédition de la réponse via DeepSeek (Kie.ai).
   */
  private async executeSupportReply(
    session: string,
    chatId: string,
    phone: string,
    incomingText: string,
    conversationId?: string,
    userId?: string,
    contactName?: string | null
  ): Promise<void> {
    try {
      this.deps.log?.('[concierge] Exécution de la réponse de support...', { chatId, text: incomingText });

      // Récupérer l'historique récent de la conversation pour le contexte
      let recentHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (conversationId && this.deps.db.queryTable) {
        try {
          const msgs = await this.deps.db.queryTable<any[]>(
            'messages',
            `conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.desc&limit=10`
          );
          if (msgs && msgs.length > 0) {
            recentHistory = msgs.reverse().map((m) => ({
              role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: m.body || '',
            }));
          }
        } catch {
          // Si indisponible, continuer sans historique
        }
      }

      // Vérifier si la vidéo tutoriel a déjà été envoyée à ce contact
      let videoAlreadySent = false;
      let currentAckLog: Record<string, any> = {};

      if (conversationId && this.deps.db.queryTable) {
        try {
          const convs = await this.deps.db.queryTable<any[]>(
            'conversations',
            `id=eq.${encodeURIComponent(conversationId)}&select=ack_log&limit=1`
          );
          currentAckLog = convs?.[0]?.ack_log || {};
          videoAlreadySent = Boolean(currentAckLog.video_tutorial_sent);
        } catch {
          // ignore
        }
      }

      // Si le client demande la procédure/comment faire et que la vidéo n'a JAMAIS été envoyée :
      const shouldSendVideoNow = !videoAlreadySent && isAskingForProcedureOrTutorial(incomingText);
      if (shouldSendVideoNow) {
        this.deps.log?.('[concierge] Envoi intelligent de la vidéo tutoriel (moment opportun procédure)', { chatId });
        await this.deps.waha.send(session, chatId, {
          kind: 'video',
          url: this.videoUrl,
          filename: 'djelia_tuto_mobile.mp4',
          mimetype: 'video/mp4',
          caption: 'Comment composer votre chanson personnalisée en 2 minutes sur Djélia',
        }).catch((err) => {
          this.deps.log?.('[concierge] Erreur envoi vidéo support', { error: err?.message || err });
        });

        // Verrou absolu d'unicité en base : JAMAIS envoyée deux fois
        if (conversationId && this.deps.db.updateRows) {
          const updatedAck = {
            ...currentAckLog,
            video_tutorial_sent: true,
            video_tutorial_sent_at: new Date().toISOString(),
          };
          await this.deps.db.updateRows('conversations', `id=eq.${conversationId}`, {
            ack_log: updatedAck,
          }).catch(() => undefined);
          videoAlreadySent = true;
        }

        await new Promise((r) => setTimeout(r, 1200));
      }

      const answer = await generateConciergeReply(
        this.deps.llmProvider,
        {
          incomingMessage: incomingText,
          recentHistory,
          contactName: contactName ?? undefined,
          phone,
          videoAlreadySent,
        },
        this.deps.log
      );

      // Arrêt du typing
      await this.deps.waha.typing(session, chatId, false).catch(() => undefined);

      // Envoi du message texte
      const sendRes = await this.deps.waha.send(session, chatId, {
        kind: 'text',
        text: answer,
      });

      this.deps.log?.('[concierge] Réponse de support expédiée avec succès', { chatId, answer, sendRes });

      // Enregistrement dans la table messages
      if (conversationId && userId && this.deps.db.insertRow) {
        await this.deps.db.insertRow('messages', {
          user_id: userId,
          conversation_id: conversationId,
          role: 'assistant',
          direction: 'outbound',
          body: answer,
          media_kind: null,
          created_at: new Date().toISOString(),
        }).catch(() => undefined);
      }
    } catch (err: any) {
      this.deps.log?.('[concierge] Erreur lors de l\'exécution du support', { error: err?.message || err });
      await this.deps.waha.typing(session, chatId, false).catch(() => undefined);
    }
  }
}
