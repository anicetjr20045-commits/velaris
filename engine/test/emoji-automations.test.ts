import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMOJI_AUTOMATIONS,
  cleanEmoji,
  shouldProcessReaction,
  executeEmojiAutomation,
  resolveAutomationContext,
} from '../src/ingest/emoji-automations.js';
import { normalizeEmoji } from '../src/ingest/wa-ids.js';
import type { LlmProvider, JsonCompletionRequest, JsonCompletion } from '../src/llm/provider.js';

test('Table des 11 automatisations : détection exacte de chaque emoji dont ✍️, 🎉 et ⭐', () => {
  const emojis = ['😊', '✨', '🙏', '💢', '🥰', '✍️', '☺️', '🎥', '🎵', '🎉', '⭐'];
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
    'Production musicale Suno V6',
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

test('✨ Présentation des offres : deux formules 1 200 F et 3 000 F', () => {
  const action = EMOJI_AUTOMATIONS[cleanEmoji('✨')];
  assert.ok(action);
  assert.equal(action.type, 'text');
  assert.ok(action.content?.includes('Chanson personnalisée : 1 200 F'));
  assert.ok(action.content?.includes('Chanson + vidéo montage avec vos photos : 3 000 F'));
  assert.ok(!action.content?.includes('3 500'));
});

test('Optimisation ultra-réactive : envoi direct sans appel DB quand le chatId est déjà un @c.us standard', async () => {
  const sent: any[] = [];
  let dbCallCount = 0;
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_fast', waKey: 'k_fast' };
    },
  };
  const mockDb: any = {
    queryTable: async () => {
      dbCallCount++;
      return [];
    },
  };

  const res = await executeEmojiAutomation(
    'Test',
    '22507596000@c.us',
    '✨',
    'msg_fast_123',
    { waha: mockWaha, db: mockDb }
  );

  assert.equal(res.executed, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, '22507596000@c.us');
  assert.ok(sent[0].content.text.includes('1 200 F'));
  assert.ok(sent[0].content.text.includes('3 000 F'));
  // Aucune requête DB ne doit être exécutée pour un message standard @c.us
  assert.equal(dbCallCount, 0);
});

test('Immunité LID WhatsApp : resolveAutomationContext résout le @c.us et les métadonnées depuis reactedKey', async () => {
  const mockDb: any = {
    queryTable: async (table: string, filter: string) => {
      if (table === 'messages' && filter.includes('KEY_LID_TEST')) {
        return [{ id: 'msg_lid_1', conversation_id: 'conv_lid_123', user_id: 'user_123' }];
      }
      if (table === 'conversations' && filter.includes('conv_lid_123')) {
        return [{
          id: 'conv_lid_123',
          user_id: 'user_123',
          contact_id: 'contact_lid_123',
          chat_id: '22573549833@c.us',
          focus_order_id: 'order_lid_123',
        }];
      }
      return [];
    },
  };

  const resolved = await resolveAutomationContext({ db: mockDb }, '209620710772884@lid', 'KEY_LID_TEST');
  assert.equal(resolved.realChatId, '22573549833@c.us');
  assert.equal(resolved.conversationId, 'conv_lid_123');
  assert.equal(resolved.contactId, 'contact_lid_123');
  assert.equal(resolved.focusOrderId, 'order_lid_123');
});

test('Exécution avec LID WhatsApp : le message texte/vocal est bien routé vers le @c.us résolu', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_lid_out', waKey: 'k_lid_out' };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string, filter: string) => {
      if (table === 'messages' && filter.includes('KEY_LID_TEST2')) {
        return [{ id: 'msg_lid_2', conversation_id: 'conv_lid_456', user_id: 'user_456' }];
      }
      if (table === 'conversations' && filter.includes('conv_lid_456')) {
        return [{
          id: 'conv_lid_456',
          user_id: 'user_456',
          contact_id: 'contact_lid_456',
          chat_id: '22573549833@c.us',
          focus_order_id: 'order_lid_456',
        }];
      }
      return [];
    },
  };

  const res = await executeEmojiAutomation(
    'Test',
    '209620710772884@lid',
    '💢',
    'KEY_LID_TEST2',
    { waha: mockWaha, db: mockDb }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Paiement Wave');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, '22573549833@c.us');
});

test('🎉 Clôture avec LID WhatsApp : résout correctement le contact et la commande sans contact_not_found', async () => {
  const updatedRows: any[] = [];
  const transitioned: any[] = [];

  const mockDb: any = {
    queryTable: async (table: string, filter: string) => {
      if (table === 'messages' && filter.includes('KEY_LID_TADA')) {
        return [{ id: 'msg_tada', conversation_id: 'conv_tada', user_id: 'user_tada' }];
      }
      if (table === 'conversations' && filter.includes('conv_tada')) {
        return [{
          id: 'conv_tada',
          user_id: 'user_tada',
          contact_id: 'contact_tada',
          chat_id: '22573549833@c.us',
          focus_order_id: 'order_tada',
        }];
      }
      if (table === 'orders') {
        return [{ id: 'order_tada', version: 1, stage: 'in_production' }];
      }
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
    '209620710772884@lid',
    '🎉',
    'KEY_LID_TADA',
    { db: mockDb }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Confirmation livraison & clôture commande');
  assert.equal(transitioned.length, 1);
  assert.equal(transitioned[0].p_order, 'order_tada');
  const contactUpdate = updatedRows.find((r) => r.table === 'contacts');
  assert.ok(contactUpdate);
  assert.equal(contactUpdate.data.is_returning, true);
});

test('Règle dynamique automation_rules : send_text personnalisé via réaction WhatsApp', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_custom_1' };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string) => {
      if (table === 'automation_rules') {
        return [
          {
            id: 'rule_flame_1',
            name: 'Offre Spéciale Anniversaire',
            trigger_value: '🔥',
            action_type: 'send_text',
            text_body: 'Voici notre formule spéciale anniversaire avec dédicace personnalisée à 1 200 F !',
            media_path: null,
            caption: null,
            enabled: true,
          },
        ];
      }
      return [];
    },
  };

  const res = await executeEmojiAutomation(
    'Test',
    '22501020304@c.us',
    '🔥',
    'key_custom_flame',
    { waha: mockWaha, db: mockDb }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Offre Spéciale Anniversaire');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.kind, 'text');
  assert.ok(sent[0].content.text.includes('anniversaire avec dédicace personnalisée à 1 200 F'));
});

test('Règle dynamique automation_rules : send_voice personnalisé via réaction WhatsApp', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_voice_1' };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string) => {
      if (table === 'automation_rules') {
        return [
          {
            id: 'rule_voice_1',
            name: 'Vocal Explicatif Client',
            trigger_value: '🎤',
            action_type: 'send_voice',
            text_body: null,
            media_path: 'user_123/automations/vocal_explicatif.opus',
            caption: null,
            enabled: true,
          },
        ];
      }
      return [];
    },
  };

  const mockSignMedia = async (path: string) => ({
    url: `https://test.supabase.co/signed/${path}`,
    mimetype: 'audio/ogg; codecs=opus',
    filename: 'vocal_explicatif.opus',
  });

  const res = await executeEmojiAutomation(
    'Test',
    '22501020304@c.us',
    '🎤',
    'key_custom_mic',
    { waha: mockWaha, db: mockDb, signMedia: mockSignMedia }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Vocal Explicatif Client');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.kind, 'voice');
  assert.ok(sent[0].content.url.includes('vocal_explicatif.opus'));
  assert.equal(sent[0].content.mimetype, 'audio/ogg; codecs=opus');
});

test('Règle dynamique automation_rules : send_media (Musique MP3) via réaction WhatsApp', async () => {
  const sent: any[] = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_song_1' };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string) => {
      if (table === 'automation_rules') {
        return [
          {
            id: 'rule_music_1',
            name: 'Démo Chanson Amour Afro',
            trigger_value: '❤️',
            action_type: 'send_media',
            text_body: null,
            media_path: 'https://cdn.djelia.store/demos/chanson_amour_demo.mp3',
            caption: 'Voici un extrait de chanson personnalisée créé pour un mariage.',
            enabled: true,
          },
        ];
      }
      return [];
    },
  };

  const res = await executeEmojiAutomation(
    'Test',
    '22501020304@c.us',
    '❤️',
    'key_custom_heart',
    { waha: mockWaha, db: mockDb }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Démo Chanson Amour Afro');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.kind, 'file');
  assert.equal(sent[0].content.caption, 'Voici un extrait de chanson personnalisée créé pour un mariage.');
  assert.equal(sent[0].content.mimetype, 'audio/mpeg');
});

test('Isolation multi-utilisateurs studio_* : ignore les presets admin et filtre automation_rules par user_id', async () => {
  const sent: any[] = [];
  const queries: Array<{ table: string; filter: string }> = [];
  const mockWaha: any = {
    send: async (session: string, chatId: string, content: any) => {
      sent.push({ session, chatId, content });
      return { status: 'sent', waMessageId: 'wa_iso_1' };
    },
  };

  const mockDb: any = {
    queryTable: async (table: string, filter: string) => {
      queries.push({ table, filter });
      if (table === 'wa_sessions' && filter.includes('studio_userA999')) {
        return [{ user_id: 'userA999-1111-2222' }];
      }
      if (table === 'automation_rules' && filter.includes('user_id=eq.userA999-1111-2222')) {
        return [
          {
            id: 'rule_userA_1',
            name: 'Accueil Perso Membre A',
            trigger_value: '✨',
            action_type: 'send_text',
            text_body: 'Bienvenue dans MON propre studio !',
            media_path: null,
            caption: null,
          },
        ];
      }
      return [];
    },
  };

  // 1. ✨ sur studio_userA999 ne doit JAMAIS déclencher les tarifs hardcodés de Test,
  // mais uniquement la règle propre à userA999-1111-2222.
  const res = await executeEmojiAutomation(
    'studio_userA999',
    '22507000000@c.us',
    '✨',
    'key_iso_star',
    { waha: mockWaha, db: mockDb }
  );

  assert.equal(res.executed, true);
  assert.equal(res.action, 'Accueil Perso Membre A');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content.text, 'Bienvenue dans MON propre studio !');
  assert.ok(queries.some((q) => q.table === 'automation_rules' && q.filter.includes('user_id=eq.userA999-1111-2222')));

  // 2. 🙏 sur studio_userA999 sans règle configurée par le membre ne doit JAMAIS fuiter le numéro OM de l'admin
  const resOm = await executeEmojiAutomation(
    'studio_userA999',
    '22507000000@c.us',
    '🙏',
    'key_iso_om',
    { waha: mockWaha, db: mockDb }
  );
  assert.equal(resOm.executed, false);
  assert.equal(sent.length, 1);
});
