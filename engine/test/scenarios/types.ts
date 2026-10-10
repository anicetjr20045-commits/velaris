/**
 * Bac à sable à scénarios Velaris (V1).
 *
 * Un scénario rejoue une conversation client complète contre le vrai moteur
 * (ingest + runTurn), avec un LLM simulé. Ça teste la MACHINE — états,
 * transitions, gardes anti-doublon, debounce, emojis, relais — pas la qualité
 * littéraire du prompt (ça, c'est le mode réaliste, V2).
 *
 * Pour ajouter un scénario : copier s01, décrire les étapes, lancer
 * `npm run test:scenarios`.
 */
import type { JsonCompletionRequest } from '../../src/llm/provider.js';

export type LlmKind = 'understand' | 'sales' | 'other';

export interface LlmCall {
  kind: LlmKind;
  system: string;
  req: JsonCompletionRequest;
}

/** Le LLM simulé : reçoit chaque appel, retourne le JSON que le vrai LLM aurait renvoyé. */
export type LlmHandler = (call: LlmCall) => unknown;

export type ReactionTarget = 'last_client' | 'last_merchant';

export type ScenarioStep =
  | { client: string | string[] } // message(s) client ; un tableau = une rafale
  | { merchant: string } // le gérant écrit lui-même → il prend la main
  | { react: { emoji: '✨' | '🎵' | '🎉' | '📝'; on: ReactionTarget } }
  | { pump: true } // force l'exécution immédiate des tours en attente (saute les 20 s)
  | { exec: (db: ScenarioDb, ctx: { convId: string }) => Promise<void> } // échappatoire : manipuler la base directement
  | { expect: Expectation | Expectation[] };

export interface Expectation {
  /** au moins une bulle agent contient chacune de ces sous-chaînes (depuis le dernier expect) */
  aiSaid?: string | string[];
  /** aucun nouveau message agent depuis le dernier expect */
  aiSilent?: boolean;
  /** étape de la commande focus (ou dernière créée) */
  orderStage?: string;
  /** mode de contrôle de la conversation */
  control?: 'ai' | 'human';
  /** nombre cumulé de vocaux de procédure mis en file (anti-doublon) */
  voiceNotes?: number;
  /** la trace du dernier tour exécuté contient (toutes) ces sous-chaînes */
  traceHas?: string | string[];
  /** au moins un appel LLM du kind dont le prompt système contient cette sous-chaîne */
  llmSaw?: { kind: LlmKind; contains: string };
  /** les paroles de la commande contiennent cette sous-chaîne */
  lyricsHave?: string;
  /** le dernier tour client terminé a regroupé exactement N messages (rafale) */
  batched?: number;
  /** une alerte gérant (system_alert) contient cette sous-chaîne */
  alertSent?: string;
}

export interface Scenario {
  name: string;
  title: string;
  llm: LlmHandler;
  steps: ScenarioStep[];
}

/** Sous-ensemble de PGlite utilisé par les scénarios (query + exec). */
export interface ScenarioDb {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers de construction du LLM simulé
// ---------------------------------------------------------------------------

/** Réponse du classifieur `understand`. Les `quote` doivent apparaître dans le message client (le code les vérifie). */
export function U(
  intent: string,
  fields: Record<string, { value: string; quote?: string } | Array<{ value: string; quote?: string }>> = {},
  confidence = 0.92,
): Record<string, unknown> {
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      norm[k] = v.map((m) => ({ value: m.value, quote: m.quote ?? m.value }));
    } else {
      norm[k] = { value: v.value, quote: v.quote ?? v.value };
    }
  }
  return {
    primary_intent: intent,
    secondary_intents: [],
    negated: false,
    confidence,
    fields: norm,
    payment_signal: { kind: 'none' },
    emotional_weight: 'none',
    sensitive_topic: 'none',
    sentiment: 'neutral',
    wants_human: false,
    stop_request: false,
    order_reference: {},
  };
}

/** Réponse du sales brain. */
export function S(
  bubbles: string[],
  extra: {
    procedure_voice?: boolean;
    video_sample?: boolean;
    formula_chosen?: boolean;
    chosen_formula?: 'decouverte' | 'prestige' | null;
  } = {},
): Record<string, unknown> {
  return {
    bubbles,
    procedure_voice: extra.procedure_voice ?? false,
    video_sample: extra.video_sample ?? false,
    formula_chosen: extra.formula_chosen ?? false,
    chosen_formula: extra.chosen_formula ?? null,
  };
}

/** Réponse de l'extraction voix/style (réaction 🎵). */
export function V(voice = 'voix douce et chaleureuse', style = 'afro-pop moderne'): Record<string, unknown> {
  return { voice, style };
}

/** Routeur simple : choisit la file de réponses selon le type d'appel. */
export function scripted(handlers: {
  understand?: Array<Record<string, unknown>> | ((call: LlmCall) => unknown);
  sales?: Array<Record<string, unknown>> | ((call: LlmCall) => unknown);
  other?: (call: LlmCall) => unknown;
}): LlmHandler {
  const uq = Array.isArray(handlers.understand) ? [...handlers.understand] : null;
  const sq = Array.isArray(handlers.sales) ? [...handlers.sales] : null;
  return (call) => {
    if (call.kind === 'understand') {
      if (typeof handlers.understand === 'function') return handlers.understand(call);
      if (uq && uq.length > 0) return uq.shift();
      throw new Error('scénario : plus de réponse scriptée pour understand (ajoutez-en une)');
    }
    if (call.kind === 'sales') {
      if (typeof handlers.sales === 'function') return handlers.sales(call);
      if (sq && sq.length > 0) return sq.shift();
      throw new Error('scénario : plus de réponse scriptée pour sales (ajoutez-en une)');
    }
    if (handlers.other) return handlers.other(call);
    return V();
  };
}
