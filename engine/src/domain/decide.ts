/**
 * Décision déterministe d'un tour.
 * Référence : ARCHITECTURE_AGENT_DEFINITIVE.md (v2), § 10 (résolution de la commande),
 * § 11 (priorités, piste paiement, piste créative, pas en avant), § 14.4 (relais).
 *
 * Règles de ce fichier (§ 21.2) :
 *  - fonction PURE : aucune I/O, aucune lecture d'horloge (l'heure arrive dans input.clock) ;
 *  - aucune expression régulière, aucune heuristique de longueur, aucune date calendaire ;
 *  - le sens vient de input.understanding (vérifiée), l'état vient de input.orders.
 *
 * decideSafely() est le seul point d'entrée du moteur : toute décision qui viole un
 * invariant est remplacée par le silence et une alerte au gérant.
 */

import {
  activeOffers,
  catalogueItemFor,
  creativeTransition,
  isBriefComplete,
  isOpen,
  isPaid,
  isPriced,
  missingSlots,
  paymentTransition,
  previewPatch,
  procedureVoiceDue,
  unpaidOpenOrders,
  type MissingSlot,
} from './orders.js';
import {
  LOW_CONFIDENCE,
  STANDALONE_STEPS,
  VALIDATION_CONFIDENCE,
  type Action,
  type BriefField,
  type BriefPatch,
  type CatalogueItem,
  type Decision,
  type DecisionInput,
  type Fact,
  type HandoffReason,
  type Intent,
  type OrderRef,
  type OrderSnapshot,
  type PendingQuestion,
  type ReplyGoal,
  type Step,
  type Utterance,
} from './types.js';

// ---------------------------------------------------------------------------
// Constantes de rythme (minutes) — I26 : une même attente, une seule réponse
// ---------------------------------------------------------------------------

const WELCOME_REPEAT_MIN = 12 * 60;
const LYRICS_ETA_REPEAT_MIN = 30;
const PRODUCTION_ETA_REPEAT_MIN = 15;
const NEW_DETAIL_ACK_REPEAT_MIN = 30;
const RELAY_REPEAT_MIN = 12 * 60;
const PROOF_IMAGE_MIN_CONFIDENCE = 0.7;
const RELAY_FORBIDDEN_REASONS: readonly string[] = ['handoff:complaint', 'handoff:payment_dispute', 'handoff:very_negative'];

// ---------------------------------------------------------------------------
// Construction de la décision
// ---------------------------------------------------------------------------

class DecisionBuilder {
  private readonly actions: Action[] = [];
  private readonly utterances: Utterance[] = [];
  private pending: PendingQuestion | null | 'keep' = 'keep';
  private readonly trace: string[] = [];

  act(action: Action): this {
    this.actions.push(action);
    return this;
  }

  say(step: Step, goal: ReplyGoal, order: OrderRef | null, facts: readonly Fact[] = [], extra: Partial<Pick<Utterance, 'asks' | 'relay'>> = {}): this {
    const u: Utterance = { step, goal, order, facts, relay: extra.relay ?? false };
    if (extra.asks !== undefined) u.asks = extra.asks;
    this.utterances.push(u);
    return this;
  }

  ask(question: PendingQuestion | null | 'keep'): this {
    this.pending = question;
    return this;
  }

  note(line: string): this {
    this.trace.push(line);
    return this;
  }

  build(): Decision {
    return { actions: this.actions, utterances: this.utterances, pendingQuestion: this.pending, trace: this.trace };
  }
}

const NEW_ORDER: OrderRef = { kind: 'new' };
const refOf = (o: OrderSnapshot): OrderRef => ({ kind: 'existing', id: o.id });
const idOf = (ref: OrderRef): string | null => (ref.kind === 'existing' ? ref.id : null);

function has(input: DecisionInput, intent: Intent): boolean {
  const u = input.understanding;
  return u.primaryIntent === intent || u.secondaryIntents.includes(intent);
}

function ackedWithin(input: DecisionInput, key: string, minutes: number): boolean {
  const iso = input.conversation.ackLog[key];
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && input.clock.nowMs - at < minutes * 60_000;
}

function relayedWithin(input: DecisionInput, key: string): boolean {
  const iso = input.handoff.relayLog[key];
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && input.clock.nowMs - at < RELAY_REPEAT_MIN * 60_000;
}

/** Comparaison de prénoms insensible à la casse et aux accents, sans expression régulière. */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string): string =>
    Array.from(s.normalize('NFD'))
      .filter((ch) => {
        const code = ch.codePointAt(0) ?? 0;
        return code < 0x0300 || code > 0x036f;
      })
      .join('')
      .toLowerCase()
      .trim();
  return norm(a) === norm(b);
}

function emptyOrder(): OrderSnapshot {
  return {
    id: '',
    version: 0,
    stage: 'collecting_brief',
    paymentStatus: 'unpaid',
    catalogueCode: null,
    priceXof: null,
    deliverable: null,
    paymentPolicy: null,
    occasion: null,
    recipientName: null,
    recipientNameConfirmed: false,
    recipientRelation: null,
    senderName: null,
    style: null,
    voice: null,
    language: null,
    memoriesCount: 0,
    photosCount: 0,
    revisionCount: 0,
    paymentInstructionsCount: 0,
    hasPaymentDeferral: false,
  };
}

// ---------------------------------------------------------------------------
// Faits transmis au rendu
// ---------------------------------------------------------------------------

function offerFacts(offers: readonly CatalogueItem[]): Fact[] {
  return offers.flatMap((o, i) => [
    { key: `offer_${i}_code`, value: o.code },
    { key: `offer_${i}_label`, value: o.label },
    { key: `offer_${i}_price_xof`, value: o.priceXof },
  ]);
}

function orderFacts(o: OrderSnapshot, input: DecisionInput): Fact[] {
  const facts: Fact[] = [];
  if (o.recipientName) facts.push({ key: 'recipient', value: o.recipientName });
  if (o.occasion) facts.push({ key: 'occasion', value: o.occasion });
  const offer = catalogueItemFor(o, input.studio);
  if (offer) facts.push({ key: 'offer_label', value: offer.label });
  if (o.priceXof !== null) facts.push({ key: 'price_xof', value: o.priceXof });
  return facts;
}

function etaFact(input: DecisionInput, orderId: string, kind: 'lyrics' | 'production' | 'video'): Fact[] {
  const phrase = input.eta[orderId]?.[kind];
  return phrase ? [{ key: 'eta_phrase', value: phrase }] : [];
}

// ---------------------------------------------------------------------------
// Signaux de paiement (§ 11.3)
// ---------------------------------------------------------------------------

interface PaymentSignals {
  askPay: boolean;
  claim: boolean;
  proofImage: boolean;
  defer: boolean;
  dispute: boolean;
}

function paymentSignals(input: DecisionInput): PaymentSignals {
  const u = input.understanding;
  const proofImage = input.media.images.some((i) => i.kind === 'payment_proof' && i.confidence >= PROOF_IMAGE_MIN_CONFIDENCE);
  const offerAnswerForPayment =
    input.conversation.pendingQuestion?.key === 'choose_offer_then_payment' && u.fields.offerCode !== undefined;
  return {
    askPay: has(input, 'ask_payment_method') || u.paymentSignal.kind === 'asks_how_to_pay' || offerAnswerForPayment,
    claim: (!u.negated && (has(input, 'payment_claim') || u.paymentSignal.kind === 'claims_paid')) || proofImage,
    proofImage,
    defer: has(input, 'payment_deferral') || u.paymentSignal.kind === 'defers',
    dispute: u.paymentSignal.kind === 'disputes_payment',
  };
}

// ---------------------------------------------------------------------------
// Résolution de la commande visée (§ 10)
// ---------------------------------------------------------------------------

export type Target =
  | { kind: 'none' }
  | { kind: 'order'; order: OrderSnapshot }
  | { kind: 'new' }
  | { kind: 'too_many' }
  | { kind: 'ambiguous'; candidates: readonly OrderSnapshot[] };

export function resolveTarget(input: DecisionInput): Target {
  const u = input.understanding;
  const open = input.orders.filter(isOpen);
  const named = u.orderReference.recipientName ?? u.fields.recipientName?.value;

  const differentRecipient =
    named !== undefined &&
    open.length > 0 &&
    open.every((o) => o.recipientName !== null && !sameName(o.recipientName, named));
  const wantsNew =
    open.length > 0 && (u.orderReference.isNewOrder === true || (u.primaryIntent === 'order_song' && differentRecipient));
  if (wantsNew) return open.length >= input.studio.maxOpenOrders ? { kind: 'too_many' } : { kind: 'new' };

  if (open.length === 0) return { kind: 'none' };

  const pendingId = input.conversation.pendingQuestion?.orderId;
  if (pendingId) {
    const o = open.find((x) => x.id === pendingId);
    if (o) return { kind: 'order', order: o };
  }
  if (open.length === 1) return { kind: 'order', order: open[0]! };

  if (named !== undefined) {
    const byName = open.filter((o) => o.recipientName !== null && sameName(o.recipientName, named));
    if (byName.length === 1) return { kind: 'order', order: byName[0]! };
  }
  const occasion = u.orderReference.occasion ?? u.fields.occasion?.value;
  if (occasion !== undefined) {
    const byOccasion = open.filter((o) => o.occasion !== null && sameName(o.occasion, occasion));
    if (byOccasion.length === 1) return { kind: 'order', order: byOccasion[0]! };
  }
  const focus = open.find((o) => o.id === input.conversation.focusOrderId);
  if (focus) return { kind: 'order', order: focus };
  return { kind: 'ambiguous', candidates: open };
}

// ---------------------------------------------------------------------------
// Brief : patch à partir de la compréhension (I20 : aucun effacement par inférence)
// ---------------------------------------------------------------------------

interface BriefUpdate {
  patch: BriefPatch;
  allowClear: BriefField[];
  offer: CatalogueItem | null;
  learned: boolean;
}

function briefUpdate(input: DecisionInput, orderId: string | null): BriefUpdate {
  const u = input.understanding;
  const f = u.fields;
  const patch: BriefPatch = {};
  const evidence: Record<string, string> = {};
  const allowClear: BriefField[] = [];

  if (f.occasion) { patch.occasion = f.occasion.value; evidence.occasion = f.occasion.quote; }
  if (f.recipientName) { patch.recipient_name = f.recipientName.value; evidence.recipient_name = f.recipientName.quote; }
  if (f.recipientRelation) { patch.recipient_relation = f.recipientRelation.value; evidence.recipient_relation = f.recipientRelation.quote; }
  if (f.senderName) { patch.sender_name = f.senderName.value; evidence.sender_name = f.senderName.quote; }
  if (f.style) { patch.style = f.style.value; evidence.style = f.style.quote; }
  if (f.voice) { patch.voice = f.voice.value; evidence.voice = f.voice.quote; }
  if (f.language) { patch.language = f.language.value; evidence.language = f.language.quote; }
  if (f.memories && f.memories.length > 0) patch.memories = f.memories;

  // Un « oui » / « non » n'agit que sur la question posée, et sur rien d'autre (cas Adeline)
  const pq = input.conversation.pendingQuestion;
  const aboutThisOrder = pq !== null && (pq.orderId === orderId || pq.orderId === null);
  if (pq?.key === 'confirm_recipient_name' && aboutThisOrder) {
    if (u.primaryIntent === 'confirm_yes') patch.recipient_name_confirmed = true;
    if (u.primaryIntent === 'confirm_no' && f.recipientName === undefined) {
      patch.recipient_name = null;
      allowClear.push('recipient_name');
    }
  }
  if (Object.keys(evidence).length > 0) patch.field_evidence = evidence;

  const offer = f.offerCode
    ? (input.studio.catalogue.find((c) => c.code === f.offerCode!.value && c.isActive) ?? null)
    : null;

  const learned = Object.keys(patch).some((k) => k !== 'field_evidence') || offer !== null;
  return { patch, allowClear, offer, learned };
}

function applyBriefActions(b: DecisionBuilder, ref: OrderRef, upd: BriefUpdate): void {
  const hasPatch = Object.keys(upd.patch).length > 0;
  if (hasPatch) b.act({ type: 'save_brief_fields', order: ref, patch: upd.patch, allowClear: upd.allowClear });
  if (upd.offer) b.act({ type: 'choose_offer', order: ref, code: upd.offer.code });
}

/** Pose la question du prochain élément manquant (une seule question). */
function askNextSlot(b: DecisionBuilder, input: DecisionInput, ref: OrderRef, after: OrderSnapshot, slot: MissingSlot, repeated: boolean): void {
  const orderId = idOf(ref);
  const facts = orderFacts(after, input);
  if (slot === 'offer') {
    b.say('offers', 'present_offers', ref, [...facts, ...offerFacts(activeOffers(input.studio))], { asks: 'offer' });
    b.ask({ key: 'choose_offer', orderId, asker: 'agent' });
    return;
  }
  if (slot === 'confirm_recipient_name') {
    b.say('brief_question', 'confirm_recipient_name', ref, facts, { asks: 'confirm' });
    b.ask({ key: 'confirm_recipient_name', orderId, asker: 'agent' });
    return;
  }
  b.say('brief_question', repeated ? 'guide_brief' : 'ask_next_field', ref, [...facts, { key: 'field', value: slot }], { asks: slot });
  b.ask({ key: 'ask_field', orderId, field: slot, asker: 'agent' });
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export function decide(input: DecisionInput): Decision {
  const b = new DecisionBuilder();
  const u = input.understanding;
  const pay = paymentSignals(input);

  // P0 — conversation close : silence absolu
  if (input.control.mode === 'closed') return b.note('P0 closed → silence').build();

  // P1 — le gérant a la main : silence, sauf accusé de passation dû ou relais sécurisé
  if (input.control.mode === 'human') return decideUnderHumanControl(input, pay, b);

  // Niveau 0 (suivi seul) : l'agent ne parle jamais
  if (!input.studio.caps.reception) return b.note('level 0 → silence').build();

  // P2 — demande d'arrêt
  if (u.stopRequest || u.primaryIntent === 'stop_contact') {
    b.act({ type: 'close_conversation' }).say('stop_ack', 'stop_ack', null).ask(null);
    return b.note('P2 stop_request').build();
  }

  // P3 — « Vous êtes un robot ? » : identité honnête, aucun changement d'état
  if (u.primaryIntent === 'asks_if_bot') {
    return b.say('identity', 'identity', null).note('P3 identity').build();
  }

  // P4 — demande d'humain, plainte, colère forte, contestation de paiement
  const humanReason = humanTrigger(input, pay);
  if (humanReason) return handoff(b, humanReason, true, `P4 ${humanReason}`);

  // P5 — disjoncteur de débit (I31)
  if (input.conversation.agentMsgsLastHour >= input.studio.maxAgentMsgsPerHour) {
    return handoff(b, 'rate_limit', false, 'P5 rate_limit');
  }

  // P6 — incertitude : pas en avant, puis passation discrète. Jamais « je n'ai pas compris ».
  if (u.confidence < LOW_CONFIDENCE) {
    if (input.conversation.lowConfStreak >= 2) return handoff(b, 'low_confidence', true, 'P6 low_confidence x2');
    return forwardMove(input, b);
  }
  if (input.conversation.repeatQuestionCount >= 3) {
    if (
      pay.askPay ||
      pay.claim ||
      pay.defer ||
      u.primaryIntent === 'choose_offer' ||
      u.primaryIntent === 'order_song' ||
      u.primaryIntent === 'validate_lyrics' ||
      u.fields.offerCode !== undefined
    ) {
      b.note('P6 loop bypassed: active commercial intent or payment request');
      b.act({ type: 'reset_repeat' });
    } else {
      return handoff(b, 'loop', true, 'P6 loop');
    }
  }

  const target = resolveTarget(input);
  b.note(`target=${target.kind}${target.kind === 'order' ? `:${target.order.stage}/${target.order.paymentStatus}` : ''}`);

  // Images non liées au paiement : photos souvenir, ou à classer par le gérant
  routeImages(input, b, target);

  // P8 — piste paiement, à toute étape (cas Fargo, Djalilou). Peut suivre un accueil émotionnel.
  if (pay.askPay || pay.claim || pay.defer) {
    if (!input.studio.caps.payment) return handoff(b, 'capability_off', true, 'P8 payment capability off');
    if (u.emotionalWeight === 'high') b.say('story_ack', 'acknowledge_story', null, storyFacts(input));
    paymentRail(input, pay, b);
    return b.build();
  }

  // P7 — confidence à forte charge émotionnelle (cas Fargo, Sylvie)
  if (u.emotionalWeight === 'high' && target.kind !== 'too_many' && target.kind !== 'ambiguous') {
    return emotionalTurn(input, b, target);
  }

  // P9 — méfiance (« c'est pas arnaque ? »)
  if (u.primaryIntent === 'trust_concern') {
    const policy = target.kind === 'order' ? target.order.paymentPolicy : (activeOffers(input.studio)[0]?.paymentPolicy ?? null);
    b.say('trust', 'reassure_trust', target.kind === 'order' ? refOf(target.order) : null, [
      { key: 'payment_after_lyrics', value: policy === 'after_lyrics_validation' },
      { key: 'sample_available', value: input.studio.hasSamples },
    ]);
    return b.note('P9 trust_concern').build();
  }

  // P10 — « voyons voir le son » : un exemple, seul
  if (u.primaryIntent === 'ask_sample') {
    if (input.studio.hasSamples) {
      const occ = target.kind === 'order' ? target.order.occasion : (u.fields.occasion?.value ?? null);
      b.say('sample', 'send_sample', target.kind === 'order' ? refOf(target.order) : null, occ ? [{ key: 'occasion', value: occ }] : []);
    } else {
      b.say('offers', 'explain_process', null, offerFacts(activeOffers(input.studio)));
    }
    return b.note('P10 ask_sample').build();
  }

  // Remise : refus poli une fois, passation à la deuxième
  if (u.primaryIntent === 'discount_request') {
    if (input.conversation.discountRequests >= 1) return handoff(b, 'discount', true, 'discount x2');
    b.act({ type: 'bump_counter', counter: 'discount_requests' });
    b.say('offers', 'decline_discount_politely', target.kind === 'order' ? refOf(target.order) : null, offerFacts(activeOffers(input.studio)));
    return b.note('discount x1').build();
  }

  // P12 — piste créative
  switch (target.kind) {
    case 'too_many':
      return handoff(b, 'too_many_orders', true, 'too_many_orders');
    case 'ambiguous':
      b.say('brief_question', 'disambiguate_order', null,
        target.candidates.flatMap((o, i) => (o.recipientName ? [{ key: `candidate_${i}`, value: o.recipientName }] : [])),
        { asks: 'which_order' });
      b.ask({ key: 'disambiguate_order', orderId: null, asker: 'agent' });
      return b.note('ambiguous target').build();
    case 'none':
      return welcomeTurn(input, b);
    case 'new':
      return briefTurn(input, b, NEW_ORDER, emptyOrder());
    case 'order':
      return orderTurn(input, b, target.order);
  }
}

// ---------------------------------------------------------------------------
// P1 — contrôle humain et relais (§ 14.4)
// ---------------------------------------------------------------------------

function decideUnderHumanControl(input: DecisionInput, pay: PaymentSignals, b: DecisionBuilder): Decision {
  if (input.handoff.open && input.handoff.origin === 'agent' && !input.handoff.ackSent) {
    return b.say('handoff_ack', 'handoff_ack', null).note('P1 pending handoff ack').build();
  }

  const reason = input.control.reason ?? '';
  const eligible =
    input.studio.relayMode === 'safe_templates' &&
    !RELAY_FORBIDDEN_REASONS.includes(reason) &&
    input.clock.clientWroteAfterMerchant &&
    (!input.clock.managerAvailable || input.clock.merchantSilentBeyondSla);
  if (!eligible) return b.note('P1 human control → silence').build();

  const u = input.understanding;
  const unpaid = unpaidOpenOrders(input.orders);

  if (pay.claim && input.studio.caps.payment) {
    if (relayedWithin(input, 'payment_claim_ack')) return b.note('P1 relay claim already sent').build();
    const targets = unpaid;
    if (targets.length > 0) {
      b.act({ type: 'register_payment_claim', orders: targets.map(refOf), withImage: pay.proofImage });
      for (const o of targets) {
        if (paymentTransition(o, 'payment_claimed', 'agent').ok) b.act({ type: 'transition', order: refOf(o), track: 'payment', event: 'payment_claimed' });
      }
    }
    b.act({ type: 'alert_owner', kind: targets.length > 0 ? 'payment_to_verify' : 'unexpected_payment_claim', order: null });
    b.act({ type: 'mark_relay', key: 'payment_claim_ack' });
    b.say('payment_ack', 'payment_claim_ack', null, [{ key: 'manager_available', value: input.clock.managerAvailable }], { relay: true });
    return b.note('P1 relay payment_claim_ack').build();
  }

  if (pay.askPay && input.studio.caps.payment) {
    if (relayedWithin(input, 'payment_instructions')) return b.note('P1 relay instructions already sent').build();
    const priced = unpaid.filter(isPriced);
    if (priced.length === 0) {
      b.act({ type: 'alert_owner', kind: 'missing_price', order: null });
      return b.note('P1 relay: no price fixed → silence + alert').build();
    }
    for (const o of priced) {
      if (paymentTransition(o, 'instructions_sent', 'agent').ok) b.act({ type: 'transition', order: refOf(o), track: 'payment', event: 'instructions_sent' });
    }
    b.act({ type: 'mark_relay', key: 'payment_instructions' });
    b.say('payment', 'payment_instructions', null, paymentFacts(priced, input), { relay: true });
    return b.note('P1 relay payment_instructions').build();
  }

  if (u.primaryIntent === 'ask_status' || u.primaryIntent === 'ask_delay' || u.primaryIntent === 'patient_wait') {
    if (relayedWithin(input, 'status_eta')) return b.note('P1 relay eta already sent').build();
    const target = resolveTarget(input);
    if (target.kind !== 'order') return b.note('P1 relay eta: no single target').build();
    const o = target.order;
    const inProd = o.stage === 'in_production';
    const facts = etaFact(input, o.id, inProd ? 'production' : 'lyrics');
    if (facts.length === 0) return b.note('P1 relay eta: no computable eta').build();
    b.act({ type: 'mark_relay', key: 'status_eta' });
    b.say(inProd ? 'production' : 'lyrics_wait', inProd ? 'production_eta' : 'lyrics_eta', refOf(o), facts, { relay: true });
    return b.note('P1 relay status_eta').build();
  }

  return b.note('P1 human control, no relay intent → silence').build();
}

// ---------------------------------------------------------------------------
// P4 / passation
// ---------------------------------------------------------------------------

function humanTrigger(input: DecisionInput, pay: PaymentSignals): HandoffReason | null {
  const u = input.understanding;
  if (u.wantsHuman || u.primaryIntent === 'ask_human') return 'ask_human';
  if (pay.dispute) return 'payment_dispute';
  if (u.primaryIntent === 'complaint') return 'complaint';
  if (u.sentiment === 'very_negative') return 'very_negative';
  return null;
}

function handoff(b: DecisionBuilder, reason: HandoffReason, ack: boolean, trace: string): Decision {
  b.act({ type: 'handoff', reason, ack });
  if (ack) b.say('handoff_ack', 'handoff_ack', null, [{ key: 'reason', value: reason }]);
  b.ask(null);
  return b.note(trace).build();
}

// ---------------------------------------------------------------------------
// P6 — pas en avant (§ 11.6)
// ---------------------------------------------------------------------------

function forwardMove(input: DecisionInput, b: DecisionBuilder): Decision {
  b.note('P6 low confidence x1 → forward move');
  const target = resolveTarget(input);
  if (target.kind === 'none') {
    b.say('offers', 'forward_move', null, [
      ...offerFacts(activeOffers(input.studio)),
      { key: 'sample_available', value: input.studio.hasSamples },
    ], { asks: 'offer' });
    b.ask({ key: 'choose_offer', orderId: null, asker: 'agent' });
    return b.build();
  }
  if (target.kind !== 'order') {
    b.act({ type: 'alert_owner', kind: 'unmapped', order: null });
    return b.build();
  }
  const o = target.order;
  if (o.stage === 'collecting_brief') {
    const slot = missingSlots(o, input.studio)[0];
    if (slot !== undefined) {
      askNextSlot(b, input, refOf(o), o, slot, true);
      return b.build();
    }
  }
  if (o.stage === 'lyrics_sent' && input.studio.caps.lyricsFollowup) {
    b.say('lyrics_feedback', 'confirm_keep_lyrics', refOf(o), orderFacts(o, input), { asks: 'validate' });
    b.ask({ key: 'validate_lyrics', orderId: o.id, asker: 'agent' });
    return b.build();
  }
  b.act({ type: 'alert_owner', kind: 'unmapped', order: refOf(o) });
  return b.build();
}

// ---------------------------------------------------------------------------
// Images (photos souvenir, à classer)
// ---------------------------------------------------------------------------

function routeImages(input: DecisionInput, b: DecisionBuilder, target: ReturnType<typeof resolveTarget>): void {
  const kinds = input.media.images
    .map((i) => (i.kind === 'payment_proof' && i.confidence < PROOF_IMAGE_MIN_CONFIDENCE ? 'unclassified' : i.kind))
    .filter((k) => k !== 'payment_proof');
  if (kinds.length === 0) return;
  const ref = target.kind === 'order' ? refOf(target.order) : null;
  b.act({ type: 'store_images', order: ref, kinds });
  if (kinds.includes('unclassified')) b.act({ type: 'alert_owner', kind: 'unclassified_image', order: ref });
}

// ---------------------------------------------------------------------------
// P8 — piste paiement (§ 11.3)
// ---------------------------------------------------------------------------

function paymentFacts(orders: readonly OrderSnapshot[], input: DecisionInput, pricesOverride: ReadonlyMap<string, number> = new Map()): Fact[] {
  const facts: Fact[] = [];
  let total = 0;
  orders.forEach((o, i) => {
    const price = pricesOverride.get(o.id) ?? o.priceXof ?? 0;
    total += price;
    const offer = catalogueItemFor(o, input.studio);
    facts.push({ key: `order_${i}_price_xof`, value: price });
    if (o.recipientName) facts.push({ key: `order_${i}_recipient`, value: o.recipientName });
    if (offer) facts.push({ key: `order_${i}_label`, value: offer.label });
  });
  facts.push({ key: 'total_xof', value: total });
  return facts;
}

function paymentRail(input: DecisionInput, pay: PaymentSignals, b: DecisionBuilder): void {
  const u = input.understanding;
  const unpaid = unpaidOpenOrders(input.orders);

  // Preuve ou affirmation de paiement : enregistrée, jamais confirmée par l'agent (I8)
  if (pay.claim) {
    if (unpaid.length > 0) {
      b.act({ type: 'register_payment_claim', orders: unpaid.map(refOf), withImage: pay.proofImage });
      for (const o of unpaid) {
        if (paymentTransition(o, 'payment_claimed', 'agent').ok) b.act({ type: 'transition', order: refOf(o), track: 'payment', event: 'payment_claimed' });
      }
      b.act({ type: 'alert_owner', kind: 'payment_to_verify', order: null });
    } else {
      b.act({ type: 'alert_owner', kind: 'unexpected_payment_claim', order: null });
    }
    b.say('payment_ack', 'payment_claim_ack', null, [{ key: 'manager_available', value: input.clock.managerAvailable }]);
    b.note('P8 payment claim');
    return;
  }

  // Demande du numéro de dépôt : répondue à toute étape dès qu'un prix est fixé (I21)
  if (pay.askPay) {
    const chosen = u.fields.offerCode
      ? (input.studio.catalogue.find((c) => c.code === u.fields.offerCode!.value && c.isActive) ?? null)
      : null;
    const offers = activeOffers(input.studio);
    const singleOffer = offers.length === 1 ? offers[0]! : null;

    if (unpaid.length === 0) {
      if (input.orders.some((o) => isOpen(o) && isPaid(o))) {
        b.say('payment_ack', 'payment_claim_ack', null, [{ key: 'already_confirmed', value: true }]);
        b.note('P8 askPay but already paid');
        return;
      }
      // Aucune commande : on l'ouvre, et on fixe la formule si elle est connue ou unique
      b.act({ type: 'open_order' });
      const offer = chosen ?? singleOffer;
      if (offer) {
        b.act({ type: 'choose_offer', order: NEW_ORDER, code: offer.code });
        b.act({ type: 'transition', order: NEW_ORDER, track: 'payment', event: 'instructions_sent' });
        b.say('payment', 'payment_instructions', NEW_ORDER, [
          { key: 'order_0_price_xof', value: offer.priceXof },
          { key: 'order_0_label', value: offer.label },
          { key: 'total_xof', value: offer.priceXof },
        ]);
        b.ask(null);
      } else {
        b.say('offers', 'ask_offer_for_payment', NEW_ORDER, offerFacts(offers), { asks: 'offer' });
        b.ask({ key: 'choose_offer_then_payment', orderId: null, asker: 'agent' });
      }
      b.note('P8 askPay without order');
      return;
    }

    const unpriced = unpaid.filter((o) => !isPriced(o));
    const prices = new Map<string, number>();
    if (unpriced.length > 0) {
      const offer = chosen ?? singleOffer;
      if (!offer) {
        const first = unpriced[0]!;
        b.say('offers', 'ask_offer_for_payment', refOf(first), [...orderFacts(first, input), ...offerFacts(offers)], { asks: 'offer' });
        b.ask({ key: 'choose_offer_then_payment', orderId: first.id, asker: 'agent' });
        b.note('P8 askPay: offer unknown → one question');
        return;
      }
      for (const o of unpriced) {
        b.act({ type: 'choose_offer', order: refOf(o), code: offer.code });
        prices.set(o.id, offer.priceXof);
      }
    }
    for (const o of unpaid) {
      if (paymentTransition(o, 'instructions_sent', 'agent').ok) b.act({ type: 'transition', order: refOf(o), track: 'payment', event: 'instructions_sent' });
    }
    b.say('payment', 'payment_instructions', null, paymentFacts(unpaid, input, prices));
    b.ask(null);
    b.note('P8 askPay → instructions');
    return;
  }

  // Report (« dépôt là si c'est demain… ») : une seule réponse, relance à l'ouverture (cas Djalilou)
  if (pay.defer) {
    const target = unpaid.find((o) => o.id === input.conversation.focusOrderId) ?? unpaid[0];
    if (!target) {
      b.note('P8 defer without unpaid order → silence');
      return;
    }
    const key = `${target.id}:payment_deferral`;
    b.act({
      type: 'record_payment_deferral',
      order: refOf(target),
      reason: u.paymentSignal.deferralReason ?? 'unknown',
      when: u.paymentSignal.deferralWhen ?? 'unknown',
    });
    if (input.conversation.ackLog[key] !== undefined) {
      b.note('P8 defer already acknowledged → silence (I26)');
      return;
    }
    b.act({ type: 'schedule_followup', kind: 'payment_after_deferral', order: refOf(target) });
    b.act({ type: 'mark_ack', key });
    b.say('payment_deferral', 'ack_deferral', refOf(target), [
      ...orderFacts(target, input),
      { key: 'deferral_reason', value: u.paymentSignal.deferralReason ?? 'unknown' },
    ]);
    b.note('P8 defer → single ack + followup at payment window opening');
  }
}

// ---------------------------------------------------------------------------
// P7 — accueil émotionnel (aucune question administrative : I29)
// ---------------------------------------------------------------------------

function storyFacts(input: DecisionInput): Fact[] {
  const u = input.understanding;
  const facts: Fact[] = [{ key: 'sensitive_topic', value: u.sensitiveTopic }];
  (u.fields.memories ?? []).forEach((m, i) => facts.push({ key: `story_${i}`, value: m.value }));
  if (u.fields.recipientName) facts.push({ key: 'recipient', value: u.fields.recipientName.value });
  return facts;
}

function emotionalTurn(input: DecisionInput, b: DecisionBuilder, target: Exclude<Target, { kind: 'too_many' } | { kind: 'ambiguous' }>): Decision {
  let ref: OrderRef;
  let snapshot: OrderSnapshot;
  if (target.kind === 'order') {
    ref = refOf(target.order);
    snapshot = target.order;
  } else {
    b.act({ type: 'open_order' });
    ref = NEW_ORDER;
    snapshot = emptyOrder();
  }
  const upd = briefUpdate(input, idOf(ref));
  if (input.understanding.sensitiveTopic !== 'none') upd.patch.sensitive_topic = input.understanding.sensitiveTopic;
  applyBriefActions(b, ref, upd);
  const after = previewPatch(snapshot, upd.patch, upd.allowClear, upd.offer);

  // Au plus la question créative la plus naturelle : occasion, prénom, ou sa confirmation
  type CreativeSlot = 'occasion' | 'recipient_name' | 'confirm_recipient_name';
  const isCreative = (s: MissingSlot): s is CreativeSlot =>
    s === 'occasion' || s === 'recipient_name' || s === 'confirm_recipient_name';
  const next = after.stage === 'collecting_brief' ? missingSlots(after, input.studio).find(isCreative) : undefined;
  const facts = storyFacts(input);
  if (next === undefined) {
    b.say('story_ack', 'acknowledge_story', ref, facts);
    b.ask('keep');
    if (after.stage === 'collecting_brief' && isBriefComplete(after, input.studio)) {
      // Le vocal doit partir seul : il partira au prochain tour, jamais collé à cet accueil.
      b.note('P7 brief complete but emotional turn → procedure deferred to next turn');
    }
  } else if (next === 'confirm_recipient_name') {
    b.say('story_ack', 'acknowledge_story', ref, facts, { asks: 'confirm' });
    b.ask({ key: 'confirm_recipient_name', orderId: idOf(ref), asker: 'agent' });
  } else {
    b.say('story_ack', 'acknowledge_story', ref, [...facts, { key: 'field', value: next }], { asks: next });
    b.ask({ key: 'ask_field', orderId: idOf(ref), field: next, asker: 'agent' });
  }
  return b.note('P7 emotional turn').build();
}

// ---------------------------------------------------------------------------
// Accueil (aucune commande ouverte)
// ---------------------------------------------------------------------------

const COMMERCIAL_INTENTS: readonly Intent[] = ['order_song', 'give_brief_info', 'shares_story', 'choose_offer', 'needs_guidance', 'provides_own_lyrics'];

function welcomeTurn(input: DecisionInput, b: DecisionBuilder): Decision {
  const u = input.understanding;
  if (COMMERCIAL_INTENTS.includes(u.primaryIntent) || u.fields.offerCode || u.fields.recipientName || u.fields.occasion) {
    b.act({ type: 'open_order' });
    return briefTurn(input, b, NEW_ORDER, emptyOrder());
  }

  const asking = u.primaryIntent === 'ask_price' || u.primaryIntent === 'ask_how_it_works' || u.primaryIntent === 'ask_delay';
  const welcomeRecentlySent = ackedWithin(input, 'welcome', WELCOME_REPEAT_MIN);
  if (!asking && welcomeRecentlySent) {
    return b.note('welcome already sent → silence').build();
  }

  const returning = input.contact.deliveredOrders > 0;
  // CORRECTIF (mineur) : si le client repose une question prix/fonctionnement/délai alors que
  // l'accueil a déjà été envoyé, on ne renvoie pas tout le bloc d'accueil — juste la réponse ciblée.
  if (!welcomeRecentlySent) {
    b.say('welcome', returning ? 'welcome_returning' : 'welcome', null, [{ key: 'returning_client', value: returning }]);
    b.act({ type: 'mark_ack', key: 'welcome' });
  }
  const first = input.studio.briefFieldOrder[0] ?? 'occasion';
  b.say('offers', u.primaryIntent === 'ask_how_it_works' ? 'explain_process' : 'present_offers', null,
    [...offerFacts(activeOffers(input.studio)), { key: 'field', value: first }], { asks: first });
  b.ask(first === 'offer'
    ? { key: 'choose_offer', orderId: null, asker: 'agent' }
    : { key: 'ask_field', orderId: null, field: first, asker: 'agent' });
  return b.note(`welcome (${returning ? 'returning' : 'new'} client)`).build();
}

// ---------------------------------------------------------------------------
// Recueil du brief
// ---------------------------------------------------------------------------

function briefTurn(input: DecisionInput, b: DecisionBuilder, ref: OrderRef, snapshot: OrderSnapshot): Decision {
  const u = input.understanding;
  if (ref.kind === 'new' && !b.build().actions.some((a) => a.type === 'open_order')) b.act({ type: 'open_order' });

  const upd = briefUpdate(input, idOf(ref));
  applyBriefActions(b, ref, upd);

  if (u.primaryIntent === 'provides_own_lyrics' && u.fields.ownLyrics) {
    b.act({ type: 'store_own_lyrics', order: ref, text: u.fields.ownLyrics.value });
    b.act({ type: 'alert_owner', kind: 'own_lyrics', order: ref });
    b.say('brief_question', 'ack_own_lyrics', ref, []);
    return b.note('own lyrics received').build();
  }

  const after = previewPatch(snapshot, upd.patch, upd.allowClear, upd.offer);
  const missing = missingSlots(after, input.studio);

  if (missing.length === 0) {
    b.act({ type: 'transition', order: ref, track: 'creative', event: 'brief_completed' });
    b.ask(null);
    // Le vocal de procédure part STRICTEMENT quand le brief est complet, et SEUL (I13)
    if (procedureVoiceDue(input.studio, input.contact.procedureVoiceReceived)) {
      b.act({ type: 'send_procedure_voice', order: ref });
      b.say('procedure', 'procedure_voice', ref, []);
      return b.note('brief complete → procedure voice alone').build();
    }
    b.act({ type: 'transition', order: ref, track: 'creative', event: 'lyrics_work_started' });
    b.act({ type: 'request_lyrics', order: ref });
    if (after.paymentPolicy === 'before_lyrics' && input.studio.caps.payment && !isPaid(after)) {
      b.act({ type: 'transition', order: ref, track: 'payment', event: 'instructions_sent' });
      b.say('payment', 'payment_instructions', ref, paymentFacts([after], input));
      return b.note('brief complete, before_lyrics → payment instructions').build();
    }
    if (input.studio.caps.lyricsDraft) {
      b.say('lyrics_delivery', 'deliver_lyrics', ref, orderFacts(after, input), { asks: 'validate' });
      b.ask({ key: 'validate_lyrics', orderId: idOf(ref), asker: 'agent' });
      return b.note('brief complete, voice already received → lyrics drafted & delivered').build();
    }
    b.say('lyrics_wait', 'brief_received', ref, [...orderFacts(after, input), ...(ref.kind === 'existing' ? etaFact(input, ref.id, 'lyrics') : [])]);
    return b.note('brief complete, voice already received → lyrics in progress').build();
  }

  const pq = input.conversation.pendingQuestion;
  const slot = missing[0]!;
  const repeated =
    !upd.learned &&
    pq !== null &&
    ((slot === 'offer' && pq.key === 'choose_offer') ||
      (slot === 'confirm_recipient_name' && pq.key === 'confirm_recipient_name') ||
      (pq.key === 'ask_field' && pq.field === slot));
  if (repeated) {
    b.act({ type: 'bump_counter', counter: 'repeat_question_count' });
  } else if (
    (upd.learned ||
      u.primaryIntent === 'choose_offer' ||
      u.primaryIntent === 'ask_sample' ||
      u.primaryIntent === 'acknowledgement' ||
      u.primaryIntent === 'positive_feedback') &&
    input.conversation.repeatQuestionCount > 0
  ) {
    b.act({ type: 'reset_repeat' });
  }

  if (u.primaryIntent === 'needs_guidance') {
    b.say('brief_question', 'guide_brief', ref, [...orderFacts(after, input), { key: 'field', value: slot }], { asks: slot === 'confirm_recipient_name' ? 'confirm' : slot });
    b.ask(slot === 'offer'
      ? { key: 'choose_offer', orderId: idOf(ref), asker: 'agent' }
      : slot === 'confirm_recipient_name'
        ? { key: 'confirm_recipient_name', orderId: idOf(ref), asker: 'agent' }
        : { key: 'ask_field', orderId: idOf(ref), field: slot, asker: 'agent' });
    return b.note('needs guidance → simple concrete question').build();
  }

  askNextSlot(b, input, ref, after, slot, repeated);
  return b.note(`brief: next slot ${slot}${repeated ? ' (repeated)' : ''}`).build();
}

// ---------------------------------------------------------------------------
// Commande existante : matrice par étape (§ 11.4)
// ---------------------------------------------------------------------------

const STATUS_INTENTS: readonly Intent[] = ['ask_status', 'ask_delay', 'patient_wait', 'acknowledgement', 'thanks_closing'];

function orderTurn(input: DecisionInput, b: DecisionBuilder, o: OrderSnapshot): Decision {
  const u = input.understanding;
  const ref = refOf(o);
  const pq = input.conversation.pendingQuestion;

  // Annulation : toujours confirmée en deux temps
  if (u.primaryIntent === 'cancel_order') {
    b.say('brief_question', 'confirm_cancel', ref, orderFacts(o, input), { asks: 'confirm' });
    b.ask({ key: 'confirm_cancel', orderId: o.id, asker: 'agent' });
    return b.note('cancel requested → confirmation').build();
  }
  if (pq?.key === 'confirm_cancel' && pq.orderId === o.id && (u.primaryIntent === 'confirm_yes' || u.primaryIntent === 'confirm_no')) {
    if (u.primaryIntent === 'confirm_no') {
      b.ask(null);
      return b.note('cancel not confirmed').build();
    }
    const t = creativeTransition(o, 'order_cancelled', 'agent');
    if (!t.ok) return handoff(b, 'payment_lock', true, `cancel refused: ${t.reason}`);
    b.act({ type: 'transition', order: ref, track: 'creative', event: 'order_cancelled' });
    b.say('brief_question', 'confirm_cancel', ref, [{ key: 'cancelled', value: true }]);
    b.ask(null);
    return b.note('order cancelled').build();
  }

  if (u.primaryIntent === 'ask_price') {
    b.say('offers', 'present_offers', ref, [...orderFacts(o, input), ...offerFacts(activeOffers(input.studio))]);
    return b.note('ask_price on existing order').build();
  }

  switch (o.stage) {
    case 'collecting_brief':
      return briefTurn(input, b, ref, o);

    case 'brief_complete':
    case 'lyrics_in_progress':
      return lyricsInProgressTurn(input, b, o);

    case 'lyrics_sent':
      return lyricsSentTurn(input, b, o);

    case 'lyrics_validated':
      if (u.primaryIntent === 'ask_status' && isPaid(o)) {
        return etaOnce(input, b, o, 'production', PRODUCTION_ETA_REPEAT_MIN);
      }
      return b.note('lyrics validated, waiting → silence').build();

    case 'in_production':
      if (STATUS_INTENTS.includes(u.primaryIntent) && u.primaryIntent !== 'acknowledgement' && u.primaryIntent !== 'thanks_closing') {
        return etaOnce(input, b, o, 'production', PRODUCTION_ETA_REPEAT_MIN);
      }
      return b.note('in production → silence').build();

    case 'audio_delivered':
    case 'video_in_progress':
      if (input.media.images.some((i) => i.kind === 'photo')) {
        const key = `${o.id}:ack_photos`;
        if (ackedWithin(input, key, NEW_DETAIL_ACK_REPEAT_MIN)) return b.note('photos already acknowledged').build();
        b.act({ type: 'mark_ack', key });
        b.say('video_photos', 'ack_photos', ref, orderFacts(o, input));
        return b.note('video photos acknowledged').build();
      }
      if (u.primaryIntent === 'ask_status' || u.primaryIntent === 'ask_delay') {
        return etaOnce(input, b, o, 'video', PRODUCTION_ETA_REPEAT_MIN);
      }
      return b.note('video stage → silence').build();

    case 'delivered':
    case 'closed':
    case 'cancelled':
      return b.note('closed order targeted → silence').build();
  }
}

function etaOnce(input: DecisionInput, b: DecisionBuilder, o: OrderSnapshot, kind: 'lyrics' | 'production' | 'video', repeatMin: number): Decision {
  const key = `${o.id}:eta:${kind}`;
  if (ackedWithin(input, key, repeatMin)) return b.note(`eta ${kind} already given → silence (I26)`).build();
  const facts = etaFact(input, o.id, kind);
  if (facts.length === 0) return b.note(`eta ${kind} not computable → silence`).build();
  b.act({ type: 'mark_ack', key });
  const step: Step = kind === 'lyrics' ? 'lyrics_wait' : kind === 'production' ? 'production' : 'video_photos';
  const goal: ReplyGoal = kind === 'lyrics' ? 'lyrics_eta' : kind === 'production' ? 'production_eta' : 'video_eta';
  b.say(step, goal, refOf(o), [...orderFacts(o, input), ...facts]);
  return b.note(`eta ${kind}`).build();
}

function lyricsInProgressTurn(input: DecisionInput, b: DecisionBuilder, o: OrderSnapshot): Decision {
  const u = input.understanding;
  const ref = refOf(o);

  // Formule payée avant les paroles : instructions proactives une fois
  if (o.paymentPolicy === 'before_lyrics' && input.studio.caps.payment && o.paymentStatus === 'unpaid' && isPriced(o) && STATUS_INTENTS.includes(u.primaryIntent)) {
    b.act({ type: 'transition', order: ref, track: 'payment', event: 'instructions_sent' });
    b.say('payment', 'payment_instructions', ref, paymentFacts([o], input));
    return b.note('lyrics in progress, before_lyrics unpaid → instructions').build();
  }

  if (u.primaryIntent === 'provides_own_lyrics' && u.fields.ownLyrics) {
    b.act({ type: 'store_own_lyrics', order: ref, text: u.fields.ownLyrics.value });
    b.act({ type: 'alert_owner', kind: 'own_lyrics', order: ref });
    b.say('brief_question', 'ack_own_lyrics', ref, []);
    return b.note('own lyrics during writing').build();
  }

  const newDetail = u.primaryIntent === 'give_brief_info' || u.primaryIntent === 'shares_story' || u.primaryIntent === 'request_lyrics_change';
  if (newDetail) {
    const upd = briefUpdate(input, o.id);
    applyBriefActions(b, ref, upd);
    if (u.fields.changeRequest) b.act({ type: 'register_change_request', order: ref, text: u.fields.changeRequest.value });
    b.act({ type: 'alert_owner', kind: 'new_detail', order: ref });
    const key = `${o.id}:new_detail`;
    if (ackedWithin(input, key, NEW_DETAIL_ACK_REPEAT_MIN)) return b.note('new detail recorded, already acknowledged').build();
    b.act({ type: 'mark_ack', key });
    b.say('lyrics_wait', 'ack_new_detail', ref, orderFacts(o, input));
    return b.note('new detail during writing → recorded + single ack').build();
  }

  // Commande post-vocal de procédure (brief_complete) ou lyrics_in_progress sans paroles
  if (o.stage === 'brief_complete' || (o.stage === 'lyrics_in_progress' && !o.lyrics)) {
    if (o.stage === 'brief_complete') {
      b.act({ type: 'transition', order: ref, track: 'creative', event: 'lyrics_work_started' });
    }
    if (input.studio.caps.lyricsDraft) {
      b.act({ type: 'request_lyrics', order: ref });
      if (o.paymentPolicy === 'before_lyrics' && input.studio.caps.payment && !isPaid(o) && isPriced(o)) {
        b.act({ type: 'transition', order: ref, track: 'payment', event: 'instructions_sent' });
        b.say('payment', 'payment_instructions', ref, paymentFacts([o], input));
        return b.note('brief complete → lyrics drafted, before_lyrics payment instructions').build();
      }
      b.say('lyrics_delivery', 'deliver_lyrics', ref, orderFacts(o, input), { asks: 'validate' });
      b.ask({ key: 'validate_lyrics', orderId: o.id, asker: 'agent' });
      return b.note('post-procedure-voice reply → lyrics drafted & delivered').build();
    }
    if (STATUS_INTENTS.includes(u.primaryIntent)) {
      if (u.primaryIntent === 'thanks_closing') return b.note('thanks while lyrics in progress → silence').build();
      return etaOnce(input, b, o, 'lyrics', LYRICS_ETA_REPEAT_MIN);
    }
    return b.note('brief complete → lyrics in progress (human)').build();
  }

  if (STATUS_INTENTS.includes(u.primaryIntent)) {
    if (u.primaryIntent === 'thanks_closing') return b.note('thanks while lyrics in progress → silence').build();
    return etaOnce(input, b, o, 'lyrics', LYRICS_ETA_REPEAT_MIN);
  }

  return b.note('lyrics in progress → silence').build();
}

function lyricsSentTurn(input: DecisionInput, b: DecisionBuilder, o: OrderSnapshot): Decision {
  const u = input.understanding;
  const ref = refOf(o);
  const pq = input.conversation.pendingQuestion;
  const askedValidation = pq?.key === 'validate_lyrics' && (pq.orderId === o.id || pq.orderId === null);
  const askedChangeRecap = pq?.key === 'confirm_change_recap' && (pq.orderId === o.id || pq.orderId === null);
  const follow = input.studio.caps.lyricsFollowup;

  const validates =
    !u.negated &&
    (u.primaryIntent === 'validate_lyrics' ||
      (u.primaryIntent === 'confirm_yes' && askedValidation) ||
      (u.primaryIntent === 'positive_feedback' && u.confidence >= VALIDATION_CONFIDENCE));
  const weakPositive = u.primaryIntent === 'positive_feedback' && u.confidence < VALIDATION_CONFIDENCE;
  const wantsChange = u.primaryIntent === 'request_lyrics_change' || (u.primaryIntent === 'confirm_no' && askedValidation);

  // Tour 2 des retouches : confirmation du récapitulatif par le client
  if (
    askedChangeRecap &&
    (u.primaryIntent === 'confirm_yes' ||
      u.primaryIntent === 'confirm_no' ||
      u.primaryIntent === 'acknowledgement' ||
      u.primaryIntent === 'patient_wait' ||
      u.primaryIntent === 'positive_feedback')
  ) {
    b.act({ type: 'transition', order: ref, track: 'creative', event: 'change_requested' });
    b.act({ type: 'revise_lyrics', order: ref });
    if (o.revisionCount >= 1) {
      b.act({ type: 'alert_owner', kind: 'change_request', order: ref });
    }
    if (!follow) {
      b.ask(null);
      return b.note('change recap confirmed (recorded, level < 2 → silence)').build();
    }
    if (input.studio.caps.lyricsDraft) {
      b.say('lyrics_delivery', 'deliver_revised_lyrics', ref, orderFacts(o, input), { asks: 'validate' });
      b.ask({ key: 'validate_lyrics', orderId: o.id, asker: 'agent' });
      return b.note('change recap confirmed → revised lyrics delivered').build();
    }
    b.ask(null);
    b.say('lyrics_feedback', 'ack_change_request', ref, [...orderFacts(o, input), ...etaFact(input, o.id, 'lyrics')]);
    return b.note('change recap confirmed → revision in progress (5 min)').build();
  }

  // Ajout de détails supplémentaires pendant le récapitulatif
  if (
    askedChangeRecap &&
    (u.primaryIntent === 'give_brief_info' || u.primaryIntent === 'shares_story' || u.primaryIntent === 'request_lyrics_change')
  ) {
    if (u.fields.changeRequest) {
      b.act({ type: 'register_change_request', order: ref, text: u.fields.changeRequest.value });
    }
    if (o.revisionCount >= 1) {
      b.act({ type: 'alert_owner', kind: 'change_request', order: ref });
    }
    b.say('lyrics_feedback', 'recap_change_request', ref, orderFacts(o, input), { asks: 'confirm' });
    b.ask({ key: 'confirm_change_recap', orderId: o.id, asker: 'agent' });
    return b.note('additional change during recap → update recap & ask again').build();
  }

  if (validates) {
    b.act({ type: 'transition', order: ref, track: 'creative', event: 'lyrics_validated' });
    b.ask(null);
    if (!follow) {
      b.act({ type: 'alert_owner', kind: 'lyrics_validated', order: ref });
      return b.note('lyrics validated (recorded, level < 2 → silence)').build();
    }
    if (isPaid(o)) {
      const audio = o.deliverable === 'audio' || o.deliverable === 'audio_video';
      if (audio && input.studio.caps.autoProduction) {
        b.act({ type: 'launch_production', order: ref });
        b.say('production', 'production_eta', ref, [...orderFacts(o, input), ...etaFact(input, o.id, 'production')]);
        return b.note('validated + paid → production').build();
      }
      b.act({ type: 'alert_owner', kind: 'production_ready', order: ref });
      b.say('lyrics_feedback', 'thank_validation', ref, orderFacts(o, input));
      return b.note('validated + paid → merchant launches').build();
    }
    if (input.studio.caps.payment && isPriced(o) && o.paymentPolicy !== 'before_lyrics' && paymentTransition(o, 'instructions_sent', 'agent').ok) {
      b.act({ type: 'transition', order: ref, track: 'payment', event: 'instructions_sent' });
      b.say('lyrics_feedback', 'thank_validation', ref, orderFacts(o, input));
      b.say('payment', 'payment_instructions', ref, paymentFacts([o], input));
      return b.note('validated → thanks + payment instructions').build();
    }
    b.act({ type: 'alert_owner', kind: 'lyrics_validated', order: ref });
    b.say('lyrics_feedback', 'thank_validation', ref, orderFacts(o, input));
    return b.note('validated → thanks, merchant handles payment').build();
  }

  // Tour 1 des retouches : capture, alerte douce si >= 1 retouche, récapitulatif & question de verrouillage
  if (wantsChange) {
    if (o.revisionCount >= input.studio.maxFreeRevisions) return handoff(b, 'revision_limit', true, 'revision limit');
    b.act({ type: 'register_change_request', order: ref, text: u.fields.changeRequest?.value ?? '' });
    if (o.revisionCount >= 1) {
      b.act({ type: 'alert_owner', kind: 'change_request', order: ref });
    }
    if (!follow) return b.note('change requested (recorded, level < 2 → silence)').build();
    b.say('lyrics_feedback', 'recap_change_request', ref, orderFacts(o, input), { asks: 'confirm' });
    b.ask({ key: 'confirm_change_recap', orderId: o.id, asker: 'agent' });
    return b.note('change requested → recap & ask if all').build();
  }

  if (weakPositive && follow) {
    b.say('lyrics_feedback', 'confirm_keep_lyrics', ref, orderFacts(o, input), { asks: 'validate' });
    b.ask({ key: 'validate_lyrics', orderId: o.id, asker: 'agent' });
    return b.note('weak positive → confirm keep lyrics').build();
  }

  return b.note('lyrics sent, no feedback signal → silence').build();
}

// ---------------------------------------------------------------------------
// Invariants de décision : verrou final avant tout envoi (§ 4)
// ---------------------------------------------------------------------------

const RELAY_STEPS: readonly Step[] = ['payment', 'payment_ack', 'lyrics_wait', 'production'];

export function assertDecisionInvariants(d: Decision, input: DecisionInput): string[] {
  const v: string[] = [];
  const steps = d.utterances.map((x) => x.step);

  if (d.utterances.length > 2) v.push('I12: more than 2 utterances');
  if (d.utterances.filter((x) => x.asks !== undefined).length > 1) v.push('I12: more than one question');
  if (steps.some((s) => STANDALONE_STEPS.includes(s)) && d.utterances.length !== 1) v.push('I13/I25: standalone message not alone');

  const sendsVoice = d.actions.some((a) => a.type === 'send_procedure_voice');
  if (steps.includes('procedure') !== sendsVoice) v.push('I13: procedure utterance and voice action must go together');
  if (sendsVoice) {
    const completes = d.actions.some((a) => a.type === 'transition' && a.track === 'creative' && a.event === 'brief_completed');
    if (!completes) v.push('I13: procedure voice without brief completion in this turn');
  }

  if (input.control.mode === 'closed' && d.utterances.length > 0) v.push('P0: utterance while closed');
  if (input.control.mode === 'human') {
    for (const x of d.utterances) {
      const allowed = x.step === 'handoff_ack' || (x.relay && RELAY_STEPS.includes(x.step));
      if (!allowed) v.push(`P1: non-relay utterance ${x.step} under human control`);
    }
  } else if (d.utterances.some((x) => x.relay)) {
    v.push('relay flag outside human control');
  }
  if (!input.studio.caps.reception && input.control.mode === 'ai' && d.utterances.length > 0) v.push('level 0: utterance');

  if (steps.includes('payment')) {
    if (!input.studio.caps.payment) v.push('I10: payment instructions without payment capability');
    const priced = (x: Utterance): boolean => x.facts.some((f) => f.key === 'total_xof' && typeof f.value === 'number' && f.value > 0);
    for (const x of d.utterances) if (x.step === 'payment' && !priced(x)) v.push('I9: payment instructions without a fixed price');
  }

  for (const a of d.actions) {
    if (a.type !== 'transition') continue;
    if (a.track === 'payment' && a.event === 'payment_confirmed') v.push('I8: agent cannot confirm a payment');
    if (a.order.kind === 'existing') {
      const id = a.order.id;
      if (!input.orders.some((x) => x.id === id)) v.push(`unknown order ${id}`);
    }
  }
  return v;
}

/**
 * Point d'entrée du moteur : une décision qui viole un invariant n'est JAMAIS exécutée.
 * Elle est remplacée par le silence et une alerte au gérant (I17).
 */
export function decideSafely(input: DecisionInput): { decision: Decision; violations: string[] } {
  const decision = decide(input);
  const violations = assertDecisionInvariants(decision, input);
  if (violations.length === 0) return { decision, violations };
  return {
    decision: {
      actions: [{ type: 'alert_owner', kind: 'unmapped', order: null }],
      utterances: [],
      pendingQuestion: 'keep',
      trace: [...decision.trace, `INVARIANT VIOLATION → silence: ${violations.join('; ')}`],
    },
    violations,
  };
}
