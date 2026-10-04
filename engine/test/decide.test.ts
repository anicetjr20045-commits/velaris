/**
 * Décision : scénarios de référence (§ 20.4) et verrous demandés par Anicet.
 * Aucune I/O, aucun modèle : la compréhension est fournie par les fixtures.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDecisionInvariants, decide, decideSafely } from '../src/domain/decide.js';
import type { Action, Decision, DecisionInput } from '../src/domain/types.js';
import { input, minutesAgo, order, standardOrder, studio, understanding, OFFER_STANDARD } from './fixtures.js';

const steps = (d: Decision): string[] => d.utterances.map((u) => u.step);
const goals = (d: Decision): string[] => d.utterances.map((u) => u.goal);
const acts = (d: Decision, type: Action['type']): Action[] => d.actions.filter((a) => a.type === type);
const hasTransition = (d: Decision, event: string): boolean =>
  d.actions.some((a) => a.type === 'transition' && a.event === event);

function run(i: DecisionInput): Decision {
  const d = decide(i);
  assert.deepEqual(assertDecisionInvariants(d, i), [], `invariants violés : ${d.trace.join(' | ')}`);
  return d;
}

describe('Vocal de procédure : strictement quand le brief est complet, et seul (I13)', () => {
  test('brief complété par la confirmation du prénom → vocal seul', () => {
    const o = standardOrder();
    const d = run(input({
      orders: [o],
      conversation: { ...input().conversation, pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' } },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.ok(hasTransition(d, 'brief_completed'));
    assert.equal(acts(d, 'send_procedure_voice').length, 1);
    assert.deepEqual(steps(d), ['procedure']);
  });

  test('rafale « anniversaire » + « pour ma femme Awa » : brief incomplet → aucune procédure, confirmation du prénom (GS-15)', () => {
    const d = run(input({
      understanding: understanding({
        primaryIntent: 'give_brief_info',
        fields: {
          occasion: { value: 'anniversaire', quote: "c'est pour un anniversaire" },
          recipientName: { value: 'Awa', quote: 'pour ma femme Awa' },
          recipientRelation: { value: 'épouse', quote: 'ma femme' },
        },
      }),
    }));
    assert.equal(acts(d, 'send_procedure_voice').length, 0);
    assert.equal(acts(d, 'open_order').length, 1);
    assert.deepEqual(goals(d), ['confirm_recipient_name']);
    assert.equal(d.utterances.length, 1);
  });

  test('prénom confirmé mais formule non choisie → question de formule, pas de vocal', () => {
    const o = order({ occasion: 'anniversaire', recipientName: 'Awa' });
    const d = run(input({
      orders: [o],
      conversation: { ...input().conversation, pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' } },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.equal(acts(d, 'send_procedure_voice').length, 0);
    assert.deepEqual(steps(d), ['offers']);
  });

  test('vocal déjà reçu par ce contact → pas de second vocal, délai à la place', () => {
    const o = standardOrder();
    const d = run(input({
      orders: [o],
      contact: { deliveredOrders: 1, procedureVoiceReceived: true },
      conversation: { ...input().conversation, pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' } },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.equal(acts(d, 'send_procedure_voice').length, 0);
    assert.ok(hasTransition(d, 'lyrics_work_started'));
    assert.deepEqual(steps(d), ['lyrics_wait']);
  });

  test('prospect dormant (contact ancien, jamais livré, jamais de vocal) → vocal envoyé (GS-07, cas Sylvie)', () => {
    const o = standardOrder();
    const d = run(input({
      orders: [o],
      contact: { deliveredOrders: 0, procedureVoiceReceived: false },
      conversation: { ...input().conversation, pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' } },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.deepEqual(steps(d), ['procedure']);
  });

  test('le vérificateur refuse un vocal accompagné d\'un autre message', () => {
    const i = input();
    const forged: Decision = {
      actions: [
        { type: 'transition', order: { kind: 'new' }, track: 'creative', event: 'brief_completed' },
        { type: 'send_procedure_voice', order: { kind: 'new' } },
      ],
      utterances: [
        { step: 'procedure', goal: 'procedure_voice', order: null, facts: [], relay: false },
        { step: 'lyrics_wait', goal: 'brief_received', order: null, facts: [], relay: false },
      ],
      pendingQuestion: 'keep',
      trace: [],
    };
    assert.ok(assertDecisionInvariants(forged, i).some((v) => v.startsWith('I13')));
  });

  test('le vérificateur refuse un vocal sans brief complété dans le tour', () => {
    const forged: Decision = {
      actions: [{ type: 'send_procedure_voice', order: { kind: 'new' } }],
      utterances: [{ step: 'procedure', goal: 'procedure_voice', order: null, facts: [], relay: false }],
      pendingQuestion: 'keep',
      trace: [],
    };
    assert.ok(assertDecisionInvariants(forged, input()).includes('I13: procedure voice without brief completion in this turn'));
  });
});

describe('Silence radio quand l\'étape l\'exige', () => {
  test('prise de main du gérant : silence total, quelle que soit l\'intention', () => {
    for (const primaryIntent of ['greeting', 'give_brief_info', 'validate_lyrics', 'ask_status', 'complaint'] as const) {
      const d = run(input({
        control: { mode: 'human', reason: 'merchant_reply', actor: 'merchant' },
        handoff: { open: true, origin: 'merchant', ackSent: false, relayLog: {} },
        clock: { ...input().clock, managerAvailable: true, merchantSilentBeyondSla: false },
        orders: [standardOrder({ stage: 'lyrics_in_progress' })],
        understanding: understanding({ primaryIntent }),
      }));
      assert.deepEqual(d.utterances, [], primaryIntent);
    }
  });

  test('conversation close (« stop ») : silence absolu', () => {
    const d = run(input({ control: { mode: 'closed', reason: 'stop_request', actor: 'agent' }, understanding: understanding({ primaryIntent: 'greeting' }) }));
    assert.deepEqual(d.utterances, []);
  });

  test('niveau 0 (suivi seul) : silence', () => {
    const d = run(input({ studio: studio({ caps: { ...studio().caps, reception: false } }), understanding: understanding({ primaryIntent: 'greeting' }) }));
    assert.deepEqual(d.utterances, []);
  });

  test('« J\'attends alors » pendant l\'écriture : délai une fois, puis silence (GS-02, I26)', () => {
    const o = standardOrder({ stage: 'lyrics_in_progress', recipientNameConfirmed: true });
    const base = input({ orders: [o], eta: { [o.id]: { lyrics: 'dans environ 10 minutes' } }, understanding: understanding({ primaryIntent: 'patient_wait' }) });
    const first = run(base);
    assert.deepEqual(goals(first), ['lyrics_eta']);
    assert.equal(acts(first, 'save_brief_fields').length, 0, 'aucune écriture du brief');
    const second = run({ ...base, conversation: { ...base.conversation, ackLog: { [`${o.id}:eta:lyrics`]: minutesAgo(5) } } });
    assert.deepEqual(second.utterances, []);
  });

  test('pas de délai calculable → silence plutôt qu\'un délai inventé (I27)', () => {
    const o = standardOrder({ stage: 'lyrics_in_progress', recipientNameConfirmed: true });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'ask_status' }) }));
    assert.deepEqual(d.utterances, []);
  });

  test('« Stop » → un message de clôture puis fermeture (I16)', () => {
    const d = run(input({ understanding: understanding({ primaryIntent: 'stop_contact', stopRequest: true }) }));
    assert.deepEqual(steps(d), ['stop_ack']);
    assert.equal(acts(d, 'close_conversation').length, 1);
  });
});

describe('Piste paiement : le numéro de dépôt n\'est jamais refusé (I21)', () => {
  test('« Le dépôt c\'est sur quelle numéro ? » pendant le brief, formule choisie → gabarit de paiement (GS-03)', () => {
    const o = standardOrder();
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'ask_payment_method' }) }));
    assert.deepEqual(steps(d), ['payment']);
    assert.ok(hasTransition(d, 'instructions_sent'));
    const total = d.utterances[0]!.facts.find((f) => f.key === 'total_xof');
    assert.equal(total?.value, 3000);
  });

  test('« Le numéro de dépôt » sans commande, une seule offre active → formule fixée et gabarit (GS-09)', () => {
    const d = run(input({
      studio: studio({ catalogue: [OFFER_STANDARD] }),
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.equal(acts(d, 'open_order').length, 1);
    assert.equal(acts(d, 'choose_offer').length, 1);
    assert.deepEqual(steps(d), ['payment']);
  });

  test('plusieurs offres, aucune choisie → une seule question : la formule', () => {
    const o = order({ occasion: 'anniversaire' });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'ask_payment_method' }) }));
    assert.deepEqual(goals(d), ['ask_offer_for_payment']);
    assert.equal(d.pendingQuestion !== 'keep' && d.pendingQuestion?.key, 'choose_offer_then_payment');
  });

  test('réponse à la question de formule → instructions dans la foulée', () => {
    const o = order({ occasion: 'anniversaire' });
    const d = run(input({
      orders: [o],
      conversation: { ...input().conversation, pendingQuestion: { key: 'choose_offer_then_payment', orderId: o.id, asker: 'agent' } },
      understanding: understanding({ primaryIntent: 'choose_offer', fields: { offerCode: { value: 'standard', quote: 'la chanson complète' } } }),
    }));
    assert.deepEqual(steps(d), ['payment']);
  });

  test('report « dépôt là si c\'est demain… » : une seule réponse, relance programmée (GS-01, cas Djalilou)', () => {
    const o = standardOrder({ stage: 'lyrics_validated', paymentStatus: 'instructions_sent', recipientNameConfirmed: true });
    const base = input({
      orders: [o],
      understanding: understanding({
        primaryIntent: 'payment_deferral',
        paymentSignal: { kind: 'defers', deferralReason: 'kiosk_closed', deferralWhen: 'tomorrow', quote: 'dépôt là si c’est demain' },
      }),
    });
    const first = run(base);
    assert.deepEqual(goals(first), ['ack_deferral']);
    assert.equal(acts(first, 'schedule_followup').length, 1);
    const again = run({ ...base, conversation: { ...base.conversation, ackLog: { [`${o.id}:payment_deferral`]: minutesAgo(1) } } });
    assert.deepEqual(again.utterances, [], 'pas de bulle d\'attente répétée');
    assert.equal(acts(again, 'schedule_followup').length, 0);
  });

  test('capture de paiement : déclarée et signalée, jamais confirmée par l\'agent (I8, GS-21)', () => {
    const o = standardOrder({ stage: 'lyrics_validated', paymentStatus: 'instructions_sent', recipientNameConfirmed: true });
    const d = run(input({
      orders: [o],
      understanding: understanding({ primaryIntent: 'acknowledgement' }),
      media: { images: [{ kind: 'payment_proof', confidence: 0.93 }], hasAudio: false },
    }));
    assert.ok(hasTransition(d, 'payment_claimed'));
    assert.equal(hasTransition(d, 'payment_confirmed'), false);
    assert.deepEqual(steps(d), ['payment_ack']);
  });

  test('« Bien reçu » n\'est jamais un paiement', () => {
    const o = standardOrder({ stage: 'lyrics_in_progress', recipientNameConfirmed: true });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'acknowledgement' }) }));
    assert.equal(hasTransition(d, 'payment_claimed'), false);
  });

  test('« Je n\'ai pas encore payé » (négation) → aucune déclaration de paiement', () => {
    const o = standardOrder({ stage: 'lyrics_validated', paymentStatus: 'instructions_sent', recipientNameConfirmed: true });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'payment_claim', negated: true }) }));
    assert.equal(hasTransition(d, 'payment_claimed'), false);
  });

  test('capacité paiement désactivée → passation, jamais de silence sur une question de paiement', () => {
    const d = run(input({
      studio: studio({ caps: { ...studio().caps, payment: false } }),
      orders: [standardOrder()],
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.deepEqual(steps(d), ['handoff_ack']);
  });
});

describe('Mode relais : le gérant dort, le client veut payer (GS-04, cas Djalilou)', () => {
  const human = {
    control: { mode: 'human' as const, reason: 'merchant_reply', actor: 'merchant' as const },
    handoff: { open: true, origin: 'merchant' as const, ackSent: false, relayLog: {} },
  };

  test('hors horaires du gérant → gabarit de paiement en relais', () => {
    const o = standardOrder({ stage: 'lyrics_sent', recipientNameConfirmed: true });
    const d = run(input({
      ...human,
      orders: [o],
      clock: { ...input().clock, managerAvailable: false },
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.deepEqual(steps(d), ['payment']);
    assert.equal(d.utterances[0]!.relay, true);
  });

  test('gérant disponible et réactif → silence', () => {
    const d = run(input({
      ...human,
      orders: [standardOrder({ stage: 'lyrics_sent' })],
      clock: { ...input().clock, managerAvailable: true, merchantSilentBeyondSla: false },
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.deepEqual(d.utterances, []);
  });

  test('passation pour plainte → jamais de relais', () => {
    const d = run(input({
      control: { mode: 'human', reason: 'handoff:complaint', actor: 'agent' },
      handoff: { open: true, origin: 'agent', ackSent: true, relayLog: {} },
      orders: [standardOrder({ stage: 'lyrics_sent' })],
      clock: { ...input().clock, managerAvailable: false },
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.deepEqual(d.utterances, []);
  });

  test('un seul relais par intention sur 12 h', () => {
    const d = run(input({
      ...human,
      handoff: { ...human.handoff, relayLog: { payment_instructions: minutesAgo(30) } },
      orders: [standardOrder({ stage: 'lyrics_sent' })],
      clock: { ...input().clock, managerAvailable: false },
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.deepEqual(d.utterances, []);
  });

  test('relais sans prix fixé → silence et alerte, jamais un prix inventé', () => {
    const d = run(input({
      ...human,
      orders: [order({ occasion: 'anniversaire' })],
      clock: { ...input().clock, managerAvailable: false },
      understanding: understanding({ primaryIntent: 'ask_payment_method' }),
    }));
    assert.deepEqual(d.utterances, []);
    assert.equal(acts(d, 'alert_owner').length, 1);
  });
});

describe('Compréhension du terrain : aucun effacement, aucun aveu', () => {
  test('« Non pas encore » à une autre question ne touche pas au prénom (GS-11, I20)', () => {
    const o = standardOrder({ recipientNameConfirmed: true, catalogueCode: null, priceXof: null });
    const d = run(input({
      orders: [o],
      conversation: { ...input().conversation, pendingQuestion: { key: 'merchant_question', orderId: o.id, asker: 'merchant' } },
      understanding: understanding({ primaryIntent: 'confirm_no' }),
    }));
    for (const a of acts(d, 'save_brief_fields')) {
      if (a.type === 'save_brief_fields') assert.deepEqual(a.allowClear, []);
    }
  });

  test('« Non » à la confirmation du prénom : seul le prénom peut être effacé', () => {
    const o = standardOrder();
    const d = run(input({
      orders: [o],
      conversation: { ...input().conversation, pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' } },
      understanding: understanding({ primaryIntent: 'confirm_no' }),
    }));
    const save = acts(d, 'save_brief_fields')[0];
    assert.ok(save && save.type === 'save_brief_fields');
    assert.deepEqual(save.allowClear, ['recipient_name']);
    assert.deepEqual(goals(d), ['ask_next_field']);
  });

  test('confiance faible une fois → pas en avant ; deux fois → passation discrète (GS-14, I22)', () => {
    const once = run(input({ understanding: understanding({ primaryIntent: 'unclear', confidence: 0.3 }), conversation: { ...input().conversation, lowConfStreak: 1 } }));
    assert.deepEqual(goals(once), ['forward_move']);
    const twice = run(input({ understanding: understanding({ primaryIntent: 'unclear', confidence: 0.3 }), conversation: { ...input().conversation, lowConfStreak: 2 } }));
    assert.deepEqual(steps(twice), ['handoff_ack']);
  });

  test('« Kpata là voyons voir le son » → un exemple, seul (GS-13)', () => {
    const d = run(input({ understanding: understanding({ primaryIntent: 'ask_sample' }) }));
    assert.deepEqual(steps(d), ['sample']);
  });

  test('« Vous êtes un robot ? » → identité honnête (GS-19, I28)', () => {
    const d = run(input({ understanding: understanding({ primaryIntent: 'asks_if_bot' }) }));
    assert.deepEqual(steps(d), ['identity']);
  });
});

describe('Accueil émotionnel (cas Fargo, Sylvie : I29)', () => {
  test('confidence à forte charge, sans commande → accueil, souvenirs gardés, aucune offre ni paiement (GS-08)', () => {
    const d = run(input({
      understanding: understanding({
        primaryIntent: 'shares_story',
        emotionalWeight: 'high',
        sensitiveTopic: 'illness',
        fields: { memories: [{ value: 'santé fragile, prière pour son foyer', quote: 'ma santé est fragile' }] },
      }),
    }));
    assert.deepEqual(steps(d), ['story_ack']);
    assert.ok(!steps(d).includes('offers') && !steps(d).includes('payment'));
    const save = acts(d, 'save_brief_fields')[0];
    assert.ok(save && save.type === 'save_brief_fields' && save.patch.memories?.length === 1);
    assert.equal(save.patch.sensitive_topic, 'illness');
  });

  test('confidence + question de paiement dans le même tour → accueil puis gabarit, sans mélange', () => {
    const d = run(input({
      orders: [standardOrder()],
      understanding: understanding({ primaryIntent: 'ask_payment_method', emotionalWeight: 'high', sensitiveTopic: 'grief' }),
    }));
    assert.deepEqual(steps(d), ['story_ack', 'payment']);
  });
});

describe('Clients anciens et nouveaux, commandes parallèles', () => {
  test('ancien client → accueil « content de vous revoir », jamais « avez-vous déjà commandé » (GS-17)', () => {
    const d = run(input({ contact: { deliveredOrders: 2, procedureVoiceReceived: true }, understanding: understanding({ primaryIntent: 'greeting' }) }));
    assert.deepEqual(goals(d), ['welcome_returning', 'present_offers']);
  });

  test('accueil déjà envoyé → pas de second accueil sur un simple « ok »', () => {
    const d = run(input({ conversation: { ...input().conversation, ackLog: { welcome: minutesAgo(20) } }, understanding: understanding({ primaryIntent: 'acknowledgement' }) }));
    assert.deepEqual(d.utterances, []);
  });

  test('« Je veux aussi une pour ma mère » → seconde commande, brief séparé (GS-16)', () => {
    const awa = standardOrder({ stage: 'lyrics_sent', recipientNameConfirmed: true });
    const d = run(input({
      orders: [awa],
      understanding: understanding({
        primaryIntent: 'order_song',
        fields: { recipientName: { value: 'Maman', quote: 'une pour ma mère' } },
        orderReference: { isNewOrder: true },
      }),
    }));
    assert.equal(acts(d, 'open_order').length, 1);
    const save = acts(d, 'save_brief_fields')[0];
    assert.ok(save && save.type === 'save_brief_fields' && save.order.kind === 'new');
  });

  test('plafond de commandes ouvertes atteint → passation', () => {
    const many = [1, 2, 3].map((n) => standardOrder({ id: `o${n}`, recipientName: `R${n}`, stage: 'lyrics_in_progress' }));
    const d = run(input({
      orders: many,
      understanding: understanding({ primaryIntent: 'order_song', orderReference: { isNewOrder: true } }),
    }));
    assert.deepEqual(steps(d), ['handoff_ack']);
  });

  test('deux commandes non payées → un seul gabarit, total cumulé', () => {
    const a = standardOrder({ id: 'a', stage: 'lyrics_validated', recipientNameConfirmed: true });
    const m = standardOrder({ id: 'm', recipientName: 'Maman', stage: 'lyrics_sent', recipientNameConfirmed: true });
    const d = run(input({ orders: [a, m], understanding: understanding({ primaryIntent: 'ask_payment_method' }) }));
    assert.deepEqual(steps(d), ['payment']);
    assert.equal(d.utterances[0]!.facts.find((f) => f.key === 'total_xof')?.value, 6000);
  });
});

describe('Paroles : validation, retouches, paiement', () => {
  test('« C\'est validé » → validation + remerciement + instructions de paiement', () => {
    const o = standardOrder({ stage: 'lyrics_sent', recipientNameConfirmed: true });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'validate_lyrics' }) }));
    assert.ok(hasTransition(d, 'lyrics_validated'));
    assert.deepEqual(steps(d), ['lyrics_feedback', 'payment']);
  });

  test('« C\'est propre » avec confiance moyenne → « On garde ce texte tel quel ? »', () => {
    const o = standardOrder({ stage: 'lyrics_sent', recipientNameConfirmed: true });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'positive_feedback', confidence: 0.7 }) }));
    assert.equal(hasTransition(d, 'lyrics_validated'), false);
    assert.deepEqual(goals(d), ['confirm_keep_lyrics']);
  });

  test('retouches gratuites épuisées → passation', () => {
    const o = standardOrder({ stage: 'lyrics_sent', revisionCount: 2, recipientNameConfirmed: true });
    const d = run(input({ orders: [o], understanding: understanding({ primaryIntent: 'request_lyrics_change' }) }));
    assert.deepEqual(steps(d), ['handoff_ack']);
  });

  test('Tour 1 : demande de retouche → récapitulatif + question confirm_change_recap', () => {
    const o = standardOrder({ stage: 'lyrics_sent', revisionCount: 0, recipientNameConfirmed: true });
    const d = run(input({
      orders: [o],
      understanding: understanding({
        primaryIntent: 'request_lyrics_change',
        fields: { changeRequest: { value: 'changer le surnom', quote: 'changer le surnom' } },
      }),
    }));
    assert.deepEqual(goals(d), ['recap_change_request']);
    assert.equal(typeof d.pendingQuestion === 'object' ? d.pendingQuestion?.key : null, 'confirm_change_recap');
    assert.ok(d.actions.some((a) => a.type === 'register_change_request' && (a as any).text === 'changer le surnom'));
  });

  test('Ajout de précisions pendant le récapitulatif → récapitulatif mis à jour', () => {
    const o = standardOrder({ stage: 'lyrics_sent', revisionCount: 0, recipientNameConfirmed: true });
    const d = run(input({
      orders: [o],
      conversation: {
        ...input().conversation,
        pendingQuestion: { key: 'confirm_change_recap', orderId: o.id, asker: 'agent' },
      },
      understanding: understanding({
        primaryIntent: 'give_brief_info',
        fields: { changeRequest: { value: 'ajouter qu elle aime chanter', quote: 'ajouter qu elle aime chanter' } },
      }),
    }));
    assert.deepEqual(goals(d), ['recap_change_request']);
    assert.equal(typeof d.pendingQuestion === 'object' ? d.pendingQuestion?.key : null, 'confirm_change_recap');
  });

  test('Tour 2 : confirmation récapitulatif (« Oui ») → transition change_requested + revise_lyrics', () => {
    const o = standardOrder({ stage: 'lyrics_sent', revisionCount: 1, recipientNameConfirmed: true });
    const d = run(input({
      orders: [o],
      conversation: {
        ...input().conversation,
        pendingQuestion: { key: 'confirm_change_recap', orderId: o.id, asker: 'agent' },
      },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.ok(hasTransition(d, 'change_requested'));
    assert.ok(d.actions.some((a) => a.type === 'revise_lyrics'));
    assert.ok(d.actions.some((a) => a.type === 'alert_owner' && a.kind === 'change_request'));
    assert.deepEqual(goals(d), ['ack_change_request']);
    assert.equal(d.pendingQuestion, null);
  });

  test('Tour 2 : confirmation par négation (« Non rien d\'autre ») → transition change_requested', () => {
    const o = standardOrder({ stage: 'lyrics_sent', revisionCount: 0, recipientNameConfirmed: true });
    const d = run(input({
      orders: [o],
      conversation: {
        ...input().conversation,
        pendingQuestion: { key: 'confirm_change_recap', orderId: o.id, asker: 'agent' },
      },
      understanding: understanding({ primaryIntent: 'confirm_no' }),
    }));
    assert.ok(hasTransition(d, 'change_requested'));
    assert.ok(d.actions.some((a) => a.type === 'revise_lyrics'));
    assert.deepEqual(goals(d), ['ack_change_request']);
  });

  test('Tour 2 avec lyricsDraft : confirmation récapitulatif → livraison paroles révisées (deliver_revised_lyrics)', () => {
    const o = standardOrder({ stage: 'lyrics_sent', revisionCount: 1, recipientNameConfirmed: true });
    const d = run(input({
      studio: studio({ caps: { ...studio().caps, lyricsDraft: true } }),
      orders: [o],
      conversation: {
        ...input().conversation,
        pendingQuestion: { key: 'confirm_change_recap', orderId: o.id, asker: 'agent' },
      },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.ok(hasTransition(d, 'change_requested'));
    assert.ok(d.actions.some((a) => a.type === 'revise_lyrics'));
    assert.ok(d.actions.some((a) => a.type === 'alert_owner' && a.kind === 'change_request'));
    assert.deepEqual(goals(d), ['deliver_revised_lyrics']);
    assert.deepEqual(steps(d), ['lyrics_delivery']);
    assert.equal(typeof d.pendingQuestion === 'object' ? d.pendingQuestion?.key : null, 'validate_lyrics');
  });

  test('Post-vocal procédure avec lyricsDraft : client dit « D\'accord » → lyrics_work_started + deliver_lyrics', () => {
    const o = standardOrder({ stage: 'brief_complete', recipientNameConfirmed: true, lyrics: null });
    const d = run(input({
      studio: studio({ caps: { ...studio().caps, lyricsDraft: true } }),
      orders: [o],
      understanding: understanding({ primaryIntent: 'acknowledgement' }),
    }));
    assert.ok(hasTransition(d, 'lyrics_work_started'));
    assert.ok(d.actions.some((a) => a.type === 'request_lyrics'));
    assert.deepEqual(goals(d), ['deliver_lyrics']);
    assert.deepEqual(steps(d), ['lyrics_delivery']);
    assert.equal(typeof d.pendingQuestion === 'object' ? d.pendingQuestion?.key : null, 'validate_lyrics');
  });

  test('Client ancien avec lyricsDraft : brief complet → deliver_lyrics direct', () => {
    const o = standardOrder({
      stage: 'collecting_brief',
      recipientNameConfirmed: false,
      catalogueCode: 'standard',
      priceXof: 3000,
      deliverable: 'audio',
      paymentPolicy: 'after_lyrics_validation',
      occasion: 'anniversaire',
      recipientName: 'Fatou',
    });
    const d = run(input({
      studio: studio({ caps: { ...studio().caps, lyricsDraft: true } }),
      contact: { deliveredOrders: 1, procedureVoiceReceived: true },
      orders: [o],
      conversation: {
        ...input().conversation,
        pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' },
      },
      understanding: understanding({ primaryIntent: 'confirm_yes' }),
    }));
    assert.ok(hasTransition(d, 'brief_completed'));
    assert.ok(hasTransition(d, 'lyrics_work_started'));
    assert.ok(d.actions.some((a) => a.type === 'request_lyrics'));
    assert.deepEqual(goals(d), ['deliver_lyrics']);
    assert.deepEqual(steps(d), ['lyrics_delivery']);
    assert.equal(typeof d.pendingQuestion === 'object' ? d.pendingQuestion?.key : null, 'validate_lyrics');
  });

  test('niveau Réception (pas de suivi des paroles) : validation enregistrée, aucun message', () => {
    const o = standardOrder({ stage: 'lyrics_sent', recipientNameConfirmed: true });
    const d = run(input({
      studio: studio({ caps: { ...studio().caps, lyricsFollowup: false } }),
      orders: [o],
      understanding: understanding({ primaryIntent: 'validate_lyrics' }),
    }));
    assert.ok(hasTransition(d, 'lyrics_validated'));
    assert.deepEqual(d.utterances, []);
  });
});

describe('decideSafely', () => {
  test('une décision saine passe telle quelle', () => {
    const { decision, violations } = decideSafely(input({ understanding: understanding({ primaryIntent: 'greeting' }) }));
    assert.deepEqual(violations, []);
    assert.ok(decision.utterances.length > 0);
  });

  test('le disjoncteur de débit coupe l\'agent (I31)', () => {
    const d = run(input({ conversation: { ...input().conversation, agentMsgsLastHour: 6 }, understanding: understanding({ primaryIntent: 'greeting' }) }));
    assert.deepEqual(d.utterances, []);
    assert.equal(acts(d, 'handoff').length, 1);
  });
});
