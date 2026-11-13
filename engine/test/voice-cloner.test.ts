import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceClonerService, DraftClonerManager } from '../src/services/voice-cloner.js';
import type { NormalizedEvent } from '../src/ingest/normalize.js';
import type { WahaClient } from '../src/send/waha-client.js';
import type { AudioTranscriber } from '../src/services/transcribe.js';

describe('Studio Voice Cloner & Draft Manager', () => {
  it('VoiceClonerService synthétise un texte avec les bons en-têtes et le format opus', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBodyLen = 0;

    const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBodyLen = (init?.body as any)?.byteLength || 0;

      return new Response(new Uint8Array([79, 103, 103, 83, 0, 2]), {
        status: 200,
        headers: { 'Content-Type': 'audio/opus' },
      });
    }) as typeof fetch;

    const cloner = new VoiceClonerService({
      apiKey: 'test-fish-key',
      fetchImpl: mockFetch,
    });

    const buf = await cloner.synthesize('Bonjour test vocal');
    assert.equal(capturedUrl, 'https://api.fish.audio/v1/tts');
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-fish-key');
    assert.equal(capturedHeaders['model'], 's2.1-pro-free');
    assert.equal(capturedHeaders['Content-Type'], 'application/msgpack');
    assert.ok(capturedBodyLen > 0);
    assert.ok(buf.length > 0);
  });

  it('DraftClonerManager: /vocal active le mode brouillon et répond par confirmation', async () => {
    const cloner = new VoiceClonerService({ fetchImpl: (async () => new Response()) as any });
    const manager = new DraftClonerManager({ cloner });

    let sentText = '';
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        if (content.kind === 'text') sentText = content.text;
        return { status: 'sent' };
      },
    } as unknown as WahaClient;

    const ev: NormalizedEvent = {
      kind: 'message',
      session: 'Test',
      chatId: '4626334134341@lid',
      waMessageId: 'msg_1',
      waKey: 'key_1',
      waTimestamp: new Date().toISOString(),
      fromMe: true,
      body: '/vocal',
      bodyHash: 'hash_1',
      mediaKind: null,
      mediaUrl: null,
      mediaMime: null,
      pushName: 'Anicet',
      quotedText: null,
      dedupKey: 'dedup_1',
    };

    const res = await manager.handleDraftMessage(ev, mockWaha);
    assert.equal(res.handled, true);
    assert.equal(res.outcome, 'draft_armed');
    assert.ok(manager.isArmed('4626334134341@lid'));
    assert.ok(sentText.includes('Mode Voix Féminine activé'));
  });

  it('DraftClonerManager: /stop désactive le mode brouillon', async () => {
    const cloner = new VoiceClonerService({ fetchImpl: (async () => new Response()) as any });
    const manager = new DraftClonerManager({ cloner });
    manager.arm('4626334134341@lid');

    let sentText = '';
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        if (content.kind === 'text') sentText = content.text;
        return { status: 'sent' };
      },
    } as unknown as WahaClient;

    const ev: NormalizedEvent = {
      kind: 'message',
      session: 'Test',
      chatId: '4626334134341@lid',
      waMessageId: 'msg_2',
      waKey: 'key_2',
      waTimestamp: new Date().toISOString(),
      fromMe: true,
      body: '/stop',
      bodyHash: 'hash_2',
      mediaKind: null,
      mediaUrl: null,
      mediaMime: null,
      pushName: 'Anicet',
      quotedText: null,
      dedupKey: 'dedup_2',
    };

    const res = await manager.handleDraftMessage(ev, mockWaha);
    assert.equal(res.handled, true);
    assert.equal(res.outcome, 'draft_disarmed');
    assert.equal(manager.isArmed('4626334134341@lid'), false);
    assert.ok(sentText.includes('Mode Voix Féminine désactivé'));
  });

  it('DraftClonerManager: /vocal <texte> effectue une synthèse one-shot sans armer', async () => {
    const mockFetch = (async () => {
      return new Response(new Uint8Array([79, 103, 103, 83]), {
        status: 200,
        headers: { 'Content-Type': 'audio/opus' },
      });
    }) as typeof fetch;

    const cloner = new VoiceClonerService({ fetchImpl: mockFetch });
    const manager = new DraftClonerManager({ cloner });

    let sentVoice: any = null;
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        if (content.kind === 'voice') sentVoice = content;
        return { status: 'sent' };
      },
    } as unknown as WahaClient;

    const ev: NormalizedEvent = {
      kind: 'message',
      session: 'Test',
      chatId: 'client_chat_1',
      waMessageId: 'msg_3',
      waKey: 'key_3',
      waTimestamp: new Date().toISOString(),
      fromMe: true,
      body: '/vocal Bonjour maman je t aime fort',
      bodyHash: 'hash_3',
      mediaKind: null,
      mediaUrl: null,
      mediaMime: null,
      pushName: 'Anicet',
      quotedText: null,
      dedupKey: 'dedup_3',
    };

    const res = await manager.handleDraftMessage(ev, mockWaha);
    assert.equal(res.handled, true);
    assert.equal(res.outcome, 'draft_oneshot_success');
    assert.ok(sentVoice);
    assert.equal(sentVoice.kind, 'voice');
    assert.ok(sentVoice.data.length > 0);
    // Non armé en persistance
    assert.equal(manager.isArmed('client_chat_1'), false);
  });

  it('DraftClonerManager: en mode armé, un texte ordinaire est automatiquement converti en vocal', async () => {
    const mockFetch = (async () => {
      return new Response(new Uint8Array([79, 103, 103, 83, 1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/opus' },
      });
    }) as typeof fetch;

    const cloner = new VoiceClonerService({ fetchImpl: mockFetch });
    const manager = new DraftClonerManager({ cloner });
    manager.arm('brouillon_chat');

    let sentVoice: any = null;
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        if (content.kind === 'voice') sentVoice = content;
        return { status: 'sent' };
      },
    } as unknown as WahaClient;

    const ev: NormalizedEvent = {
      kind: 'message',
      session: 'Test',
      chatId: 'brouillon_chat',
      waMessageId: 'msg_4',
      waKey: 'key_4',
      waTimestamp: new Date().toISOString(),
      fromMe: true,
      body: 'Voici le texte à dire au client',
      bodyHash: 'hash_4',
      mediaKind: null,
      mediaUrl: null,
      mediaMime: null,
      pushName: 'Anicet',
      quotedText: null,
      dedupKey: 'dedup_4',
    };

    const res = await manager.handleDraftMessage(ev, mockWaha);
    assert.equal(res.handled, true);
    assert.equal(res.outcome, 'draft_text_transformed');
    assert.ok(sentVoice);
    assert.equal(sentVoice.kind, 'voice');
  });

  it('DraftClonerManager: en mode armé, une note vocale est transcrite puis convertie en voix de la sœur', async () => {
    const mockFetch = (async () => {
      return new Response(new Uint8Array([79, 103, 103, 83, 9, 8, 7]), {
        status: 200,
        headers: { 'Content-Type': 'audio/opus' },
      });
    }) as typeof fetch;

    const cloner = new VoiceClonerService({ fetchImpl: mockFetch });
    const manager = new DraftClonerManager({ cloner });
    manager.arm('brouillon_chat');

    const mockTranscriber = {
      downloadAudio: async () => Buffer.from('mock_voice_data'),
      transcribeBuffer: async () => 'Coucou c est un message vocal transcrit',
    } as unknown as AudioTranscriber;

    let sentVoice: any = null;
    const mockWaha = {
      send: async (_session: string, _chatId: string, content: any) => {
        if (content.kind === 'voice') sentVoice = content;
        return { status: 'sent' };
      },
    } as unknown as WahaClient;

    const ev: NormalizedEvent = {
      kind: 'message',
      session: 'Test',
      chatId: 'brouillon_chat',
      waMessageId: 'msg_5',
      waKey: 'key_5',
      waTimestamp: new Date().toISOString(),
      fromMe: true,
      body: null,
      bodyHash: 'hash_5',
      mediaKind: 'audio',
      mediaUrl: 'http://waha:3000/files/voice.ogg',
      mediaMime: 'audio/ogg',
      pushName: 'Anicet',
      quotedText: null,
      dedupKey: 'dedup_5',
    };

    const res = await manager.handleDraftMessage(ev, mockWaha, mockTranscriber);
    assert.equal(res.handled, true);
    assert.equal(res.outcome, 'draft_audio_transformed');
    assert.ok(sentVoice);
    assert.equal(sentVoice.kind, 'voice');
  });

  it('DraftClonerManager: un message ordinaire dans une conversation NON armée n est pas intercepté', async () => {
    const cloner = new VoiceClonerService({ fetchImpl: (async () => new Response()) as any });
    const manager = new DraftClonerManager({ cloner });

    const mockWaha = {
      send: async () => ({ status: 'sent' }),
    } as unknown as WahaClient;

    const ev: NormalizedEvent = {
      kind: 'message',
      session: 'Test',
      chatId: 'client_lambda',
      waMessageId: 'msg_6',
      waKey: 'key_6',
      waTimestamp: new Date().toISOString(),
      fromMe: false,
      body: 'Bonjour combien coûte la chanson ?',
      bodyHash: 'hash_6',
      mediaKind: null,
      mediaUrl: null,
      mediaMime: null,
      pushName: 'Client',
      quotedText: null,
      dedupKey: 'dedup_6',
    };

    const res = await manager.handleDraftMessage(ev, mockWaha);
    assert.equal(res.handled, false);
  });

  it('TurnWorker respecte enableAiAutoReply: false et ne réclame aucun tour', async () => {
    let claimCalled = false;
    const mockDb = {
      rpc: async (fn: string) => {
        if (fn === 'agent_claim_turn') claimCalled = true;
        return [];
      },
    } as any;

    const { TurnWorker } = await import('../src/queue/worker.js');
    const worker = new TurnWorker({
      db: mockDb,
      llmProvider: {} as any,
      workerId: 'test-worker',
      enableAiAutoReply: false,
      log: () => {},
    });

    const claimed = await worker.tick();
    assert.equal(claimed, 0);
    assert.equal(claimCalled, false, 'agent_claim_turn ne doit JAMAIS être appelé quand enableAiAutoReply=false');
  });
});
