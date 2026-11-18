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
  isAskingForProcedureOrTutorial,
  isAskingForDemoOrSample,
  isPriceQuestion,
  extractCleanPhone,
  isBurkinaFasoNumber,
} from '../llm/concierge-brain.js';

export const TEST_PHONE_NUMBER = '22605777308';

export function isTestPhoneNumber(phoneOrJid?: string | null): boolean {
  if (!phoneOrJid) return false;
  const clean = extractCleanPhone(phoneOrJid);
  return clean === TEST_PHONE_NUMBER || clean === '05777308' || clean.endsWith('22605777308') || clean.endsWith('05777308');
}

export interface TestModeConfig {
  chatId: string;
  countryCode: string;
  countryName: string;
  simulatedPhone: string;
  active: boolean;
  startedAt: string;
}

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
  priceVoiceUrl?: string | undefined;
  videoUrl?: string | undefined;
  demoVideoUrl?: string | undefined;
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
  private readonly testModes = new Map<string, TestModeConfig>();
  private readonly voiceUrl: string;
  private readonly priceVoiceUrl: string;
  private readonly videoUrl: string;
  private readonly demoVideoUrl: string;
  private readonly delayMs: number;
  private readonly typingDelayMs: number;
  private readonly wahaUrl: string;
  private readonly wahaApiKey: string;
  private readonly kieApiKey: string | null;
  private readonly campaignStartDate: number;

  constructor(private readonly deps: ConciergeServiceDeps) {
    this.voiceUrl = deps.voiceUrl || 'https://waha.velarisagent.life/qr/assets/vocal_accueil_concierge.opus';
    this.priceVoiceUrl = deps.priceVoiceUrl || 'https://waha.velarisagent.life/qr/assets/vocal_prix_concierge.opus';
    this.videoUrl = deps.videoUrl || 'https://waha.velarisagent.life/qr/assets/djelia_tuto_mobile.mp4';
    this.demoVideoUrl = deps.demoVideoUrl || 'https://waha.velarisagent.life/qr/assets/324048.mp4';
    this.delayMs = deps.delayMs ?? 30_000;
    this.typingDelayMs = deps.typingDelayMs ?? 22_000;
    this.wahaUrl = (deps.wahaUrl || 'http://waha:3000').replace(/\/$/, '');
    this.wahaApiKey = deps.wahaApiKey || '';
    this.kieApiKey = deps.kieApiKey || null;
    this.campaignStartDate = deps.campaignStartDateIso
      ? new Date(deps.campaignStartDateIso).getTime()
      : new Date('2026-11-17T12:00:00Z').getTime();

    this.loadPersistedTestModes();
  }

  private loadPersistedTestModes(): void {
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const p = path.resolve(__dirname, '../assets/test-modes.json');
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          for (const it of items) {
            if (it?.chatId && it?.active) {
              this.testModes.set(it.chatId, it);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private savePersistedTestModes(): void {
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const p = path.resolve(__dirname, '../assets/test-modes.json');
      const arr = Array.from(this.testModes.values());
      fs.writeFileSync(p, JSON.stringify(arr, null, 2), 'utf8');
    } catch {
      // ignore
    }
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
    // 0. Mode test actif : toujours considéré comme un nouveau prospect
    if (this.testModes.get(_chatId)?.active) {
      return { isReturning: false, reason: 'test_mode_forced_new_lead' };
    }

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
   * Traite les commandes spéciales reçues depuis le numéro de test autorisé (+226 05777308).
   */
  private async handleTestCommand(
    ev: MessageEvent,
    conversation?: any,
    contact?: any
  ): Promise<{ handled: boolean; action?: string; reason?: string }> {
    const text = ev.body?.trim() || '';
    const parts = text.split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || '';
    const arg = parts.slice(1).join(' ').toLowerCase().trim();

    const chatId = ev.chatId;
    const session = ev.session;

    if (cmd === '/test' || cmd === '/mode') {
      let countryCode = '237';
      let countryName = 'Cameroun';

      if (arg.includes('ci') || arg.includes('ivoire')) {
        countryCode = '225';
        countryName = "Côte d'Ivoire";
      } else if (arg.includes('sn') || arg.includes('senegal')) {
        countryCode = '221';
        countryName = 'Sénégal';
      } else if (arg.includes('bf') || arg.includes('burkina')) {
        countryCode = '226';
        countryName = 'Burkina Faso';
      } else if (arg.includes('fr') || arg.includes('france') || arg.includes('diaspora')) {
        countryCode = '33';
        countryName = 'France (Diaspora)';
      } else if (arg.includes('ga') || arg.includes('gabon')) {
        countryCode = '241';
        countryName = 'Gabon';
      } else if (arg.includes('cd') || arg.includes('congo') || arg.includes('rdc')) {
        countryCode = '243';
        countryName = 'RD Congo';
      }

      this.testModes.set(chatId, {
        chatId,
        countryCode,
        countryName,
        simulatedPhone: `${countryCode}690000000`,
        active: true,
        startedAt: new Date().toISOString(),
      });
      this.savePersistedTestModes();

      await this.wipeConversationForTest(chatId, conversation?.id, contact?.id);

      const reply =
        `[MODE TEST ACTIVÉ]\n\n` +
        `Simulateur configuré comme un NOUVEAU PROSPECT de : ${countryName} (+${countryCode}).\n` +
        `Toute la discussion a été effacée et les compteurs remis à zéro.\n\n` +
        `Envoyez votre premier message (ex: 'Bonjour' ou 'C'est combien ?') pour démarrer le test !\n\n` +
        `Commandes utiles :\n` +
        `• /reset : efface tout et recommence à zéro\n` +
        `• /stop : quitte le mode test et revient en mode normal\n` +
        `• /test [pays] : change le pays simulé (ex: /test ci, /test sn, /test cm)`;

      await this.deps.waha.send(session, chatId, { kind: 'text', text: reply });
      return { handled: true, action: `test_mode_activated_${countryCode}` };
    }

    if (cmd === '/reset' || cmd === '/clear' || cmd === '/recommencer') {
      const current = this.testModes.get(chatId);
      await this.wipeConversationForTest(chatId, conversation?.id, contact?.id);

      const countryInfo = current ? `${current.countryName} (+${current.countryCode})` : 'Cameroun (+237)';
      const reply =
        `[CONVERSATION RÉINITIALISÉE]\n\n` +
        `Toutes les données de la discussion ont été purgées. Les compteurs sont remis à zéro.\n` +
        `Pays simulé : ${countryInfo}.\n\n` +
        `Vous pouvez renvoyer un premier message (ex: 'Bonjour') pour retester l'accueil depuis le début !`;

      await this.deps.waha.send(session, chatId, { kind: 'text', text: reply });
      return { handled: true, action: 'test_conversation_reset' };
    }

    if (cmd === '/stop' || cmd === '/off' || cmd === '/quitter') {
      this.testModes.delete(chatId);
      this.savePersistedTestModes();
      await this.wipeConversationForTest(chatId, conversation?.id, contact?.id);

      const reply =
        `[MODE TEST DÉSACTIVÉ]\n\n` +
        `Le numéro +226 05777308 est revenu en mode normal (gérant humain WhatsApp).\n` +
        `Pour réactiver le test à tout moment, tapez : /test`;

      await this.deps.waha.send(session, chatId, { kind: 'text', text: reply });
      return { handled: true, action: 'test_mode_deactivated' };
    }

    if (cmd === '/aide' || cmd === '/help' || cmd === '/statut' || cmd === '/status') {
      const current = this.testModes.get(chatId);
      const statusTxt = current?.active
        ? `ACTIF (Pays simulé : ${current.countryName} +${current.countryCode})`
        : `INACTIF (Mode normal gérant)`;

      const reply =
        `[STATUT DU MODE TEST]\n` +
        `Statut actuel : ${statusTxt}\n\n` +
        `Commandes disponibles :\n` +
        `• /test : active le test en simulant un client du Cameroun (+237)\n` +
        `• /test ci : simule un client de Côte d'Ivoire (+225)\n` +
        `• /test sn : simule un client du Sénégal (+221)\n` +
        `• /test bf : simule un client du Burkina Faso (+226)\n` +
        `• /reset : purge complètement la discussion pour recommencer à zéro\n` +
        `• /stop : désactive le mode test`;

      await this.deps.waha.send(session, chatId, { kind: 'text', text: reply });
      return { handled: true, action: 'test_help_sent' };
    }

    return { handled: false, reason: 'unknown_test_command' };
  }

  /**
   * Purge intégrale de la conversation pour le mode test :
   * Supprime les messages de la table messages, réinitialise ack_log et contacts.is_returning.
   */
  private async wipeConversationForTest(chatId: string, knownConvId?: string, knownContactId?: string): Promise<void> {
    this.cancelPendingTurn(chatId);

    if (!this.deps.db.queryTable) return;

    try {
      let convId = knownConvId;
      let contactId = knownContactId;

      if (!convId || !contactId) {
        const cleanPhone = extractCleanPhone(chatId);
        const contacts = await this.deps.db.queryTable<any[]>(
          'contacts',
          `wa_jid=eq.${encodeURIComponent(chatId)}&select=id&limit=1`
        );
        let c = contacts?.[0];
        if (!c && cleanPhone) {
          const byPhone = await this.deps.db.queryTable<any[]>(
            'contacts',
            `phone=eq.${encodeURIComponent(cleanPhone)}&select=id&limit=1`
          );
          c = byPhone?.[0];
        }
        contactId = c?.id || contactId;

        if (contactId) {
          const convs = await this.deps.db.queryTable<any[]>(
            'conversations',
            `contact_id=eq.${encodeURIComponent(contactId)}&select=id&limit=1`
          );
          convId = convs?.[0]?.id || convId;
        }
        if (!convId) {
          const convsByChat = await this.deps.db.queryTable<any[]>(
            'conversations',
            `chat_id=eq.${encodeURIComponent(chatId)}&select=id&limit=1`
          );
          convId = convsByChat?.[0]?.id || convId;
        }
      }

      // 1. Supprimer tous les messages de la table messages
      if (convId && this.deps.db.deleteRows) {
        await this.deps.db.deleteRows('messages', `conversation_id=eq.${convId}`).catch(() => undefined);
        await this.deps.db.deleteRows('orders', `conversation_id=eq.${convId}`).catch(() => undefined);
      }

      // 2. Réinitialiser la conversation
      if (convId && this.deps.db.updateRows) {
        await this.deps.db.updateRows('conversations', `id=eq.${convId}`, {
          ack_log: {
            concierge_onboarding_sent: false,
            video_tutorial_sent: false,
            demo_video_sent: false,
            test_mode: true,
          },
          control_mode: 'ai',
          ai_paused: false,
          funnel_stage: 'new',
          last_merchant_at: null,
        }).catch(() => undefined);
      }

      // 3. Réinitialiser le contact
      if (contactId && this.deps.db.updateRows) {
        await this.deps.db.updateRows('contacts', `id=eq.${contactId}`, {
          is_returning: false,
        }).catch(() => undefined);
      }

      // 4. Annuler tout message sortant en attente
      if (this.deps.db.updateRows) {
        await this.deps.db.updateRows(
          'outbound_messages',
          `chat_id=eq.${encodeURIComponent(chatId)}&status=in.(pending,unknown,queued)`,
          { status: 'cancelled' }
        ).catch(() => undefined);
      }

      this.deps.log?.('[concierge] Conversation purgée avec succès pour le test', { chatId, convId });
    } catch (err: any) {
      this.deps.log?.('[concierge] Erreur purge conversation test', { error: err?.message || err, chatId });
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

    // 0. Interception des commandes de test pour le numéro autorisé (+226 05777308)
    if (isTestPhoneNumber(ev.chatId) && ev.body?.trim().startsWith('/')) {
      return await this.handleTestCommand(ev);
    }

    const testConfig = this.testModes.get(ev.chatId);
    const isTestActive = Boolean(testConfig?.active);

    // 0 bis. RÈGLE INVIOLABLE BURKINA FASO (+226) : 100% GÉRANT HUMAIN (ANCIENS COMME NOUVEAUX)
    // Sauf si le numéro autorisé est en mode test actif !
    if (isBurkinaFasoNumber(ev.chatId) && !isTestActive) {
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

      // Si le contact en base a un numéro Burkinabé (+226) et n'est pas en test, débrayage 100% humain immédiat
      if (contact?.phone && isBurkinaFasoNumber(contact.phone) && !isTestActive) {
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
      const isPrice = isPriceQuestion(ev.body);
      await this.sendOnboardingPack(ev.session, ev.chatId, conversation, isPrice);
      return { handled: true, action: isPrice ? 'onboarding_price_pack_sent' : 'onboarding_welcome_pack_sent' };
    }

    // Étape B : Questions ultérieures du lead -> Support Concierge 24/7 avec temporisation
    await this.scheduleSupportReply(ev, conversation, contact);
    return { handled: true, action: 'support_scheduled' };
  }

  /**
   * Envoi du pack d'accueil : Note vocale (accueil ou prix) + Vidéo tutoriel (136s, 4.4 Mo) + Message texte avec lien direct studio web.
   * Le vocal annonce la vidéo, la vidéo suit immédiatement, puis le message donne le lien et invite à poser des questions.
   */
  private async sendOnboardingPack(
    session: string,
    chatId: string,
    conversation: any,
    isPrice: boolean = false
  ): Promise<void> {
    const targetVoiceUrl = isPrice ? this.priceVoiceUrl : this.voiceUrl;
    this.deps.log?.('[concierge] Envoi du pack d\'accueil au nouveau lead', {
      chatId,
      session,
      isPrice,
      voiceUrl: targetVoiceUrl,
    });

    // 1. Note vocale PTT (Voix de la sœur clonée, annonce la vidéo)
    await this.deps.waha.send(session, chatId, {
      kind: 'voice',
      url: targetVoiceUrl,
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
    const onboardingText = isPrice
      ? "Nos formules officielles :\n• Chanson personnalisée complète (2 versions MP3) : 1 200 F CFA\n• Chanson + montage vidéo avec vos photos : 3 500 F CFA\n\nVoici le lien de notre studio en ligne : https://djelia.store/studio.html\n\nRegardez la courte vidéo ci-dessus et écrivez-moi directement ici si vous avez la moindre question !"
      : "Voici le lien de notre studio en ligne pour composer votre chanson en quelques clics : https://djelia.store/studio.html\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner.";

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
        onboarding_type: isPrice ? 'price' : 'welcome',
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

    const testConfig = this.testModes.get(chatId);
    const isTestActive = Boolean(testConfig?.active);

    const accumulatedText = existing ? existing.accumulatedText : messageText;
    const session = ev.session;
    const conversationId = conversation?.id;
    const userId = conversation?.user_id;
    const phone = (isTestActive && testConfig) ? testConfig.simulatedPhone : (contact?.phone || ev.chatId);

    const effectiveDelayMs = isTestActive ? 5_000 : this.delayMs;
    const effectiveTypingMs = isTestActive ? 1_500 : this.typingDelayMs;

    // Déclencheur typing
    const typingTimer = setTimeout(() => {
      this.deps.log?.('[concierge] Déclenchement indicateur de frappe (typing)...', { chatId });
      void this.deps.waha.typing(session, chatId, true).catch(() => undefined);
    }, effectiveTypingMs);

    // Déclencheur d'envoi final
    const timer = setTimeout(async () => {
      this.pendingTurns.delete(chatId);
      await this.executeSupportReply(session, chatId, phone, accumulatedText, conversationId, userId, contact?.name);
    }, effectiveDelayMs);

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

    this.deps.log?.('[concierge] Tour de support programmé', { chatId, isTestActive, effectiveDelayMs, preview: messageText.slice(0, 60) });
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

      // Vérifier si la vidéo tutoriel ou démo a déjà été envoyée à ce contact
      let videoAlreadySent = false;
      let demoAlreadySent = false;
      let currentAckLog: Record<string, any> = {};

      if (conversationId && this.deps.db.queryTable) {
        try {
          const convs = await this.deps.db.queryTable<any[]>(
            'conversations',
            `id=eq.${encodeURIComponent(conversationId)}&select=ack_log&limit=1`
          );
          currentAckLog = convs?.[0]?.ack_log || {};
          videoAlreadySent = Boolean(currentAckLog.video_tutorial_sent);
          demoAlreadySent = Boolean(currentAckLog.demo_video_sent);
        } catch {
          // ignore
        }
      }

      // 1. Si le client demande la démarche/procédure et que le tutoriel n'a pas été envoyé :
      const shouldSendTutorialNow = !videoAlreadySent && isAskingForProcedureOrTutorial(incomingText);
      if (shouldSendTutorialNow) {
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

        // Verrou d'unicité en base : JAMAIS renvoyée
        if (conversationId && this.deps.db.updateRows) {
          const updatedAck = {
            ...currentAckLog,
            video_tutorial_sent: true,
            video_tutorial_sent_at: new Date().toISOString(),
          };
          await this.deps.db.updateRows('conversations', `id=eq.${conversationId}`, {
            ack_log: updatedAck,
          }).catch(() => undefined);
          currentAckLog = updatedAck;
          videoAlreadySent = true;
        }

        await new Promise((r) => setTimeout(r, 1200));
      }

      // 2. Si le client demande un exemple / démo et qu'elle n'a pas encore été envoyée :
      const shouldSendDemoNow = !demoAlreadySent && !shouldSendTutorialNow && isAskingForDemoOrSample(incomingText);
      if (shouldSendDemoNow) {
        this.deps.log?.('[concierge] Envoi intelligent de la vidéo démo (exemple demandé)', { chatId });
        await this.deps.waha.send(session, chatId, {
          kind: 'video',
          url: this.demoVideoUrl,
          filename: '324048.mp4',
          mimetype: 'video/mp4',
          caption: 'Voici un aperçu d\'une de nos créations avec montage vidéo',
        }).catch((err) => {
          this.deps.log?.('[concierge] Erreur envoi vidéo démo', { error: err?.message || err });
        });

        if (conversationId && this.deps.db.updateRows) {
          const updatedAck = {
            ...currentAckLog,
            demo_video_sent: true,
            demo_video_sent_at: new Date().toISOString(),
          };
          await this.deps.db.updateRows('conversations', `id=eq.${conversationId}`, {
            ack_log: updatedAck,
          }).catch(() => undefined);
          currentAckLog = updatedAck;
          demoAlreadySent = true;
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
          videoAlreadySent: videoAlreadySent || shouldSendTutorialNow,
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
