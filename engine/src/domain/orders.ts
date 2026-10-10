/**
 * Commandes : table des transitions (miroir exact de public.order_transitions),
 * portes croisées entre pistes, et faits dérivés d'une commande.
 * Référence : ARCHITECTURE_AGENT_DEFINITIVE.md (v2), § 6.6, § 8.
 *
 * Fonctions pures uniquement. Toute modification de TRANSITIONS doit être faite
 * À L'IDENTIQUE dans supabase/migrations/20261004_agent_core.sql (test de parité).
 */

import {
  CLOSED_STAGES,
  type Actor,
  type BriefField,
  type BriefPatch,
  type BriefSlot,
  type CatalogueItem,
  type CreativeEvent,
  type CreativeStage,
  type OrderSnapshot,
  type PaymentEvent,
  type PaymentState,
  type StudioConfig,
  type Track,
} from './types.js';

export interface TransitionRow {
  track: Track;
  from: string;
  event: string;
  to: string;
  actors: readonly Actor[];
}

const M = ['merchant'] as const;
const AM = ['agent', 'merchant'] as const;
const MS = ['merchant', 'system'] as const;
const AMS = ['agent', 'merchant', 'system'] as const;
const MP = ['merchant', 'saspay'] as const;
const S = ['system'] as const;

export const TRANSITIONS: readonly TransitionRow[] = [
  // Piste créative
  { track: 'creative', from: 'collecting_brief',   event: 'brief_completed',      to: 'brief_complete',     actors: AM },
  { track: 'creative', from: 'brief_complete',     event: 'lyrics_work_started',  to: 'lyrics_in_progress', actors: AMS },
  { track: 'creative', from: 'collecting_brief',   event: 'lyrics_sent',          to: 'lyrics_sent',        actors: M },
  { track: 'creative', from: 'brief_complete',     event: 'lyrics_sent',          to: 'lyrics_sent',        actors: M },
  { track: 'creative', from: 'lyrics_in_progress', event: 'lyrics_sent',          to: 'lyrics_sent',        actors: AM },
  { track: 'creative', from: 'lyrics_sent',        event: 'lyrics_sent',          to: 'lyrics_sent',        actors: M },
  { track: 'creative', from: 'lyrics_sent',        event: 'change_requested',     to: 'lyrics_in_progress', actors: AM },
  { track: 'creative', from: 'lyrics_sent',        event: 'lyrics_validated',     to: 'lyrics_validated',   actors: AM },
  { track: 'creative', from: 'lyrics_validated',   event: 'production_started',   to: 'in_production',      actors: AMS },
  { track: 'creative', from: 'lyrics_validated',   event: 'delivery_sent',        to: 'delivered',          actors: MS },
  { track: 'creative', from: 'in_production',      event: 'delivery_sent',        to: 'delivered',          actors: MS },
  { track: 'creative', from: 'in_production',      event: 'audio_delivered',      to: 'audio_delivered',    actors: MS },
  { track: 'creative', from: 'in_production',      event: 'production_failed',    to: 'lyrics_validated',   actors: S },
  { track: 'creative', from: 'audio_delivered',    event: 'video_started',        to: 'video_in_progress',  actors: MS },
  { track: 'creative', from: 'video_in_progress',  event: 'delivery_sent',        to: 'delivered',          actors: MS },
  { track: 'creative', from: 'delivered',          event: 'after_sales_closed',   to: 'closed',             actors: AMS },
  { track: 'creative', from: 'collecting_brief',   event: 'order_cancelled',      to: 'cancelled',          actors: AM },
  { track: 'creative', from: 'brief_complete',     event: 'order_cancelled',      to: 'cancelled',          actors: AM },
  { track: 'creative', from: 'lyrics_in_progress', event: 'order_cancelled',      to: 'cancelled',          actors: M },
  { track: 'creative', from: 'lyrics_sent',        event: 'order_cancelled',      to: 'cancelled',          actors: AM },
  { track: 'creative', from: 'lyrics_validated',   event: 'order_cancelled',      to: 'cancelled',          actors: AM },
  { track: 'creative', from: 'in_production',      event: 'order_cancelled',      to: 'cancelled',          actors: M },
  { track: 'creative', from: 'audio_delivered',    event: 'order_cancelled',      to: 'cancelled',          actors: M },
  { track: 'creative', from: 'video_in_progress',  event: 'order_cancelled',      to: 'cancelled',          actors: M },
  { track: 'creative', from: 'collecting_brief',   event: 'abandoned',            to: 'cancelled',          actors: S },
  // Piste paiement
  { track: 'payment', from: 'unpaid',            event: 'instructions_sent', to: 'instructions_sent', actors: AMS },
  { track: 'payment', from: 'instructions_sent', event: 'instructions_sent', to: 'instructions_sent', actors: AMS },
  { track: 'payment', from: 'unpaid',            event: 'payment_claimed',   to: 'claimed',           actors: AM },
  { track: 'payment', from: 'instructions_sent', event: 'payment_claimed',   to: 'claimed',           actors: AM },
  { track: 'payment', from: 'claimed',           event: 'payment_claimed',   to: 'claimed',           actors: AM },
  { track: 'payment', from: 'unpaid',            event: 'payment_confirmed', to: 'confirmed',         actors: MP },
  { track: 'payment', from: 'instructions_sent', event: 'payment_confirmed', to: 'confirmed',         actors: MP },
  { track: 'payment', from: 'claimed',           event: 'payment_confirmed', to: 'confirmed',         actors: MP },
  { track: 'payment', from: 'claimed',           event: 'payment_rejected',  to: 'instructions_sent', actors: M },
  { track: 'payment', from: 'confirmed',         event: 'payment_refunded',  to: 'refunded',          actors: M },
];

export type TransitionRefusal =
  | 'transition_forbidden'
  | 'actor_forbidden'
  | 'payment_not_confirmed'
  | 'video_pending'
  | 'not_video_offer'
  | 'payment_lock';

export type TransitionResult<S extends string> = { ok: true; to: S } | { ok: false; reason: TransitionRefusal };

function findRow(track: Track, from: string, event: string): TransitionRow | undefined {
  return TRANSITIONS.find((t) => t.track === track && t.from === from && t.event === event);
}

/**
 * Transition de la piste créative, avec les portes croisées.
 * Même logique, dans le même ordre, que public.agent_transition_order.
 */
export function creativeTransition(
  order: Pick<OrderSnapshot, 'stage' | 'paymentStatus' | 'deliverable'>,
  event: CreativeEvent,
  actor: Actor,
): TransitionResult<CreativeStage> {
  const row = findRow('creative', order.stage, event);
  if (!row) return { ok: false, reason: 'transition_forbidden' };
  if (!row.actors.includes(actor)) return { ok: false, reason: 'actor_forbidden' };
  if (actor !== 'merchant') {
    const needsPayment: readonly CreativeEvent[] = ['production_started', 'delivery_sent', 'audio_delivered', 'video_started'];
    if (needsPayment.includes(event) && order.paymentStatus !== 'confirmed') {
      return { ok: false, reason: 'payment_not_confirmed' };
    }
    if (event === 'delivery_sent' && order.stage === 'in_production' && order.deliverable === 'audio_video') {
      return { ok: false, reason: 'video_pending' };
    }
    if (event === 'audio_delivered' && order.deliverable !== 'audio_video') {
      return { ok: false, reason: 'not_video_offer' };
    }
    if (event === 'order_cancelled' && (order.paymentStatus === 'claimed' || order.paymentStatus === 'confirmed')) {
      return { ok: false, reason: 'payment_lock' };
    }
  }
  return { ok: true, to: row.to as CreativeStage };
}

export function paymentTransition(
  order: Pick<OrderSnapshot, 'paymentStatus'>,
  event: PaymentEvent,
  actor: Actor,
): TransitionResult<PaymentState> {
  const row = findRow('payment', order.paymentStatus, event);
  if (!row) return { ok: false, reason: 'transition_forbidden' };
  if (!row.actors.includes(actor)) return { ok: false, reason: 'actor_forbidden' };
  return { ok: true, to: row.to as PaymentState };
}

// ---------------------------------------------------------------------------
// Faits dérivés d'une commande
// ---------------------------------------------------------------------------

export function isOpen(order: Pick<OrderSnapshot, 'stage'>): boolean {
  return !CLOSED_STAGES.includes(order.stage);
}

export function isPriced(order: Pick<OrderSnapshot, 'priceXof'>): boolean {
  return order.priceXof !== null && order.priceXof > 0;
}

export function isPaid(order: Pick<OrderSnapshot, 'paymentStatus'>): boolean {
  return order.paymentStatus === 'confirmed';
}

/** Commandes ouvertes dont le paiement n'est pas encore confirmé. */
export function unpaidOpenOrders(orders: readonly OrderSnapshot[]): OrderSnapshot[] {
  return orders.filter(
    (o) => isOpen(o) && (o.paymentStatus === 'unpaid' || o.paymentStatus === 'instructions_sent' || o.paymentStatus === 'claimed'),
  );
}

export function catalogueItemFor(order: Pick<OrderSnapshot, 'catalogueCode'>, studio: StudioConfig): CatalogueItem | null {
  if (!order.catalogueCode) return null;
  return studio.catalogue.find((c) => c.code === order.catalogueCode && c.isActive) ?? null;
}

export function activeOffers(studio: StudioConfig): CatalogueItem[] {
  return studio.catalogue.filter((c) => c.isActive);
}

function fieldPresent(order: OrderSnapshot, field: BriefField): boolean {
  switch (field) {
    case 'occasion': return order.occasion !== null;
    case 'recipient_name': return order.recipientName !== null;
    case 'recipient_relation': return order.recipientRelation !== null;
    case 'sender_name': return order.senderName !== null;
    case 'style': return order.style !== null;
    case 'voice': return order.voice !== null;
    case 'language': return order.language !== null;
    case 'memories': return order.memoriesCount > 0;
    case 'photos': return order.photosCount > 0;
  }
}

/**
 * Applique un patch de brief à un instantané, SANS effacement implicite (I20) :
 * une valeur null n'efface que si le champ figure dans allowClear.
 * Sert à évaluer dans le même tour si le brief devient complet.
 */
export function previewPatch(
  order: OrderSnapshot,
  patch: BriefPatch,
  allowClear: readonly BriefField[],
  offer: CatalogueItem | null,
): OrderSnapshot {
  const pick = <T>(field: BriefField, next: T | null | undefined, cur: T | null): T | null => {
    if (next === undefined) return cur;
    if (next === null) return allowClear.includes(field) ? null : cur;
    return next;
  };
  const recipientName = pick('recipient_name', patch.recipient_name, order.recipientName);
  const recipientChanged = recipientName !== order.recipientName;
  return {
    ...order,
    occasion: pick('occasion', patch.occasion, order.occasion),
    recipientName,
    recipientNameConfirmed:
      patch.recipient_name_confirmed !== undefined
        ? patch.recipient_name_confirmed
        : recipientChanged
          ? false
          : order.recipientNameConfirmed,
    recipientRelation: pick('recipient_relation', patch.recipient_relation, order.recipientRelation),
    senderName: pick('sender_name', patch.sender_name, order.senderName),
    style: pick('style', patch.style, order.style),
    voice: pick('voice', patch.voice, order.voice),
    language: pick('language', patch.language, order.language),
    memoriesCount: order.memoriesCount + (patch.memories?.length ?? 0),
    ...(offer
      ? {
          catalogueCode: offer.code,
          priceXof: offer.priceXof,
          deliverable: offer.deliverable,
          paymentPolicy: offer.paymentPolicy,
        }
      : {}),
  };
}

export type MissingSlot = BriefSlot | 'confirm_recipient_name';

/**
 * Éléments manquants du brief, dans l'ordre choisi par le studio.
 * La confirmation du prénom vient juste après le prénom (le prénom chanté est sacré).
 */
export function missingSlots(order: OrderSnapshot, studio: StudioConfig): MissingSlot[] {
  const offer = catalogueItemFor(order, studio);
  // Sans offre choisie (brief avant le choix), on exige l'union des champs requis
  // des offres actives : le brief collecte tout, quelle que soit la formule finale.
  const required = new Set<BriefField>(
    offer
      ? offer.requiredFields
      : studio.catalogue.filter((c) => c.isActive).flatMap((c) => c.requiredFields),
  );
  if (required.size === 0) {
    required.add('occasion');
    required.add('recipient_name');
  }
  const ordered: BriefSlot[] = [...studio.briefFieldOrder];
  for (const f of required) if (!ordered.includes(f)) ordered.push(f);
  if (!ordered.includes('offer')) ordered.push('offer');

  const missing: MissingSlot[] = [];
  // Le client a fourni directement son texte : il contient déjà tout
  // (occasion, prénom, expéditeur, message). Aucune question de brief,
  // seul le choix d'offre reste.
  const skipBriefFields = order.hasOwnLyrics;
  for (const slot of ordered) {
    if (slot === 'offer') {
      if (!isPriced(order)) missing.push('offer');
      continue;
    }
    if (skipBriefFields) continue;
    if (!required.has(slot)) continue;
    if (slot === 'recipient_name' && order.lyrics && order.lyrics.trim().length > 0) continue;
    if (!fieldPresent(order, slot)) {
      missing.push(slot);
    } else if (slot === 'recipient_name' && !order.recipientNameConfirmed) {
      missing.push('confirm_recipient_name');
    }
  }
  return missing;
}

/** Brief complet : formule choisie, champs requis présents, prénom confirmé (§ 6.3 garde brief_completed). */
export function isBriefComplete(order: OrderSnapshot, studio: StudioConfig): boolean {
  return missingSlots(order, studio).length === 0;
}

/** Le vocal de procédure est dû : capacité active, vocal configuré, jamais reçu par ce contact (cas Sylvie). */
export function procedureVoiceDue(studio: StudioConfig, procedureVoiceReceived: boolean): boolean {
  return studio.caps.procedureVoice && studio.hasProcedureVoice && !procedureVoiceReceived;
}
