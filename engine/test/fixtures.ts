import type {
  CatalogueItem,
  DecisionInput,
  OrderSnapshot,
  StudioConfig,
  Understanding,
} from '../src/domain/types.js';

export const NOW = Date.parse('2026-10-04T10:00:00Z');

export const OFFER_STANDARD: CatalogueItem = {
  code: 'standard',
  label: 'Chanson complète',
  priceXof: 3000,
  deliverable: 'audio',
  paymentPolicy: 'after_lyrics_validation',
  requiredFields: ['occasion', 'recipient_name'],
  isActive: true,
};

export const OFFER_TEXT: CatalogueItem = {
  code: 'decouverte',
  label: 'Texte de paroles',
  priceXof: 1200,
  deliverable: 'lyrics',
  paymentPolicy: 'before_lyrics',
  requiredFields: ['occasion', 'recipient_name'],
  isActive: true,
};

export function studio(over: Partial<StudioConfig> = {}): StudioConfig {
  return {
    caps: {
      reception: true,
      procedureVoice: true,
      lyricsFollowup: true,
      payment: true,
      lyricsDraft: false,
      autoProduction: false,
      video: false,
    },
    relayMode: 'safe_templates',
    maxOpenOrders: 3,
    maxAgentMsgsPerHour: 6,
    maxFreeRevisions: 2,
    briefFieldOrder: ['occasion', 'recipient_name', 'offer'],
    hasProcedureVoice: true,
    hasSamples: true,
    catalogue: [OFFER_TEXT, OFFER_STANDARD],
    ...over,
  };
}

export function understanding(over: Partial<Understanding> = {}): Understanding {
  return {
    primaryIntent: 'acknowledgement',
    secondaryIntents: [],
    negated: false,
    confidence: 0.95,
    fields: {},
    paymentSignal: { kind: 'none' },
    emotionalWeight: 'none',
    sensitiveTopic: 'none',
    sentiment: 'neutral',
    wantsHuman: false,
    stopRequest: false,
    orderReference: {},
    ...over,
  };
}

export function order(over: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'order-1',
    version: 3,
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
    memories: [],
    lyrics: null,
    hasOwnLyrics: false,
    photosCount: 0,
    revisionCount: 0,
    paymentInstructionsCount: 0,
    hasPaymentDeferral: false,
    ...over,
  };
}

/** Commande « standard » à 3 000 F, brief prêt sauf la confirmation du prénom. */
export function standardOrder(over: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return order({
    catalogueCode: 'standard',
    priceXof: 3000,
    deliverable: 'audio',
    paymentPolicy: 'after_lyrics_validation',
    occasion: 'anniversaire',
    recipientName: 'Awa',
    ...over,
  });
}

export function input(over: Partial<DecisionInput> = {}): DecisionInput {
  return {
    control: { mode: 'ai', reason: null, actor: null },
    handoff: { open: false, origin: null, ackSent: false, relayLog: {} },
    conversation: {
      pendingQuestion: null,
      lowConfStreak: 0,
      repeatQuestionCount: 0,
      discountRequests: 0,
      ackLog: {},
      agentMsgsLastHour: 0,
      focusOrderId: null,
    },
    orders: [],
    contact: { deliveredOrders: 0, procedureVoiceReceived: false },
    studio: studio(),
    understanding: understanding(),
    media: { images: [], hasAudio: false },
    clock: { nowMs: NOW, managerAvailable: true, merchantSilentBeyondSla: false, clientWroteAfterMerchant: true },
    eta: {},
    ...over,
  };
}

export function minutesAgo(min: number): string {
  return new Date(NOW - min * 60_000).toISOString();
}
