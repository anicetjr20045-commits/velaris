import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/domain/decide.js';
import { input, standardOrder, understanding } from './fixtures.js';
import { generateSalesReply, type SalesBrainInput } from '../src/llm/sales-brain.js';
import { runTurn, type RunTurnDeps } from '../src/queue/run-turn.js';
import type { LlmProvider, JsonCompletionRequest, JsonCompletion } from '../src/llm/provider.js';
import type { Db } from '../src/db/rest.js';

describe('Émoji ⭐ et Détection des Anciens Clients (mark_returning)', () => {
  test('decide() : contact avec isReturning: true (même avec deliveredOrders = 0) reçoit welcome_returning', () => {
    const d = decide(
      input({
        contact: { deliveredOrders: 0, isReturning: true, procedureVoiceReceived: true },
        understanding: understanding({ primaryIntent: 'greeting' }),
      })
    );
    const goals = d.utterances.map((u) => u.goal);
    assert.deepEqual(
      goals,
      ['welcome_returning', 'present_offers'],
      'Un client marqué isReturning: true doit recevoir le message welcome_returning'
    );
  });

  test('decide() : contact avec isReturning: true ne reçoit JAMAIS le vocal de procédure même brief complet', () => {
    const o = standardOrder();
    const d = decide(
      input({
        orders: [o],
        contact: { deliveredOrders: 0, isReturning: true, procedureVoiceReceived: true },
        conversation: {
          ...input().conversation,
          pendingQuestion: { key: 'confirm_recipient_name', orderId: o.id, asker: 'agent' },
        },
        understanding: understanding({ primaryIntent: 'confirm_yes' }),
      })
    );

    const hasProcedureVoice = d.actions.some((a) => a.type === 'send_procedure_voice');
    assert.equal(hasProcedureVoice, false, 'Le vocal de procédure ne doit JAMAIS être envoyé à un ancien client');
  });

  test('sales-brain : prompt injecte le statut de client récurrent et supprime le vocal de procédure', async () => {
    let capturedSystem = '';
    const mockLlm: LlmProvider = {
      name: 'mock',
      async completeJson(req: JsonCompletionRequest): Promise<JsonCompletion> {
        capturedSystem = req.system ?? '';
        return {
          data: {
            bubbles: ['Bonjour, avec plaisir pour composer à nouveau pour vous.'],
            procedure_voice: false,
            video_sample: false,
            formula_chosen: false,
            chosen_formula: null,
          },
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const inputData: SalesBrainInput = {
      turnText: 'Bonjour je reviens vers vous',
      recent: [],
      contact: {
        phone: '22507000000',
        name: 'Koffi',
        wa_jid: '22507000000@s.whatsapp.net',
        deliveredOrders: 0,
        isReturning: true,
      },
      persona: { studio_name: 'Velaris Studio', agent_name: 'Alex', manager_first_name: 'Anicet' },
      orders: [],
    };

    await generateSalesReply(mockLlm, inputData);

    assert.ok(
      capturedSystem.includes('Client récurrent / fidèle (ne pas envoyer le vocal de procédure, demander directement la formule)'),
      'Le prompt système doit catégoriser le contact comme client récurrent / fidèle'
    );
    assert.ok(
      capturedSystem.includes('Statut Note Vocale : DÉJÀ ENVOYÉE dans cette discussion'),
      'Le statut note vocale doit être DÉJÀ ENVOYÉE pour interdire tout envoi'
    );
  });

  test('runTurn() : réaction ⭐ du gérant (mark_returning) persiste ack_log, met à jour contact et ne produit aucun message sortant', async () => {
    const rpcCalls: Array<{ fn: string; args: any }> = [];
    const updateCalls: Array<{ table: string; match: string; data: any }> = [];

    const mockDb: Db = {
      async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
        rpcCalls.push({ fn, args });
        if (fn === 'agent_turn_context') {
          return {
            turn: {
              id: 'turn-star-1',
              trigger: 'merchant_reaction',
              trigger_data: { emoji: '⭐', command: 'mark_returning', reacted_key: 'msg-key-1' },
              inbound_message_ids: [],
            },
            conversation: {
              id: 'conv-star-1',
              contact_id: 'contact-star-1',
              focus_order_id: null,
              control_mode: 'human',
              control_reason: 'merchant_intervention',
              control_actor: 'merchant',
              pending_question: null,
              low_conf_streak: 0,
              repeat_question_count: 0,
              discount_requests: 0,
              ack_log: {},
            },
            persona: {
              studio_name: 'Velaris Studio',
              agent_name: 'Alex',
              manager_first_name: 'Anicet',
              cap_reception: true,
              cap_procedure_voice: true,
            },
            contact: {
              name: 'Koffi',
              phone: '22507000000',
              wa_jid: '22507000000@s.whatsapp.net',
            },
            contact_facts: {
              delivered_orders: 0,
              open_orders: 0,
              procedure_voice_received_at: null,
            },
            orders: [],
            recent: [],
            inbound: [],
            assets: [],
            handoff: null,
            catalogue: [],
            agent_msgs_last_hour: 0,
          } as unknown as T;
        }
        if (fn === 'agent_conversation_effect' || fn === 'agent_finish_turn') {
          return null as unknown as T;
        }
        return null as unknown as T;
      },
      async updateRows<T>(table: string, match: string, data: Record<string, unknown>): Promise<T> {
        updateCalls.push({ table, match, data });
        return null as unknown as T;
      },
    };

    const mockLlm: LlmProvider = {
      name: 'mock',
      async completeJson(): Promise<JsonCompletion> {
        throw new Error("LLM ne doit pas être appelé lors d'une réaction");
      },
    };

    const deps: RunTurnDeps = {
      db: mockDb,
      llmProvider: mockLlm,
      workerId: 'test-worker',
      log: () => {},
    };

    const outcome = await runTurn(deps, {
      turnId: 'turn-star-1',
      conversationId: 'conv-star-1',
      userId: 'user-1',
      lockToken: 123,
      trigger: 'merchant_reaction',
    });

    assert.equal(outcome.outcome, 'reaction_mark_returning');
    assert.equal(outcome.enqueuedIds.length, 0, 'Aucun message ne doit être envoyé au client');

    // Vérifier l'appel à agent_conversation_effect avec 'returning_client'
    const effectCall = rpcCalls.find((c) => c.fn === 'agent_conversation_effect');
    assert.ok(effectCall, 'agent_conversation_effect doit avoir été appelé');
    assert.equal(effectCall.args.p_kind, 'mark_ack');
    assert.deepEqual(effectCall.args.p_data, { key: 'returning_client' });

    // Vérifier l'appel de mise à jour sur la table contacts
    const contactUpdate = updateCalls.find((c) => c.table === 'contacts');
    assert.ok(contactUpdate, 'contacts doit être mis à jour');
    assert.equal(contactUpdate.match, 'id=eq.contact-star-1');
    assert.deepEqual(contactUpdate.data, { notes: 'returning_client' });

    // Vérifier que le tour a été clôturé avec réaction 'reaction_mark_returning'
    const finishCall = rpcCalls.find((c) => c.fn === 'agent_finish_turn');
    assert.ok(finishCall, 'agent_finish_turn doit être appelé');
    assert.equal(finishCall.args.p_outcome, 'reaction_mark_returning');
  });
});
