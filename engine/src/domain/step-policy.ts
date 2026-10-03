/**
 * Canal par étape de discours : la personnalisation par studio (§ 12).
 * Le moteur décide CE QUI est dit (decide.ts) ; le studio choisit COMMENT (ici).
 *
 * Verrous non contournables, quelle que soit la configuration :
 *  - paiement : toujours écrit, jamais généré (gabarit, ou vocal puis gabarit) ;
 *  - messages qui engagent (accusé de preuve, passation, arrêt, identité) : gabarit, jamais silencieux ;
 *  - un canal vocal sans vocal enregistré retombe sur le gabarit ;
 *  - un envoi de relais (§ 14.4) est toujours un gabarit ;
 *  - un message « seul » (vocal de procédure, paroles, exemple, livraison) part seul.
 */

import { STANDALONE_STEPS, type Channel, type Decision, type Step, type Utterance } from './types.js';

export interface StepPolicy {
  channel: Channel;
  assetId?: string;
  templateKey?: string;
}

export type StudioStepPolicies = Partial<Readonly<Record<Step, StepPolicy>>>;

/** Messages qui engagent : toujours un gabarit. */
const TEMPLATE_ONLY: readonly Step[] = ['payment', 'payment_ack', 'handoff_ack', 'stop_ack', 'identity'];
/** Paiement : écrit, éventuellement précédé d'un vocal. */
const PAYMENT_ALLOWED: readonly Channel[] = ['template', 'voice_then_template'];
/** Contenu fourni par le studio, pas par un canal de rédaction. */
const CONTENT_STEPS: readonly Step[] = ['lyrics_delivery', 'delivery', 'sample'];

/** Préréglage « Alex complet » : la base de tous les studios. */
export const DEFAULT_POLICIES: Readonly<Record<Step, StepPolicy>> = {
  welcome: { channel: 'ai_text' },
  offers: { channel: 'template' },
  procedure: { channel: 'voice' },
  brief_question: { channel: 'ai_text' },
  story_ack: { channel: 'ai_text' },
  lyrics_wait: { channel: 'template' },
  lyrics_delivery: { channel: 'template' },
  lyrics_feedback: { channel: 'ai_text' },
  payment: { channel: 'template' },
  payment_ack: { channel: 'template' },
  payment_deferral: { channel: 'ai_text' },
  production: { channel: 'template' },
  delivery: { channel: 'template' },
  video_photos: { channel: 'template' },
  after_sales: { channel: 'ai_text' },
  trust: { channel: 'ai_text' },
  sample: { channel: 'voice' },
  identity: { channel: 'template' },
  handoff_ack: { channel: 'template' },
  stop_ack: { channel: 'template' },
};

export type PresetName = 'alex_complet' | 'mes_mots_uniquement' | 'vocaux_d_abord' | 'reception_seule';

/** Préréglages proposés à l'écran de configuration (§ 12.2). Seules les différences avec DEFAULT_POLICIES. */
export const PRESETS: Readonly<Record<PresetName, Partial<Record<Step, Channel>>>> = {
  alex_complet: {},
  mes_mots_uniquement: {
    welcome: 'template', brief_question: 'template', story_ack: 'template', lyrics_feedback: 'template',
    payment_deferral: 'template', after_sales: 'template', trust: 'template',
  },
  vocaux_d_abord: {
    welcome: 'voice', offers: 'voice_then_template', brief_question: 'template', story_ack: 'template',
    lyrics_feedback: 'template', payment_deferral: 'template', after_sales: 'template', trust: 'voice',
  },
  reception_seule: {
    lyrics_feedback: 'silent', payment_deferral: 'silent', after_sales: 'silent', trust: 'template',
  },
};

export interface ResolvedChannel {
  step: Step;
  channel: Channel;
  assetId?: string;
  templateKey: string;
  /** Raison d'une correction imposée par un verrou (journalisée). */
  coerced?: string;
}

export function resolveChannel(step: Step, policies: StudioStepPolicies, relay = false): ResolvedChannel {
  const configured = policies[step] ?? DEFAULT_POLICIES[step];
  const templateKey = configured.templateKey ?? step;
  const out: ResolvedChannel = { step, channel: configured.channel, templateKey };
  if (configured.assetId !== undefined) out.assetId = configured.assetId;

  const coerce = (channel: Channel, why: string): ResolvedChannel => {
    const r: ResolvedChannel = { step, channel, templateKey, coerced: why };
    if (channel === 'voice_then_template' && out.assetId !== undefined) r.assetId = out.assetId;
    return r;
  };

  if (relay) return out.channel === 'template' ? out : coerce('template', 'relay is template only');
  if (step === 'payment') {
    if (!PAYMENT_ALLOWED.includes(out.channel)) return coerce('template', 'payment is always written by template');
  } else if (TEMPLATE_ONLY.includes(step) && out.channel !== 'template') {
    return coerce('template', `${step} is template only`);
  }
  if ((out.channel === 'voice' || out.channel === 'voice_then_template') && out.assetId === undefined) {
    return coerce('template', 'voice channel without recorded asset');
  }
  return out;
}

export interface OutputItem {
  utterance: Utterance;
  resolved: ResolvedChannel;
}

/**
 * Plan d'envoi d'une décision : résout les canaux, retire les étapes silencieuses,
 * et garantit qu'un message « seul » est l'unique envoi du tour.
 */
export function planOutput(decision: Decision, policies: StudioStepPolicies): { items: OutputItem[]; notes: string[] } {
  const notes: string[] = [];
  let items: OutputItem[] = decision.utterances.map((u) => ({ utterance: u, resolved: resolveChannel(u.step, policies, u.relay) }));

  for (const it of items) if (it.resolved.coerced) notes.push(`${it.utterance.step}: ${it.resolved.coerced}`);

  const silenced = items.filter((it) => it.resolved.channel === 'silent' && !CONTENT_STEPS.includes(it.utterance.step));
  for (const it of silenced) notes.push(`${it.utterance.step}: silent by studio policy`);
  items = items.filter((it) => !silenced.includes(it));

  const standalone = items.find((it) => STANDALONE_STEPS.includes(it.utterance.step));
  if (standalone && items.length > 1) {
    notes.push(`standalone ${standalone.utterance.step}: other messages dropped`);
    items = [standalone];
  }
  return { items, notes };
}
