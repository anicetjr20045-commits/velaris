import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackgroundProduction } from '../src/services/music.js';
import { OutboxSender } from '../src/send/outbox.js';
import type { Db } from '../src/db/rest.js';
import type { OutboxRow } from '../src/send/outbox.js';

describe('🧪 Validation Rigoureuse : Double Version Suno V6 & Livraison Différée 12-15 min', () => {
  test('Cycle complet multi-commandes : enfilage différé, réveil PostgreSQL et distribution ordonnée', async () => {
    // Simuler une table outbound_messages PostgreSQL avec filtrage natif sur not_before <= simulatedNow
    const dbMessages: Array<OutboxRow & { not_before: string; status: string; idempotency_key: string }> = [];
    let simulatedNow = Date.now();

    const mockDb: Db = {
      async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
        if (fn === 'agent_enqueue_outbox') {
          const row = {
            id: `outbox_${dbMessages.length + 1}`,
            user_id: String(args.p_user),
            conversation_id: String(args.p_conversation),
            order_id: String(args.p_order),
            origin: args.p_origin as any,
            kind: args.p_kind as any,
            purpose: String(args.p_purpose),
            session_name: String(args.p_session),
            chat_id: String(args.p_chat_id),
            body: args.p_body ? String(args.p_body) : null,
            media_path: args.p_media_path ? String(args.p_media_path) : null,
            caption: args.p_caption ? String(args.p_caption) : null,
            not_before: String(args.p_not_before),
            status: String(args.p_status || 'pending'),
            idempotency_key: String(args.p_idempotency_key),
          };
          dbMessages.push(row);
          return row.id as T;
        }

        if (fn === 'agent_pending_outbox') {
          // Émule fidèlement: WHERE status = 'pending' AND not_before <= now() ORDER BY not_before, created_at
          const nowIso = new Date(simulatedNow).toISOString();
          const pending = dbMessages
            .filter((m) => m.status === 'pending' && m.not_before <= nowIso)
            .sort((a, b) => a.not_before.localeCompare(b.not_before));
          return pending as T;
        }

        if (fn === 'agent_begin_send') {
          const row = dbMessages.find((m) => m.id === args.p_outbox);
          if (!row || row.status !== 'pending') return 'not_pending' as T;
          row.status = 'sending';
          return 'ok' as T;
        }

        if (fn === 'agent_finish_send') {
          const row = dbMessages.find((m) => m.id === args.p_outbox);
          if (row) row.status = String(args.p_status);
          return 'ok' as T;
        }

        if (fn === 'agent_transition_order') {
          return 'ok' as T;
        }

        return 'ok' as T;
      },
      async queryTable<T>(table: string): Promise<T> {
        if (table === 'orders') return [{ version: 1, stage: 'in_production' }] as T;
        return [] as T;
      },
      async updateRows<T>() {
        return [] as unknown as T;
      },
    };

    const sentDeliveries: Array<{ chatId: string; kind: string; body?: string | null; media?: string | null; sentAt: number }> = [];

    const mockSender = new OutboxSender({
      db: mockDb,
      waha: {
        async send(_session, chatId, content) {
          sentDeliveries.push({
            chatId,
            kind: content.kind,
            body: content.kind === 'text' ? content.text : null,
            media: 'url' in content ? content.url : null,
            sentAt: simulatedNow,
          });
          return { status: 'sent', waMessageId: `msg_${sentDeliveries.length}`, waKey: 'ABC' };
        },
        async typing() {},
      },
      signMedia: async (p) => ({ url: p, mimetype: 'audio/mpeg', filename: 'song.mp3' }),
      perSessionConcurrency: 5,
      protectedSessions: ['anicet2'],
      sleep: async () => {},
      log: () => {},
    });

    // 1. Déclencher 2 commandes de clients distincts à T = 0
    const startT0 = simulatedNow;

    const createKieFetch = (clientName: string): typeof fetch => {
      return (async (url: string) => {
        if (url.includes('/generate/record-info')) {
          return new Response(JSON.stringify({
            code: 200,
            msg: 'success',
            data: {
              status: 'SUCCESS',
              response: {
                sunoData: [
                  { audioUrl: `https://cdn.kie.ai/audio/${clientName}_v1.mp3`, duration: 180 },
                  { audioUrl: `https://cdn.kie.ai/audio/${clientName}_v2.mp3`, duration: 185 },
                ],
              },
            },
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          code: 200,
          msg: 'success',
          data: { taskId: `task_${clientName}` },
        }), { status: 200 });
      }) as typeof fetch;
    };

    // Commande Client 1 : Mariam (délai 13 min)
    const p1 = startBackgroundProduction({
      apiKey: 'k',
      db: mockDb,
      orderId: 'order_mariam',
      userId: 'u1',
      conversationId: 'c1',
      sessionName: 'Test',
      chatId: '22650000001@c.us',
      title: 'Pour Mariam',
      style: 'Afro-love doux',
      lyrics: '[Verse 1]\nMariam mon coeur',
      targetDeliveryDelayMinutes: 13,
      pollIntervalMs: 20,
      fetchImpl: createKieFetch('mariam'),
      log: () => {},
    });

    // Commande Client 2 : Ibrahim (délai 14 min)
    const p2 = startBackgroundProduction({
      apiKey: 'k',
      db: mockDb,
      orderId: 'order_ibrahim',
      userId: 'u2',
      conversationId: 'c2',
      sessionName: 'Test',
      chatId: '22650000002@c.us',
      title: 'Pour Ibrahim',
      style: 'Dansant',
      lyrics: '[Verse 1]\nIbrahim champion',
      targetDeliveryDelayMinutes: 14,
      pollIntervalMs: 20,
      fetchImpl: createKieFetch('ibrahim'),
      log: () => {},
    });

    await Promise.all([p1, p2]);
    await new Promise((r) => setTimeout(r, 60));

    // Vérifier que 6 messages sont stockés en file PostgreSQL (3 par client : texte + v1 + v2)
    assert.equal(dbMessages.length, 6, 'Doit avoir 6 messages en file au total');
    assert.equal(dbMessages.filter((m) => m.status === 'pending').length, 6);

    // 2. Vérification à T + 2 minutes : la génération Suno est finie MAIS aucun message n'est expédié
    simulatedNow = startT0 + 2 * 60 * 1000;
    await mockSender.tick();
    assert.equal(sentDeliveries.length, 0, 'À T+2 min, AUCUN message ne doit être envoyé au client');

    // 3. Vérification à T + 10 minutes : toujours aucun message expédié
    simulatedNow = startT0 + 10 * 60 * 1000;
    await mockSender.tick();
    assert.equal(sentDeliveries.length, 0, 'À T+10 min, les messages restent sagement en attente');

    // 4. À l'échéance programmée de Mariam (13 minutes) :
    // Le texte d'annonce de Mariam doit partir !
    const mariamTextMsg = dbMessages.find((m) => m.chat_id === '22650000001@c.us' && m.kind === 'text')!;
    const mariamDeliveryStart = new Date(mariamTextMsg.not_before).getTime();

    simulatedNow = mariamDeliveryStart;
    const tick13m = await mockSender.tick();
    await Promise.all(tick13m);

    // Seul le message texte de Mariam doit être parti (Ibrahim est planifié à 14 min, v1 Mariam est à +4s)
    const sentMariam13 = sentDeliveries.filter((s) => s.chatId === '22650000001@c.us');
    assert.equal(sentMariam13.length, 1, 'À T+13m pile, seul le texte d annonce de Mariam part');
    assert.equal(sentMariam13[0]!.kind, 'text');
    assert.ok(sentMariam13[0]!.body?.includes('Pour Mariam'));
    assert.ok(sentMariam13[0]!.body?.includes('1ère note vocale : Version 1'));
    assert.ok(sentMariam13[0]!.body?.includes('2ème note vocale : Version 2'));

    // Aucun message pour Ibrahim n'est parti
    const sentIbrahim13 = sentDeliveries.filter((s) => s.chatId === '22650000002@c.us');
    assert.equal(sentIbrahim13.length, 0, 'Ibrahim n a rien reçu à T+13m');

    // 5. À T + 13 minutes + 4 secondes :
    // La note vocale Version 1 de Mariam arrive !
    simulatedNow = mariamDeliveryStart + 4_000;
    const tick13mV1 = await mockSender.tick();
    await Promise.all(tick13mV1);

    const sentMariamV1 = sentDeliveries.filter((s) => s.chatId === '22650000001@c.us');
    assert.equal(sentMariamV1.length, 2, 'Version 1 de Mariam doit être expédiée à T+13m4s');
    assert.equal(sentMariamV1[1]!.kind, 'voice');
    assert.equal(sentMariamV1[1]!.media, 'https://cdn.kie.ai/audio/mariam_v1.mp3');

    // 6. À T + 13 minutes + 9 secondes :
    // La note vocale Version 2 de Mariam arrive !
    simulatedNow = mariamDeliveryStart + 9_000;
    const tick13mV2 = await mockSender.tick();
    await Promise.all(tick13mV2);

    const sentMariamComplete = sentDeliveries.filter((s) => s.chatId === '22650000001@c.us');
    assert.equal(sentMariamComplete.length, 3, 'Les 3 messages de Mariam sont intégralement livrés');
    assert.equal(sentMariamComplete[2]!.kind, 'voice');
    assert.equal(sentMariamComplete[2]!.media, 'https://cdn.kie.ai/audio/mariam_v2.mp3');

    // Ibrahim toujours rien reçu
    assert.equal(sentDeliveries.filter((s) => s.chatId === '22650000002@c.us').length, 0);

    // 7. À l'échéance programmée d'Ibrahim (14 minutes) :
    // Tout le cycle d'Ibrahim se déroule fidèlement
    const ibrahimTextMsg = dbMessages.find((m) => m.chat_id === '22650000002@c.us' && m.kind === 'text')!;
    const ibrahimDeliveryStart = new Date(ibrahimTextMsg.not_before).getTime();

    simulatedNow = ibrahimDeliveryStart;
    await Promise.all(await mockSender.tick());

    simulatedNow = ibrahimDeliveryStart + 4_000;
    await Promise.all(await mockSender.tick());

    simulatedNow = ibrahimDeliveryStart + 9_000;
    await Promise.all(await mockSender.tick());

    const sentIbrahimComplete = sentDeliveries.filter((s) => s.chatId === '22650000002@c.us');
    assert.equal(sentIbrahimComplete.length, 3, 'Les 3 messages d Ibrahim sont intégralement livrés');
    assert.equal(sentIbrahimComplete[0]!.kind, 'text');
    assert.ok(sentIbrahimComplete[0]!.body?.includes('Pour Ibrahim'));
    assert.equal(sentIbrahimComplete[1]!.media, 'https://cdn.kie.ai/audio/ibrahim_v1.mp3');
    assert.equal(sentIbrahimComplete[2]!.media, 'https://cdn.kie.ai/audio/ibrahim_v2.mp3');

    // Total final : 6 envois, 0 doublon, isolation 100% étanche
    assert.equal(sentDeliveries.length, 6);
  });
});
