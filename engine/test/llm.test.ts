/**
 * Fournisseur DeepSeek : réponses simulées, dont les pièges historiques du modèle « reasoner ».
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../src/config.js';
import { DeepSeekProvider } from '../src/llm/deepseek.js';
import { parseStrictJsonObject } from '../src/llm/json-guard.js';
import { LlmError } from '../src/llm/provider.js';

type Reply = { status?: number; body: unknown };

function fakeFetch(replies: Reply[], calls: Array<{ url: string; body: Record<string, unknown> }>): typeof fetch {
  let i = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    const r = replies[Math.min(i++, replies.length - 1)]!;
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
}

const ok = (content: string | null, extra: Record<string, unknown> = {}, finish = 'stop') => ({
  body: {
    model: 'deepseek-flash',
    choices: [{ finish_reason: finish, message: { content, ...extra } }],
    usage: { prompt_tokens: 120, completion_tokens: 30, prompt_cache_hit_tokens: 64 },
  },
});

const req = { system: 'Classe le message.', messages: [{ role: 'user' as const, content: 'Le numéro de dépôt' }], maxTokens: 300 };

describe('json-guard', () => {
  test('objet JSON pur', () => assert.deepEqual(parseStrictJsonObject('{"intent":"ask_payment_method"}').data, { intent: 'ask_payment_method' }));
  test('bloc <think> retiré et signalé', () => {
    const r = parseStrictJsonObject('<think>le client veut payer…</think>\n{"intent":"ask_payment_method"}');
    assert.deepEqual(r.data, { intent: 'ask_payment_method' });
    assert.equal(r.strippedThinking, true);
  });
  test('balise <think> non fermée refusée', () => assert.throws(() => parseStrictJsonObject('<think>je réfléchis {"a":1}'), LlmError));
  test('bloc ```json``` accepté', () => assert.deepEqual(parseStrictJsonObject('```json\n{"a":1}\n```').data, { a: 1 }));
  test('texte autour du JSON extrait avec tolérance', () => assert.deepEqual(parseStrictJsonObject('Voici : {"a":1}').data, { a: 1 }));
  test('tableau refusé', () => assert.throws(() => parseStrictJsonObject('[1,2]'), LlmError));
  test('JSON invalide refusé', () => assert.throws(() => parseStrictJsonObject('{"a":}'), LlmError));
});

describe('DeepSeekProvider', () => {
  test('requête : deepseek-flash, /v1/chat/completions, mode JSON, température 0, mot « json » ajouté', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const p = new DeepSeekProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch([ok('{"intent":"ask_payment_method"}')], calls) });
    const r = await p.completeJson(req);
    assert.deepEqual(r.data, { intent: 'ask_payment_method' });
    assert.equal(calls[0]!.url, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(calls[0]!.body.model, 'deepseek-flash');
    assert.deepEqual(calls[0]!.body.response_format, { type: 'json_object' });
    assert.equal(calls[0]!.body.temperature, 0);
    const sys = (calls[0]!.body.messages as Array<{ role: string; content: string }>)[0]!;
    assert.match(sys.content, /json/i);
    assert.equal(r.usage.cacheHitTokens, 64);
    assert.equal(r.reasoningDiscarded, false);
  });

  test('reasoning_content présent : ignoré, jamais lu comme réponse, signalé', async () => {
    const p = new DeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch([ok('{"x":1}', { reasoning_content: 'Hmm, the user wants… {"x":2}' })], []) });
    const r = await p.completeJson(req);
    assert.deepEqual(r.data, { x: 1 });
    assert.equal(r.reasoningDiscarded, true);
  });

  test('modèle « reasoner » refusé à la construction', () => {
    assert.throws(() => new DeepSeekProvider({ apiKey: 'k', model: 'deepseek-reasoner' }), ConfigError);
  });

  test('modèle « reasoner » renvoyé par l\'API refusé', async () => {
    const reply = ok('{"x":1}');
    (reply.body as { model: string }).model = 'deepseek-reasoner';
    const p = new DeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch([reply], []) });
    await assert.rejects(p.completeJson(req), (e: LlmError) => e.kind === 'refused_model');
  });

  test('sortie tronquée refusée sans nouvel essai', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const p = new DeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch([ok('{"x":', {}, 'length')], calls) });
    await assert.rejects(p.completeJson(req), (e: LlmError) => e.kind === 'truncated');
    assert.equal(calls.length, 1);
  });

  test('contenu vide (bizarrerie connue du mode JSON) → un nouvel essai', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const p = new DeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch([ok(''), ok('{"x":1}')], calls) });
    const r = await p.completeJson(req);
    assert.deepEqual(r.data, { x: 1 });
    assert.equal(r.attempts, 2);
  });

  test('503 → nouvel essai ; 401 → aucun', async () => {
    const c1: Array<{ url: string; body: Record<string, unknown> }> = [];
    const p1 = new DeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch([{ status: 503, body: 'busy' }, ok('{"x":1}')], c1) });
    assert.deepEqual((await p1.completeJson(req)).data, { x: 1 });
    const c2: Array<{ url: string; body: Record<string, unknown> }> = [];
    const p2 = new DeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch([{ status: 401, body: 'bad key' }], c2) });
    await assert.rejects(p2.completeJson(req), (e: LlmError) => e.kind === 'client');
    assert.equal(c2.length, 1);
  });
});

describe('configuration', () => {
  const base = {
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 's', WAHA_URL: 'http://waha:3000', WAHA_API_KEY: 'w',
    WAHA_WEBHOOK_HMAC_KEY: 'h'.repeat(40), DEEPSEEK_API_KEY: 'sk',
  };
  test('valeurs par défaut sûres', () => {
    const c = loadConfig(base);
    assert.equal(c.deepseek.model, 'deepseek-flash');
    assert.equal(c.deepseek.baseUrl, 'https://api.deepseek.com/v1');
    assert.deepEqual(c.protectedSessions, ['anicet2']);
  });
  test('démarrage refusé sans clé HMAC, ou avec un modèle reasoner', () => {
    assert.throws(() => loadConfig({ ...base, WAHA_WEBHOOK_HMAC_KEY: '' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, DEEPSEEK_MODEL: 'deepseek-reasoner' }), ConfigError);
  });
});
