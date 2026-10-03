/**
 * Interface unique des fournisseurs de modèles de langage (§ 5.3 couche 4, § 9).
 * Le reste du moteur ne connaît que completeJson : un fournisseur se remplace sans rien toucher d'autre.
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface JsonCompletionRequest {
  system: string;
  messages: readonly LlmMessage[];
  maxTokens: number;
  /** 0 par défaut : la compréhension doit être reproductible. */
  temperature?: number;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
}

export interface JsonCompletion {
  data: Record<string, unknown>;
  model: string;
  usage: LlmUsage;
  latencyMs: number;
  attempts: number;
  /** Vrai si le fournisseur a renvoyé un flot de « pensée » (ignoré, mais signalé au journal). */
  reasoningDiscarded: boolean;
}

export type LlmErrorKind = 'config' | 'network' | 'timeout' | 'rate_limited' | 'server' | 'client' | 'invalid_output' | 'truncated' | 'refused_model';

export class LlmError extends Error {
  constructor(readonly kind: LlmErrorKind, message: string, readonly retryable: boolean) {
    super(message);
  }
}

export interface LlmProvider {
  readonly name: string;
  completeJson(req: JsonCompletionRequest): Promise<JsonCompletion>;
}
