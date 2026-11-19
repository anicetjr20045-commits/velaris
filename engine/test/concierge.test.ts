import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DJELIA_CONCIERGE_SYSTEM_PROMPT,
  generateConciergeReply,
  resolveCountryFromPhone,
  compressRecentHistory,
  extractCleanPhone,
  isBurkinaFasoNumber,
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
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('djelia.store'));
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('1 200 francs'));
    assert.ok(!DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('3 500'));
    assert.ok(!DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('FCFA'));
    assert.ok(DJELIA_CONCIERGE_SYSTEM_PROMPT.includes('25%'));
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
            reply: '✨ Au Cameroun, vous pouvez payer par MTN Mobile Money ou Orange Money sur https://djelia.store . 🎵',
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
    assert.ok(reply.includes('djelia.store'));
  });

  it('extractCleanPhone extrait fidèlement les chiffres sur tous les formats WhatsApp', () => {
    assert.equal(extractCleanPhone('22670112233@c.us'), '22670112233');
    assert.equal(extractCleanPhone('22670112233:1@c.us'), '22670112233');
    assert.equal(extractCleanPhone('22670112233:2@s.whatsapp.net'), '22670112233');
    assert.equal(extractCleanPhone('+226 70 11 22 33'), '22670112233');
    assert.equal(extractCleanPhone('0022670112233'), '22670112233');
    assert.equal(extractCleanPhone('+237 699 11 22 33'), '237699112233');
    assert.equal(extractCleanPhone('225 07 08 09 10 11'), '2250708091011');
    assert.equal(extractCleanPhone(''), '');
    assert.equal(extractCleanPhone(null), '');
  });

  it('isBurkinaFasoNumber détecte de façon déterministe les numéros burkinabés (+226 et 8 chiffres locaux)', () => {
    // Avec indicatif international 226
    assert.equal(isBurkinaFasoNumber('22670112233@c.us'), true);
    assert.equal(isBurkinaFasoNumber('22676001122:1@c.us'), true);
    assert.equal(isBurkinaFasoNumber('+226 78 00 11 22'), true);
    assert.equal(isBurkinaFasoNumber('0022670112233'), true);

    // Format local 8 chiffres (Moov, Orange, Telecel, Fixes)
    assert.equal(isBurkinaFasoNumber('70112233'), true); // Moov
    assert.equal(isBurkinaFasoNumber('07112233'), true); // Orange
    assert.equal(isBurkinaFasoNumber('78112233'), true); // Telecel
    assert.equal(isBurkinaFasoNumber('25301122'), true); // Fixe Ouaga

    // Numéros d'autres pays (hors Burkina Faso)
    assert.equal(isBurkinaFasoNumber('237690123456@c.us'), false); // Cameroun
    assert.equal(isBurkinaFasoNumber('2250701020304@c.us'), false); // Côte d'Ivoire
    assert.equal(isBurkinaFasoNumber('221770001122@c.us'), false); // Sénégal
    assert.equal(isBurkinaFasoNumber('+33612345678'), false); // France
    assert.equal(isBurkinaFasoNumber('+14155552671'), false); // USA
  });

  it('Règle inviolable Burkina Faso : tout numéro Burkinabé (+226) nouveau ou ancien est confié 100% au gérant humain', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-1', waKey: 'key-1' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async () => [],
      updateRows: async () => [],
      rpc: async () => null,
    } as any;

    // Délai suffisant pour permettre l'intervention du gérant
    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      delayMs: 100,
      typingDelayMs: 40,
    });

    // 1. Nouveau contact burkinabé
    const evNew = makeMockMessage({
      chatId: '22670112233@c.us',
      body: 'Bonjour je veux composer une chanson',
    });
    const resNew = await concierge.handleEvent(evNew);
    assert.equal(resNew.handled, false);
    assert.equal(resNew.reason, 'burkina_faso_manual_handling');
    assert.equal(sentMessages.length, 0, 'Aucun automate ne doit répondre à un Burkinabé');

    // 2. Ancien contact burkinabé
    const evOld = makeMockMessage({
      chatId: '22676000000@c.us',
      body: 'Salut c est encore moi',
    });
    const resOld = await concierge.handleEvent(evOld);
    assert.equal(resOld.handled, false);
    assert.equal(resOld.reason, 'burkina_faso_manual_handling');
    assert.equal(sentMessages.length, 0);
  });

  it('Règle Burkina Faso sur fiche contact : si le numéro en base est burkinabé, le concierge se tait immédiatement', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async () => ({ status: 'sent' }),
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') {
          return [{ id: 'c-bf', name: 'Issa', phone: '70112233', wa_jid: 'some-jid@c.us' }];
        }
        return [];
      },
      updateRows: async () => [],
    } as any;

    // Délai suffisant pour permettre l'intervention du gérant
    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      delayMs: 100,
      typingDelayMs: 40,
    });

    const ev = makeMockMessage({
      chatId: 'some-jid@c.us',
      body: 'Bonjour',
    });
    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, false);
    assert.equal(res.reason, 'burkina_faso_manual_handling');
    assert.equal(sentMessages.length, 0);
  });

  it('Isolation absolue : un ancien client hors Burkina Faso (is_returning = true) n\'est JAMAIS touché par le concierge', async () => {
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
          return [{ id: 'contact-old', name: 'Oumar', phone: '22507000001', is_returning: true }];
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
      chatId: '22507000001@c.us',
      body: 'Bonjour je veux commander',
      pushName: 'Oumar',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, false);
    assert.equal(res.reason, 'contact_marked_returning');
    assert.equal(sentMessages.length, 0, 'Aucun message ne doit être envoyé à un ancien client');
  });

  it('Un contact historique hors Burkina (créé avant la campagne) est détecté comme ancien et bloqué', async () => {
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
            phone: '237690001122',
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
      chatId: '237690001122@c.us',
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

    // Délai suffisant pour permettre l'intervention du gérant
    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      delayMs: 100,
      typingDelayMs: 40,
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

  it('Nouveau lead : expédie le pack d\'accueil complet (vocal d\'accueil + vidéo tutoriel + texte studio)', async () => {
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
      delayMs: 0,
      typingDelayMs: 0,
    });

    const ev = makeMockMessage({
      chatId: '22507000000@c.us',
      body: 'Bonjour je viens pour la chanson de mariage',
      pushName: 'Moussa',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'onboarding_welcome_pack_sent');

    // Pack onboarding en 3 volets : Vocal -> Vidéo -> Texte & Studio
    assert.equal(sentMessages.length, 3);
    assert.equal(sentMessages[0].kind, 'voice');
    assert.ok(sentMessages[0].url.includes('vocal_accueil_concierge.opus'));
    assert.equal(sentMessages[1].kind, 'video');
    assert.ok(sentMessages[1].url.includes('djelia_tuto_mobile.mp4'));
    assert.equal(sentMessages[2].kind, 'text');
    assert.ok(sentMessages[2].text.includes('djelia.store'));

    assert.equal(updatedAckLog.concierge_onboarding_sent, true);
    assert.equal(updatedAckLog.video_tutorial_sent, true);
    assert.equal(updatedAckLog.onboarding_type, 'welcome');
  });

  it('Numéro de test (+226 05777308) : active le mode test /test, réinitialise avec /reset et stoppe avec /stop', async () => {
    const sentMessages: any[] = [];
    let deletedTable: string[] = [];

    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-test', waKey: 'key-test' };
      },
      typing: async () => {},
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') return [{ id: 'c-test', phone: '22605777308' }];
        if (table === 'conversations') return [{ id: 'conv-test', ack_log: {} }];
        return [];
      },
      deleteRows: async (table: string) => {
        deletedTable.push(table);
        return [];
      },
      updateRows: async () => [{}],
      rpc: async () => null,
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      delayMs: 0,
      typingDelayMs: 0,
    });

    const testChatId = '22605777308@c.us';

    // 1. Commande /test (active Cameroun +237 par défaut)
    const evTest = makeMockMessage({
      chatId: testChatId,
      body: '/test',
    });
    const resTest = await concierge.handleEvent(evTest);
    assert.equal(resTest.handled, true);
    assert.equal(resTest.action, 'test_mode_activated_237');
    assert.ok(sentMessages[sentMessages.length - 1].text.includes('MODE TEST ACTIVÉ'));
    assert.ok(sentMessages[sentMessages.length - 1].text.includes('Cameroun (+237)'));
    assert.ok(deletedTable.includes('messages'));

    // 2. Message de salutation "Bonjour" : ne doit PAS être bloqué par la règle Burkina Faso (+226)
    sentMessages.length = 0;
    const evGreeting = makeMockMessage({
      chatId: testChatId,
      body: 'Bonjour',
    });
    const resGreeting = await concierge.handleEvent(evGreeting);
    assert.equal(resGreeting.handled, true);
    assert.equal(resGreeting.action, 'onboarding_welcome_pack_sent');
    assert.equal(sentMessages.length, 3);
    assert.equal(sentMessages[0].kind, 'voice');
    assert.equal(sentMessages[1].kind, 'video');
    assert.equal(sentMessages[2].kind, 'text');

    // 3. Commande /reset
    sentMessages.length = 0;
    deletedTable.length = 0;
    const evReset = makeMockMessage({
      chatId: testChatId,
      body: '/reset',
    });
    const resReset = await concierge.handleEvent(evReset);
    assert.equal(resReset.handled, true);
    assert.equal(resReset.action, 'test_conversation_reset');
    assert.ok(sentMessages[0].text.includes('CONVERSATION RÉINITIALISÉE'));
    assert.ok(deletedTable.includes('messages'));

    // 4. Commande /stop
    sentMessages.length = 0;
    const evStop = makeMockMessage({
      chatId: testChatId,
      body: '/stop',
    });
    const resStop = await concierge.handleEvent(evStop);
    assert.equal(resStop.handled, true);
    assert.equal(resStop.action, 'test_mode_deactivated');
    assert.ok(sentMessages[0].text.includes('MODE TEST DÉSACTIVÉ'));

    // 5. Message après /stop : le numéro redevient bloqué par la règle 100% gérant humain (+226)
    const evAfterStop = makeMockMessage({
      chatId: testChatId,
      body: 'Rebonjour',
    });
    const resAfterStop = await concierge.handleEvent(evAfterStop);
    assert.equal(resAfterStop.handled, false);
    assert.equal(resAfterStop.reason, 'burkina_faso_manual_handling');
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
          return [{ role: 'assistant', body: 'Lien site officiel : https://djelia.store' }];
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

    // Délai suffisant pour permettre l'intervention du gérant
    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
      delayMs: 100,
      typingDelayMs: 40,
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

  it('Message d accueil automatique WhatsApp Business : ignoré et ne débraye PAS le concierge', async () => {
    let merchantIntervened = false;
    const mockWaha = {
      send: async () => ({ status: 'sent' }),
      typing: async () => {},
    } as any;
    const mockDb = {
      updateRows: async () => {},
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: {} as any,
    });
    concierge.handleMerchantIntervention = async () => {
      merchantIntervened = true;
    };

    const res = await concierge.handleEvent(makeMockMessage({
      chatId: '22501000000@c.us',
      fromMe: true,
      body: 'Bonjour ! Dites-nous comment nous pouvons vous aider.',
      source: null,
    }));

    assert.equal(res.handled, false);
    assert.equal(res.reason, 'whatsapp_business_auto_greeting_ignored');
    assert.equal(merchantIntervened, false, 'Le message d accueil automatique ne doit PAS débrayer le concierge');
  });

  it('Nouveau lead avec question directe de prix : expédie le pack adapté (vocal prix + vidéo tutoriel + texte tarifaire & studio)', async () => {
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
          return [{ id: 'contact-direct-price', name: 'Alain', phone: '23769900000', is_returning: false }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-direct-price', user_id: 'user-1', control_mode: 'ai', ack_log: {} }];
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
      delayMs: 0,
      typingDelayMs: 0,
    });

    const ev = makeMockMessage({
      chatId: '23769900000@c.us',
      body: 'C\'est combien pour faire une chanson ?',
      pushName: 'Alain',
    });

    const res = await concierge.handleEvent(ev);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'onboarding_price_pack_sent');

    // 3 messages dans l'ordre : Vocal Prix -> Vidéo -> Texte & Tarifs
    assert.equal(sentMessages.length, 3);
    assert.equal(sentMessages[0].kind, 'voice');
    assert.ok(sentMessages[0].url.includes('vocal_prix_concierge.opus'));
    assert.equal(sentMessages[1].kind, 'video');
    assert.ok(sentMessages[1].url.includes('djelia_tuto_mobile.mp4'));
    assert.equal(sentMessages[2].kind, 'text');
    assert.ok(sentMessages[2].text.includes('1 200 francs'));
    assert.ok(sentMessages[2].text.includes('djelia.store'));

    assert.equal(updatedAckLog.concierge_onboarding_sent, true);
    assert.equal(updatedAckLog.video_tutorial_sent, true);
    assert.equal(updatedAckLog.onboarding_type, 'price');
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

  it('Support : découpage en 2 bulles si "---" est présent avec pause naturelle', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent', waMessageId: 'wa-1' };
      },
      typing: async () => {},
    } as any;

    const mockLlm = {
      completeJson: async () => ({
        data: { reply: 'Voici la première explication détaillée.\n---\nEt voici la deuxième bulle de conseil.' },
      }),
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') return [{ id: 'c-1', phone: '23769000000', is_returning: false }];
        if (table === 'conversations') return [{ id: 'conv-1', ack_log: { concierge_onboarding_sent: true, video_tutorial_sent: true } }];
        return [];
      },
      insertRow: async () => ({ id: 'msg-1' }),
      updateRows: async () => [],
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: mockLlm,
      delayMs: 20,
      typingDelayMs: 5,
    });

    await concierge.handleEvent(makeMockMessage({
      chatId: '23769000000@c.us',
      body: 'Quels sont vos styles musicaux ?',
    }));

    await new Promise((r) => setTimeout(r, 1600));

    assert.equal(sentMessages.length, 2, 'Deux bulles doivent être expédiées séparément');
    assert.equal(sentMessages[0].text, 'Voici la première explication détaillée.');
    assert.equal(sentMessages[1].text, 'Et voici la deuxième bulle de conseil.');
  });

  it('Garde-fou SILENCE : l IA ne répond rien si elle renvoie SILENCE', async () => {
    const sentMessages: any[] = [];
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent' };
      },
      typing: async () => {},
    } as any;

    const mockLlm = {
      completeJson: async () => ({
        data: { reply: 'SILENCE' },
      }),
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') return [{ id: 'c-2', phone: '23769000001', is_returning: false }];
        if (table === 'conversations') return [{ id: 'conv-2', ack_log: { concierge_onboarding_sent: true } }];
        return [];
      },
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: mockLlm,
      delayMs: 20,
      typingDelayMs: 5,
    });

    await concierge.handleEvent(makeMockMessage({
      chatId: '23769000001@c.us',
      body: 'Message douteux ou inintelligible',
    }));

    await new Promise((r) => setTimeout(r, 60));
    assert.equal(sentMessages.length, 0, 'Aucun message ne doit être envoyé si la réponse est SILENCE');
  });

  it('Passage de main au responsable de l atelier : débraye en mode humain permanent', async () => {
    const sentMessages: any[] = [];
    let updatedConversation: any = null;

    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        sentMessages.push(content);
        return { status: 'sent' };
      },
      typing: async () => {},
    } as any;

    const mockLlm = {
      completeJson: async () => ({
        data: { reply: "J'ai bien reçu votre message. Je transmets directement votre demande au responsable de l'atelier qui va regarder cela pour vous tout de suite." },
      }),
    } as any;

    const mockDb = {
      queryTable: async (table: string) => {
        if (table === 'contacts') return [{ id: 'c-3', phone: '23769000002', is_returning: false }];
        if (table === 'conversations') return [{ id: 'conv-3', ack_log: { concierge_onboarding_sent: true } }];
        return [];
      },
      updateRows: async (table: string, _match: string, data: any) => {
        if (table === 'conversations') updatedConversation = data;
        return [data];
      },
      insertRow: async () => ({ id: 'msg-3' }),
    } as any;

    const concierge = new ConciergeService({
      db: mockDb,
      waha: mockWaha,
      llmProvider: mockLlm,
      delayMs: 20,
      typingDelayMs: 5,
    });

    await concierge.handleEvent(makeMockMessage({
      chatId: '23769000002@c.us',
      body: 'J ai un litige de paiement Chariow depuis 3 jours',
    }));

    await new Promise((r) => setTimeout(r, 60));
    assert.equal(sentMessages.length, 1);
    assert.ok(sentMessages[0].text.includes("responsable de l'atelier"));
    assert.equal(updatedConversation?.control_mode, 'human', 'Le control_mode doit basculer en human');
  });
});
