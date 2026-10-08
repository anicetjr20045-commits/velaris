/**
 * Fournisseur DeepSeek : modèle deepseek-chat (DeepSeek-V3), API compatible OpenAI.
 *   POST {baseUrl}/chat/completions   (baseUrl par défaut : https://api.deepseek.com/v1)
 *
 * Verrous contre le piège « reasoner » :
 *  1. modèle à raisonnement refusé à la construction (et revérifié sur le modèle renvoyé) ;
 *  2. reasoning_content ignoré (jamais lu comme réponse), signalé dans le résultat ;
 *  3. mode JSON natif (response_format json_object) + extraction stricte (json-guard) ;
 *  4. sortie tronquée (finish_reason = length) refusée, jamais « réparée » ;
 *  5. température 0 par défaut, délai borné, un seul nouvel essai sur erreur transitoire.
 */

import { assertNonReasoningModel } from '../config.js';
import { parseStrictJsonObject } from './json-guard.js';
import { LlmError, type JsonCompletion, type JsonCompletionRequest, type LlmProvider } from './provider.js';

export interface DeepSeekOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface ChatResponse {
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null; reasoning_content?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
}

const JSON_WORD = /json/i;

export class DeepSeekProvider implements LlmProvider {
  readonly name = 'deepseek';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly opts: DeepSeekOptions) {
    if (!opts.apiKey) throw new LlmError('config', 'clé DeepSeek absente', false);
    this.baseUrl = (opts.baseUrl ?? 'https://api.deepseek.com/v1').replace(/\/$/, '');
    this.model = opts.model ?? 'deepseek-flash';
    assertNonReasoningModel(this.model);
    this.timeoutMs = opts.timeoutMs ?? 12_000;
    this.maxAttempts = Math.max(1, Math.min(opts.maxAttempts ?? 2, 3));
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  async completeJson(req: JsonCompletionRequest): Promise<JsonCompletion> {
    // Le mode JSON de DeepSeek exige que le mot « json » figure dans le prompt.
    const system = JSON_WORD.test(req.system) ? req.system : `${req.system}\n\nRéponds uniquement par un objet JSON.`;
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: system }, ...req.messages],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: req.temperature ?? 0,
      max_tokens: req.maxTokens,
      stream: false,
    };

    const started = this.now();
    let last: LlmError | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const out = await this.once(body);
        return { ...out, latencyMs: this.now() - started, attempts: attempt };
      } catch (err) {
        last = err instanceof LlmError ? err : new LlmError('network', String(err), true);
        if (!last.retryable || attempt === this.maxAttempts) break;
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    throw last ?? new LlmError('network', 'échec inconnu', false);
  }

  private async once(body: unknown): Promise<Omit<JsonCompletion, 'latencyMs' | 'attempts'>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new LlmError('timeout', 'délai dépassé', true);
      throw new LlmError('network', `réseau : ${name}`, true);
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      if (res.status === 429) throw new LlmError('rate_limited', `HTTP 429 ${detail}`, true);
      if (res.status >= 500) throw new LlmError('server', `HTTP ${res.status} ${detail}`, true);
      // 401 clé invalide, 402 solde épuisé, 400 requête invalide : inutile de réessayer
      throw new LlmError('client', `HTTP ${res.status} ${detail}`, false);
    }

    let payload: ChatResponse;
    try {
      payload = (await res.json()) as ChatResponse;
    } catch {
      throw new LlmError('invalid_output', 'réponse HTTP non JSON', true);
    }

    const returnedModel = payload.model ?? this.model;
    try {
      assertNonReasoningModel(returnedModel);
    } catch {
      throw new LlmError('refused_model', `modèle renvoyé refusé : ${returnedModel}`, false);
    }

    const choice = payload.choices?.[0];
    if (!choice?.message) throw new LlmError('invalid_output', 'aucun choix dans la réponse', true);
    if (choice.finish_reason === 'length') throw new LlmError('truncated', 'sortie tronquée (max_tokens)', false);

    const reasoningDiscarded = typeof choice.message.reasoning_content === 'string' && choice.message.reasoning_content.length > 0;
    const guarded = parseStrictJsonObject(choice.message.content);

    return {
      data: guarded.data,
      model: returnedModel,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        cacheHitTokens: payload.usage?.prompt_cache_hit_tokens ?? (payload.usage as any)?.prompt_tokens_details?.cached_tokens ?? 0,
      },
      reasoningDiscarded: reasoningDiscarded || guarded.strippedThinking,
    };
  }
}
