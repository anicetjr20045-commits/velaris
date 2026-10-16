/**
 * Tests unitaires du service AudioTranscriber (Kie.ai Gemini 3.6 Flash + WAHA + fallback Whisper).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioTranscriber } from '../src/services/transcribe.js';

describe('AudioTranscriber', () => {
  test('downloadAudio reecrit URL pour WAHA et ajoute X-Api-Key', async () => {
    let capturedUrl = '';
    let capturedKey = '';

    const fakeFetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedKey = (init?.headers as Record<string, string>)?.['X-Api-Key'] || '';
      return new Response(Buffer.from('fake-audio-bytes'), { status: 200 });
    }) as typeof fetch;

    const transcriber = new AudioTranscriber({
      wahaUrl: 'http://waha:3000',
      wahaApiKey: 'waha-secret-key',
      kieApiKey: 'kie-secret-key',
      fetchImpl: fakeFetch,
    });

    const buf = await transcriber.downloadAudio('Test', 'http://localhost:3000/api/files/Test/audio.oga');
    assert.ok(buf);
    assert.equal(buf.toString(), 'fake-audio-bytes');
    assert.equal(capturedUrl, 'http://waha:3000/api/files/Test/audio.oga');
    assert.equal(capturedKey, 'waha-secret-key');
  });

  test('transcribeBuffer appelle en priorité Kie.ai Gemini 3.6 Flash via SSE streaming', async () => {
    let capturedUrl = '';
    let capturedAuth = '';
    let capturedBody: any = null;

    const fakeFetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedAuth = (init?.headers as Record<string, string>)?.['Authorization'] || '';
      capturedBody = JSON.parse(String(init?.body));

      const sseStream = [
        'data: {"choices":[{"delta":{"content":"« Bonjour Velaris, je souhaite une chanson "}}]}',
        'data: {"choices":[{"delta":{"content":"pour anniversaire de ma mere »"}}]}',
        'data: [DONE]',
      ].join('\n');

      return new Response(sseStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const transcriber = new AudioTranscriber({
      wahaUrl: 'http://waha:3000',
      wahaApiKey: 'waha-key',
      kieApiKey: 'kie-key-123',
      sttUrl: 'http://stt-whisper:5001',
      fetchImpl: fakeFetch,
    });

    const text = await transcriber.transcribeBuffer(Buffer.from('fake-wav-header'), 'audio/wav');
    assert.equal(capturedUrl, 'https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions');
    assert.equal(capturedAuth, 'Bearer kie-key-123');
    assert.equal(capturedBody.model, 'gemini-3-6-flash');
    assert.equal(capturedBody.stream, true);
    assert.ok(capturedBody.messages[0].content[1].image_url.url.startsWith('data:audio/wav;base64,'));
    assert.equal(text, "Bonjour Velaris, je souhaite une chanson pour anniversaire de ma mere");
  });

  test('transcribeBuffer bascule sur Faster-Whisper local si Kie.ai échoue', async () => {
    const urlsCalled: string[] = [];

    const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      urlsCalled.push(url);
      if (url.includes('api.kie.ai')) {
        return new Response('{"code":500,"msg":"Server error"}', { status: 500 });
      }
      return new Response(JSON.stringify({ text: "Repli Whisper réussi pour le brief" }), { status: 200 });
    }) as typeof fetch;

    const transcriber = new AudioTranscriber({
      wahaUrl: 'http://waha:3000',
      wahaApiKey: 'waha-key',
      kieApiKey: 'kie-key',
      sttUrl: 'http://stt-whisper:5001',
      fetchImpl: fakeFetch,
    });

    const text = await transcriber.transcribeBuffer(Buffer.from('fake-wav'), 'audio/wav');
    assert.equal(text, 'Repli Whisper réussi pour le brief');
    assert.ok(urlsCalled[0]?.includes('api.kie.ai'));
    assert.ok(urlsCalled[1]?.includes('stt-whisper:5001/transcribe'));
  });

  test('transcribeMessage orchestre le téléchargement, la transcription et la mise à jour SQL', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

    const fakeDb: any = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return 'ok';
      },
    };

    const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api/files')) {
        return new Response(Buffer.from('audio-content'), { status: 200 });
      }
      const sseStream = 'data: {"choices":[{"delta":{"content":"Je veux la formule Or"}}]}\ndata: [DONE]';
      return new Response(sseStream, { status: 200 });
    }) as typeof fetch;

    const transcriber = new AudioTranscriber({
      wahaUrl: 'http://waha:3000',
      wahaApiKey: 'waha-key',
      kieApiKey: 'kie-key',
      db: fakeDb,
      fetchImpl: fakeFetch,
    });

    const res = await transcriber.transcribeMessage(
      'msg-uuid-123',
      'Test',
      'http://localhost:3000/api/files/Test/voice.wav',
      'audio'
    );

    assert.equal(res, 'Je veux la formule Or');
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0]?.fn, 'agent_set_transcript');
    assert.equal(rpcCalls[0]?.args.p_message, 'msg-uuid-123');
    assert.equal(rpcCalls[0]?.args.p_transcript, 'Je veux la formule Or');
    assert.equal(rpcCalls[0]?.args.p_status, 'done');
  });
});
