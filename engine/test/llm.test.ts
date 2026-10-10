/**
 * Fournisseur DeepSeek : réponses simulées, dont les pièges historiques du modèle « reasoner ».
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../src/config.js';
import { DeepSeekProvider } from '../src/llm/deepseek.js';
import { parseStrictJsonObject } from '../src/llm/json-guard.js';
import { LlmError, type LlmProvider } from '../src/llm/provider.js';
import { generateSalesReply, cataloguePrices, buildSalesSystemPrompt, type SalesBrainInput } from '../src/llm/sales-brain.js';

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

  test('mode Kie.ai : endpoint /openai/v1/responses, format Responses API, deepseek-v4-1-flash, cache hit tokens', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const kiePayload = {
      status: 'completed',
      model: 'deepseek-v4-1-flash',
      output: [
        {
          role: 'assistant',
          type: 'message',
          content: [{ type: 'output_text', text: '{"intent":"ask_payment_method"}' }],
          status: 'completed',
        },
      ],
      usage: {
        input_tokens: 150,
        output_tokens: 30,
        total_tokens: 180,
        input_tokens_details: { cached_tokens: 128 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    };

    const p = new DeepSeekProvider({
      apiKey: 'kie-secret-key',
      baseUrl: 'https://api.kie.ai',
      fetchImpl: fakeFetch([{ body: kiePayload }], calls),
    });

    const res = await p.completeJson(req);
    assert.deepEqual(res.data, { intent: 'ask_payment_method' });
    assert.equal(calls[0]!.url, 'https://api.kie.ai/openai/v1/responses');
    assert.equal(calls[0]!.body.model, 'deepseek-v4-1-flash');
    assert.deepEqual(calls[0]!.body.reasoning, { effort: 'none' });
    assert.deepEqual(calls[0]!.body.text, { format: { type: 'json_object' } });
    assert.ok(Array.isArray(calls[0]!.body.input));
    assert.equal(res.usage.cacheHitTokens, 128);
    assert.equal(res.usage.promptTokens, 150);
    assert.equal(res.usage.completionTokens, 30);
    assert.equal(res.reasoningDiscarded, false);
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

describe('sales-brain: vidéo démo déduplication et garde liens externes', () => {
  function mockLlm(returnData: Record<string, unknown>): LlmProvider {
    return {
      name: 'mock',
      async completeJson() {
        return {
          data: returnData,
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };
  }

  const baseInput: SalesBrainInput = {
    turnText: '',
    recent: [],
    contact: {
      phone: '22501020304',
      name: 'Awa',
      wa_jid: '22501020304@s.whatsapp.net',
    },
    persona: {
      studio_name: 'Velaris Studio',
      agent_name: 'Alex',
      manager_first_name: 'Jean',
    },
    orders: [],
  };

  test('lien vidéo externe ou TikTok du client ne déclenche jamais video_sample, même si DeepSeek le propose', async () => {
    const input: SalesBrainInput = {
      ...baseInput,
      turnText: 'Voici le lien tiktok https://vm.tiktok.com/xxxx essaye de voir la vidéo et puis on va un peu copier dessus',
    };
    const llm = mockLlm({ bubbles: ['Bien reçu.'], video_sample: true });
    const outcome = await generateSalesReply(llm, input);
    assert.equal(outcome.videoSampleDue, false);
    assert.ok(outcome.notes.some((n) => n.includes('client is sharing external reference')));
  });

  test('demande expresse du client déclenche video_sample si non encore envoyé', async () => {
    const input: SalesBrainInput = {
      ...baseInput,
      turnText: 'Est-ce que je peux voir un exemple de vidéo ?',
    };
    const llm = mockLlm({ bubbles: ['Voici notre aperçu vidéo.'], video_sample: false });
    const outcome = await generateSalesReply(llm, input);
    assert.equal(outcome.videoSampleDue, true);
  });

  test('vidéo démo déjà envoyée (contact ou historique) supprime strictement tout nouvel envoi', async () => {
    const inputWithContactFlag: SalesBrainInput = {
      ...baseInput,
      contact: { ...baseInput.contact, videoSampleReceived: true },
      turnText: 'Montre-moi encore la vidéo s\'il vous plaît',
    };
    const llm = mockLlm({ bubbles: ['Voici notre aperçu.'], video_sample: true });
    const outcome1 = await generateSalesReply(llm, inputWithContactFlag);
    assert.equal(outcome1.videoSampleDue, false);
    assert.ok(outcome1.notes.some((n) => n.includes('video_sample suppressed because already sent')));

    const inputWithRecentHistory: SalesBrainInput = {
      ...baseInput,
      recent: [{ who: 'studio', text: 'Aperçu vidéo souvenir' }],
      turnText: 'Est-ce que je peux voir un exemple de vidéo ?',
    };
    const outcome2 = await generateSalesReply(llm, inputWithRecentHistory);
    assert.equal(outcome2.videoSampleDue, false);
    assert.ok(outcome2.notes.some((n) => n.includes('video_sample suppressed because already sent')));
  });

  test('aucun débordement du tour précédent : un message ordinaire ne re-déclenche pas la vidéo', async () => {
    const input: SalesBrainInput = {
      ...baseInput,
      recent: [
        { who: 'client', text: 'Essaye de voir la vidéo https://tiktok.com/xxxx' },
        { who: 'studio', text: 'C\'est bien noté pour votre référence.' },
      ],
      turnText: 'Mariage il s\'appelle Claude',
    };
    const llm = mockLlm({ bubbles: ['C\'est noté pour Claude.'], video_sample: false });
    const outcome = await generateSalesReply(llm, input);
    assert.equal(outcome.videoSampleDue, false);
  });
});

describe('sales-brain: directive anti-digression (off_topic)', () => {
  function capturingMockLlm(returnData: Record<string, unknown>): { llm: LlmProvider; systems: string[] } {
    const systems: string[] = [];
    const llm: LlmProvider = {
      name: 'mock',
      async completeJson(req) {
        systems.push(req.system ?? '');
        return {
          data: returnData,
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };
    return { llm, systems };
  }

  const baseInput: SalesBrainInput = {
    turnText: 'Au fait, vous regardez le match ce soir ?',
    recent: [{ who: 'studio', text: 'C\'est bien noté pour Awa. C\'est prévu pour quelle date ?' }],
    contact: {
      phone: '22501020304',
      name: 'Ibrahim',
      wa_jid: '22501020304@s.whatsapp.net',
    },
    persona: {
      studio_name: 'Velaris Studio',
      agent_name: 'Alex',
      manager_first_name: 'Jean',
    },
    orders: [],
  };

  test('digression=true injecte la directive prioritaire "répondre puis recadrer"', async () => {
    const { llm, systems } = capturingMockLlm({ bubbles: ['Bien noté.'], procedure_voice: false });
    const outcome = await generateSalesReply(llm, { ...baseInput, digression: true });
    assert.equal(systems.length, 1);
    assert.ok(systems[0]!.includes('DIRECTIVE ANTI-DIGRESSION (PRIORITAIRE)'));
    assert.ok(systems[0]!.includes('UNE SEULE phrase sobre'));
    assert.ok(systems[0]!.includes('ne pose JAMAIS de question'));
    assert.ok(outcome.notes.some((n) => n.includes('anti-digression directive injected')));
  });

  test('sans digression, aucune directive anti-digression dans le prompt', async () => {
    const { llm, systems } = capturingMockLlm({ bubbles: ['Bien noté.'], procedure_voice: false });
    await generateSalesReply(llm, { ...baseInput });
    assert.equal(systems.length, 1);
    assert.ok(!systems[0]!.includes('DIRECTIVE ANTI-DIGRESSION'));
  });
});



describe('cataloguePrices (M6) : prix dynamiques depuis le catalogue', () => {
  test('retourne les prix du catalogue quand présents', () => {
    const p = cataloguePrices([
      { code: 'decouverte', label: 'Découverte', priceXof: 1500 },
      { code: 'prestige', label: 'Prestige', priceXof: 3500 },
    ]);
    assert.equal(p.decouverte, '1 500');
    assert.equal(p.prestige, '3 500');
  });

  test('repli sur les valeurs par défaut quand le catalogue est vide', () => {
    const p = cataloguePrices([]);
    assert.equal(p.decouverte, '1 200');
    assert.equal(p.prestige, '3 000');
  });

  test('insensible à la casse et aux accents', () => {
    const p = cataloguePrices([
      { code: 'DECOUVERTE', label: 'Formule Découverte', priceXof: 2000 },
      { code: 'PRESTIGE', label: 'Prestige Vidéo', priceXof: 5000 },
    ]);
    assert.equal(p.decouverte, '2 000');
    assert.equal(p.prestige, '5 000');
  });
});

describe('sales-brain : "trouvé sur Facebook" ne bloque plus la vidéo démo (mineur)', () => {
  function mockLlm2(returnData: Record<string, unknown>): LlmProvider {
    return {
      name: 'mock',
      async completeJson() {
        return {
          data: returnData,
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };
  }

  const base2: SalesBrainInput = {
    turnText: '',
    recent: [],
    contact: { phone: '22501020304', name: 'Awa', wa_jid: '22501020304@s.whatsapp.net' },
    persona: { studio_name: 'Velaris Studio', agent_name: 'Alex', manager_first_name: 'Jean' },
    orders: [],
  };

  test('mention de Facebook sans lien vidéo ne supprime pas la démo', async () => {
    const input: SalesBrainInput = {
      ...base2,
      turnText: "Je vous ai trouvé sur Facebook, montrez-moi une vidéo démo",
    };
    const outcome = await generateSalesReply(mockLlm2({ bubbles: ['Voici la démo.'], video_sample: true }), input);
    assert.ok(!outcome.notes.some((n) => n.includes('client is sharing external reference')));
  });

  test('un vrai lien fb.watch bloque toujours la démo', async () => {
    const input: SalesBrainInput = {
      ...base2,
      recent: [{ who: 'client', text: 'Regardez https://fb.watch/xyz123' }],
      turnText: 'voici ma vidéo',
    };
    const outcome = await generateSalesReply(mockLlm2({ bubbles: ['Noté.'], video_sample: true }), input);
    assert.equal(outcome.videoSampleDue, false);
    assert.ok(outcome.notes.some((n) => n.includes('client is sharing external reference')));
  });
});

describe('sales-brain: directive anti-digression graduée (anti-perroquet)', () => {
  const base: SalesBrainInput = {
    turnText: 'Au fait vous faites aussi des vidéos ?',
    recent: [{ who: 'client', text: 'Au fait vous faites aussi des vidéos ?' }],
    contact: { phone: '22501020304', name: null, wa_jid: '22501020304@s.whatsapp.net' },
    persona: { studio_name: 'Velaris Studio', agent_name: 'Alex', manager_first_name: 'Jean' },
    orders: [],
  };

  test('sans digression → aucune directive anti-digression', () => {
    const p = buildSalesSystemPrompt(base);
    assert.ok(!p.includes('ANTI-DIGRESSION'));
  });

  test('digression, 1er recadrage → ton doux, compteur à 1', () => {
    const p = buildSalesSystemPrompt({ ...base, digression: true, repeatCount: 0 });
    assert.ok(p.includes('ANTI-DIGRESSION'));
    assert.ok(p.includes('1ème fois'));
    assert.ok(p.includes('ANTI-PERROQUET STRICT'));
  });

  test('digression, 2ème recadrage → ton adapté, pas la même consigne', () => {
    const p = buildSalesSystemPrompt({ ...base, digression: true, repeatCount: 1 });
    assert.ok(p.includes('2ème fois'));
    assert.ok(p.includes('montre que tu as entendu'));
  });

  test('digression, 4ème recadrage → ton ferme, proposition de pause', () => {
    const p = buildSalesSystemPrompt({ ...base, digression: true, repeatCount: 3 });
    assert.ok(p.includes('4ème fois'));
    assert.ok(p.includes('poli mais ferme'));
  });

  test('le prompt contient des exemples de ponts naturels', () => {
    const p = buildSalesSystemPrompt({ ...base, digression: true, repeatCount: 0 });
    assert.ok(p.includes('Pour revenir à votre chanson'));
  });
});
