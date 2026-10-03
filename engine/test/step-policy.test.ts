/**
 * Personnalisation par studio (§ 12) et verrous non contournables.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICIES, PRESETS, planOutput, resolveChannel, type StudioStepPolicies } from '../src/domain/step-policy.js';
import { STEPS, type Decision, type Step, type Utterance } from '../src/domain/types.js';

const utter = (step: Step, relay = false): Utterance => ({ step, goal: 'welcome', order: null, facts: [], relay });
const decision = (...u: Utterance[]): Decision => ({ actions: [], utterances: u, pendingQuestion: 'keep', trace: [] });

function presetPolicies(name: keyof typeof PRESETS): StudioStepPolicies {
  const out: Partial<Record<Step, { channel: (typeof DEFAULT_POLICIES)[Step]['channel']; assetId?: string }>> = {};
  for (const step of STEPS) {
    const channel = PRESETS[name][step] ?? DEFAULT_POLICIES[step].channel;
    out[step] = channel === 'voice' || channel === 'voice_then_template' ? { channel, assetId: `asset-${step}` } : { channel };
  }
  return out;
}

test('« Mes mots uniquement » : aucune étape en texte généré par l\'IA', () => {
  const p = presetPolicies('mes_mots_uniquement');
  for (const step of STEPS) assert.notEqual(resolveChannel(step, p).channel, 'ai_text', step);
});

test('le paiement ne peut être ni silencieux, ni généré, ni dicté seul', () => {
  for (const channel of ['silent', 'ai_text', 'voice'] as const) {
    const r = resolveChannel('payment', { payment: { channel, assetId: 'x' } });
    assert.equal(r.channel, 'template', channel);
    assert.ok(r.coerced);
  }
  assert.equal(resolveChannel('payment', { payment: { channel: 'voice_then_template', assetId: 'x' } }).channel, 'voice_then_template');
});

test('messages de protection : toujours un gabarit', () => {
  for (const step of ['handoff_ack', 'stop_ack', 'identity', 'payment_ack'] as const) {
    assert.equal(resolveChannel(step, { [step]: { channel: 'silent' } }).channel, 'template', step);
    assert.equal(resolveChannel(step, { [step]: { channel: 'ai_text' } }).channel, 'template', step);
  }
});

test('canal vocal sans vocal enregistré → gabarit', () => {
  const r = resolveChannel('welcome', { welcome: { channel: 'voice' } });
  assert.equal(r.channel, 'template');
});

test('relais : toujours un gabarit, même si le studio a choisi le texte IA', () => {
  assert.equal(resolveChannel('lyrics_wait', { lyrics_wait: { channel: 'ai_text' } }, true).channel, 'template');
});

test('étape mise en silence par le studio : rien n\'est envoyé', () => {
  const { items, notes } = planOutput(decision(utter('after_sales')), { after_sales: { channel: 'silent' } });
  assert.equal(items.length, 0);
  assert.ok(notes.some((n) => n.includes('silent')));
});

test('un message « seul » reste seul dans le plan d\'envoi', () => {
  const { items } = planOutput(decision(utter('procedure'), utter('lyrics_wait')), { procedure: { channel: 'voice', assetId: 'v' } });
  assert.deepEqual(items.map((i) => i.utterance.step), ['procedure']);
});
