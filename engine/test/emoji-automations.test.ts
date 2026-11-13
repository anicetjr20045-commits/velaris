import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOJI_AUTOMATIONS, cleanEmoji, shouldProcessReaction, executeEmojiAutomation } from '../src/ingest/emoji-automations.js';
import { normalizeEmoji } from '../src/ingest/wa-ids.js';

test('Table des 9 automatisations : détection exacte de chaque emoji', () => {
  const emojis = ['😊', '✨', '🙏', '💢', '🥰', '✍️', '☺️', '🎥', '🎵'];
  const expectedLabels = [
    'Accueil Djelia',
    'Présentation des offres',
    'Paiement Orange Money',
    'Paiement Wave',
    'Demande avis Facebook',
    'Validation des paroles',
    'Vocal prise de commande',
    'Vidéo démo',
    'Vocal procédure',
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
