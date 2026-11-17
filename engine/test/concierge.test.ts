import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DJELIA_CONCIERGE_SYSTEM_PROMPT,
  generateConciergeReply,
  resolveCountryFromPhone,
  compressRecentHistory,
} from '../src/llm/concierge-brain.js';
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
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('20%'));
  });

  it('resolveCountryFromPhone détecte avec précision le pays et les moyens de paiement Chariow', () => {
    const cm = resolveCountryFromPhone('237690123456@c.us');
    assert.equal(cm.code, 'CM');
    assert.equal(cm.name, 'Cameroun');
    assert.ok(cm.methods.includes('MTN Mobile Money'));
    assert.ok(cm.methods.includes('Orange Money Cameroun'));

    const ci = resolveCountryFromPhone('+2250701020304');
    assert.equal(ci.code, 'CI');
    assert.equal(ci.name, 'Côte d\'Ivoire');
    assert.ok(ci.methods.includes('Wave'));
    assert.ok(ci.methods.includes('Orange Money'));

    const bf = resolveCountryFromPhone('22670000000');
    assert.equal(bf.code, 'BF');
    assert.equal(bf.name, 'Burkina Faso');
    assert.ok(bf.methods.includes('Orange Money'));
    assert.ok(bf.methods.includes('Moov Money'));

    const fr = resolveCountryFromPhone('+33612345678');
    assert.equal(fr.code, 'FR');
    assert.ok(fr.methods.includes('Carte bancaire'));
  });

  it('compressRecentHistory compresse intelligemment les longues discussions (> 6 messages)', () => {
    const shortHistory = [
      { role: 'user' as const, content: 'Bonjour' },
      { role: 'assistant' as const, content: 'Bienvenue sur Djélia' },
    ];
    const shortCompressed = compressRecentHistory(shortHistory);
    assert.equal(shortCompressed.length, 2);

    const longHistory = [
      { role: 'user' as const, content: 'Bonjour je veux une chanson' },
      { role: 'assistant' as const, content: 'Voici le lien du studio' },
      { role: 'user' as const, content: 'Je suis au Cameroun' },
      { role: 'assistant' as const, content: 'Le paiement MTN et Orange est disponible' },
      { role: 'user' as const, content: 'C est pour mon mariage' },
      { role: 'assistant' as const, content: 'Très bon choix' },
      { role: 'user' as const, content: 'Comment écouter ?' },
      { role: 'assistant' as const, content: 'Vous lisez les paroles en direct' },
      { role: 'user' as const, content: 'Question finale sur le prix' },
    ];

    const compressed = compressRecentHistory(longHistory);
    // Doit contenir 1 message de synthèse condensée + les 4 derniers messages récents = 5 messages
    assert.equal(compressed.length, 5);
    assert.ok(compressed[0]!.content.includes('Historique condensé'));
    assert.equal(compressed[compressed.length - 1]!.content, 'Question finale sur le prix');
  });

  it('generateConciergeReply injecte les paiements locaux du Cameroun et nettoie les émojis', async () => {
    let capturedSystem = '';
    const mockLlm = {
      completeJson: async (req: any) => {
        capturedSystem = req.system;
        return {
          data: {
            reply: '✨ Au Cameroun, vous pouvez payer par MTN Mobile Money ou Orange Money sur https://djelia.store/studio.html . 🎵',
          },
        };
      },
    } as any;

    const reply = await generateConciergeReply(mockLlm, {
      incomingMessage: 'Comment je paye depuis Douala ?',
      phone: '237690000000',
    });

    assert.ok(capturedSystem.includes('Cameroun'));
    assert.ok(capturedSystem.includes('MTN Mobile Money'));
    assert.doesNotMatch(reply, /[\u{1F300}-\u{1F9FF}]/u);
    assert.ok(reply.includes('MTN Mobile Money'));
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
      queryTable: async (table: string, ..._args: unknown[]) => {
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
    assert.equal(res.reason, 'contact_marked_returning');
    assert.equal(sentMessages.length, 0, 'Aucun message ne doit être envoyé à un ancien client');
  });

  it('Un contact historique (first_seen_at avant la campagne) est détecté comme ancien et bloqué', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string, ..._args: unknown[]) => {
        if (table === 'contacts') {
          return [{
            id: 'contact-ancient',
            phone: '22670001122',
            is_returning: false,
            first_seen_at: '2026-10-15T10:00:00Z', // bien avant la campagne
          }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-ancient', control_mode: 'ai', ack_log: {} }];
        }
        return [];
      },
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      campaignStartDateIso: '2026-11-17T12:00:00Z',
    });

    const ev = makeMockMessage({
      chatId: '22670001122@c.us',
      body: 'Salut',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, false);
    assert.equal(res.reason, 'contact_first_seen_before_campaign');
    assert.equal(sentMessages.length, 0);
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
      queryTable: async (table: string, ..._args: unknown[]) => {
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
    assert.equal(res.reason, 'has_prior_orders');
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
      queryTable: async (table: string, ..._args: unknown[]) => {
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

  it('Lead en cours : temporisation humaine, regroupement de rafales et réponse consolidée', async () => {
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

    let receivedUserText = '';
    const mockLlm = {
      completeJson: async (req: any) => {
        receivedUserText = req.messages[req.messages.length - 1].content;
        return {
          data: {
            reply: 'Vous pouvez payer par MTN Mobile Money ou Orange Money directement lors de la commande.',
          },
        };
      },
    } as any;

    const mockDb = {
      queryTable: async (table: string, queryParams: string = '') => {
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
          if (queryParams.includes('created_at=lt')) return [];
          return [{ role: 'assistant', body: 'Lien studio : https://djelia.store/studio.html' }];
        }
        return [];
      },
      insertRow: async () => ({ id: 'new-msg' }),
      updateRows: async () => [],
      rpc: async () => null,
    } as any;

    // Délais raccourcis pour le test unitaire (80ms et 30ms)
    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: mockLlm,
      delayMs: 80,
      typingDelayMs: 30,
    });

    // Message 1 de la rafale
    await concierge.handleEvent(makeMockMessage({
      chatId: '23760000000@c.us',
      body: 'Comment payer par MTN au Cameroun ?',
      pushName: 'Junior',
    }));

    // Message 2 envoyé 20ms plus tard dans la même fenêtre
    await new Promise((r) => setTimeout(r, 20));
    await concierge.handleEvent(makeMockMessage({
      chatId: '23760000000@c.us',
      body: 'Et est-ce que c est sécurisé ?',
      pushName: 'Junior',
    }));

    // Attendre que la temporisation s'exécute
    await new Promise((r) => setTimeout(r, 120));

    assert.ok(typingCalls.includes(true), 'L\'indicateur de frappe typing doit être déclenché');
    assert.equal(sentMessages.length, 1, 'Une seule réponse consolidée doit être expédiée pour la rafale');
    assert.ok(receivedUserText.includes('Comment payer par MTN au Cameroun ?'));
    assert.ok(receivedUserText.includes('Et est-ce que c est sécurisé ?'));
    assert.equal(sentMessages[0].kind, 'text');
    assert.ok(sentMessages[0].text.includes('MTN Mobile Money'));
  });

  it('Capture d écran reçue : l analyse visuelle multimodale est intégrée dans la compréhension de l IA', async () => {
    let capturedIncomingText = '';
    const mockLlm = {
      completeJson: async (req: any) => {
        capturedIncomingText = req.messages[req.messages.length - 1].content;
        return {
          data: {
            reply: 'D après votre capture, vous êtes à l étape des paroles. Cliquez sur Continuer pour choisir le style musical.',
          },
        };
      },
    } as any;

    const mockDb = {
      queryTable: async (table: string, queryParams: string = '') => {
        if (table === 'contacts') return [{ id: 'contact-vis', phone: '22501020304', is_returning: false }];
        if (table === 'conversations') return [{ id: 'conv-vis', user_id: 'u-1', ack_log: { concierge_onboarding_sent: true } }];
        if (table === 'messages' && queryParams.includes('created_at=lt')) return [];
        return [];
      },
      insertRow: async () => ({ id: 'msg-vis' }),
      updateRows: async () => [],
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: { send: async () => ({ status: 'sent' }), typing: async () => {} } as any,
      llmProvider: mockLlm,
      kieApiKey: 'test-key',
      delayMs: 50,
      typingDelayMs: 20,
    });

    // Mock du downloadMedia pour simuler le téléchargement de l'image
    concierge.downloadMedia = async () => Buffer.from('fake-image-bytes');

    // On passe un événement avec mediaKind = 'image'
    await concierge.handleEvent(makeMockMessage({
      chatId: '22501020304@c.us',
      mediaKind: 'image',
      mediaUrl: 'http://waha:3000/api/files/screenshot.jpg',
      body: 'Je suis bloqué ici',
    }));

    await new Promise((r) => setTimeout(r, 80));

    // Vérifie que le tour a bien été planifié et que le texte a été injecté
    assert.ok(capturedIncomingText.includes('Je suis bloqué ici'));
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
      queryTable: async (table: string, ..._args: unknown[]) => {
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

  it('Nouveau lead avec question directe : ne balance PAS la vidéo, bascule en support conseiller', async () => {
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
      queryTable: async (table: string, ..._args: unknown[]) => {
        if (table === 'contacts') {
          return [{ id: 'contact-direct-q', name: 'Alain', phone: '23769900000', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-direct-q', user_id: 'user-1', control_mode: 'ai', ack_log: {} }];
        }
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
      delayMs: 150,
      typingDelayMs: 50,
    });

    const ev = makeMockMessage({
      chatId: '23769900000@c.us',
      body: 'Bonjour, vous êtes situés dans quel pays ?',
      pushName: 'Alain',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'support_scheduled_direct_question');

    // Aucune vidéo balancée à l'accueil
    assert.equal(sentMessages.length, 0, 'La vidéo ne doit PAS être balancée sur une question directe');
    assert.equal(updatedAckLog.video_tutorial_sent, false);
    assert.equal(updatedAckLog.concierge_onboarding_sent, true);
  });

  it('Envoi de la vidéo au moment opportun (demande procédure) et verrou d\'unicité (jamais 2 fois)', async () => {
    const sentMessages: any[] = [];
    let ackLogStore: any = { concierge_onboarding_sent: true, video_tutorial_sent: false };

    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-supp', waKey: 'key-supp' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string, queryParams: string) => {
        if (table === 'contacts') {
          return [{ id: 'contact-proc', name: 'Fatou', phone: '22507001122', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-proc', user_id: 'user-1', control_mode: 'ai', ack_log: ackLogStore }];
        }
        if (table === 'messages' && queryParams.includes('created_at=lt')) return [];
        return [];
      },
      updateRows: async (_table: string, _match: string, data: any) => {
        ackLogStore = { ...ackLogStore, ...(data.ack_log || {}) };
        return [data];
      },
      insertRow: async () => ({ id: 'msg-1' }),
      rpc: async () => null,
    } as any;

    const mockLlm = {
      completeJson: async () => ({
        data: { reply: 'Voici comment procéder sur notre studio en ligne.' },
        model: 'deepseek-v4-1-flash',
        usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
        latencyMs: 10,
        attempts: 1,
      }),
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: mockLlm,
      delayMs: 60,
      typingDelayMs: 20,
    });

    // 1. Le client demande comment commander
    const ev1 = makeMockMessage({
      chatId: '22507001122@c.us',
      body: 'Comment on fait pour commander ?',
    });
    await concierge.handleEvent(ev1);

    // Attendre l'exécution
    await new Promise((r) => setTimeout(r, 150));

    // Doit avoir envoyé la vidéo puis la réponse texte
    const videoMessages1 = sentMessages.filter((m) => m.kind === 'video');
    assert.equal(videoMessages1.length, 1, 'La vidéo doit être envoyée quand le client demande comment commander');
    assert.equal(ackLogStore.video_tutorial_sent, true, 'Le verrou d\'unicité de la vidéo doit être activé');

    // 2. Le client redemande comment faire plus tard
    const ev2 = makeMockMessage({
      chatId: '22507001122@c.us',
      body: 'Rappelez-moi comment composer svp ?',
    });
    await concierge.handleEvent(ev2);

    await new Promise((r) => setTimeout(r, 150));

    // La vidéo ne doit PAS avoir été renvoyée une 2ème fois !
    const videoMessages2 = sentMessages.filter((m) => m.kind === 'video');
    assert.equal(videoMessages2.length, 1, 'La vidéo ne doit JAMAIS être envoyée deux fois');
  });
});
