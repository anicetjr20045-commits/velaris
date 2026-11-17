import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DJELIA_CONCIERGE_SYSTEM_PROMPT, generateConciergeReply } from '../src/llm/concierge-brain.js';
import { ConciergeService } from '../src/services/concierge-service.js';
import type { MessageEvent } from '../src/ingest/normalize.js';

function makeMockMessage(overrides: Partial<MessageEvent> = {}): MessageEvent {
  return {
    kind: 'message',
    session: 'Test',
    chatId: '22650000000@c.us',
    fromMe: false,
    source: 'app',
    waMessageId: 'msg-id',
    waKey: 'key-id',
    waTimestamp: new Date().toISOString(),
    body: 'Test message',
    bodyHash: null,
    mediaKind: null,
    mediaUrl: null,
    mediaMime: null,
    pushName: 'Client',
    dedupKey: 'dedup-id',
    ...overrides,
  };
}

describe('Concierge Djélia 24/7 (Web-First & Support)', () => {
  it('DJELIA_CONCIERGE_SYSTEM_PROMPT respecte la règle de concision (< 60 lignes) et zéro émoji', () => {
    const lines = DJELIA_CONCIERGE_SYSTEM_PROMPT.split('\n');
    assert.ok(lines.length <= 60, `Prompt trop long : ${lines.length} lignes`);
    assert.doesNotMatch(DJELIA_CONCIERGE_SYSTEM_PROMPT, /[\u{1F300}-\u{1F9FF}]/u, 'Le prompt ne doit contenir aucun émoji');
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('djelia.store/studio.html'));
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('1 200 F CFA'));
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('Wave'));
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('MTN Mobile Money'));
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('20%'));
  });

  it('generateConciergeReply nettoie impitoyablement les émojis et renvoie 1-2 phrases sobres', async () => {
    const mockLlm = {
      completeJson: async () => ({
        data: {
          reply: '✨ Vous pouvez composer vos paroles sur https://djelia.store/studio.html 🎉. Nous sommes là si vous avez besoin d\'aide ! 🎵',
        },
      }),
    } as any;

    const reply = await generateConciergeReply(mockLlm, {
      incomingMessage: 'Comment je fais pour commander ?',
    });

    assert.doesNotMatch(reply, /[\u{1F300}-\u{1F9FF}]/u);
    assert.ok(reply.includes('djelia.store/studio.html'));
  });

  it('Isolation absolue : un ancien client (is_returning = true) n\'est JAMAIS touché par le concierge', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-1', waKey: 'key-1' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') {
          return [{ id: 'contact-old', name: 'Oumar', phone: '22650000001', is_returning: true }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-old', user_id: 'user-1', control_mode: 'ai', ack_log: {} }];
        }
        return [];
      },
      updateRows: async () => [],
      rpc: async () => null,
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      protectedSessions: ['anicet2'],
    });

    const ev = makeMockMessage({
      chatId: '22650000001@c.us',
      body: 'Bonjour je veux commander',
      pushName: 'Oumar',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, false);
    assert.equal(res.reason, 'returning_client');
    assert.equal(sentMessages.length, 0, 'Aucun message ne doit être envoyé à un ancien client');
  });

  it('Un contact ayant des commandes existantes n\'est JAMAIS touché par le concierge', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-1', waKey: 'key-1' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') {
          return [{ id: 'contact-with-order', name: 'Awa', phone: '22501020304', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-1', user_id: 'user-1', control_mode: 'ai', ack_log: {} }];
        }
        if (table === 'orders') {
          return [{ id: 'order-1', stage: 'delivered' }];
        }
        return [];
      },
      updateRows: async () => [],
      rpc: async () => null,
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
    });

    const ev = makeMockMessage({
      chatId: '22501020304@c.us',
      body: 'Bonsoir',
      pushName: 'Awa',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, false);
    assert.equal(res.reason, 'has_orders');
    assert.equal(sentMessages.length, 0);
  });

  it('Nouveau lead : expédie la note vocale d\'accueil, la vidéo et le texte avec lien studio web', async () => {
    const sentMessages: any[] = [];
    let updatedAckLog: any = null;

    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-pack', waKey: 'key-pack' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') {
          return [{ id: 'contact-new', name: 'Moussa', phone: '22507000000', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-new', user_id: 'user-1', control_mode: 'ai', ack_log: {} }];
        }
        if (table === 'orders') return [];
        return [];
      },
      updateRows: async (_table: string, _match: string, data: any) => {
        updatedAckLog = data.ack_log;
        return [data];
      },
      rpc: async () => null,
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
    });

    const ev = makeMockMessage({
      chatId: '22507000000@c.us',
      body: 'Bonjour je viens pour la chanson de mariage',
      pushName: 'Moussa',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'onboarding_pack_sent');

    assert.equal(sentMessages.length, 3);
    assert.equal(sentMessages[0].kind, 'voice');
    assert.ok(sentMessages[0].url.includes('vocal_accueil_concierge.opus'));

    assert.equal(sentMessages[1].kind, 'video');
    assert.ok(sentMessages[1].url.includes('djelia_tuto_mobile.mp4'));

    assert.equal(sentMessages[2].kind, 'text');
    assert.ok(sentMessages[2].text.includes('https://djelia.store/studio.html'));

    assert.equal(updatedAckLog.concierge_onboarding_sent, true);
  });

  it('Lead en cours : temporisation humaine et indicateur typing avant envoi de la réponse support', async () => {
    const sentMessages: any[] = [];
    const typingCalls: boolean[] = [];

    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-ans', waKey: 'key-ans' };
      },
      typing: async (_session: string, _chatId: string, state: boolean) => {
        typingCalls.push(state);
      },
    } as any;

    const mockLlm = {
      completeJson: async () => ({
        data: {
          reply: 'Vous pouvez payer par MTN Mobile Money ou Orange Money directement lors de la commande.',
        },
      }),
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') {
          return [{ id: 'contact-cam', name: 'Junior', phone: '23760000000', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{
            id: 'conv-cam',
            user_id: 'user-1',
            control_mode: 'ai',
            ack_log: { concierge_onboarding_sent: true },
          }];
        }
        if (table === 'messages') {
          return [{ role: 'assistant', body: 'Lien studio : https://djelia.store/studio.html' }];
        }
        return [];
      },
      insertRow: async () => ({ id: 'new-msg' }),
      updateRows: async () => [],
      rpc: async () => null,
    } as any;

    // Délais courts pour le test unitaire (50ms et 20ms)
    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: mockLlm,
      delayMs: 60,
      typingDelayMs: 20,
    });

    const ev = makeMockMessage({
      chatId: '23760000000@c.us',
      body: 'Comment payer par MTN au Cameroun ?',
      pushName: 'Junior',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'support_scheduled');

    // Attendre que la temporisation s'exécute
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(typingCalls.includes(true), 'L\'indicateur de frappe typing doit être déclenché');
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].kind, 'text');
    assert.ok(sentMessages[0].text.includes('MTN Mobile Money'));
  });

  it('Intervention du gérant : annule immédiatement tout tour de support en attente', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async () => {
        sentMessages.push('should_not_be_called');
        return { status: 'sent' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') {
          return [{ id: 'contact-1', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-1', ack_log: { concierge_onboarding_sent: true } }];
        }
        return [];
      },
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      delayMs: 150,
      typingDelayMs: 50,
    });

    // 1. Message client
    await concierge.handleEvent(makeMockMessage({
      chatId: '22501000000@c.us',
      fromMe: false,
      body: 'Je ne comprends pas',
    }));

    // 2. Le gérant intervient immédiatement depuis son téléphone
    await concierge.handleEvent(makeMockMessage({
      chatId: '22501000000@c.us',
      fromMe: true,
      body: 'Bonjour je m en occupe',
      source: 'app',
    }));

    // 3. Attendre la fin du délai initial
    await new Promise((r) => setTimeout(r, 200));

    assert.equal(sentMessages.length, 0, 'Aucun message automatique ne doit être envoyé après intervention du gérant');
  });
});
