import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTurn, type RunTurnDeps } from '../src/queue/run-turn.js';
import type { Db } from '../src/db/rest.js';
import type { LlmProvider } from '../src/llm/provider.js';

describe('⭐ Réaction Producteur Multi-Commandes & Détection En-Tête', () => {
  it('⭐ sur Message 1 extrait l en-tete, cible Order 1 et lance la production Suno V6', async () => {
    const updateCalls: Array<{ table: string; match: string; data: any }> = [];
    const rpcCalls: Array<{ fn: string; args: any }> = [];

    const mockDb: Db = {
      async queryTable<T>(table: string, match: string): Promise<T> {
        if (table === 'messages' && match.includes('wa-key-text-1')) {
          return [
            {
              id: 'msg-uuid-1',
              body: `[Style: Afro-love doux | Voix: Masculine]
[Titre: Pour Mariam]
(Couplet 1)
Mariam, mon coeur t'appartient depuis le 12/05/2020
Appelle au 5506 pour notre amour
(Refrain)
C'est le 1er jour de notre vie !`,
              transcript: null,
            },
          ] as unknown as T;
        }
        return [] as unknown as T;
      },
      async updateRows<T>(table: string, match: string, data: Record<string, unknown>): Promise<T> {
        updateCalls.push({ table, match, data });
        return { updated: 1 } as unknown as T;
      },
      async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
        rpcCalls.push({ fn, args });
        if (fn === 'agent_turn_context') {
          return {
            turn: {
              id: 'turn-1',
              trigger: 'merchant_reaction',
              trigger_data: { emoji: '⭐', reacted_key: 'wa-key-text-1' },
              inbound_message_ids: [],
            },
            conversation: {
              id: 'conv-1',
              user_id: 'user-1',
              session_name: 'Test',
              chat_id: '22650000000@c.us',
              focus_order_id: 'order-1',
            },
            persona: {
              studio_name: 'Velaris Studio',
              reaction_commands: { '⭐': 'confirm_and_produce' },
            },
            contact: { id: 'contact-1', name: 'Mariam' },
            now: new Date().toISOString(),
            orders: [
              {
                id: 'order-1',
                stage: 'brief_complete',
                version: 1,
                lyrics: null,
                lyrics_message_id: null,
                recipient_name: 'Mariam',
              },
            ],
            recent: [],
          } as unknown as T;
        }
        if (fn === 'agent_transition_order') {
          return 'ok' as unknown as T;
        }
        if (fn === 'agent_finish_turn') {
          return 'ok' as unknown as T;
        }
        return {} as unknown as T;
      },
    };

    const mockLlm: LlmProvider = {
      name: 'mock-llm',
      async completeJson() {
        return {
          data: { voice: 'masculine', style: 'Afro-love doux' },
          model: 'test-model',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const deps: RunTurnDeps = {
      db: mockDb,
      llmProvider: mockLlm,
      workerId: 'worker-test',
      kieApiKey: 'test-kie-key',
      log: () => {},
    };

    const outcome = await runTurn(deps, {
      turnId: 'turn-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      lockToken: 1,
      trigger: 'merchant_reaction',
    });

    assert.equal(outcome.outcome, 'reaction_confirm_and_produce');

    // Vérifier la mise à jour de order-1 avec lyrics_message_id = msg-uuid-1
    const orderUpdate = updateCalls.find((c) => c.table === 'orders' && c.match === 'id=eq.order-1');
    assert.ok(orderUpdate, 'Order 1 doit être mis à jour');
    assert.equal(orderUpdate.data.lyrics_message_id, 'msg-uuid-1');
    assert.equal(orderUpdate.data.style, 'Afro-love doux');
    assert.equal(orderUpdate.data.voice, 'male');
    assert.equal(orderUpdate.data.lyrics_source, 'merchant_reaction');
    assert.ok(!orderUpdate.data.lyrics.includes('[Style:'), 'Les métadonnées doivent être retirées des paroles');

    // Vérifier la transition d'ordre vers lyrics_sent
    const transition = rpcCalls.find((c) => c.fn === 'agent_transition_order');
    assert.ok(transition, 'La commande doit progresser vers lyrics_sent');
    assert.equal(transition.args.p_event, 'lyrics_sent');
  });

  it('⭐ sur Message 2 isole la seconde commande sans contaminer la première', async () => {
    const updateCalls: Array<{ table: string; match: string; data: any }> = [];
    const rpcCalls: Array<{ fn: string; args: any }> = [];

    const mockDb: Db = {
      async queryTable<T>(table: string, match: string): Promise<T> {
        if (table === 'messages' && match.includes('wa-key-text-2')) {
          return [
            {
              id: 'msg-uuid-2',
              body: `[Style: Coupé-décalé | Voix: Féminine]
[Titre: Ambiance Koumassi]
(Couplet 1)
Ce soir on danse et on s'enjaille
(Refrain)
Coupé décalé pour toujours !`,
              transcript: null,
            },
          ] as unknown as T;
        }
        return [] as unknown as T;
      },
      async updateRows<T>(table: string, match: string, data: Record<string, unknown>): Promise<T> {
        updateCalls.push({ table, match, data });
        return { updated: 1 } as unknown as T;
      },
      async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
        rpcCalls.push({ fn, args });
        if (fn === 'agent_turn_context') {
          return {
            turn: {
              id: 'turn-2',
              trigger: 'merchant_reaction',
              trigger_data: { emoji: '⭐', reacted_key: 'wa-key-text-2' },
              inbound_message_ids: [],
            },
            conversation: {
              id: 'conv-1',
              user_id: 'user-1',
              session_name: 'Test',
              chat_id: '22650000000@c.us',
              focus_order_id: 'order-1',
            },
            persona: {
              studio_name: 'Velaris Studio',
              reaction_commands: { '⭐': 'confirm_and_produce' },
            },
            contact: { id: 'contact-1', name: 'Mariam' },
            now: new Date().toISOString(),
            // Order 1 a DÉJÀ son texte et sa production
            orders: [
              {
                id: 'order-1',
                stage: 'lyrics_sent',
                version: 2,
                lyrics: 'Paroles Chanson 1',
                lyrics_message_id: 'msg-uuid-1',
                style: 'Afro-love doux',
                voice: 'male',
              },
              {
                id: 'order-2',
                stage: 'brief_complete',
                version: 1,
                lyrics: null,
                lyrics_message_id: null,
              },
            ],
            recent: [],
          } as unknown as T;
        }
        if (fn === 'agent_transition_order') return 'ok' as unknown as T;
        if (fn === 'agent_finish_turn') return 'ok' as unknown as T;
        return {} as unknown as T;
      },
    };

    const mockLlm: LlmProvider = {
      name: 'mock-llm',
      async completeJson() {
        return {
          data: { voice: 'féminine', style: 'Coupé-décalé' },
          model: 'test-model',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const deps: RunTurnDeps = {
      db: mockDb,
      llmProvider: mockLlm,
      workerId: 'worker-test',
      kieApiKey: 'test-kie-key',
      log: () => {},
    };

    const outcome = await runTurn(deps, {
      turnId: 'turn-2',
      conversationId: 'conv-1',
      userId: 'user-1',
      lockToken: 1,
      trigger: 'merchant_reaction',
    });

    assert.equal(outcome.outcome, 'reaction_confirm_and_produce');

    // Vérifier que c'est bien ORDER-2 qui a été ciblé, et NON ORDER-1 !
    const order2Update = updateCalls.find((c) => c.table === 'orders' && c.match === 'id=eq.order-2');
    assert.ok(order2Update, 'Order 2 doit être ciblé pour le second texte');
    assert.equal(order2Update.data.lyrics_message_id, 'msg-uuid-2');
    assert.equal(order2Update.data.style, 'Coupé-décalé');
    assert.equal(order2Update.data.voice, 'female');

    // Vérifier qu'Order 1 n'a absolument pas été altéré
    const order1Update = updateCalls.find((c) => c.table === 'orders' && c.match === 'id=eq.order-1');
    assert.equal(order1Update, undefined, 'Order 1 ne doit jamais être touché par la réaction sur le texte 2');
  });
});
