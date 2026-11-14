import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOJI_AUTOMATIONS, cleanEmoji, shouldProcessReaction, executeEmojiAutomation } from '../src/ingest/emoji-automations.js';
import { normalizeEmoji } from '../src/ingest/wa-ids.js';
import type { LlmProvider, JsonCompletionRequest, JsonCompletion } from '../src/llm/provider.js';

test('Table des 10 automatisations : détection exacte de chaque emoji dont ✍️ et 🎉', () => {
  const emojis = ['😊', '✨', '🙏', '💢', '🥰', '✍️', '☺️', '🎥', '🎵', '🎉'];
  const expectedLabels = [
    'Accueil Djelia',
    'Présentation des offres',
    'Paiement Orange Money',
    'Paiement Wave',
    'Demande avis Facebook',
    'Génération et livraison des paroles',
    'Vocal prise de commande',
    'Vidéo démo',
    'Vocal procédure',
    'Confirmation livraison & clôture commande',
  ];

  emojis.forEach((e, idx) => {
    const norm = normalizeEmoji(e);
    const action = EMOJI_AUTOMATIONS[cleanEmoji(norm)];
    assert.ok(action, `L'emoji ${e} doit correspondre à une action`);
    assert.equal(action.label, expectedLabels[idx]);
  });
});

test('Dédoublonnage : un même emoji sur un même message dans les 4s est ignoré', () => {
  const msgId = 'msg_test_123';
  const emoji = cleanEmoji('🙏');
  assert.equal(shouldProcessReaction(msgId, emoji), true);
  assert.equal(shouldProcessReaction(msgId, emoji), false);
});

test('Exécution simulée : action texte déclenche bien sendText', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_1', waKey: 'k_1' };
    },
  };

  const res = await executeEmojiAutomation('Test', '22501010101@c.us', '💢', 'msg_wave_test', mockWaha);
  assert.equal(res.executed, true);
  assert.equal(res.action, 'Paiement Wave');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.kind, 'text');
  assert.ok(sent[0].content.text.includes('WAVE +225 0759600590'));
});

test('Exécution simulée : action vocale déclenche bien sendVoice', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_2', waKey: 'k_2' };
    },
  };

  const res = await executeEmojiAutomation('Test', '22501010101@c.us', '🎵', 'msg_proc_test', mockWaha);
  assert.equal(res.executed, true);
  assert.equal(res.action, 'Vocal procédure');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.kind, 'voice');
  assert.ok(sent[0].content.url.includes('vocal_procedure_soeur.opus'));
});

test('Exécution simulée : action vidéo déclenche bien sendVideo', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_3', waKey: 'k_3' };
    },
  };

  const res = await executeEmojiAutomation('Test', '22501010101@c.us', '🎥', 'msg_video_test', mockWaha);
  assert.equal(res.executed, true);
  assert.equal(res.action, 'Vidéo démo');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.kind, 'video');
  assert.ok(sent[0].content.url.includes('324048.mp4'));
});

test('✍️ Fallback : en l absence de db/llmProvider, envoi propre du message de politesse', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_fb', waKey: 'k_fb' };
    },
  };

  const res = await executeEmojiAutomation('Test', '22501010101@c.us', '✍️', 'msg_hand_fallback', mockWaha);
  assert.equal(res.executed, true);
  assert.equal(res.action, 'Validation des paroles (fallback)');
  assert.equal(sent.length, 1);
  assert.ok(sent[0].content.text.includes('Merci de me donner votre retour sur le texte'));
});

test('✍️ Pipeline complet autonome : analyse, composition d élite et livraison directe (Option B)', async () => {
  const sent: any[] = [];
  const updatedOrders: any[] = [];
  const transitioned: any[] = [];

  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: `wa_${sent.length}`, waKey: `k_${sent.length}` };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string, filter: string) => {
      if (table === 'contacts') {
        return [{ id: 'contact_001', user_id: 'user_001' }];
      }
      if (table === 'conversations') {
        return [{ id: 'conv_001', user_id: 'user_001', focus_order_id: 'order_001' }];
      }
      if (table === 'orders' && filter.includes('delivered,closed')) {
        return []; // Pas de commande précédente fermée
      }
      if (table === 'messages') {
        return [
          {
            id: 'm1',
            from_me: false,
            body: "Bonjour, c'est pour l'anniversaire de ma maman Awa 50 ans.",
            transcript: null,
            media_kind: 'text',
            wa_message_key: 'key_1',
            created_at: '2026-11-14T10:00:00Z',
          },
          {
            id: 'm2',
            from_me: false,
            body: null,
            transcript: "Elle a toujours été généreuse avec tout le quartier, sa voix douce nous réconforte.",
            media_kind: 'audio',
            wa_message_key: 'key_2',
            created_at: '2026-11-14T10:02:00Z',
          },
        ];
      }
      return [];
    },
    updateRows: async (table: string, matchQuery: string, data: any) => {
      updatedOrders.push({ table, matchQuery, data });
      return data;
    },
    rpc: async (fn: string, args: any) => {
      if (fn === 'agent_transition_order') {
        transitioned.push(args);
        return 'ok';
      }
      return 'ok';
    },
  };

  const goldenLyrics = `[Style: Afro-pop acoustique douce]
[Intro]
Cinquante années de grâce et de lumière…
Pour notre reine Awa…
[Couplet 1]
Maman Awa au grand cœur si généreux
Dans tout le quartier ton sourire rend heureux
Chaque matin ta bénédiction nous guide
Face aux tourments jamais tu n'es timide
Ton amour est un fleuve inépuisable
Ta tendresse pour tes enfants est admirable
[Refrain]
Joyeux anniversaire à toi Maman Awa !
Que le ciel t'accorde santé et éclat !
Maman Awa notre lumière notre trésor
Pour tes cinquante ans on t'aime encore plus fort !
[Couplet 2]
Ta voix si douce apaise tous nos chagrins
Tu as séché nos larmes sur ton chemin
Tes sacrifices ont bâti notre avenir
De ta bonté nul ne pourra tarir
Merci pour la sagesse que tu nous donnes
Dans nos cœurs c'est ton prénom qui résonne
[Refrain]
Joyeux anniversaire à toi Maman Awa !
Que le ciel t'accorde santé et éclat !
Maman Awa notre lumière notre trésor
Pour tes cinquante ans on t'aime encore plus fort !
[Pont]
Cinquante ans aujourd'hui c'est le jour béni
Que la paix et la joie remplissent ta vie
Longue vie à toi notre pilier d'amour
Que Dieu veille sur tes pas pour toujours
[Refrain Final]
Joyeux anniversaire à toi Maman Awa !
Que le ciel t'accorde santé et éclat !
Maman Awa notre lumière notre trésor
Pour tes cinquante ans on t'aime encore plus fort !
[Outro]
Joyeux anniversaire Maman d'amour…
On t'aime infiniment…`;

  const fakeLlm: LlmProvider = {
    name: 'deepseek-chat',
    async completeJson(req: JsonCompletionRequest): Promise<JsonCompletion> {
      // 1. Extraction du brief
      if (req.system.includes('directeur artistique et analyste en chef')) {
        return {
          data: {
            isMultiSong: false,
            briefs: [
              {
                recipientName: 'Maman Awa',
                recipientRelation: 'mère',
                senderName: 'Ses enfants',
                occasion: 'Anniversaire 50 ans',
                style: 'Afro-pop acoustique douce',
                language: 'Français',
                memories: ['généreuse avec le quartier', 'voix douce', '50 ans'],
                explanation: 'Commande directe pour sa mère',
              },
            ],
          },
          model: 'deepseek-chat',
          usage: { promptTokens: 300, completionTokens: 100, cacheHitTokens: 0 },
          latencyMs: 100,
          attempts: 1,
          reasoningDiscarded: false,
        };
      }
      // 2. Composition poétique
      return {
        data: {
          title: 'Maman Awa, Reine de Nos Cœurs',
          lyrics: goldenLyrics,
        },
        model: 'deepseek-chat',
        usage: { promptTokens: 500, completionTokens: 400, cacheHitTokens: 0 },
        latencyMs: 200,
        attempts: 1,
        reasoningDiscarded: false,
      };
    },
  };

  const res = await executeEmojiAutomation(
    'Test',
    '22650000000@c.us',
    '✍️',
    'key_2',
    {
      waha: mockWaha,
      db: mockDb,
      llmProvider: fakeLlm as any,
    }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Génération et livraison des paroles réussie');

  // Doit avoir envoyé exactement 2 bulles au client (Bulle 1 : Paroles, Bulle 2 : Validation)
  assert.equal(sent.length, 2);
  assert.ok(sent[0].content.text.includes('MAMAN AWA, REINE DE NOS CŒURS'));
  assert.ok(sent[0].content.text.includes('[Intro]'));
  assert.ok(sent[0].content.text.includes('[Refrain]'));
  assert.ok(sent[1].content.text.includes('Merci de me donner votre retour sur le texte'));

  // Doit avoir mis à jour l'ordre en base avec les paroles
  assert.equal(updatedOrders.length, 1);
  assert.equal(updatedOrders[0].table, 'orders');
  assert.ok(updatedOrders[0].data.lyrics.includes('Maman Awa'));

  // Doit avoir transitionné la commande vers lyrics_sent
  assert.equal(transitioned.length, 1);
  assert.equal(transitioned[0].p_event, 'lyrics_sent');
});

test('🎉 Clôture de commande : marque l ordre en delivered et inscrit le client comme fidèle sans message spam', async () => {
  const sent: any[] = [];
  const updatedRows: any[] = [];
  const transitioned: any[] = [];

  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_spam', waKey: 'k_spam' };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string) => {
      if (table === 'contacts') return [{ id: 'contact_999', user_id: 'user_999' }];
      if (table === 'conversations') return [{ id: 'conv_999' }];
      if (table === 'orders') return [{ id: 'order_999', version: 3, stage: 'in_production' }];
      return [];
    },
    rpc: async (fn: string, args: any) => {
      if (fn === 'agent_transition_order') {
        transitioned.push(args);
        return 'ok';
      }
      return 'ok';
    },
    updateRows: async (table: string, matchQuery: string, data: any) => {
      updatedRows.push({ table, matchQuery, data });
      return data;
    },
  };

  const res = await executeEmojiAutomation(
    'Test',
    '22650000000@c.us',
    '🎉',
    'key_done',
    {
      waha: mockWaha,
      db: mockDb,
    }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Confirmation livraison & clôture commande');

  // Aucune bulle parasite ne doit être envoyée au client pour la clôture 🎉
  assert.equal(sent.length, 0);

  // Transition de l'ordre appelée
  assert.equal(transitioned.length, 1);
  assert.equal(transitioned[0].p_order, 'order_999');
  assert.equal(transitioned[0].p_event, 'delivery_sent');

  // Contact marqué comme returning (fidèle)
  const contactUpdate = updatedRows.find((r) => r.table === 'contacts');
  assert.ok(contactUpdate);
  assert.equal(contactUpdate.data.is_returning, true);
});
