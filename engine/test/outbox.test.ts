/**
 * Boîte d'envoi : garde, aucun nouvel essai après un délai dépassé, régulation.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from '../src/db/rest.js';
import { OutboxSender, humanDelayMs, type OutboxRow } from '../src/send/outbox.js';
import type { OutgoingContent, SendResult } from '../src/send/waha-client.js';

function row(over: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: 'o1', user_id: 'u', conversation_id: 'c', origin: 'agent', kind: 'text', purpose: 'reply',
    session_name: 'studio_x', chat_id: '226@c.us', body: 'Bonjour', media_path: null, caption: null, ...over,
  };
}

function harness(opts: {
  gate?: string;
  send?: SendResult;
  pending?: OutboxRow[];
  outboxStatus?: string;
  controlMode?: string;
} = {}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const sends: Array<{ session: string; chatId: string; content: OutgoingContent }> = [];
  const db: Db = {
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
      rpcCalls.push({ fn, args });
      if (fn === 'agent_begin_send') return (opts.gate ?? 'ok') as T;
      if (fn === 'agent_pending_outbox') return (opts.pending ?? []) as T;
      return 'ok' as T;
    },
    async queryTable<T>(table: string): Promise<T> {
      if (table === 'outbound_messages') {
        return [{ status: opts.outboxStatus ?? 'sending' }] as T;
      }
      if (table === 'conversations') {
        return [{ control_mode: opts.controlMode ?? 'ai', control_reason: null }] as T;
      }
      return [] as T;
    },
  };
  const sender = new OutboxSender({
    db,
    waha: {
      async send(session, chatId, content) {
        sends.push({ session, chatId, content });
        return opts.send ?? { status: 'sent', waMessageId: 'true_226@c.us_ABC', waKey: 'ABC' };
      },
      async typing() {},
    },
    signMedia: async (p) => ({ url: `https://x/${p}`, mimetype: 'audio/ogg', filename: 'v.ogg' }),
    perSessionConcurrency: 2,
    protectedSessions: ['anicet2'],
    sleep: async () => {},
    log: () => {},
  });
  return { sender, rpcCalls, sends };
}

describe('OutboxSender', () => {
  test('garde refusée (supersession, prise de main…) → WAHA jamais appelé', async () => {
    for (const gate of ['superseded', 'paused', 'lost_lock', 'rate_limited', 'not_pending']) {
      const h = harness({ gate });
      await h.sender.sendOne(row());
      assert.equal(h.sends.length, 0, gate);
      assert.ok(!h.rpcCalls.some((c) => c.fn === 'agent_finish_send'), gate);
    }
  });

  test('envoi réussi → fin d\'envoi avec la clé WhatsApp', async () => {
    const h = harness();
    await h.sender.sendOne(row());
    assert.equal(h.sends.length, 1);
    const fin = h.rpcCalls.find((c) => c.fn === 'agent_finish_send')!;
    assert.deepEqual(fin.args, { p_outbox: 'o1', p_status: 'sent', p_wa_message_id: 'true_226@c.us_ABC', p_wa_key: 'ABC' });
  });

  test('délai dépassé → « unknown », un seul appel WAHA (jamais de doublon)', async () => {
    const h = harness({ send: { status: 'unknown', error: 'timeout' } });
    await h.sender.sendOne(row());
    assert.equal(h.sends.length, 1);
    assert.equal(h.rpcCalls.find((c) => c.fn === 'agent_finish_send')!.args.p_status, 'unknown');
  });

  test('503 → remis en file avec délai, sans renvoi immédiat', async () => {
    const h = harness({ send: { status: 'retry', error: 'http_503', retryInSeconds: 15 } });
    await h.sender.sendOne(row());
    const fin = h.rpcCalls.find((c) => c.fn === 'agent_finish_send')!;
    assert.equal(fin.args.p_status, 'retry');
    assert.equal(fin.args.p_retry_in_seconds, 15);
    assert.equal(h.sends.length, 1);
  });

  test('session protégée (anicet2) → aucun envoi', async () => {
    const h = harness();
    await h.sender.sendOne(row({ session_name: 'anicet2' }));
    assert.equal(h.sends.length, 0);
  });

  test('vocal : URL signée du bucket privé', async () => {
    const h = harness();
    await h.sender.sendOne(row({ kind: 'voice', body: null, media_path: 'u/procedure.ogg', purpose: 'procedure_voice' }));
    assert.deepEqual(h.sends[0]!.content, { kind: 'voice', url: 'https://x/u/procedure.ogg', mimetype: 'audio/ogg' });
  });

  test('vocal de procédure officiel : embarque le base64 natif WhatsApp', async () => {
    const h = harness();
    await h.sender.sendOne(row({ kind: 'voice', body: null, media_path: 'assets/procedure_voice.ogg', purpose: 'procedure_voice' }));
    assert.equal(h.sends[0]!.content.kind, 'voice');
    assert.ok('data' in h.sends[0]!.content && typeof h.sends[0]!.content.data === 'string' && h.sends[0]!.content.data.length > 1000);
    assert.equal(h.sends[0]!.content.mimetype, 'audio/ogg; codecs=opus');
  });

  test('vidéo : URL signée et envoi avec filename', async () => {
    const h = harness();
    await h.sender.sendOne(row({ kind: 'video', body: null, media_path: 'assets/montage_sample.mp4', purpose: 'video' }));
    assert.deepEqual(h.sends[0]!.content, { kind: 'video', url: 'https://x/assets/montage_sample.mp4', mimetype: 'audio/ogg', filename: 'v.ogg' });
  });

  test('régulation : un seul envoi à la fois par discussion', async () => {
    const h = harness({ pending: [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c', chat_id: '227@c.us' })] });
    const started = await h.sender.tick();
    assert.equal(started.length, 2);
    await Promise.all(started);
  });

  test('délai humain borné', () => {
    assert.equal(humanDelayMs({ kind: 'text', body: 'ok' }), 1_500);
    assert.equal(humanDelayMs({ kind: 'text', body: 'x'.repeat(1000) }), 6_000);
  });

  test('intervention gérant pendant le délai humain (statut annulé) → WAHA jamais appelé', async () => {
    const h = harness({ outboxStatus: 'cancelled' });
    await h.sender.sendOne(row());
    assert.equal(h.sends.length, 0);
    const fin = h.rpcCalls.find((c) => c.fn === 'agent_finish_send')!;
    assert.equal(fin.args.p_status, 'failed');
    assert.equal(fin.args.p_error, 'outbox_status_cancelled');
  });

  test('intervention gérant pendant le délai humain (contrôle humain) → WAHA jamais appelé', async () => {
    const h = harness({ controlMode: 'human' });
    await h.sender.sendOne(row());
    assert.equal(h.sends.length, 0);
    const fin = h.rpcCalls.find((c) => c.fn === 'agent_finish_send')!;
    assert.equal(fin.args.p_status, 'failed');
    assert.equal(fin.args.p_error, 'human_control_merchant_took_over');
  });
});
