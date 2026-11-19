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
 *    - Envoi du lien vers le site officiel (https://djelia.store) et message d'accompagnement.
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

import * as fs from 'node:fs';
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
const TEST_MODES_PERSIST_FILE = process.env.TEST_MODES_FILE || '/tmp/velaris-test-modes.json';

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
  merchantTookOver?: boolean;
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

interface PendingConciergeTurn {
  session: string;
  chatId: string;
  phone: string;
  conversationId?: string | undefined;
  userId?: string | undefined;
  contactName?: string | undefined;
  accumulatedText: string;
  isInitialOnboarding: boolean;
  timer?: NodeJS.Timeout;
  typingTimer?: NodeJS.Timeout;
}

export class ConciergeService {
  private readonly pendingTurns = new Map<string, PendingConciergeTurn>();
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
    this.delayMs = deps.delayMs !== undefined ? deps.delayMs : 30_000;
    this.typingDelayMs = deps.typingDelayMs !== undefined ? deps.typingDelayMs : 22_000;
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
      if (fs.existsSync(TEST_MODES_PERSIST_FILE)) {
        const raw = fs.readFileSync(TEST_MODES_PERSIST_FILE, 'utf8');
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          for (const it of items) {
            if (it?.chatId) {
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
      const arr = Array.from(this.testModes.values());
      fs.writeFileSync(TEST_MODES_PERSIST_FILE, JSON.stringify(arr, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  /**
   * Retourne la configuration de test pour un chat donné.
   * Pour le numéro de test configuré (+226 05777308), le mode test est ACTIF PAR DÉFAUT (Cameroun +237)
   * sauf si explicitement désactivé via /stop.
   */
  getTestMode(chatId: string): TestModeConfig | null {
    if (this.testModes.has(chatId)) {
      return this.testModes.get(chatId)!;
    }
    if (isTestPhoneNumber(chatId)) {
      const defaultConfig: TestModeConfig = {
        chatId,
        countryCode: '237',
        countryName: 'Cameroun',
        simulatedPhone: '23769000000',
        active: true,
        startedAt: new Date().toISOString(),
      };
      this.testModes.set(chatId, defaultConfig);
      this.savePersistedTestModes();
      return defaultConfig;
    }
    return null;
  }

  /**
   * Active ou met à jour le mode test pour un numéro autorisé.
   */
  enableTestMode(chatId: string, countryCode = '237', countryName = 'Cameroun'): TestModeConfig {
    const config: TestModeConfig = {
      chatId,
      countryCode,
      countryName,
      simulatedPhone: `${countryCode}690000000`,
      active: true,
      merchantTookOver: false,
      startedAt: new Date().toISOString(),
    };
    this.testModes.set(chatId, config);
    this.savePersistedTestModes();
    return config;
  }

  /**
   * Annule tout tour en attente pour un chat donné.
   */
  cancelPendingTurn(chatId: string): void {
    const existing = this.pendingTurns.get(chatId);
    if (existing) {
      if (existing.timer) clearTimeout(existing.timer);
      if (existing.typingTimer) clearTimeout(existing.typingTimer);
      this.pendingTurns.delete(chatId);
      void this.deps.waha.typing(existing.session, chatId, false).catch(() => undefined);
      this.deps.log?.('[concierge] Tour en attente annulé pour cause d\'intervention gérant', { chatId });
    }
  }

  /**
   * Intervention manuelle du gérant depuis WhatsApp :
   * Débraye définitivement la conversation (mode humain permanent) et impose le silence absolu de l'IA.
   */
  async handleMerchantIntervention(session: string, chatId: string): Promise<void> {
    this.cancelPendingTurn(chatId);

    // 1. Débrayer la conversation en base : control_mode = 'human'
    if (this.deps.db.updateRows) {
      await this.deps.db.updateRows(
        'conversations',
        `chat_id=eq.${encodeURIComponent(chatId)}`,
        {
          control_mode: 'human',
          last_merchant_at: new Date().toISOString(),
        }
      ).catch(() => undefined);
    }

    // 2. Annuler immédiatement tout message sortant en attente
    if (this.deps.db.updateRows) {
      await this.deps.db.updateRows(
        'outbound_messages',
        `session_name=eq.${encodeURIComponent(session)}&chat_id=eq.${encodeURIComponent(chatId)}&status=in.(pending,proposed,sending)&origin=eq.agent`,
        { status: 'cancelled', error: 'merchant_took_over' }
      ).catch(() => undefined);
    }

    // 3. Si c'est le numéro de test, marquer que le gérant a pris la main (silence absolu jusqu'au prochain /reset)
    const testMode = this.getTestMode(chatId);
    if (testMode) {
      testMode.merchantTookOver = true;
      this.savePersistedTestModes();
    }

    this.deps.log?.('[concierge] Gérant intervenu -> mode humain permanent activé, silence total de l\'IA', { chatId });
  }

  /**
   * Vérifie de façon multi-couches si un contact est un ancien client ou sous contrôle gérant.
   * Si vrai, le concierge se tait et n'intervient jamais.
   */
  async checkIsReturningClient(
    _session: string,
    _chatId: string,
    contact: any,
    conversation: any
  ): Promise<{ isReturning: boolean; reason: string }> {
    // 0. Si le gérant est déjà intervenu manuellement dans ce chat : SILENCE TOTAL ET PERMANENT
    if (conversation?.control_mode === 'human' || conversation?.last_merchant_at) {
      // Garde de sécurité : vérifier si ce n'est pas un nouveau prospect pollué par l'auto-greeting
      const onboardingSent = Boolean(conversation?.ack_log?.concierge_onboarding_sent);
      if (!onboardingSent) {
        let hasRealManualHumanMsg = false;
        if (this.deps.db.queryTable && conversation?.id) {
          try {
            const msgs = await this.deps.db.queryTable<any[]>(
              'messages',
              `conversation_id=eq.${encodeURIComponent(conversation.id)}&direction=eq.outbound&limit=5`
            );
            hasRealManualHumanMsg = (msgs || []).some((m) => {
              const body = m.body || '';
              return !body.toLowerCase().includes('comment nous pouvons vous aider') &&
                     !body.toLowerCase().includes('dites-nous comment nous pouvons vous aider');
            });
          } catch {
            hasRealManualHumanMsg = false;
          }
        }
        if (!hasRealManualHumanMsg) {
          // Aucun vrai message du gérant : auto-réparation et maintien en mode IA
          if (this.deps.db.updateRows && conversation?.id) {
            void this.deps.db.updateRows('conversations', `id=eq.${encodeURIComponent(conversation.id)}`, {
              control_mode: 'ai',
              last_merchant_at: null,
            }).catch(() => undefined);
          }
          conversation.control_mode = 'ai';
          conversation.last_merchant_at = null;
        } else {
          return {
            isReturning: true,
            reason: conversation?.control_mode === 'human' ? 'conversation_human_control' : 'merchant_already_intervened',
          };
        }
      } else {
        return {
          isReturning: true,
          reason: conversation?.control_mode === 'human' ? 'conversation_human_control' : 'merchant_already_intervened',
        };
      }
    }
    if (this.getTestMode(_chatId)?.merchantTookOver) {
      return { isReturning: true, reason: 'merchant_took_over_test' };
    }

    // 0 bis. Mode test actif sans intervention du gérant : toujours considéré comme un nouveau prospect
    if (this.getTestMode(_chatId)?.active) {
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
    const rawCmd = parts[0]?.toLowerCase().trim() || '';
    const cmd = rawCmd.replace(/^[/#!]/, '');
    const arg = parts.slice(1).join(' ').toLowerCase().trim();

    const chatId = ev.chatId;
    const session = ev.session;

    if (cmd === 'test' || cmd === 'mode') {
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

      this.enableTestMode(chatId, countryCode, countryName);
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

    if (cmd === 'reset' || cmd === 'clear' || cmd === 'recommencer') {
      const current = this.getTestMode(chatId);
      const countryCode = current?.countryCode || '237';
      const countryName = current?.countryName || 'Cameroun';
      this.enableTestMode(chatId, countryCode, countryName);
      await this.wipeConversationForTest(chatId, conversation?.id, contact?.id);

      const reply =
        `[CONVERSATION RÉINITIALISÉE]\n\n` +
        `Toutes les données de la discussion ont été purgées. Les compteurs sont remis à zéro.\n` +
        `Pays simulé : ${countryName} (+${countryCode}).\n\n` +
        `Vous pouvez renvoyer un premier message (ex: 'Bonjour') pour retester l'accueil depuis le début !`;

      await this.deps.waha.send(session, chatId, { kind: 'text', text: reply });
      return { handled: true, action: 'test_conversation_reset' };
    }

    if (cmd === 'stop' || cmd === 'off' || cmd === 'quitter') {
      this.testModes.set(chatId, {
        chatId,
        countryCode: '226',
        countryName: 'Burkina Faso',
        simulatedPhone: '22605777308',
        active: false,
        startedAt: new Date().toISOString(),
      });
      this.savePersistedTestModes();
      await this.wipeConversationForTest(chatId, conversation?.id, contact?.id);

      const reply =
        `[MODE TEST DÉSACTIVÉ]\n\n` +
        `Le numéro +226 05777308 est revenu en mode normal (gérant humain WhatsApp).\n` +
        `Pour réactiver le test à tout moment, tapez : /test`;

      await this.deps.waha.send(session, chatId, { kind: 'text', text: reply });
      return { handled: true, action: 'test_mode_deactivated' };
    }

    if (cmd === 'aide' || cmd === 'help' || cmd === 'statut' || cmd === 'status') {
      const current = this.getTestMode(chatId);
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

    // Si le message est tapé par le gérant (fromMe et non écho API) : débrayage 100% humain permanent
    if (ev.fromMe && ev.source !== 'api') {
      // Détection des messages d'accueil automatiques WhatsApp Business (ex: "Bonjour ! Dites-nous comment nous pouvons vous aider.")
      const isAutoGreeting = ev.body && (
        ev.body.toLowerCase().includes('dites-nous comment nous pouvons vous aider') ||
        ev.body.toLowerCase().includes('comment nous pouvons vous aider')
      );
      if (isAutoGreeting) {
        this.deps.log?.('[concierge] Message d\'accueil automatique WhatsApp Business ignoré (pas de débrayage humain)', {
          chatId: ev.chatId,
          body: ev.body,
        });
        return { handled: false, reason: 'whatsapp_business_auto_greeting_ignored' };
      }

      await this.handleMerchantIntervention(ev.session, ev.chatId);
      return { handled: false, reason: 'merchant_message' };
    }
    if (ev.fromMe) {
      return { handled: false, reason: 'api_echo_ignored' };
    }

    // 0. Interception des commandes de test pour le numéro autorisé (+226 05777308)
    const firstWord = ev.body?.trim().split(/\s+/)[0]?.toLowerCase().replace(/^[/#!]/, '') || '';
    if (
      isTestPhoneNumber(ev.chatId) &&
      (ev.body?.trim().startsWith('/') ||
        ev.body?.trim().startsWith('#') ||
        ev.body?.trim().startsWith('!') ||
        ['test', 'stop', 'aide', 'help', 'mode', 'reset', 'clear', 'recommencer'].includes(firstWord))
    ) {
      return await this.handleTestCommand(ev);
    }

    const testConfig = this.getTestMode(ev.chatId);
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

    // Planification du tour (temporisation de 30s avec regroupement des rafales, typing et exécution)
    return await this.scheduleTurn(ev as MessageEvent, conversation, contact, !onboardingSent);
  }

  /**
   * Envoi du pack d'accueil : Note vocale (accueil ou prix) + Vidéo tutoriel (136s, 4.4 Mo) + Message texte avec lien officiel.
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

    // 3. Message texte officiel avec lien direct vers le site
    const onboardingText = isPrice
      ? "Pour composer votre chanson personnalisée avec vos paroles (2 versions complètes incluses) :\nLe tarif est de 1 200 francs.\n\nVoici le lien de notre site officiel : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et écrivez-moi directement ici si vous avez la moindre question !"
      : "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner.";

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
   * Planifie ou agrège un tour pour un client (onboarding initial ou support différé)
   * avec une temporisation humaine de 30 secondes (typing pendant les 8 dernières secondes),
   * regroupement des rafales de messages et analyse visuelle/audio.
   */
  private async scheduleTurn(
    ev: MessageEvent,
    conversation: any,
    contact: any,
    isInitialOnboarding: boolean
  ): Promise<{ handled: boolean; action?: string; reason?: string }> {
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

    const testConfig = this.getTestMode(chatId);
    const isTestActive = Boolean(testConfig?.active);
    const phone = (isTestActive && testConfig) ? testConfig.simulatedPhone : (contact?.phone || ev.chatId);
    const session = ev.session;
    const conversationId = conversation?.id;
    const userId = conversation?.user_id;
    const contactName = contact?.name;

    const existing = this.pendingTurns.get(chatId);
    if (existing) {
      if (existing.timer) clearTimeout(existing.timer);
      if (existing.typingTimer) clearTimeout(existing.typingTimer);
      existing.accumulatedText += '\n' + messageText;
      if (conversationId && !existing.conversationId) existing.conversationId = conversationId;
      if (userId && !existing.userId) existing.userId = userId;
      if (contactName && !existing.contactName) existing.contactName = contactName;
    }

    const accumulatedText = existing ? existing.accumulatedText : messageText;
    const turnIsInitialOnboarding = existing ? existing.isInitialOnboarding : isInitialOnboarding;

    // Cas synchrone (pour tests unitaires avec delayMs: 0)
    if (this.delayMs === 0) {
      this.pendingTurns.delete(chatId);
      const isPrice = isPriceQuestion(accumulatedText);
      await this.executeTurn(
        session,
        chatId,
        phone,
        accumulatedText,
        turnIsInitialOnboarding,
        conversationId,
        userId,
        contactName,
        conversation
      );
      return {
        handled: true,
        action: turnIsInitialOnboarding
          ? (isPrice ? 'onboarding_price_pack_sent' : 'onboarding_welcome_pack_sent')
          : 'support_replied',
      };
    }

    // Cas asynchrone temporisé (30 secondes en production, typing aux 8 dernières secondes)
    const effectiveDelayMs = this.delayMs;
    const effectiveTypingMs = this.typingDelayMs;

    const typingTimer = setTimeout(() => {
      this.deps.log?.('[concierge] Déclenchement indicateur de frappe (typing)...', { chatId });
      void this.deps.waha.typing(session, chatId, true).catch(() => undefined);
    }, effectiveTypingMs);

    const timer = setTimeout(async () => {
      this.pendingTurns.delete(chatId);
      await this.executeTurn(
        session,
        chatId,
        phone,
        accumulatedText,
        turnIsInitialOnboarding,
        conversationId,
        userId,
        contactName,
        conversation
      );
    }, effectiveDelayMs);

    this.pendingTurns.set(chatId, {
      session,
      chatId,
      phone,
      conversationId,
      userId,
      contactName,
      accumulatedText,
      isInitialOnboarding: turnIsInitialOnboarding,
      timer,
      typingTimer,
    });

    const isPrice = isPriceQuestion(accumulatedText);
    this.deps.log?.('[concierge] Tour programmé (temporisation 30s)', {
      chatId,
      isInitialOnboarding: turnIsInitialOnboarding,
      effectiveDelayMs,
      preview: messageText.slice(0, 60),
    });

    return {
      handled: true,
      action: turnIsInitialOnboarding
        ? (isPrice ? 'onboarding_price_pack_scheduled' : 'onboarding_welcome_pack_scheduled')
        : 'support_scheduled',
    };
  }

  /**
   * Exécute le tour une fois la temporisation de 30 secondes écoulée.
   */
  private async executeTurn(
    session: string,
    chatId: string,
    phone: string,
    accumulatedText: string,
    isInitialOnboarding: boolean,
    conversationId?: string,
    userId?: string,
    contactName?: string | null,
    conversation?: any
  ): Promise<void> {
    try {
      // 1. Arrêter l'indicateur de saisie
      await this.deps.waha.typing(session, chatId, false).catch(() => undefined);

      // 2. Si c'est l'onboarding initial : envoi du pack (Vocal + Vidéo + Texte studio)
      if (isInitialOnboarding) {
        const isPrice = isPriceQuestion(accumulatedText);
        await this.sendOnboardingPack(session, chatId, conversation, isPrice);
        return;
      }

      // 3. Sinon : Support Concierge 24/7 (DeepSeek via Kie.ai)
      await this.executeSupportReply(
        session,
        chatId,
        phone,
        accumulatedText,
        conversationId,
        userId,
        contactName
      );
    } catch (err: any) {
      this.deps.log?.('[concierge] Erreur lors de l\'exécution du tour concierge', { error: err?.message || err });
      await this.deps.waha.typing(session, chatId, false).catch(() => undefined);
    }
  }

  /**
   * Génération et expédition de la réponse via DeepSeek (Kie.ai) avec support 1 ou 2 bulles,
   * garde-fou SILENCE et passage de main au responsable si litige/doute.
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

      // Si l'IA répond SILENCE (doute ou garde-fou) : ne rien envoyer du tout
      if (!answer || answer.trim().toUpperCase() === 'SILENCE') {
        this.deps.log?.('[concierge] Garde-fou SILENCE activé -> aucun message envoyé', { chatId });
        return;
      }

      // Détection de passage de main au responsable de l'atelier
      const isManagerHandoff = answer.toLowerCase().includes("responsable de l'atelier");

      // Découpage en 1 ou 2 bulles si présent (séparateur '---' ou double saut de ligne)
      let bubbles: string[] = [];
      if (answer.includes('---')) {
        bubbles = answer.split(/\s*---\s*/).map((b) => b.trim()).filter(Boolean);
      } else if (answer.includes('\n\n')) {
        bubbles = answer.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
      }

      if (bubbles.length === 0) {
        bubbles = [answer];
      } else if (bubbles.length > 2) {
        const first = bubbles[0] || answer;
        const rest = bubbles.slice(1).join('\n\n');
        bubbles = [first, rest];
      }

      // Envoi de la ou des bulles avec un délai réaliste de 1.5s entre chaque bulle
      for (let i = 0; i < bubbles.length; i++) {
        const bubbleText = bubbles[i];
        if (!bubbleText) continue;
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }
        await this.deps.waha.send(session, chatId, {
          kind: 'text',
          text: bubbleText,
        });
      }

      this.deps.log?.('[concierge] Réponse de support expédiée avec succès', { chatId, bubblesCount: bubbles.length });

      // Enregistrement dans la table messages
      if (conversationId && userId && this.deps.db.insertRow) {
        await this.deps.db.insertRow('messages', {
          user_id: userId,
          conversation_id: conversationId,
          role: 'assistant',
          direction: 'outbound',
          body: bubbles.join('\n\n'),
          media_kind: null,
          created_at: new Date().toISOString(),
        }).catch(() => undefined);
      }

      // Si passage de main au responsable, débrayer immédiatement en mode humain
      if (isManagerHandoff) {
        await this.handleMerchantIntervention(session, chatId);
      }
    } catch (err: any) {
      this.deps.log?.('[concierge] Erreur lors de l\'exécution du support', { error: err?.message || err });
      await this.deps.waha.typing(session, chatId, false).catch(() => undefined);
    }
  }
}
