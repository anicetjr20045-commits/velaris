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
import { renderOutputItem, type RenderContext, type RenderedMessage } from './render.js';

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
    procedure_voice_received: boolean;
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
    const forbiddenReasons = ['handoff:complaint', 'handoff:payment_dispute', 'handoff:very_negative'];
    const isRelayAllowed = isRelayMode && !forbiddenReasons.includes(reason) && clientWroteAfterMerchant && !managerAvailable;

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

  // 4. Préparer les messages entrants du tour
  const inboundTexts = raw.inbound
    .map((m) => m.transcript || m.body || '')
    .filter(Boolean);
  const turnText = inboundTexts.join('\n').trim();

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
  const openOrdersContext = orders.map((o) => ({ recipient: o.recipientName, occasion: o.occasion }));
  const currentStage = orders[0]?.stage ?? 'collecting_brief';
  const currentPaymentStatus = orders[0]?.paymentStatus ?? 'unpaid';
  const pendingQ = conversation.pending_question?.key
    ? String(conversation.pending_question.key)
    : null;

  const recentHistory = raw.recent.map((r) => ({
    who: (r.role === 'client' ? 'client' : r.role === 'gérant' ? 'gérant' : 'studio') as 'client' | 'gérant' | 'studio',
    text: r.text || '',
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
      procedureVoiceReceived: raw.contact_facts?.procedure_voice_received ?? false,
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
  for (const item of plan.items) {
    const res = await renderOutputItem(item, renderCtx);
    trace.push(...res.notes);
    renderedMessages.push(...res.messages);
  }

  // 13. Mettre en boîte d'envoi (agent_enqueue_outbox)
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
        await ctx.db.rpc('agent_choose_offer', { p_order: id, p_expected_version: version, p_code: action.code });
        ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'save_brief_fields': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        await ctx.db.rpc('agent_patch_order_fields', {
          p_order: id,
          p_expected_version: version,
          p_patch: action.patch,
          p_allow_clear: action.allowClear.length > 0,
        });
        ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'transition': {
      const { id, version } = resolveOrderForAction(action.order, ctx);
      if (id) {
        await ctx.db.rpc('agent_transition_order', {
          p_order: id,
          p_expected_version: version,
          p_track: action.track,
          p_event: action.event,
          p_actor: 'agent',
          p_turn: ctx.turnId,
        });
        ctx.orderVersionMap.set(id, version + 1);
      }
      break;
    }
    case 'request_lyrics': {
      if (ctx.persona.cap_lyrics_draft || ctx.persona.lyrics_author === 'ai_draft_approved') {
        const { id, version } = resolveOrderForAction(action.order, ctx);
        const targetOrder = ctx.orders.find((o) => o.id === id);
        if (id && targetOrder && targetOrder.recipientName && targetOrder.occasion) {
          try {
            const composed = await composeLyrics(ctx.llmProvider, {
              recipientName: targetOrder.recipientName,
              occasion: targetOrder.occasion,
              recipientRelation: targetOrder.recipientRelation,
              senderName: targetOrder.senderName,
              style: targetOrder.style,
              language: targetOrder.language,
              memories: targetOrder.memories ?? [],
              studioName: ctx.persona.studio_name,
            });
            await ctx.db.rpc('agent_order_effect', {
              p_order: id,
              p_expected_version: version,
              p_kind: 'lyrics',
              p_data: { text: composed.lyrics, title: composed.title, source: 'ai_draft_approved' },
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
            targetOrder.lyrics = composed.lyrics;
            targetOrder.stage = 'lyrics_sent';
          } catch (err) {
            await ctx.db.rpc('agent_order_effect', {
              p_order: id,
              p_expected_version: version,
              p_kind: 'change_request',
              p_data: { note: `Échec composition paroles: ${(err as Error).message}` },
            });
          }
        }
      }
      break;
    }
    case 'revise_lyrics': {
      if (ctx.persona.cap_lyrics_draft || ctx.persona.lyrics_author === 'ai_draft_approved' || ctx.persona.cap_lyrics_followup) {
        const { id, version } = resolveOrderForAction(action.order, ctx);
        const targetOrder = ctx.orders.find((o) => o.id === id);
        const existingLyrics = targetOrder?.lyrics;
        if (id && targetOrder && existingLyrics && targetOrder.recipientName && targetOrder.occasion) {
          try {
            const rawOrder = ctx.rawOrders.find((o) => o.id === id);
            const changeReqs = rawOrder?.change_requests;
            const lastChange = Array.isArray(changeReqs) && changeReqs.length > 0 ? changeReqs[changeReqs.length - 1]?.text : '';
            const changeReqText = action.changeRequest || lastChange || 'Ajustements demandés par le client';
            const revised = await reviseLyrics(ctx.llmProvider, {
              existingLyrics,
              changeRequest: changeReqText,
              recipientName: targetOrder.recipientName,
              occasion: targetOrder.occasion,
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
          await ctx.db.rpc('agent_order_effect', {
            p_order: id,
            p_expected_version: version,
            p_kind: 'payment_claim',
            p_data: { with_image: action.withImage },
          });
          ctx.orderVersionMap.set(id, version + 1);
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
    default:
      break;
  }
}
