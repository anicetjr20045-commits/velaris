/**
 * Types du domaine de l'agent de vente WhatsApp.
 * Référence : ARCHITECTURE_AGENT_DEFINITIVE.md (v2), § 8, § 9, § 11, § 12.
 *
 * Ce fichier ne contient que des données et des types : aucune I/O, aucune logique.
 */

// ---------------------------------------------------------------------------
// Commandes : deux pistes indépendantes
// ---------------------------------------------------------------------------

export const CREATIVE_STAGES = [
  'collecting_brief',
  'brief_complete',
  'lyrics_in_progress',
  'lyrics_sent',
  'lyrics_validated',
  'in_production',
  'audio_delivered',
  'video_in_progress',
  'delivered',
  'closed',
  'cancelled',
] as const;
export type CreativeStage = (typeof CREATIVE_STAGES)[number];

export const CLOSED_STAGES: readonly CreativeStage[] = ['delivered', 'closed', 'cancelled'];

export const PAYMENT_STATES = ['unpaid', 'instructions_sent', 'claimed', 'confirmed', 'refunded'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const CREATIVE_EVENTS = [
  'brief_completed',
  'procedure_voice_sent',
  'lyrics_work_started',
  'lyrics_sent',
  'change_requested',
  'lyrics_validated',
  'production_started',
  'delivery_sent',
  'audio_delivered',
  'production_failed',
  'video_started',
  'after_sales_closed',
  'order_cancelled',
  'abandoned',
] as const;
export type CreativeEvent = (typeof CREATIVE_EVENTS)[number];

export const PAYMENT_EVENTS = [
  'instructions_sent',
  'payment_claimed',
  'payment_confirmed',
  'payment_rejected',
  'payment_refunded',
] as const;
export type PaymentEvent = (typeof PAYMENT_EVENTS)[number];

export type Track = 'creative' | 'payment';
export type Actor = 'agent' | 'merchant' | 'system' | 'saspay';
export type ControlMode = 'ai' | 'human' | 'closed';

export type Deliverable = 'lyrics' | 'audio' | 'audio_video';
export type PaymentPolicy = 'after_lyrics_validation' | 'before_lyrics';
export type Voice = 'male' | 'female' | 'duo';

/** Champs du brief pouvant être exigés par une formule (miroir de chk_required_fields). */
export const BRIEF_FIELDS = [
  'occasion',
  'recipient_name',
  'recipient_relation',
  'sender_name',
  'style',
  'voice',
  'language',
  'memories',
  'photos',
] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

/** Éléments ordonnables des questions de brief : un champ, ou le choix de la formule. */
export type BriefSlot = BriefField | 'offer';

export interface CatalogueItem {
  code: string;
  label: string;
  priceXof: number;
  deliverable: Deliverable;
  paymentPolicy: PaymentPolicy;
  requiredFields: readonly BriefField[];
  isActive: boolean;
}

/** Instantané d'une commande tel que lu en base au début du tour. */
export interface OrderSnapshot {
  id: string;
  version: number;
  stage: CreativeStage;
  paymentStatus: PaymentState;
  catalogueCode: string | null;
  priceXof: number | null;
  deliverable: Deliverable | null;
  paymentPolicy: PaymentPolicy | null;
  occasion: string | null;
  recipientName: string | null;
  recipientNameConfirmed: boolean;
  recipientRelation: string | null;
  senderName: string | null;
  style: string | null;
  voice: Voice | null;
  language: string | null;
  memoriesCount: number;
  photosCount: number;
  revisionCount: number;
  paymentInstructionsCount: number;
  hasPaymentDeferral: boolean;
}

// ---------------------------------------------------------------------------
// Compréhension (sortie du modèle, déjà vérifiée par le code : § 9.3)
// ---------------------------------------------------------------------------

export const INTENTS = [
  'greeting',
  'ask_price',
  'ask_delay',
  'ask_how_it_works',
  'ask_sample',
  'order_song',
  'give_brief_info',
  'shares_story',
  'needs_guidance',
  'choose_offer',
  'confirm_yes',
  'confirm_no',
  'acknowledgement',
  'patient_wait',
  'positive_feedback',
  'validate_lyrics',
  'request_lyrics_change',
  'provides_own_lyrics',
  'ask_payment_method',
  'payment_claim',
  'payment_deferral',
  'ask_status',
  'trust_concern',
  'asks_if_bot',
  'ask_human',
  'complaint',
  'discount_request',
  'cancel_order',
  'stop_contact',
  'thanks_closing',
  'smalltalk',
  'off_topic',
  'unclear',
] as const;
export type Intent = (typeof INTENTS)[number];

/** Valeur extraite avec sa citation exacte (vérifiée présente dans le message). */
export interface Extracted {
  value: string;
  quote: string;
}

export interface ExtractedFields {
  offerCode?: Extracted;
  occasion?: Extracted;
  recipientName?: Extracted;
  recipientRelation?: Extracted;
  senderName?: Extracted;
  style?: Extracted;
  voice?: { value: Voice; quote: string };
  language?: Extracted;
  memories?: readonly Extracted[];
  changeRequest?: Extracted;
  ownLyrics?: Extracted;
}

export type PaymentSignalKind = 'none' | 'asks_how_to_pay' | 'claims_paid' | 'defers' | 'disputes_payment';
export type DeferralReason = 'kiosk_closed' | 'no_money_now' | 'traveling' | 'waiting_someone' | 'other' | 'unknown';
export type DeferralWhen = 'later_today' | 'tonight' | 'tomorrow' | 'this_week' | 'unknown';

export interface PaymentSignal {
  kind: PaymentSignalKind;
  deferralReason?: DeferralReason;
  deferralWhen?: DeferralWhen;
  quote?: string;
}

export type EmotionalWeight = 'none' | 'moderate' | 'high';
export type SensitiveTopic = 'none' | 'grief' | 'illness' | 'apology' | 'hardship' | 'love' | 'celebration' | 'faith';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface OrderReference {
  recipientName?: string;
  occasion?: string;
  isNewOrder?: boolean;
}

export interface Understanding {
  primaryIntent: Intent;
  secondaryIntents: readonly Intent[];
  negated: boolean;
  confidence: number;
  fields: ExtractedFields;
  paymentSignal: PaymentSignal;
  emotionalWeight: EmotionalWeight;
  sensitiveTopic: SensitiveTopic;
  sentiment: Sentiment;
  wantsHuman: boolean;
  stopRequest: boolean;
  orderReference: OrderReference;
}

/** Seuil sous lequel la compréhension est jugée incertaine. */
export const LOW_CONFIDENCE = 0.6;
/** Seuil au-delà duquel une appréciation positive vaut validation des paroles. */
export const VALIDATION_CONFIDENCE = 0.8;

// ---------------------------------------------------------------------------
// Contexte du tour
// ---------------------------------------------------------------------------

export type PendingQuestionKey =
  | 'ask_field'
  | 'choose_offer'
  | 'choose_offer_then_payment'
  | 'confirm_recipient_name'
  | 'validate_lyrics'
  | 'confirm_cancel'
  | 'disambiguate_order'
  | 'merchant_question';

export interface PendingQuestion {
  key: PendingQuestionKey;
  orderId: string | null;
  field?: BriefField;
  asker: 'agent' | 'merchant';
}

export interface ControlState {
  mode: ControlMode;
  /** Ex. 'merchant_reply', 'handoff:complaint'. */
  reason: string | null;
  actor: 'merchant' | 'agent' | 'system' | null;
}

export interface HandoffState {
  open: boolean;
  origin: 'merchant' | 'agent' | null;
  ackSent: boolean;
  /** Clé d'intention de relais → horodatage ISO du dernier relais. */
  relayLog: Readonly<Record<string, string>>;
}

export interface ConversationState {
  pendingQuestion: PendingQuestion | null;
  /** Nombre de tours incertains consécutifs, CE TOUR INCLUS (calculé avant la décision). */
  lowConfStreak: number;
  repeatQuestionCount: number;
  discountRequests: number;
  /** Clé d'accusé → horodatage ISO (I26 : une même attente ne produit qu'une réponse). */
  ackLog: Readonly<Record<string, string>>;
  agentMsgsLastHour: number;
  focusOrderId: string | null;
}

export interface ContactFacts {
  deliveredOrders: number;
  /** Vocal de procédure déjà reçu et encore valide (calculé par agent_contact_facts). */
  procedureVoiceReceived: boolean;
}

export interface Capabilities {
  reception: boolean;
  procedureVoice: boolean;
  lyricsFollowup: boolean;
  payment: boolean;
  lyricsDraft: boolean;
  autoProduction: boolean;
  video: boolean;
}

export interface StudioConfig {
  caps: Capabilities;
  relayMode: 'off' | 'safe_templates';
  maxOpenOrders: number;
  maxAgentMsgsPerHour: number;
  maxFreeRevisions: number;
  briefFieldOrder: readonly BriefSlot[];
  hasProcedureVoice: boolean;
  hasSamples: boolean;
  catalogue: readonly CatalogueItem[];
}

/** Horloge déjà évaluée dans le fuseau du studio (§ 16) : decide() ne lit jamais l'heure. */
export interface ClockFacts {
  nowMs: number;
  managerAvailable: boolean;
  /** Aucun message du gérant depuis handoff_sla_minutes. */
  merchantSilentBeyondSla: boolean;
  /** Le client a écrit après le dernier message du gérant. */
  clientWroteAfterMerchant: boolean;
}

/** Phrases de délai calculées (§ 16.2), par commande. Absentes = aucun délai annonçable. */
export interface EtaPhrases {
  lyrics?: string;
  production?: string;
  video?: string;
}

export type ImageKind = 'photo' | 'payment_proof' | 'unclassified';

export interface TurnMedia {
  images: readonly { kind: ImageKind; confidence: number }[];
  hasAudio: boolean;
}

export interface DecisionInput {
  control: ControlState;
  handoff: HandoffState;
  conversation: ConversationState;
  orders: readonly OrderSnapshot[];
  contact: ContactFacts;
  studio: StudioConfig;
  understanding: Understanding;
  media: TurnMedia;
  clock: ClockFacts;
  eta: Readonly<Record<string, EtaPhrases>>;
}

// ---------------------------------------------------------------------------
// Sortie : étapes de discours et canaux (§ 12)
// ---------------------------------------------------------------------------

export const STEPS = [
  'welcome',
  'offers',
  'procedure',
  'brief_question',
  'story_ack',
  'lyrics_wait',
  'lyrics_delivery',
  'lyrics_feedback',
  'payment',
  'payment_ack',
  'payment_deferral',
  'production',
  'delivery',
  'video_photos',
  'after_sales',
  'trust',
  'sample',
  'identity',
  'handoff_ack',
  'stop_ack',
] as const;
export type Step = (typeof STEPS)[number];

export const CHANNELS = ['ai_text', 'template', 'voice', 'voice_then_template', 'silent'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Étapes dont le message doit partir seul dans son tour (I13, I25). */
export const STANDALONE_STEPS: readonly Step[] = ['procedure', 'lyrics_delivery', 'sample', 'delivery'];

export const REPLY_GOALS = [
  'welcome',
  'welcome_returning',
  'present_offers',
  'ask_offer_for_payment',
  'ask_next_field',
  'confirm_recipient_name',
  'guide_brief',
  'acknowledge_story',
  'ack_own_lyrics',
  'explain_process',
  'forward_move',
  'reassure_trust',
  'send_sample',
  'procedure_voice',
  'brief_received',
  'lyrics_eta',
  'ack_new_detail',
  'ack_change_request',
  'thank_validation',
  'confirm_keep_lyrics',
  'production_eta',
  'video_eta',
  'ack_photos',
  'thank_after_delivery',
  'decline_discount_politely',
  'ack_deferral',
  'payment_instructions',
  'payment_claim_ack',
  'disambiguate_order',
  'confirm_cancel',
  'identity',
  'handoff_ack',
  'stop_ack',
] as const;
export type ReplyGoal = (typeof REPLY_GOALS)[number];

/** Fait vérifié transmis au rendu (gabarit ou rédaction). Jamais inventé par le modèle. */
export interface Fact {
  key: string;
  value: string | number | boolean;
}

/** Référence à une commande existante, ou à une commande créée dans ce tour. */
export type OrderRef = { kind: 'existing'; id: string } | { kind: 'new' };

export interface Utterance {
  step: Step;
  goal: ReplyGoal;
  order: OrderRef | null;
  facts: readonly Fact[];
  /** Champ demandé à la fin du message, s'il y a une question. */
  asks?: BriefSlot | 'confirm' | 'validate' | 'which_order';
  /** Envoi autorisé pendant une prise de main (§ 14.4) : gabarit uniquement. */
  relay: boolean;
}

// ---------------------------------------------------------------------------
// Actions (exécutées par les outils du moteur, jamais par le modèle)
// ---------------------------------------------------------------------------

export interface BriefPatch {
  occasion?: string | null;
  recipient_name?: string | null;
  recipient_name_confirmed?: boolean;
  recipient_relation?: string | null;
  sender_name?: string | null;
  style?: string | null;
  voice?: Voice | null;
  language?: string | null;
  sensitive_topic?: SensitiveTopic | null;
  memories?: readonly Extracted[];
  field_evidence?: Readonly<Record<string, string>>;
}

export type HandoffReason =
  | 'ask_human'
  | 'complaint'
  | 'very_negative'
  | 'payment_dispute'
  | 'low_confidence'
  | 'loop'
  | 'discount'
  | 'out_of_catalogue'
  | 'revision_limit'
  | 'guard_failure'
  | 'production_failed'
  | 'post_delivery_change'
  | 'too_many_orders'
  | 'rate_limit'
  | 'capability_off'
  | 'payment_lock';

export type OwnerAlertKind =
  | 'payment_to_verify'
  | 'unexpected_payment_claim'
  | 'new_detail'
  | 'own_lyrics'
  | 'lyrics_feedback'
  | 'lyrics_validated'
  | 'change_request'
  | 'unclassified_image'
  | 'missing_price'
  | 'unmapped'
  | 'production_ready';

export type FollowupKind = 'brief_incomplete' | 'lyrics_unanswered' | 'payment_pending' | 'payment_after_deferral';

export type Action =
  | { type: 'open_order' }
  | { type: 'choose_offer'; order: OrderRef; code: string }
  | { type: 'save_brief_fields'; order: OrderRef; patch: BriefPatch; allowClear: readonly BriefField[] }
  | { type: 'transition'; order: OrderRef; track: 'creative'; event: CreativeEvent }
  | { type: 'transition'; order: OrderRef; track: 'payment'; event: PaymentEvent }
  | { type: 'send_procedure_voice'; order: OrderRef }
  | { type: 'request_lyrics'; order: OrderRef }
  | { type: 'register_change_request'; order: OrderRef; text: string }
  | { type: 'store_own_lyrics'; order: OrderRef; text: string }
  | { type: 'register_payment_claim'; orders: readonly OrderRef[]; withImage: boolean }
  | { type: 'record_payment_deferral'; order: OrderRef; reason: DeferralReason; when: DeferralWhen }
  | { type: 'store_images'; order: OrderRef | null; kinds: readonly ImageKind[] }
  | { type: 'launch_production'; order: OrderRef }
  | { type: 'schedule_followup'; kind: FollowupKind; order: OrderRef }
  | { type: 'handoff'; reason: HandoffReason; ack: boolean }
  | { type: 'close_conversation' }
  | { type: 'alert_owner'; kind: OwnerAlertKind; order: OrderRef | null }
  | { type: 'mark_ack'; key: string }
  | { type: 'mark_relay'; key: string }
  | { type: 'bump_counter'; counter: 'discount_requests' | 'repeat_question_count' };

export interface Decision {
  actions: readonly Action[];
  /** 0 à 2 messages ; un message « seul » (STANDALONE_STEPS) est toujours l'unique message. */
  utterances: readonly Utterance[];
  /** Nouvelle question en attente ; 'keep' = inchangée ; null = effacée. */
  pendingQuestion: PendingQuestion | null | 'keep';
  /** Chemin de décision, pour le journal des tours. */
  trace: readonly string[];
}
