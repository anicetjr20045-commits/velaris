/**
 * Compréhension (§ 9) : DeepSeek classe et extrait en JSON ; le code VÉRIFIE.
 *  - chaque valeur extraite doit être justifiée par une citation présente dans le message ;
 *  - un simple accusé (« bien reçu », « ok ») ne porte jamais un paiement ;
 *  - un oui/non n'a de sens que s'il répond à une question en attente ;
 *  - un récit n'est jamais pris pour des paroles fournies (I30).
 * Toute sortie invalide devient « unclear » (confiance 0) : pas en avant, puis passation.
 */

import {
  INTENTS,
  type EmotionalWeight,
  type Extracted,
  type ExtractedFields,
  type Intent,
  type PaymentSignal,
  type SensitiveTopic,
  type Sentiment,
  type Understanding,
  type Voice,
} from '../domain/types.js';
import { CORPUS } from './corpus.js';
import type { LlmProvider } from './provider.js';

export const UNDERSTAND_PROMPT_VERSION = 'understand.v1';

export interface UnderstandInput {
  turnText: string;
  recent: ReadonlyArray<{ who: 'client' | 'studio' | 'gérant'; text: string }>;
  stage: string;
  paymentStatus: string;
  pendingQuestion: string | null;
  offers: ReadonlyArray<{ code: string; label: string }>;
  openOrders: ReadonlyArray<{ recipient: string | null; occasion: string | null }>;
}

export interface UnderstandResult {
  understanding: Understanding;
  raw: Record<string, unknown> | null;
  rejected: string[];
  model: string | null;
  tokens: { prompt: number; completion: number; cacheHit?: number } | null;
  latencyMs: number;
  /** Fournisseur indisponible : le tour doit être retenu et retenté, pas traité comme incompris (§ 5.3). */
  providerFailed: boolean;
}

const PAYMENT_KINDS = ['none', 'asks_how_to_pay', 'claims_paid', 'defers', 'disputes_payment'] as const;
const DEFERRAL_REASONS = ['kiosk_closed', 'no_money_now', 'traveling', 'waiting_someone', 'other', 'unknown'] as const;
const DEFERRAL_WHEN = ['later_today', 'tonight', 'tomorrow', 'this_week', 'unknown'] as const;
const WEIGHTS = ['none', 'moderate', 'high'] as const;
const TOPICS = ['none', 'grief', 'illness', 'apology', 'hardship', 'love', 'celebration', 'faith'] as const;
const SENTIMENTS = ['positive', 'neutral', 'negative', 'very_negative'] as const;
/** Accusés seuls : ne portent jamais un paiement. */
const ACK_ONLY = ['bien recu', 'recu', 'ok', 'okay', 'd accord', 'dac', 'merci', 'oui', 'ca marche', 'entendu'];

export function normalizeForEvidence(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function buildSystemPrompt(): string {
  const examples = CORPUS.filter((c) => c.fewShot)
    .map((c) => {
      const ctx = [`étape=${c.context.stage}`, c.context.pendingQuestion ? `question posée="${c.context.pendingQuestion}"` : null, c.context.paymentStatus ? `paiement=${c.context.paymentStatus}` : null]
        .filter(Boolean).join(', ');
      const out: Record<string, unknown> = { primary_intent: c.expect.primary_intent };
      if (c.expect.payment_kind) out.payment_signal = { kind: c.expect.payment_kind };
      if (c.expect.negated) out.negated = true;
      if (c.expect.emotional_weight) out.emotional_weight = c.expect.emotional_weight;
      if (c.expect.fields) out.fields = Object.fromEntries(Object.entries(c.expect.fields).map(([k, v]) => [k, { value: v, quote: '…' }]));
      return `- [${ctx}] « ${c.text} » → ${JSON.stringify(out)}`;
    })
    .join('\n');

  return `Tu analyses les messages WhatsApp qu'un client envoie à un studio de chansons personnalisées en Afrique de l'Ouest (Burkina Faso, Côte d'Ivoire, Sénégal, Mali).
Tu ne réponds PAS au client. Tu produis uniquement un objet JSON.

Les clients écrivent comme ils parlent : fautes, phrases sans verbe, nouchi ivoirien, mots de dioula ou de mooré, abréviations (« C sur kel numero »). Comprends le SENS, jamais la forme.

Intentions (primary_intent, et au plus 2 secondary_intents) :
${INTENTS.join(', ')}
Définitions essentielles :
- acknowledgement : accusé neutre (« bien reçu », « ok », « merci »). Ce n'est JAMAIS un paiement.
- patient_wait : le client accepte d'attendre (« j'attends alors »). Ce n'est JAMAIS un refus ni un changement d'avis.
- ask_payment_method : le client demande où ou comment payer, quelle que soit la forme (« le numéro de dépôt », « c'est sur quelle numéro », « OM ou Wave »).
- payment_claim : le client affirme avoir payé ou envoie une preuve. payment_deferral : il paiera plus tard (précise la raison et le moment).
- confirm_yes / confirm_no : réponse à la question posée juste avant (« Non pas encore » = confirm_no).
- positive_feedback : appréciation (« c'est propre », « c'est doux »). validate_lyrics : validation explicite des paroles (« c'est validé »).
- ask_sample : veut écouter un exemple (« kpata là voyons voir le son »).
- shares_story : raconte une histoire, des souvenirs, une épreuve. Ce ne sont PAS des paroles. provides_own_lyrics : dit EXPLICITEMENT fournir ses propres paroles.
- needs_guidance : le client est perdu, ne sait pas quoi dire.
- order_song : demande une chanson (y compris une NOUVELLE chanson pour une autre personne).

Format de sortie (toutes les clés obligatoires) :
{"primary_intent": "...", "secondary_intents": [], "negated": false, "confidence": 0.0-1.0,
 "fields": {"offer_code"?, "occasion"?, "recipient_name"?, "recipient_relation"?, "sender_name"?, "style"?, "language"?, "change_request"?, "own_lyrics"?: {"value": "...", "quote": "extrait EXACT du message"}, "voice"?: {"value": "male|female|duo", "quote": "..."}, "memories"?: [{"value": "...", "quote": "..."}]},
 "payment_signal": {"kind": "none|asks_how_to_pay|claims_paid|defers|disputes_payment", "deferral_reason"?: "kiosk_closed|no_money_now|traveling|waiting_someone|other|unknown", "deferral_when"?: "later_today|tonight|tomorrow|this_week|unknown"},
 "emotional_weight": "none|moderate|high", "sensitive_topic": "none|grief|illness|apology|hardship|love|celebration|faith",
 "sentiment": "positive|neutral|negative|very_negative", "wants_human": false, "stop_request": false,
 "order_reference": {"recipient_name"?: "...", "occasion"?: "...", "is_new_order"?: true}}

Règles d'extraction :
- N'extrais QUE ce qui figure dans les messages du client de ce tour ; chaque valeur a une citation exacte.
- offer_code uniquement parmi les codes de formule fournis.
- Une confidence basse (< 0,6) vaut mieux qu'une intention inventée.

Exemples réels :
${examples}`;
}

function userPrompt(i: UnderstandInput): string {
  const recent = i.recent.slice(-8).map((m) => `${m.who} : ${m.text}`).join('\n') || '(aucun)';
  const orders = i.openOrders.length
    ? i.openOrders.map((o) => `pour ${o.recipient ?? '?'} (${o.occasion ?? '?'})`).join(' ; ')
    : 'aucune';
  return `Contexte : étape=${i.stage}, paiement=${i.paymentStatus}, question posée juste avant=${i.pendingQuestion ? `« ${i.pendingQuestion} »` : 'aucune'}
Commandes ouvertes : ${orders}
Formules : ${i.offers.map((o) => `${o.code} (${o.label})`).join(', ') || 'aucune'}
Derniers échanges :
${recent}

Message(s) du client à analyser (ce tour) :
« ${i.turnText} »

Réponds par l'objet JSON.`;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export function unclearUnderstanding(): Understanding {
  return {
    primaryIntent: 'unclear', secondaryIntents: [], negated: false, confidence: 0, fields: {},
    paymentSignal: { kind: 'none' }, emotionalWeight: 'none', sensitiveTopic: 'none', sentiment: 'neutral',
    wantsHuman: false, stopRequest: false, orderReference: {},
  };
}

/** Valide la sortie brute du modèle et applique les vérifications du code (§ 9.3). */
export function validateUnderstanding(raw: Record<string, unknown>, input: Pick<UnderstandInput, 'turnText' | 'pendingQuestion' | 'offers'>): { understanding: Understanding; rejected: string[] } {
  const rejected: string[] = [];
  const text = normalizeForEvidence(input.turnText);
  const evidenced = (quote: unknown): boolean => typeof quote === 'string' && quote.trim() !== '' && text.includes(normalizeForEvidence(quote));

  let primary = pick<Intent>(raw.primary_intent, INTENTS, 'unclear');
  if (primary === 'unclear' && raw.primary_intent !== 'unclear') rejected.push(`intention inconnue : ${String(raw.primary_intent)}`);
  const secondary = Array.isArray(raw.secondary_intents)
    ? raw.secondary_intents.filter((s): s is Intent => typeof s === 'string' && (INTENTS as readonly string[]).includes(s)).slice(0, 2)
    : [];
  let confidence = typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? Math.min(1, Math.max(0, raw.confidence)) : 0;
  const negated = raw.negated === true;

  // Champs : citation obligatoire et présente dans le message
  const rawFields = (typeof raw.fields === 'object' && raw.fields !== null ? raw.fields : {}) as Record<string, unknown>;
  const fields: ExtractedFields = {};
  const ex = (key: string): Extracted | undefined => {
    const f = rawFields[key] as { value?: unknown; quote?: unknown } | undefined;
    if (!f || typeof f.value !== 'string' || !f.value.trim()) return undefined;
    if (!evidenced(f.quote)) { rejected.push(`${key} : citation absente du message`); return undefined; }
    return { value: f.value.trim().slice(0, 120), quote: String(f.quote).slice(0, 200) };
  };
  const occasion = ex('occasion'); if (occasion) fields.occasion = occasion;
  const recipient = ex('recipient_name');
  if (recipient) {
    if (normalizeForEvidence(recipient.quote).includes(normalizeForEvidence(recipient.value))) fields.recipientName = recipient;
    else rejected.push('recipient_name : prénom absent de sa citation');
  }
  const relation = ex('recipient_relation'); if (relation) fields.recipientRelation = relation;
  const sender = ex('sender_name'); if (sender) fields.senderName = sender;
  const style = ex('style'); if (style) fields.style = style;
  const language = ex('language'); if (language) fields.language = language;
  const change = ex('change_request'); if (change) fields.changeRequest = change;
  const offer = ex('offer_code');
  if (offer) {
    if (input.offers.some((o) => o.code === offer.value)) fields.offerCode = offer;
    else rejected.push(`offer_code inconnu : ${offer.value}`);
  }
  const rv = rawFields.voice as { value?: unknown; quote?: unknown } | undefined;
  if (rv && (rv.value === 'male' || rv.value === 'female' || rv.value === 'duo')) {
    if (evidenced(rv.quote)) fields.voice = { value: rv.value as Voice, quote: String(rv.quote) };
    else rejected.push('voice : citation absente');
  }
  if (Array.isArray(rawFields.memories)) {
    const mems: Extracted[] = [];
    for (const m of rawFields.memories.slice(0, 6) as Array<{ value?: unknown; quote?: unknown }>) {
      if (typeof m?.value === 'string' && m.value.trim() && evidenced(m.quote)) mems.push({ value: m.value.trim().slice(0, 200), quote: String(m.quote).slice(0, 200) });
    }
    if (mems.length) fields.memories = mems;
  }
  // I30 : des paroles fournies seulement sur déclaration explicite
  if (primary === 'provides_own_lyrics') {
    const own = rawFields.own_lyrics as { value?: unknown } | undefined;
    fields.ownLyrics = { value: typeof own?.value === 'string' && own.value.trim() ? own.value.slice(0, 3000) : input.turnText.slice(0, 3000), quote: input.turnText.slice(0, 200) };
  }

  // Paiement
  const ps = (typeof raw.payment_signal === 'object' && raw.payment_signal !== null ? raw.payment_signal : {}) as Record<string, unknown>;
  const paymentSignal: PaymentSignal = { kind: pick(ps.kind, PAYMENT_KINDS, 'none') };
  if (ps.deferral_reason !== undefined) paymentSignal.deferralReason = pick(ps.deferral_reason, DEFERRAL_REASONS, 'unknown');
  if (ps.deferral_when !== undefined) paymentSignal.deferralWhen = pick(ps.deferral_when, DEFERRAL_WHEN, 'unknown');
  const ackOnly = ACK_ONLY.includes(text);
  if ((paymentSignal.kind === 'claims_paid' || primary === 'payment_claim') && (ackOnly || negated)) {
    rejected.push('paiement déclaré sur un simple accusé ou une négation → requalifié');
    paymentSignal.kind = negated ? 'defers' : 'none';
    if (primary === 'payment_claim') primary = negated ? 'payment_deferral' : 'acknowledgement';
  }

  // Oui / non sans question en attente = simple accusé
  if ((primary === 'confirm_yes' || primary === 'confirm_no') && !input.pendingQuestion) {
    rejected.push(`${primary} sans question en attente → acknowledgement`);
    primary = 'acknowledgement';
  }
  // Récit pris pour des paroles : requalifié (cas Sylvie)
  if (primary === 'provides_own_lyrics' && !/\b(paroles|texte|ecrit|chanson que j)/.test(text)) {
    rejected.push('provides_own_lyrics sans déclaration explicite → shares_story');
    primary = 'shares_story';
    delete fields.ownLyrics;
  }
  if (rejected.length > 2) confidence = Math.min(confidence, 0.5);

  const or = (typeof raw.order_reference === 'object' && raw.order_reference !== null ? raw.order_reference : {}) as Record<string, unknown>;
  const orderReference: Understanding['orderReference'] = {};
  if (typeof or.recipient_name === 'string' && or.recipient_name.trim() && text.includes(normalizeForEvidence(or.recipient_name))) orderReference.recipientName = or.recipient_name.trim();
  if (typeof or.occasion === 'string' && or.occasion.trim()) orderReference.occasion = or.occasion.trim();
  if (or.is_new_order === true) orderReference.isNewOrder = true;

  return {
    understanding: {
      primaryIntent: primary,
      secondaryIntents: secondary,
      negated,
      confidence,
      fields,
      paymentSignal,
      emotionalWeight: pick<EmotionalWeight>(raw.emotional_weight, WEIGHTS, 'none'),
      sensitiveTopic: pick<SensitiveTopic>(raw.sensitive_topic, TOPICS, 'none'),
      sentiment: pick<Sentiment>(raw.sentiment, SENTIMENTS, 'neutral'),
      wantsHuman: raw.wants_human === true,
      stopRequest: raw.stop_request === true,
      orderReference,
    },
    rejected,
  };
}

export async function understand(provider: LlmProvider, input: UnderstandInput): Promise<UnderstandResult> {
  const started = Date.now();
  try {
    const r = await provider.completeJson({
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userPrompt(input) }],
      maxTokens: 700,
      temperature: 0,
    });
    const v = validateUnderstanding(r.data, input);
    return {
      understanding: v.understanding,
      raw: r.data,
      rejected: v.rejected,
      model: r.model,
      tokens: { prompt: r.usage.promptTokens, completion: r.usage.completionTokens, cacheHit: r.usage.cacheHitTokens },
      latencyMs: r.latencyMs,
      providerFailed: false,
    };
  } catch (err) {
    return {
      understanding: unclearUnderstanding(),
      raw: null,
      rejected: [`fournisseur : ${(err as Error).message}`],
      model: null,
      tokens: null,
      latencyMs: Date.now() - started,
      providerFailed: true,
    };
  }
}
