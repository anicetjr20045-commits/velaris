/**
 * Tests unitaires du service AudioTranscriber (Gemini Flash + WAHA).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioTranscriber } from '../src/services/transcribe.js';

describe('AudioTranscriber', () => {
  test('downloadAudio réécrit l\'URL pour WAHA et ajoute X-Api-Key', async () => {
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

  test('transcribeBuffer envoie inlineData au endpoint natif Gemini et nettoie le texte', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    const fakeFetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '« Bonjour Velaris, je souhaite une chanson pour l\'anniversaire de ma mère »' }],
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const transcriber = new AudioTranscriber({
      wahaUrl: 'http://waha:3000',
      wahaApiKey: 'waha-key',
      kieApiKey: 'kie-key',
      fetchImpl: fakeFetch,
    });

    const text = await transcriber.transcribeBuffer(Buffer.from('fake-audio'), 'audio/ogg; codecs=opus');
    assert.equal(capturedUrl, 'https://api.kie.ai/gemini/v1/models/gemini-3-8-flash:generateContent');
    assert.equal(capturedBody.contents[0].parts[1].inlineData.mimeType, 'audio/ogg');
    assert.equal(capturedBody.contents[0].parts[1].inlineData.data, Buffer.from('fake-audio').toString('base64'));
    assert.equal(text, "Bonjour Velaris, je souhaite une chanson pour l'anniversaire de ma mère");
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
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Je veux la formule Or' }],
              },
            },
          ],
        }),
        { status: 200 }
      );
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
      'http://localhost:3000/api/files/Test/voice.oga',
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
