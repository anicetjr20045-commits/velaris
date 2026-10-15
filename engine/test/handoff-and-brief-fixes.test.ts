import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TEMPLATES } from '../src/output/templates.js';
import { generateSalesReply, type SalesBrainInput } from '../src/llm/sales-brain.js';
import type { LlmProvider, JsonCompletionRequest, JsonCompletion } from '../src/llm/provider.js';

describe('Vérifications rigoureuses des correctifs de templates et prompt', () => {
  test('Gabarits : aucun texte ne contient de mention "transmets à {manager}" ou "vers 7h30"', () => {
    const handoffDay = DEFAULT_TEMPLATES['handoff_ack'] ?? '';
    const handoffNight = DEFAULT_TEMPLATES['handoff_ack.offhours'] ?? '';
    const ownLyrics = DEFAULT_TEMPLATES['ack_own_lyrics'] ?? '';
    const newDetail = DEFAULT_TEMPLATES['ack_new_detail'] ?? '';

    // Vérifier l'absence de manager dans handoff_ack
    assert.ok(handoffDay.length > 0, 'handoff_ack doit exister');
    assert.ok(!handoffDay.includes('{manager}'), 'handoff_ack ne doit plus mentionner {manager}');
    assert.ok(!handoffDay.includes('7h30'), 'handoff_ack ne doit pas contenir 7h30');
    assert.ok(handoffDay.includes('notre équipe'), 'handoff_ack doit mentionner notre équipe');

    assert.ok(handoffNight.length > 0, 'handoff_ack.offhours doit exister');
    assert.ok(!handoffNight.includes('{manager}'), 'handoff_ack.offhours ne doit plus mentionner {manager}');
    assert.ok(!handoffNight.includes('7h30'), 'handoff_ack.offhours ne doit pas contenir 7h30');
    assert.ok(handoffNight.includes('notre équipe'), 'handoff_ack.offhours doit mentionner notre équipe');

    // Vérifier les accusés de texte et de détail
    assert.ok(!ownLyrics.includes('{manager}'), 'ack_own_lyrics ne doit plus mentionner {manager}');
    assert.ok(!newDetail.includes('{manager}'), 'ack_new_detail ne doit plus mentionner {manager}');
  });

  test('Sales-brain prompt : la date est strictement conditionnelle (interdite sur chanson d\'amour/hommage)', async () => {
    let capturedSystem = '';
    const mockLlm: LlmProvider = {
      name: 'mock',
      async completeJson(req: JsonCompletionRequest): Promise<JsonCompletion> {
        capturedSystem = req.system ?? '';
        return {
          data: { bubbles: ['D\'accord'], procedure_voice: false, video_sample: false, formula_chosen: false, chosen_formula: null },
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const input: SalesBrainInput = {
      turnText: 'Bonjour je veux une chanson d amour pour ma cherie Noura',
      recent: [],
      contact: { phone: '22670000000', name: null, wa_jid: '22670000000@s.whatsapp.net' },
      persona: { studio_name: 'Velaris Studio', agent_name: 'Alex', manager_first_name: 'Anicet' },
      orders: [],
    };

    await generateSalesReply(mockLlm, input);

    assert.ok(capturedSystem.length > 0, 'Le prompt système doit être généré');
    assert.ok(
      capturedSystem.includes('DEMANDE LA DATE UNIQUEMENT'),
      'Le prompt doit contenir DEMANDE LA DATE UNIQUEMENT'
    );
    assert.ok(
      capturedSystem.includes('NE DEMANDE JAMAIS LA DATE pour une chanson d\'amour'),
      'Le prompt doit explicitement interdire la date pour une chanson d\'amour'
    );
  });
});
