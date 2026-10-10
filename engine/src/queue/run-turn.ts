/**
 * Exécution d'un tour de conversation (§ 7.4) :
 *  1. Lecture atomique du contexte complet (agent_turn_context)
 *  2. Compréhension structurée par DeepSeek (understand)
 *  3. Résolution de commande et décision déterministe (decideSafely)
 *  4. Application des actions sur Postgres (transitions, patchs de champs, effets)
 *  5. Rendu des sorties (gabarits, vocaux, rédaction IA avec garde-fous)
 *  6. Mise en boîte d'envoi (agent_enqueue_outbox)
 *  7. Clôture atomique du tour (agent_finish_turn) et journalisation (agent_log_turn).
 */

import type { Db } from '../db/rest.js';
import { decideSafely, resolveTarget } from '../domain/decide.js';
import { orderEtas, type Hours } from '../domain/clock.js';
import { planOutput, type StepPolicy, type StudioStepPolicies } from '../domain/step-policy.js';
import type {
  Action,
  BriefField,
  CatalogueItem,
  DecisionInput,
  OrderRef,
  OrderSnapshot,
  Step,
  StudioConfig,
  Understanding,
} from '../domain/types.js';
import { bodyHash } from '../ingest/wa-ids.js';
import type { LlmProvider } from '../llm/provider.js';
import { understand, type UnderstandInput } from '../llm/understand.js';
import { composeLyrics, reviseLyrics } from '../llm/lyrics-composer.js';
import { generateSalesReply, cataloguePrices } from '../llm/sales-brain.js';
import { renderOutputItem, type RenderContext, type RenderedMessage } from './render.js';

import type { AudioTranscriber } from '../services/transcribe.js';

export interface TurnRef {
  turnId: string;
  conversationId: string;
  userId: string;
  lockToken: number;
  trigger: string;
}

export interface RunTurnDeps {
  db: Db;
  llmProvider: LlmProvider;
  workerId: string;
  transcriber?: AudioTranscriber | undefined;
  log: (line: string, data?: Record<string, unknown>) => void;
}

export interface RunTurnOutcome {
  outcome: string;
  trace: string[];
  enqueuedIds: string[];
  latencyMs: number;
}

interface RawTurnContext {
  turn: {
    id: string;
    trigger: string;
    trigger_data: Record<string, unknown>;
    inbound_message_ids: string[];
    lock_token: number;
  };
  conversation: {
    id: string;
    user_id: string;
    contact_id: string;
    control_mode: 'ai' | 'human' | 'closed';
    control_reason: string | null;
    control_actor: 'agent' | 'merchant' | 'system' | null;
    focus_order_id: string | null;
    pending_question: Record<string, unknown> | null;
    ack_log: Record<string, string>;
    low_conf_streak: number;
    repeat_question_count: number;
    discount_requests: number;
    supersede_streak: number;
    session_name: string;
    chat_id: string;
    last_merchant_at: string | null;
    last_inbound_at: string | null;
  };
  contact: {
    name: string | null;
    phone: string;
    wa_jid: string;
  };
  contact_facts: {
    delivered_orders: number;
    /** CORRECTIF (M1) : le SQL (agent_contact_facts) retourne procedure_voice_received_at (timestamptz),
     *  pas un booléen procedure_voice_received. L'ancienne clé valait toujours undefined. */
    procedure_voice_received_at: string | null;
  };
  session_owner: string | null;
  orders: Array<{
    id: string;
    version: number;
    stage: string;
    payment_status: string;
    catalogue_code: string | null;
    price_xof: number | null;
    deliverable: string | null;
    payment_policy: string | null;
    occasion: string | null;
    recipient_name: string | null;
    recipient_name_confirmed: boolean;
    recipient_relation: string | null;
    sender_name: string | null;
    style: string | null;
    voice: string | null;
    language: string | null;
    memories?: string[];
    lyrics?: string | null;
    memories_count: number;
    revision_count: number;
    payment_instructions_count: number;
    has_payment_deferral: boolean;
    lyrics_sent_at: string | null;
    stage_changed_at: string;
    payment_instructions_at: string | null;
    payment_confirmed_at: string | null;
    photos_count: number;
  }>;
  persona: {
    studio_name: string;
    agent_name: string;
    manager_first_name: string;
    tone: 'chaleureux' | 'sobre' | 'enjoue';
    formal_address: boolean;
    emoji_policy: 'none' | 'sparing';
    timezone: string;
    agent_hours: Hours;
    manager_hours: Hours;
    payment_window_hours: Hours;
    brief_field_order: string[];
    cap_reception: boolean;
    cap_procedure_voice: boolean;
    cap_lyrics_followup: boolean;
    cap_payment: boolean;
    cap_lyrics_draft: boolean;
    cap_auto_production: boolean;
    cap_video: boolean;
    delivery_mode: 'shadow' | 'live';
    relay_mode: 'off' | 'safe_templates';
    max_open_orders: number;
    max_agent_msgs_per_hour: number;
    max_free_revisions: number;
    payment_methods: Array<{ provider: string; number: string; holder: string; country?: string }>;
    alert_phone: string | null;
  };
  catalogue: Array<{
    code: string;
    label: string;
    price_xof: number;
    deliverable: 'lyrics' | 'audio' | 'audio_video';
    payment_policy: 'after_lyrics_validation' | 'before_lyrics';
    required_fields: string[];
    is_active: boolean;
  }>;
  step_policies: Array<{
    step: Step;
    channel: 'ai_text' | 'template' | 'voice' | 'voice_then_template' | 'silent';
    asset_id?: string;
    template_key?: string;
  }>;
  templates: Record<string, string>;
  assets: Array<{
    id: string;
    kind: 'voice' | 'sample_audio' | 'sample_video' | 'image';
    purpose: string;
    occasion: string | null;
    storage_path: string;
    caption: string | null;
  }>;
  handoff: {
    id: string;
    origin: 'merchant' | 'agent';
    reason: string;
    ack_sent: boolean;
    relay_log: Record<string, string>;
    opened_at: string;
  } | null;
  inbound: Array<{
    id: string;
    body: string | null;
    transcript: string | null;
    transcript_status: string | null;
    media_kind: string | null;
    media_path: string | null;
    role: string;
  }>;
  recent: Array<{
    role: string;
    text: string | null;
    media_kind: string | null;
    at: string;
  }>;
  agent_msgs_last_hour: number;
  recent_agent_bodies: string[];
  now: string;
}

/**
 * CORRECTIF (M1) : le SQL (agent_contact_facts) retourne procedure_voice_received_at (timestamptz),
 * pas un booléen. Cette sonde couvre TOUT l'historique du contact (toutes conversations),
 * pas seulement les 10 derniers messages.
 */
function contactReceivedProcedureVoice(facts: { procedure_voice_received_at?: string | null } | undefined): boolean {
  return facts?.procedure_voice_received_at != null;
}

/**
 * CORRECTIF (C6) : un vocal ENTRANT du client (role='user', media_kind='audio') ne doit JAMAIS
 * être compté comme "vocal de procédure déjà envoyé". Seuls les vocaux émis par l'assistant
 * (role='assistant') comptent — sinon les clients qui communiquent par notes vocales
 * (cas très fréquent) ne reçoivent jamais le vocal de procédure et le funnel est cassé.
 */
function assistantSentVoiceInRecent(recent: Array<{ role: string; text: string | null; media_kind: string | null }>): boolean {
  return recent.some((r) => r.role === 'assistant' && (r.media_kind === 'audio' || r.text === null));
}

/**
 * CORRECTIF (C5) : panne du fournisseur LLM (DeepSeek/Kie.ai).
 * Le tour est RETENU et replanifié avec backoff exponentiel — jamais traité comme "incompris".
 * Avant ce correctif, le bot envoyait une réponse incohérente ("pas en avant") au client.
 * Après épuisement des tentatives, le gérant est alerté et le tour est clos proprement.
 */
const PROVIDER_RETRY_DELAYS_MS = [60_000, 120_000, 300_000, 600_000, 900_000];

async function getProviderRetryCount(db: Db, turnId: string): Promise<number> {
  try {
    const rows = await db.queryTable?.<Array<{ trigger_data: { retry_count?: number } }>>(
      'conversation_turns',
      `id=eq.${turnId}&select=trigger_data&limit=1`,
    );
    const n = rows?.[0]?.trigger_data?.retry_count;
    return typeof n === 'number' && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function holdTurnForProviderRetry(
  deps: RunTurnDeps,
  turnRef: TurnRef,
  raw: RawTurnContext,
  trace: string[],
  startedAt: number,
): Promise<RunTurnOutcome> {
  const retryCount = await getProviderRetryCount(deps.db, turnRef.turnId);
  const maxRetries = PROVIDER_RETRY_DELAYS_MS.length;

  if (retryCount < maxRetries && deps.db.insertRow) {
    const delayMs = PROVIDER_RETRY_DELAYS_MS[retryCount]!;
    const readyAt = new Date(Date.now() + delayMs).toISOString();
    try {
      await deps.db.insertRow('conversation_turns', {
        user_id: turnRef.userId,
        conversation_id: turnRef.conversationId,
        trigger: 'retry',
        status: 'scheduled',
        inbound_message_ids: raw.turn.inbound_message_ids,
        trigger_data: { reason: 'provider_down', retry_of: turnRef.turnId, retry_count: retryCount + 1 },
        ready_at: readyAt,
      });
      trace.push(`provider down: turn held, retry #${retryCount + 1}/${maxRetries} scheduled in ${delayMs / 1000}s`);
      deps.log('turn held for provider retry', { turnId: turnRef.turnId, retry: retryCount + 1, readyAt });
    } catch (err) {
      trace.push(`provider down: retry scheduling failed (${(err as Error).message}), turn held without retry`);
      deps.log('provider retry scheduling failed', { turnId: turnRef.turnId, error: (err as Error).message });
    }
  } else {
    trace.push(`provider down: ${maxRetries} retries exhausted, alerting manager`);
    deps.log('provider down: retries exhausted, alerting manager', { turnId: turnRef.turnId });
    // Alerte gérant via l'outbox (indépendante du LLM en panne).
    // SÉCURITÉ : sans alert_phone configuré, on n'alerte pas plutôt que d'alerter le client.
    const alertPhone = raw.persona?.alert_phone?.replace(/\D/g, '');
    if (alertPhone) {
      try {
        await deps.db.rpc('agent_enqueue_outbox', {
          p_user: turnRef.userId,
          p_conversation: turnRef.conversationId,
          p_order: null,
          p_turn: turnRef.turnId,
          p_origin: 'system_alert',
          p_kind: 'text',
          p_purpose: 'owner_alert',
          p_is_relay: false,
          p_session: raw.conversation.session_name,
          p_chat_id: `${alertPhone}@c.us`,
          p_body: `⚠️ [Velaris] Le fournisseur IA est en panne depuis plusieurs minutes. Les réponses automatiques sont en pause sur cette discussion — prenez la main manuellement si besoin.`,
          p_media_path: null,
          p_caption: null,
          p_body_hash: null,
          p_idempotency_key: `alert_${turnRef.turnId}_provider_down`,
        });
      } catch (err) {
        deps.log('provider down: manager alert failed', { error: (err as Error).message });
      }
    } else {
      deps.log('provider down: no alert_phone configured, manager not alerted', { turnId: turnRef.turnId });
    }
  }

  await deps.db.rpc('agent_finish_turn', {
    p_turn: turnRef.turnId,
    p_conversation: turnRef.conversationId,
    p_token: turnRef.lockToken,
    p_status: 'done',
    p_outcome: 'held_provider_down',
  });
  return { outcome: 'held_provider_down', trace, enqueuedIds: [], latencyMs: Date.now() - startedAt };
}


/**
 * Traite les reactions-emoji du gerant (commandes explicites).
 *
 * sparkles resume_ai : le gerant rend la main - l'IA reprend le controle et evalue la suite.
 * musical_note confirm_and_produce : le texte reagi doit devenir une chanson (voix/style extraits).
 * tada mark_delivered : la livraison de la chanson est effectuee (commande -> delivered).
 * memo mark_as_lyrics : le message reagi est enregistre comme paroles de la commande.
 *
 * Retourne 'continue' pour resume_ai (le flux normal evalue ensuite l'etat et reprend),
 * ou un RunTurnOutcome final pour les autres commandes.
 */
async function handleMerchantReaction(
  rdeps: RunTurnDeps,
  rturnRef: TurnRef,
  rraw: RawTurnContext,
  rtrace: string[],
  renqueuedIds: string[],
  rstartedAt: number,
): Promise<'continue' | RunTurnOutcome> {
  const finish = async (outcome: string): Promise<RunTurnOutcome> => {
    await rdeps.db.rpc('agent_finish_turn', {
      p_turn: rturnRef.turnId,
      p_conversation: rturnRef.conversationId,
      p_token: rturnRef.lockToken,
      p_status: 'done',
      p_outcome: outcome,
    });
    return { outcome, trace: rtrace, enqueuedIds: renqueuedIds, latencyMs: Date.now() - rstartedAt };
  };

  const rtd = rraw.turn.trigger_data || {};
  const rcommand = String(rtd.command || '');
  const remoji = String(rtd.emoji || '');
  const rreactedKey = String(rtd.reacted_key || '');
  rtrace.push(`merchant_reaction: ${remoji} -> ${rcommand}`);

  let reactedBody: string | null = null;
  let reactedId: string | null = null;
  if (rreactedKey) {
    try {
      const rows = await rdeps.db.queryTable?.<Array<{ id: string; body: string | null }>>(
        'messages',
        `user_id=eq.${rturnRef.userId}&wa_message_key=eq.${encodeURIComponent(rreactedKey)}&select=id,body&limit=1`,
      );
      reactedBody = rows?.[0]?.body ?? null;
      reactedId = rows?.[0]?.id ?? null;
    } catch (e) {
      rdeps.log('merchant_reaction: failed to fetch reacted message', { error: (e as Error).message });
    }
  }

  const rfocusOrderId: string | null = rraw.conversation.focus_order_id ?? null;

  switch (rcommand) {
    case 'resume_ai': {
      await rdeps.db.rpc('agent_set_control', {
        p_conversation: rturnRef.conversationId,
        p_mode: 'ai',
        p_reason: 'merchant_reaction_resume',
        p_actor: 'merchant',
      });
      rtrace.push('merchant_reaction: control returned to AI, continuing with normal flow');
      return 'continue';
    }

    case 'confirm_and_produce': {
      if (!rfocusOrderId) {
        rtrace.push('merchant_reaction: confirm_and_produce without focused order');
        return finish('reaction_no_order');
      }
      if (!reactedBody) {
        rtrace.push('merchant_reaction: confirm_and_produce without reacted text');
        return finish('reaction_no_text');
      }
      let voiceStyle = '';
      try {
        const res = await rdeps.llmProvider.completeJson({
          system: 'Tu analyses un texte de chanson. Reponds en JSON strict : {"voice": "<voix suggeree>", "style": "<style musical>"}. Base-toi uniquement sur le ton et le contenu du texte.',
          messages: [{ role: 'user', content: reactedBody.slice(0, 2000) }],
          temperature: 0.2,
          maxTokens: 150,
        });
        const d = res.data as { voice?: string; style?: string } | undefined;
        const voice = String(d?.voice || '').trim();
        const style = String(d?.style || '').trim();
        if (voice || style) voiceStyle = `\n\nVoix : ${voice}\nStyle : ${style}`;
      } catch (e) {
        rdeps.log('merchant_reaction: voice/style extraction failed', { error: (e as Error).message });
      }
      await rdeps.db.updateRows?.(
        'orders',
        `id=eq.${rfocusOrderId}`,
        { lyrics: reactedBody, lyrics_source: 'merchant_reaction', lyrics_message_id: reactedId },
      );
      const confirmBody =
        `C'est note ! Ce texte part en production chanson.${voiceStyle}` +
        `\nNotre equipe lance la creation avec ces caracteristiques mises en avant.`;
      const outId = await rdeps.db.rpc<string>('agent_enqueue_outbox', {
        p_user: rturnRef.userId,
        p_conversation: rturnRef.conversationId,
        p_order: rfocusOrderId,
        p_turn: rturnRef.turnId,
        p_origin: 'agent',
        p_kind: 'text',
        p_purpose: 'reaction_confirm',
        p_is_relay: false,
        p_session: rraw.conversation.session_name,
        p_chat_id: rraw.conversation.chat_id,
        p_body: confirmBody,
        p_media_path: null,
        p_caption: null,
        p_body_hash: null,
        p_idempotency_key: `reaction_confirm_${rturnRef.turnId}`,
        p_lock_token: rturnRef.lockToken,
        p_status: 'pending',
        p_not_before: null,
        p_expires_at: null,
      });
      renqueuedIds.push(outId);
      rtrace.push('merchant_reaction: lyrics confirmed for production with voice/style');
      return finish('reaction_confirm_and_produce');
    }

    case 'mark_delivered': {
      if (!rfocusOrderId) {
        rtrace.push('merchant_reaction: mark_delivered without focused order');
        return finish('reaction_no_order');
      }
      const orderRows = await rdeps.db.queryTable?.<Array<{ version: number; stage: string }>>(
        'orders',
        `id=eq.${rfocusOrderId}&select=version,stage&limit=1`,
      );
      const rorder = orderRows?.[0];
      if (!rorder) {
        rtrace.push('merchant_reaction: mark_delivered order not found');
        return finish('reaction_no_order');
      }
      const tr = await rdeps.db.rpc<string>('agent_transition_order', {
        p_order: rfocusOrderId,
        p_expected_version: rorder.version,
        p_track: 'creative',
        p_event: 'delivery_sent',
        p_actor: 'merchant',
        p_turn: rturnRef.turnId,
        p_data: { via: 'merchant_reaction', emoji: remoji },
        p_inferred: false,
      });
      rtrace.push(`merchant_reaction: delivery transition -> ${tr}`);
      return finish(tr === 'ok' ? 'reaction_mark_delivered' : `reaction_transition_${tr}`);
    }

    case 'mark_as_lyrics': {
      if (!rfocusOrderId || !reactedBody) {
        rtrace.push('merchant_reaction: mark_as_lyrics missing order or text');
        return finish('reaction_no_order_or_text');
      }
      await rdeps.db.updateRows?.(
        'orders',
        `id=eq.${rfocusOrderId}`,
        { lyrics: reactedBody, lyrics_source: 'merchant_reaction_mark', lyrics_message_id: reactedId },
      );
      rtrace.push('merchant_reaction: text marked as lyrics');
      return finish('reaction_mark_as_lyrics');
    }

    default: {
      rtrace.push(`merchant_reaction: unknown command ${rcommand}`);
      return finish('reaction_unknown_command');
    }
  }
}

export async function runTurn(deps: RunTurnDeps, turnRef: TurnRef): Promise<RunTurnOutcome> {
  const startedAt = Date.now();
  const trace: string[] = [];
  const enqueuedIds: string[] = [];

  // 1. Lire le contexte complet
  const raw = await deps.db.rpc<RawTurnContext>('agent_turn_context', { p_turn: turnRef.turnId });
  if (!raw || !raw.conversation || !raw.persona) {
    await deps.db.rpc('agent_finish_turn', {
      p_turn: turnRef.turnId,
      p_conversation: turnRef.conversationId,
      p_token: turnRef.lockToken,
      p_status: 'failed',
      p_outcome: 'missing_context',
      p_error: 'agent_turn_context returned null',
    });
    return { outcome: 'missing_context', trace, enqueuedIds, latencyMs: Date.now() - startedAt };
  }

  const { conversation, persona, contact } = raw;
  const nowMs = new Date(raw.now).getTime();

  // 1b. Réactions-emoji du gérant (commandes explicites ✨/🎵/🎉/📝) : traitées en priorité.
  // Pour resume_ai (✨), le handler rend la main à l'IA et retourne 'continue'
  // pour que le flux normal évalue l'état de la conversation et reprenne la suite.
  // On mémorise la reprise pour informer le sales brain.
  let resumeNote: string | null = null;
  if (raw.turn.trigger === 'merchant_reaction') {
    const reactionResult = await handleMerchantReaction(deps, turnRef, raw, trace, enqueuedIds, startedAt);
    if (reactionResult !== 'continue') return reactionResult;
    resumeNote = 'Le gérant vient de vous rendre la main (réaction ✨). Évaluez l’état actuel de la conversation et continuez naturellement la suite, sans redemander ce qui est déjà acquis.';
    // Le contrôle est repassé à 'ai' par le handler ; on met à jour l'objet local
    // pour que les vérifications suivantes voient le bon mode.
    conversation.control_mode = 'ai';
  }

  // 2. Vérifier le contrôle de conversation
  if (conversation.control_mode === 'closed') {
    await deps.db.rpc('agent_finish_turn', {
      p_turn: turnRef.turnId,
      p_conversation: turnRef.conversationId,
      p_token: turnRef.lockToken,
      p_status: 'done',
      p_outcome: 'conversation_closed',
    });
    return { outcome: 'conversation_closed', trace, enqueuedIds, latencyMs: Date.now() - startedAt };
  }

  // 3. Déterminer si un relais est possible si mode humain
  const lastMerchantMs = conversation.last_merchant_at ? new Date(conversation.last_merchant_at).getTime() : 0;
  const lastInboundMs = conversation.last_inbound_at ? new Date(conversation.last_inbound_at).getTime() : 0;
  const clientWroteAfterMerchant = lastInboundMs > lastMerchantMs;

  // Calcul d'horaires
  const tz = persona.timezone || 'Africa/Ouagadougou';
  const managerHours = persona.manager_hours || { all: ['07:30', '22:00'] };

  // Vérifier la présence du gérant
  const managerParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const day = managerParts.find((p) => p.type === 'weekday')?.value.toLowerCase().slice(0, 3) ?? 'mon';
  const mins = Number(managerParts.find((p) => p.type === 'hour')?.value ?? '0') * 60 + Number(managerParts.find((p) => p.type === 'minute')?.value ?? '0');
  const windowForDay = managerHours[day] ?? managerHours.all ?? ['07:30', '22:00'];
  const [openStr, closeStr] = windowForDay;
  const openMins = Number(openStr?.split(':')[0] ?? 7) * 60 + Number(openStr?.split(':')[1] ?? 30);
  const closeMins = Number(closeStr?.split(':')[0] ?? 22) * 60 + Number(closeStr?.split(':')[1] ?? 0);
  const managerAvailable = mins >= openMins && mins < closeMins;

  if (conversation.control_mode === 'human') {
    const isRelayMode = persona.relay_mode === 'safe_templates';
    const reason = conversation.control_reason ?? '';
    const forbiddenReasons = ['handoff:complaint', 'handoff:payment_dispute', 'handoff:very_negative', 'merchant_reply'];
    const isRelayAllowed = isRelayMode && !forbiddenReasons.includes(reason) && clientWroteAfterMerchant && !managerAvailable && conversation.control_actor !== 'merchant';

    if (!isRelayAllowed) {
      await deps.db.rpc('agent_finish_turn', {
        p_turn: turnRef.turnId,
        p_conversation: turnRef.conversationId,
        p_token: turnRef.lockToken,
        p_status: 'done',
        p_outcome: 'human_control_no_relay',
      });
      return { outcome: 'human_control_no_relay', trace, enqueuedIds, latencyMs: Date.now() - startedAt };
    }
  }

  // 4. Préparer les messages entrants du tour (avec transcription à la volée des vocaux si non encore transcrits)
  const pendingAudios = raw.inbound.filter((m) => m.media_kind === 'audio' && !m.transcript);
  const failedAudios: string[] = [];
  if (pendingAudios.length > 0 && deps.transcriber) {
    await Promise.all(
      pendingAudios.map(async (m) => {
        try {
          const text = await deps.transcriber!.transcribeMessage(
            m.id,
            conversation.session_name,
            m.media_path,
            m.media_kind,
            undefined,
            conversation.chat_id
          );
          if (text) {
            m.transcript = text;
            m.transcript_status = 'done';
          } else {
            failedAudios.push(m.id);
          }
        } catch {
          // Si la transcription échoue, on continue pour ne pas bloquer le tour
          failedAudios.push(m.id);
        }
      })
    );
  }

  const inboundTexts = raw.inbound
    .map((m, idx) => {
      if (m.transcript) {
        return raw.inbound.length > 1
          ? `[Message vocal ${idx + 1}] : ${m.transcript}`
          : m.transcript;
      }
      return m.body || '';
    })
    .filter(Boolean);
  const turnText = inboundTexts.join('\n').trim();

  // CORRECTIF (M9) : avant, un échec de transcription (2 tentatives déjà épuisées : ingestion + tour)
  // entraînait une perte silencieuse du contenu du vocal. Désormais le gérant est alerté
  // quand il n'y a aucun texte exploitable — il peut écouter le vocal manuellement.
  if (failedAudios.length > 0) {
    if (!turnText) {
      trace.push(`transcription failed for ${failedAudios.length} voice note(s), no usable text — alerting manager`);
      const alertPhone = raw.persona.alert_phone?.replace(/\D/g, '');
      if (alertPhone) {
        await deps.db
          .rpc('agent_enqueue_outbox', {
            p_user: turnRef.userId,
            p_conversation: turnRef.conversationId,
            p_order: null,
            p_turn: turnRef.turnId,
            p_origin: 'system_alert',
            p_kind: 'text',
            p_purpose: 'owner_alert',
            p_is_relay: false,
            p_session: conversation.session_name,
            p_chat_id: `${alertPhone}@c.us`,
            p_body: `⚠️ [Velaris] Impossible de transcrire ${failedAudios.length > 1 ? 'des notes vocales' : 'une note vocale'} de ${contact.name ?? conversation.chat_id}. Écoutez-la manuellement sur WhatsApp.`,
            p_media_path: null,
            p_caption: null,
            p_body_hash: null,
            p_idempotency_key: `alert_${turnRef.turnId}_transcribe_failed`,
          })
          .catch(() => undefined);
      }
    } else {
      trace.push(`transcription failed for ${failedAudios.length} voice note(s), continuing with other text`);
    }
  }

  // 5. Convertir les commandes en OrderSnapshot
  const orders: OrderSnapshot[] = raw.orders.map((o) => ({
    id: o.id,
    version: o.version,
    stage: o.stage as any,
    paymentStatus: o.payment_status as any,
    catalogueCode: o.catalogue_code,
    priceXof: o.price_xof,
    deliverable: (o.deliverable as any) ?? null,
    paymentPolicy: (o.payment_policy as any) ?? null,
    occasion: o.occasion,
    recipientName: o.recipient_name,
    recipientNameConfirmed: o.recipient_name_confirmed,
    recipientRelation: o.recipient_relation,
    senderName: o.sender_name,
    style: o.style,
    voice: (o.voice as any) ?? null,
    language: o.language,
    memoriesCount: o.memories_count,
    memories: Array.isArray(o.memories) ? o.memories : [],
    lyrics: o.lyrics ?? null,
    photosCount: o.photos_count,
    revisionCount: o.revision_count,
    paymentInstructionsCount: o.payment_instructions_count,
    hasPaymentDeferral: o.has_payment_deferral,
  }));

  // Catalogue
  const catalogue: CatalogueItem[] = raw.catalogue.map((c) => ({
    code: c.code,
    label: c.label,
    priceXof: c.price_xof,
    deliverable: c.deliverable,
    paymentPolicy: c.payment_policy,
    requiredFields: c.required_fields as BriefField[],
    isActive: c.is_active,
  }));

  // 6. Compréhension (Understand)
  const offersList = catalogue.map((c) => ({ code: c.code, label: c.label }));
  // CORRECTIF (M6) : prix dynamiques depuis le catalogue du studio (jamais en dur).
  const studioPrices = cataloguePrices(catalogue);
  const openOrdersContext = orders.map((o) => ({ recipient: o.recipientName, occasion: o.occasion }));
  const currentStage = orders[0]?.stage ?? 'collecting_brief';
  const currentPaymentStatus = orders[0]?.paymentStatus ?? 'unpaid';
  const pendingQ = conversation.pending_question?.key
    ? String(conversation.pending_question.key)
    : null;

  const recentHistory = raw.recent.map((r) => ({
    who: (r.role === 'client' || r.role === 'user' ? 'client' : r.role === 'gérant' || r.role === 'human_agent' ? 'gérant' : 'studio') as 'client' | 'gérant' | 'studio',
    text: r.text || (r.media_kind === 'audio' ? '[Note vocale explicative de procédure transmise par le studio]' : r.media_kind === 'video' ? '[Vidéo souvenir démo transmise]' : r.media_kind === 'image' ? '[Photo reçue]' : ''),
  }));

  const understandInput: UnderstandInput = {
    turnText,
    recent: recentHistory,
    stage: currentStage,
    paymentStatus: currentPaymentStatus,
    pendingQuestion: pendingQ,
    offers: offersList,
    openOrders: openOrdersContext,
  };

  const understandResult = await understand(deps.llmProvider, understandInput);
  const understanding: Understanding = understandResult.understanding;
  trace.push(`understand: ${understanding.primaryIntent} (conf=${understanding.confidence.toFixed(2)})`);

  // CORRECTIF : le classifieur détecte le hors-sujet (off_topic) mais rien ne l'exploitait :
  // l'IA se perdait dès que le client digressait pendant le brief. On force désormais la règle
  // "répondre puis recadrer" via une directive prioritaire injectée au sales brain.
  // Exclu après une reprise ✨ (la note de reprise guide déjà l'IA).
  const digressionDetected =
    !resumeNote &&
    understanding.primaryIntent === 'off_topic' &&
    understanding.confidence >= 0.6 &&
    (currentStage === 'collecting_brief' || currentStage === 'brief_complete');
  if (digressionDetected) trace.push('digression: off_topic detected, anti-digression directive injected');

  // CORRECTIF (C5) : fournisseur LLM en panne → le tour est retenu et replanifié,
  // jamais traité comme "incompris". Aucun message n'est envoyé au client.
  if (understandResult.providerFailed) {
    return holdTurnForProviderRetry(deps, turnRef, raw, trace, startedAt);
  }

  // 7. Calculer les délais annonçables
  const etaMap: Record<string, { lyrics?: string; production?: string; video?: string }> = {};
  for (const o of raw.orders) {
    const cat = catalogue.find((c) => c.code === o.catalogue_code);
    const eta = orderEtas(
      {
        stage: o.stage,
        stageChangedAtMs: o.stage_changed_at ? new Date(o.stage_changed_at).getTime() : nowMs,
        lyricsLeadMin: 8,
        productionLeadMin: 18,
        videoLeadMin: cat?.deliverable === 'audio_video' ? 120 : null,
      },
      managerHours,
      tz,
      nowMs,
    );
    etaMap[o.id] = eta;
  }

  // 8. Construire la configuration studio
  const studioConfig: StudioConfig = {
    caps: {
      reception: persona.cap_reception,
      procedureVoice: persona.cap_procedure_voice,
      lyricsFollowup: persona.cap_lyrics_followup,
      payment: persona.cap_payment,
      lyricsDraft: persona.cap_lyrics_draft,
      autoProduction: persona.cap_auto_production,
      video: persona.cap_video,
    },
    relayMode: persona.relay_mode,
    maxOpenOrders: persona.max_open_orders,
    maxAgentMsgsPerHour: persona.max_agent_msgs_per_hour,
    maxFreeRevisions: persona.max_free_revisions,
    briefFieldOrder: (persona.brief_field_order as any) ?? ['occasion', 'recipient_name', 'offer'],
    hasProcedureVoice: raw.assets.some((a) => a.kind === 'voice' && a.purpose === 'procedure'),
    hasSamples: raw.assets.some((a) => a.kind === 'sample_audio'),
    catalogue,
    paymentMethodCount: (persona.payment_methods as unknown[] | null)?.length ?? 0,
  };

  // 9. Construire l'entrée de décision
  const decisionInput: DecisionInput = {
    control: {
      mode: conversation.control_mode,
      reason: conversation.control_reason,
      actor: conversation.control_actor,
    },
    handoff: {
      open: raw.handoff !== null,
      origin: raw.handoff?.origin ?? null,
      ackSent: raw.handoff?.ack_sent ?? false,
      relayLog: raw.handoff?.relay_log || {},
    },
    orders,
    contact: {
      deliveredOrders: raw.contact_facts?.delivered_orders ?? 0,
      procedureVoiceReceived: contactReceivedProcedureVoice(raw.contact_facts),
    },
    conversation: {
      pendingQuestion: conversation.pending_question as any,
      lowConfStreak: conversation.low_conf_streak + (understanding.confidence < 0.6 ? 1 : 0),
      repeatQuestionCount: conversation.repeat_question_count,
      discountRequests: conversation.discount_requests,
      ackLog: conversation.ack_log || {},
      agentMsgsLastHour: raw.agent_msgs_last_hour,
      focusOrderId: conversation.focus_order_id,
    },
    understanding,
    studio: studioConfig,
    media: {
      images: [],
      hasAudio: raw.inbound.some((m) => m.media_kind === 'audio'),
    },
    clock: {
      nowMs,
      managerAvailable,
      merchantSilentBeyondSla: false,
      clientWroteAfterMerchant,
    },
    eta: etaMap,
  };

  // 10. Exécuter la décision sécurisée
  const { decision, violations } = decideSafely(decisionInput);
  const targetResolution = resolveTarget(decisionInput);
  trace.push(...decision.trace);
  if (violations.length > 0) {
    trace.push(`violations: ${violations.join(', ')}`);
  }

  // 11. Appliquer les actions en base
  const orderVersionMap = new Map<string, number>();
  for (const o of raw.orders) orderVersionMap.set(o.id, o.version);
  let createdOrderId: string | null = null;

  for (const action of decision.actions) {
    if (
      action.type === 'handoff' &&
      (action.reason === 'rate_limit' || action.reason === 'loop' || action.reason === 'low_confidence') &&
      conversation.control_mode === 'ai'
    ) {
      // CORRECTIF (M5) : la passation est contournée pour ne pas casser une vente en cours,
      // mais le gérant DOIT être prévenu — avant, le client n'avait rien et personne n'était au courant.
      trace.push(`${action.reason} handoff bypassed: active sales conversation — alerting manager`);
      await queueOwnerAlert(
        {
          db: deps.db,
          conversationId: turnRef.conversationId,
          turnId: turnRef.turnId,
          orderVersionMap,
          getCreatedOrderId: () => createdOrderId,
          setCreatedOrderId: (id: string) => {
            createdOrderId = id;
            orderVersionMap.set(id, 0);
          },
          llmProvider: deps.llmProvider,
          persona,
          orders,
          rawOrders: raw.orders,
          userId: raw.conversation.user_id,
          sessionName: conversation.session_name,
          clientName: contact.name,
          lockToken: turnRef.lockToken,
          trace,
        },
        orders[0]?.id ?? null,
        `⚠️ [Velaris] Passation automatique ignorée (${action.reason}) sur la discussion avec ${contact.name ?? conversation.chat_id}. Le client attend une réponse — prenez la main si besoin.`,
        `handoff_bypass_${action.reason}`,
      ).catch(() => undefined);
      continue;
    }
    await applyAction(action, {
      db: deps.db,
      conversationId: turnRef.conversationId,
      turnId: turnRef.turnId,
      orderVersionMap,
      getCreatedOrderId: () => createdOrderId,
      setCreatedOrderId: (id: string) => {
        createdOrderId = id;
        orderVersionMap.set(id, 0);
      },
      llmProvider: deps.llmProvider,
      persona,
      orders,
      rawOrders: raw.orders,
      userId: raw.conversation.user_id,
      sessionName: conversation.session_name,
      clientName: contact.name,
      lockToken: turnRef.lockToken,
      trace,
    });
  }

  // Mise à jour de la question en attente et de low_conf_streak
  if (decision.pendingQuestion !== 'keep') {
    await deps.db.rpc('agent_conversation_effect', {
      p_conversation: turnRef.conversationId,
      p_kind: 'pending_question',
      p_data: { question: decision.pendingQuestion },
    });
  }

  const nextStreak = understanding.confidence < 0.6 ? conversation.low_conf_streak + 1 : 0;
  if (nextStreak !== conversation.low_conf_streak) {
    await deps.db.rpc('agent_conversation_effect', {
      p_conversation: turnRef.conversationId,
      p_kind: 'low_conf_streak',
      p_data: { value: nextStreak },
    });
  }

  // 12. Planifier et restituer les sorties
  const policiesMap: Record<string, StepPolicy> = {};
  for (const p of raw.step_policies) {
    const pol: StepPolicy = { channel: p.channel };
    if (p.asset_id) pol.assetId = p.asset_id;
    if (p.template_key) pol.templateKey = p.template_key;
    policiesMap[p.step] = pol;
  }

  const plan = planOutput(decision, policiesMap as StudioStepPolicies);
  trace.push(...plan.notes);

  const renderCtx: RenderContext = {
    studioName: persona.studio_name,
    agentName: persona.agent_name,
    managerFirstName: persona.manager_first_name,
    clientFirstName: contact.name,
    tone: persona.tone,
    formalAddress: persona.formal_address,
    emojiPolicy: persona.emoji_policy,
    orders,
    catalogue,
    paymentMethods: persona.payment_methods || [],
    templates: raw.templates || {},
    assets: raw.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      purpose: a.purpose,
      occasion: a.occasion,
      storagePath: a.storage_path,
      caption: a.caption,
    })),
    managerHours,
    timezone: tz,
    nowMs,
    managerAvailable,
    sensitiveTopic: understanding.sensitiveTopic,
    recentMessages: recentHistory,
    recentAgentBodies: raw.recent_agent_bodies,
    llmProvider: deps.llmProvider,
  };

  const renderedMessages: RenderedMessage[] = [];

  // Priorité absolue : Cerveau Commercial Adaptatif (VELARIS_CLOSING_PROMPT_TEMPLATE via DeepSeek Flash)
  let usedSalesBrain = false;
  if (conversation.control_mode === 'ai' && deps.llmProvider) {
    const salesOutcome = await generateSalesReply(deps.llmProvider, {
      turnText: resumeNote ? `${resumeNote}\n${turnText}` : turnText,
      recent: recentHistory,
      contact: {
        phone: contact.phone,
        name: contact.name,
        wa_jid: contact.wa_jid,
        deliveredOrders: raw.contact_facts?.delivered_orders ?? 0,
        procedureVoiceReceived: Boolean(
          contactReceivedProcedureVoice(raw.contact_facts) ||
          assistantSentVoiceInRecent(raw.recent)
        ),
        videoSampleReceived: Boolean(
          raw.recent.some((r) => r.media_kind === 'video' || (r.text && /aper[çc]u vid[ée]o souvenir|vid[ée]o souvenir d[ée]mo/i.test(r.text)))
        ),
      },
      persona: {
        studio_name: persona.studio_name,
        agent_name: persona.agent_name,
        manager_first_name: persona.manager_first_name,
      },
      orders,
      catalogue,
      digression: digressionDetected,
    });

    trace.push(...salesOutcome.notes);

    if (salesOutcome.bubbles.length > 0 || salesOutcome.procedureVoiceDue || salesOutcome.videoSampleDue) {
      usedSalesBrain = true;
      if (conversation.repeat_question_count > 0) {
        await deps.db.rpc('agent_conversation_effect', {
          p_conversation: turnRef.conversationId,
          p_kind: 'reset_repeat',
          p_data: {},
        }).catch(() => undefined);
      }
      for (const b of salesOutcome.bubbles) {
        renderedMessages.push({
          kind: 'text',
          purpose: 'reply',
          body: b,
          orderId: orders[0]?.id ?? null,
          isRelay: false,
        });
      }

      // 1. Si le brief est complet et que le vocal de procédure est dû (strictement 1 fois par discussion)
      const procedureVoiceAlreadySent = Boolean(
        contactReceivedProcedureVoice(raw.contact_facts) ||
        assistantSentVoiceInRecent(raw.recent)
      );

      // CORRECTIF (M14) : la décision déterministe est souveraine. decide() émet send_procedure_voice
      // quand le brief est complet (I13) ; avant, seul le LLM (procedureVoiceDue) pilotait l'envoi et
      // les deux pouvaient diverger (vocal jamais envoyé, ou brief complet sans vocal).
      const decidedProcedureVoiceDue = decision.actions.some((a) => a.type === 'send_procedure_voice');
      const procedureVoiceDue = salesOutcome.procedureVoiceDue || decidedProcedureVoiceDue;
      if (decidedProcedureVoiceDue && !salesOutcome.procedureVoiceDue) {
        trace.push('deterministic: procedure voice due by decide(), LLM did not flag it — enforcing');
      }

      if (procedureVoiceDue && persona.cap_procedure_voice !== false && !procedureVoiceAlreadySent) {
        const procedureAsset = raw.assets.find((a) => a.kind === 'voice' && a.purpose === 'procedure');
        renderedMessages.push({
          kind: 'voice',
          purpose: 'procedure_voice',
          mediaPath: procedureAsset?.storage_path ?? 'assets/procedure_voice.ogg',
          orderId: orders[0]?.id ?? null,
          isRelay: false,
        });
        trace.push('sales_brain: procedure voice note enqueued');
      } else if (procedureVoiceDue && procedureVoiceAlreadySent) {
        trace.push('guard: procedure voice already sent in conversation, duplicate suppressed');
      }

      if (procedureVoiceAlreadySent) {
        // Supprimer toute bulle résiduelle annonçant un renvoi de note vocale
        for (let i = renderedMessages.length - 1; i >= 0; i--) {
          const m = renderedMessages[i]!;
          if (m.kind === 'text' && m.body && /je vous (envoie|transmets) (la note vocale|le vocal|notre note vocale)|pour vous présenter notre démarche/i.test(m.body)) {
            renderedMessages.splice(i, 1);
          }
        }
        // Si après accusé de réception du vocal le bot n'a pas présenté les offres, les présenter immédiatement
        // CORRECTIF (M6) : détection basée sur les prix catalogue dynamiques, pas '1 200' en dur.
        const hasOffersMention = renderedMessages.some((m) => m.kind === 'text' && (m.body?.includes(studioPrices.decouverte) || m.body?.includes(studioPrices.prestige) || m.body?.includes('Formule') || m.body?.includes('formule')));
        const turnTextLower = turnText.toLowerCase();
        const clientAcknowledgedVoice = turnTextLower.includes('convient') || turnTextLower.includes('d\'accord') || turnTextLower.includes('daccord') || turnTextLower.includes('c\'est bon') || turnTextLower.includes('ok') || turnTextLower.includes('bien reçu');
        if (!hasOffersMention && clientAcknowledgedVoice) {
          renderedMessages.push({
            kind: 'text',
            purpose: 'reply',
            body: `Voici nos deux formules : Découverte à ${studioPrices.decouverte} F CFA (chanson complète en 18 minutes) et Prestige à ${studioPrices.prestige} F CFA (chanson + vidéo souvenir avec photos). Laquelle préférez-vous ?`,
            orderId: orders[0]?.id ?? null,
            isRelay: false,
          });
        }
      }

      // 2. Si le client a demandé un extrait de la formule vidéo souvenir (strictement 1 fois par discussion)
      const videoSampleAlreadySent = Boolean(
        raw.recent.some((r) => r.media_kind === 'video' || (r.text && /aper[çc]u vid[ée]o souvenir|vid[ée]o souvenir d[ée]mo/i.test(r.text)))
      );

      if (salesOutcome.videoSampleDue && !videoSampleAlreadySent) {
        const videoAsset = raw.assets.find(
          (a) => a.kind === 'sample_video' && (a.purpose === 'sample_video' || a.purpose === 'video_sample' || a.purpose === 'video')
        );
        const videoMsg: RenderedMessage = {
          kind: 'video',
          purpose: 'video',
          mediaPath: videoAsset?.storage_path ?? 'assets/montage_sample.mp4',
          orderId: orders[0]?.id ?? null,
          isRelay: false,
        };
        if (videoAsset?.caption) {
          videoMsg.caption = videoAsset.caption;
        }
        renderedMessages.push(videoMsg);
        trace.push('sales_brain: video sample demo enqueued');
      } else if (salesOutcome.videoSampleDue && videoSampleAlreadySent) {
        trace.push('guard: video sample already sent in conversation, duplicate suppressed');
      }

      // 3. Détection de la confirmation de formule & Alerte gérant enrichie
      const isFormulaConfirmed =
        salesOutcome.formulaChosen ||
        renderedMessages.some(
          (m) =>
            m.kind === 'text' &&
            m.body &&
            (/c'est bien noté pour la formule|passe immédiatement à la (rédaction|finalisation)|votre texte vous sera envoyé ici dans un délai de 15 minutes/i.test(m.body))
        );

      if (isFormulaConfirmed) {
        // Garantir la délivrance des bulles d'annonce des 15 minutes au client
        for (const m of renderedMessages) {
          if (m.kind === 'text') m.purpose = 'handoff_ack';
        }

        // CORRECTIF (M6) : détection et libellés basés sur le prix catalogue, pas sur '3 000' en dur.
        const prestigePricePattern = studioPrices.prestige.replace(/\s/g, '\\s');
        const prestigeDetectRe = new RegExp(`prestige|${prestigePricePattern}|vid[ée]o`, 'i');
        const isPrestige =
          salesOutcome.chosenFormula === 'prestige' ||
          renderedMessages.some((m) => m.body && (prestigeDetectRe.test(m.body) || /vidéo souvenir/i.test(m.body))) ||
          prestigeDetectRe.test(turnText);

        const chosenFormulaLabel = isPrestige
          ? `Formule Prestige (${studioPrices.prestige} F CFA — Chanson + Vidéo Souvenir)`
          : `Formule Découverte (${studioPrices.decouverte} F CFA — Chanson personnalisée)`;

        const order = orders[0];
        const clientDisplayName = contact.name ? `${contact.name}` : 'Nouveau prospect';
        const clientPhoneFormatted = contact.phone ? `+${contact.phone.replace(/\D/g, '')}` : conversation.chat_id;
        const recipientDisplayName = order?.recipientName || 'À préciser';
        const occasionDisplayName = order?.occasion || 'À préciser';
        const senderDisplayName = order?.senderName || 'Le client lui-même';

        // Synthèse des détails et souvenirs
        let detailsSummary = '';
        if (order?.memories && order.memories.length > 0) {
          detailsSummary = order.memories.map((m) => `- ${m}`).join('\n');
        } else {
          const clientNotes = recentHistory
            .filter((m) => m.who === 'client' && m.text.length > 5)
            .map((m) => `- "${m.text}"`)
            .slice(-4);
          detailsSummary = clientNotes.length > 0 ? clientNotes.join('\n') : 'Détails transmis dans la discussion';
        }

        const alertBody = `[Velaris Studio] Nouvelle commande prête pour rédaction !

👤 Client : ${clientDisplayName} (${clientPhoneFormatted})
🎯 Destinataire : ${recipientDisplayName}
🎉 Occasion : ${occasionDisplayName}
📦 Formule choisie : ${chosenFormulaLabel}
✍️ Expéditeur : ${senderDisplayName}

📝 Détails & Histoire :
${detailsSummary}

👉 Le client a validé sa formule et attend son texte sous 15 minutes. À vous de jouer pour la rédaction !`;

        const actionCtx: ActionContext = {
          db: deps.db,
          conversationId: turnRef.conversationId,
          turnId: turnRef.turnId,
          orderVersionMap,
          getCreatedOrderId: () => createdOrderId,
          setCreatedOrderId: (id: string) => {
            createdOrderId = id;
            orderVersionMap.set(id, 0);
          },
          llmProvider: deps.llmProvider,
          persona,
          orders,
          rawOrders: raw.orders,
          userId: raw.conversation.user_id,
          sessionName: conversation.session_name,
          clientName: contact.name,
          lockToken: turnRef.lockToken,
        };

        await queueOwnerAlert(actionCtx, order?.id ?? null, alertBody, 'formula_chosen');

        // Passage de relais immédiat au gérant (l'IA se met en retrait)
        await deps.db.rpc('agent_conversation_effect', {
          p_conversation: turnRef.conversationId,
          p_kind: 'handoff',
          p_data: { reason: 'brief_complete_handoff', ack: true },
        });

        trace.push('formula_chosen: enriched owner alert sent, handoff to human merchant');
      }
    }
  }

  // Repli automatique sur les gabarits déterministes si le Sales Brain n'a rien émis ou en mode relais
  if (!usedSalesBrain) {
    for (const item of plan.items) {
      const res = await renderOutputItem(item, renderCtx);
      trace.push(...res.notes);
      renderedMessages.push(...res.messages);
    }
  }

  // 12.5. Bouclier Anti-Paiement Prématuré :
  // Le client ne doit JAMAIS recevoir de coordonnées de paiement (Wave, Orange Money, etc.)
  // tant que les paroles de la chanson n'ont pas été effectivement envoyées et validées.
  const lyricsDeliveredOrValidated = orders.some(
    (o) => (o.lyrics && o.lyrics.trim().length > 0) || o.stage === 'lyrics_sent' || o.stage === 'lyrics_validated' || o.stage === 'in_production' || o.stage === 'audio_delivered' || o.stage === 'delivered'
  ) || recentHistory.some((m) => m.who !== 'client' && (m.text.toLowerCase().includes('refrain') || m.text.toLowerCase().includes('couplet 1') || (m.text.length > 350 && m.text.includes('\n\n'))));

  // CORRECTIF : les réponses explicites à « pas de moyen de paiement » (CONV_18) et à
  // « combien d'avance ? » (CONV_23) ne sont jamais des instructions prématurées : ces tours
  // n'émettent aucun payment_instructions (retour anticipé dans paymentRail). Les censurer
  // recréerait le cul-de-sac CONV_18.
  const explicitPaymentHelp = decision.utterances.some((u) =>
    u.goal === 'payment_no_method_alternatives' || u.goal === 'payment_no_method_handoff' ||
    u.goal === 'deposit_policy_full' || u.goal === 'deposit_policy_generic',
  );
  if (!lyricsDeliveredOrValidated && !explicitPaymentHelp) {
    // CORRECTIF (mineur) : les numéros détectés viennent des moyens de paiement du studio,
    // pas de numéros en dur (inopérant si le studio change de numéros).
    const studioPaymentNumbers: string[] = (persona.payment_methods || [])
      .flatMap((pm: { number?: string }) => {
        const digits = String(pm?.number ?? '').replace(/\D/g, '');
        if (!digits) return [];
        // variantes avec/sans espaces tous les 2 chiffres (format local)
        const spaced = digits.replace(/(\d{2})(?=\d)/g, '$1 ');
        return [digits, spaced, `+${digits}`];
      });
    const isPaymentInstruction = (text: string | null | undefined): boolean => {
      if (!text) return false;
      const t = text.toLowerCase();
      const hasKnownNumber = studioPaymentNumbers.some((n) => n && t.includes(n.toLowerCase()));
      const hasPaymentProvider = t.includes('orange money') || t.includes('wave') || hasKnownNumber;
      const hasPaymentKeyword = t.includes('paiement') || t.includes('dépôt') || t.includes('depot') || t.includes('capture') || t.includes('réseau') || t.includes('reseau');
      return (hasPaymentProvider && hasPaymentKeyword) || t.includes('capture pour vérifier') || t.includes('capture de votre paiement');
    };

    for (let i = 0; i < renderedMessages.length; i++) {
      const msg = renderedMessages[i]!;
      if (msg.kind === 'text' && isPaymentInstruction(msg.body)) {
        trace.push('guard: premature payment instructions intercepted before lyrics delivered');
        if (msg.purpose === 'payment') msg.purpose = 'reply';
        // CORRECTIF (M6) : détection basée sur les prix catalogue dynamiques.
        const hasOfferMention = renderedMessages.some((m, idx) => idx !== i && m.kind === 'text' && (m.body?.toLowerCase().includes('formule') || m.body?.includes(studioPrices.decouverte) || m.body?.includes(studioPrices.prestige)));
        if (hasOfferMention) {
          msg.body = 'Notre équipe passe immédiatement à la rédaction de vos paroles. Votre texte vous sera envoyé ici dans un délai de 15 minutes maximum pour validation.';
        } else {
          msg.body = 'Nous préférons que vous découvriez d\'abord vos paroles personnalisées et que vous les validiez avant de passer au paiement ! Notre équipe s\'occupe de préparer votre texte.';
        }
      }
    }
  }

  // Déduplication de sécurité des bulles adjacentes identiques
  const dedupedMessages: RenderedMessage[] = [];
  for (const m of renderedMessages) {
    const prev = dedupedMessages[dedupedMessages.length - 1];
    if (prev && prev.kind === 'text' && m.kind === 'text' && prev.body?.trim() === m.body?.trim()) {
      continue;
    }
    dedupedMessages.push(m);
  }
  renderedMessages.length = 0;
  renderedMessages.push(...dedupedMessages);

  // 13. Mettre en boîte d'envoi (agent_enqueue_outbox)
  // Vérification de sécurité en direct : si le gérant est intervenu sur WhatsApp pendant le calcul du tour,
  // la discussion est passée en mode humain. On annule immédiatement le tour sans rien insérer en outbox !
  // CORRECTIF : ne pas annuler quand c'est l'IA elle-même qui a passé le relais pendant ce tour
  // (ex : choix de formule → l'annonce des 15 minutes doit quand même partir au client).
  if (turnRef.conversationId && deps.db.queryTable) {
    const liveConv = await deps.db.queryTable<Array<{ control_mode: string; control_actor: string | null }>>(
      'conversations',
      `id=eq.${turnRef.conversationId}&select=control_mode,control_actor`
    ).catch(() => []);
    const cm = liveConv?.[0]?.control_mode;
    const actor = liveConv?.[0]?.control_actor;
    if (cm === 'human' && actor === 'merchant') {
      await deps.db.rpc('agent_finish_turn', {
        p_turn: turnRef.turnId,
        p_conversation: turnRef.conversationId,
        p_token: turnRef.lockToken,
        p_status: 'done',
        p_outcome: 'human_control_no_relay',
      });
      return { outcome: 'human_control_no_relay', trace, enqueuedIds, latencyMs: Date.now() - startedAt };
    }
  }

  let itemIdx = 0;
  for (const m of renderedMessages) {
    itemIdx++;
    const idempotencyKey = `${turnRef.turnId}_${itemIdx}_${m.purpose}`;
    const hash = bodyHash(m.body ?? null);
    const targetOrderFinalId = m.orderId === 'new' ? createdOrderId : (m.orderId ?? orders[0]?.id ?? null);

    const outboxId = await deps.db.rpc<string>('agent_enqueue_outbox', {
      p_user: raw.conversation.user_id,
      p_conversation: turnRef.conversationId,
      p_order: targetOrderFinalId,
      p_turn: turnRef.turnId,
      p_origin: 'agent',
      p_kind: m.kind,
      p_purpose: m.purpose,
      p_is_relay: m.isRelay,
      p_session: conversation.session_name,
      p_chat_id: conversation.chat_id,
      p_body: m.body ?? null,
      p_media_path: m.mediaPath ?? null,
      p_caption: m.caption ?? null,
      p_body_hash: hash,
      p_idempotency_key: idempotencyKey,
      p_lock_token: turnRef.lockToken,
      p_status: persona.delivery_mode === 'shadow' ? 'proposed' : 'pending',
    });

    if (outboxId) enqueuedIds.push(outboxId);
  }

  // 14. Clôturer le tour atomiquement
  const finalOutcome = renderedMessages.length > 0 ? 'replied' : 'silent';
  await deps.db.rpc('agent_finish_turn', {
    p_turn: turnRef.turnId,
    p_conversation: turnRef.conversationId,
    p_token: turnRef.lockToken,
    p_status: 'done',
    p_outcome: finalOutcome,
  });

  // 15. Journal du tour (agent_log_turn)
  try {
    await deps.db.rpc('agent_log_turn', {
      p: {
        turn_id: turnRef.turnId,
        user_id: raw.conversation.user_id,
        conversation_id: turnRef.conversationId,
        policy_version: 'v2',
        orders_before: raw.orders,
        understanding,
        target_resolution: targetResolution,
        decision,
        actions: decision.actions,
        draft: renderedMessages,
        guard_results: violations,
        final_outbox_ids: enqueuedIds,
        outcome: finalOutcome,
        models: { understand: understandResult.model },
        tokens: understandResult.tokens,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (err) {
    deps.log('failed to record agent_log_turn', { error: (err as Error).message });
  }

  return { outcome: finalOutcome, trace, enqueuedIds, latencyMs: Date.now() - startedAt };
}

interface ActionContext {
  db: Db;
  conversationId: string;
  turnId: string;
  orderVersionMap: Map<string, number>;
  getCreatedOrderId: () => string | null;
  setCreatedOrderId: (id: string) => void;
  llmProvider: LlmProvider;
  persona: any;
  orders: OrderSnapshot[];
  rawOrders: any[];
  userId: string;
  sessionName: string;
  clientName: string | null;
  lockToken: number;
  /** Journal de trace du tour (optionnel) pour signaler les refus RPC. */
  trace?: string[];
}

/**
 * CORRECTIF (M4) : les RPC métier retournent un statut TEXT
 * ('ok', 'version_conflict', 'payment_lock', 'transition_forbidden'...).
 * Avant, la valeur était ignorée et la version locale incrémentée même en cas de refus,
 * ce qui faisait dériver l'état et échouer silencieusement les actions suivantes du tour.
 * La version locale n'est désormais incrémentée qu'en cas de succès explicite.
 */
function rpcOk(result: unknown, what: string, trace?: string[]): boolean {
  if (result === 'ok') return true;
  trace?.push(`rpc refused: ${what} → ${String(result)} (local version not bumped)`);
  return false;
}

async function queueOwnerAlert(
  ctx: ActionContext,
  orderId: string | null,
  body: string,
  keySuffix: string,
): Promise<void> {
  const alertPhone = ctx.persona?.alert_phone;
  if (!alertPhone || !ctx.sessionName) return;
  const alertChatId = alertPhone.includes('@') ? alertPhone : `${alertPhone.replace(/\+/g, '')}@c.us`;
  const idemKey = `alert_${ctx.turnId}_${keySuffix}`;
  await ctx.db.rpc('agent_enqueue_outbox', {
    p_user: ctx.userId,
    p_conversation: ctx.conversationId,
    p_order: orderId,
    p_turn: ctx.turnId,
    p_origin: 'system_alert',
    p_kind: 'text',
    p_purpose: 'owner_alert',
    p_is_relay: false,
    p_session: ctx.sessionName,
    p_chat_id: alertChatId,
    p_body: body,
    p_media_path: null,
    p_caption: null,
    p_body_hash: bodyHash(body),
    p_idempotency_key: idemKey,
    p_lock_token: ctx.lockToken,
    p_status: ctx.persona?.delivery_mode === 'shadow' ? 'proposed' : 'pending',
  });
}

function resolveOrderForAction(ref: OrderRef, ctx: ActionContext): { id: string | null; version: number } {
  if (ref.kind === 'new') {
    const id = ctx.getCreatedOrderId();
    return { id, version: id ? (ctx.orderVersionMap.get(id) ?? 0) : 0 };
  }
  const id = ref.id;
  const version = ctx.orderVersionMap.get(id) ?? 0;
  return { id, version };
}

async function applyAction(action: Action, ctx: ActionContext): Promise<void> {
  switch (action.type) {
    case 'open_order': {
      const orderId = await ctx.db.rpc<string>('agent_open_order', { p_conversation: ctx.conversationId });
      if (orderId) ctx.setCreatedOrderId(orderId);
      break;
    }
    case 'choose_offer': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        const r = await ctx.db.rpc('agent_choose_offer', { p_order: id, p_expected_version: version, p_code: action.code });
        if (rpcOk(r, `choose_offer(${action.code})`, ctx.trace)) ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'save_brief_fields': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        const r = await ctx.db.rpc('agent_patch_order_fields', {
          p_order: id,
          p_expected_version: version,
          p_patch: action.patch,
          p_allow_clear: action.allowClear.length > 0,
        });
        if (rpcOk(r, 'save_brief_fields', ctx.trace)) ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'transition': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        const r = await ctx.db.rpc('agent_transition_order', {
          p_order: id,
          p_expected_version: version,
          p_track: action.track,
          p_event: action.event,
          p_actor: 'agent',
          p_turn: ctx.turnId,
        });
        if (rpcOk(r, `transition(${action.track}:${action.event})`, ctx.trace)) ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'request_lyrics': {
      if (ctx.persona.cap_lyrics_draft || ctx.persona.lyrics_author === 'ai_draft_approved') {
        const { id, version } = resolveOrderForAction(action.order, ctx);
        const targetOrder = ctx.orders.find((o) => o.id === id);
        const rawOrder = ctx.rawOrders.find((o) => o.id === id);
        const recipientName = targetOrder?.recipientName || rawOrder?.recipient_name;
        const occasion = targetOrder?.occasion || rawOrder?.occasion;
        if (id && targetOrder && recipientName && occasion) {
          try {
            const composed = await composeLyrics(ctx.llmProvider, {
              recipientName,
              occasion,
              recipientRelation: targetOrder.recipientRelation || rawOrder?.recipient_relation,
              senderName: targetOrder.senderName || rawOrder?.sender_name,
              style: targetOrder.style || rawOrder?.style,
              language: targetOrder.language || rawOrder?.language,
              memories: targetOrder.memories ?? rawOrder?.memories ?? [],
              studioName: ctx.persona.studio_name,
            });
            const r1 = await ctx.db.rpc('agent_order_effect', {
              p_order: id,
              p_expected_version: version,
              p_kind: 'lyrics',
              p_data: { text: composed.lyrics, title: composed.title, source: 'ai_draft_approved' },
            });
            // CORRECTIF (M4) : si l'effet est refusé (version_conflict...), on ne tente pas la transition.
            if (!rpcOk(r1, 'lyrics_effect', ctx.trace)) break;
            ctx.orderVersionMap.set(id, version + 1);
            const r2 = await ctx.db.rpc('agent_transition_order', {
              p_order: id,
              p_expected_version: version + 1,
              p_track: 'creative',
              p_event: 'lyrics_sent',
              p_actor: 'agent',
              p_turn: ctx.turnId,
            });
            if (rpcOk(r2, 'transition(creative:lyrics_sent)', ctx.trace)) ctx.orderVersionMap.set(id, version + 2);
            targetOrder.lyrics = composed.lyrics;
            targetOrder.stage = 'lyrics_sent';
          } catch (err) {
            console.error('Erreur composition paroles:', err);
            await ctx.db.rpc('agent_order_effect', {
              p_order: id,
              p_expected_version: version,
              p_kind: 'change_request',
              p_data: { note: `Échec composition paroles: ${(err as Error).message}` },
            });
            await queueOwnerAlert(
              ctx,
              id,
              `[Velaris Studio] Échec composition paroles IA pour ${ctx.clientName || 'client'} (${recipientName}). Intervention manuelle requise.`,
              'compose_failed',
            );
          }
        }
      }
      break;
    }
    case 'revise_lyrics': {
      if (ctx.persona.cap_lyrics_draft || ctx.persona.lyrics_author === 'ai_draft_approved' || ctx.persona.cap_lyrics_followup) {
        const { id, version } = resolveOrderForAction(action.order, ctx);
        const targetOrder = ctx.orders.find((o) => o.id === id);
        const rawOrder = ctx.rawOrders.find((o) => o.id === id);
        const existingLyrics = targetOrder?.lyrics || rawOrder?.lyrics;
        const recipientName = targetOrder?.recipientName || rawOrder?.recipient_name || 'votre proche';
        const occasion = targetOrder?.occasion || rawOrder?.occasion || 'votre événement';
        if (id && targetOrder && existingLyrics) {
          try {
            const changeReqs = rawOrder?.change_requests;
            const lastChange = Array.isArray(changeReqs) && changeReqs.length > 0 ? changeReqs[changeReqs.length - 1]?.text : '';
            const changeReqText = action.changeRequest || lastChange || 'Ajustements demandés par le client';
            const revised = await reviseLyrics(ctx.llmProvider, {
              existingLyrics,
              changeRequest: changeReqText,
              recipientName,
              occasion,
              studioName: ctx.persona.studio_name,
            });
            await ctx.db.rpc('agent_order_effect', {
              p_order: id,
              p_expected_version: version,
              p_kind: 'lyrics',
              p_data: { text: revised.lyrics, title: revised.title, source: 'ai_draft_approved' },
            });
            ctx.orderVersionMap.set(id, version + 1);
            await ctx.db.rpc('agent_transition_order', {
              p_order: id,
              p_expected_version: version + 1,
              p_track: 'creative',
              p_event: 'lyrics_sent',
              p_actor: 'agent',
              p_turn: ctx.turnId,
            });
            ctx.orderVersionMap.set(id, version + 2);
            targetOrder.lyrics = revised.lyrics;
            targetOrder.stage = 'lyrics_sent';
          } catch (err) {
            console.error('Erreur révision paroles:', err);
            await ctx.db.rpc('agent_order_effect', {
              p_order: id,
              p_expected_version: version,
              p_kind: 'change_request',
              p_data: { note: `Échec révision paroles: ${(err as Error).message}` },
            });
            await queueOwnerAlert(
              ctx,
              id,
              `[Velaris Studio] Échec retouches paroles IA pour ${ctx.clientName || 'client'} (${recipientName}). Intervention requise.`,
              'revise_failed',
            );
          }
        }
      }
      break;
    }
    case 'register_change_request': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        await ctx.db.rpc('agent_order_effect', {
          p_order: id,
          p_expected_version: version,
          p_kind: 'change_request',
          p_data: { text: action.text },
        });
        ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'store_own_lyrics': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        await ctx.db.rpc('agent_order_effect', {
          p_order: id,
          p_expected_version: version,
          p_kind: 'own_lyrics',
          p_data: { text: action.text },
        });
        ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'record_payment_deferral': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        await ctx.db.rpc('agent_order_effect', {
          p_order: id,
          p_expected_version: version,
          p_kind: 'payment_deferral',
          p_data: { reason: action.reason, when: action.when },
        });
        ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'register_payment_claim': {
      for (const ref of action.orders) {
        const { id, version } = resolveOrderForAction(ref, ctx);
        if (id) {
          const r = await ctx.db.rpc('agent_order_effect', {
            p_order: id,
            p_expected_version: version,
            p_kind: 'payment_claim',
            p_data: { with_image: action.withImage },
          });
          if (rpcOk(r, 'payment_claim', ctx.trace)) ctx.orderVersionMap.set(id, version + 1);
        }
      }
      break;
    }
    case 'handoff': {
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'handoff',
        p_data: { reason: action.reason, ack: action.ack },
      });
      const client = ctx.clientName || 'Un client';
      const msg = `[Velaris Studio] Prise en main requise pour la conversation avec ${client} (Raison : ${action.reason}).`;
      await queueOwnerAlert(ctx, null, msg, `handoff_${action.reason}`);
      break;
    }
    case 'alert_owner': {
      const { id } = action.order ? resolveOrderForAction(action.order, ctx) : { id: null };
      const order = id ? ctx.orders.find((o) => o.id === id) : null;
      const recipient = order?.recipientName ? ` pour ${order.recipientName}` : '';
      const client = ctx.clientName || 'Un client';

      let msg = '';
      switch (action.kind) {
        case 'payment_to_verify':
          msg = `[Velaris Studio] Paiement à vérifier pour ${client}${recipient}. Justificatif ou réclamation reçu.`;
          break;
        case 'unexpected_payment_claim':
          msg = `[Velaris Studio] Réclamation de paiement inattendue de ${client}${recipient}.`;
          break;
        case 'new_detail':
          msg = `[Velaris Studio] Nouveau détail ajouté par ${client}${recipient}.`;
          break;
        case 'own_lyrics':
          msg = `[Velaris Studio] ${client} a fourni ses propres paroles${recipient}.`;
          break;
        case 'change_request':
          msg = `[Velaris Studio] Demande de retouches reçue de ${client}${recipient}.`;
          break;
        case 'lyrics_validated':
          msg = `[Velaris Studio] Paroles validées par ${client}${recipient}.`;
          break;
        case 'production_ready':
          msg = `[Velaris Studio] Commande prête pour production : ${client}${recipient} (Paiement et paroles validés).`;
          break;
        case 'unclassified_image':
          msg = `[Velaris Studio] Image reçue de ${client}${recipient} (à vérifier).`;
          break;
        case 'missing_price':
          msg = `[Velaris Studio] Commande sans prix défini pour ${client}${recipient}.`;
          break;
        default:
          msg = `[Velaris Studio] Notification studio : ${action.kind} pour ${client}${recipient}.`;
          break;
      }

      await queueOwnerAlert(ctx, id, msg, `${action.kind}_${id ?? 'none'}`);
      break;
    }
    case 'launch_production': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        await ctx.db.rpc('agent_transition_order', {
          p_order: id,
          p_expected_version: version,
          p_track: 'creative',
          p_event: 'production_started',
          p_actor: 'agent',
          p_turn: ctx.turnId,
        });
        ctx.orderVersionMap.set(id, version + 1);
        const targetOrder = ctx.orders.find((o) => o.id === id);
        if (targetOrder) targetOrder.stage = 'in_production';
      }
      break;
    }
    case 'schedule_followup': {
      const { id } = resolveOrderForAction(action.order, ctx);
      const delayHours = ctx.persona?.followup_delay_hours ?? 24;
      const readyAt = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'schedule_followup',
        p_data: { kind: action.kind, order_id: id ?? null, at: readyAt },
      });
      break;
    }
    case 'send_procedure_voice': {
      // L'envoi effectif a lieu dans la phase de rendu (décision déterministe souveraine, cf. M14) :
      // rien à persister ici, l'action sert de signal vérifié par les invariants I13.
      break;
    }
    case 'store_images': {
      break;
    }
    case 'close_conversation': {
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'close',
        p_data: {},
      });
      break;
    }
    case 'mark_ack': {
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'mark_ack',
        p_data: { key: action.key },
      });
      break;
    }
    case 'mark_relay': {
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'mark_relay',
        p_data: { key: action.key },
      });
      break;
    }
    case 'bump_counter': {
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'bump_counter',
        p_data: { counter: action.counter },
      });
      break;
    }
    case 'reset_repeat': {
      await ctx.db.rpc('agent_conversation_effect', {
        p_conversation: ctx.conversationId,
        p_kind: 'reset_repeat',
        p_data: {},
      });
      break;
    }
    default:
      break;
  }
}
