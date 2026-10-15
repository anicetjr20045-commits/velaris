import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLyricsForSuno, generateKieSong, pollKieSongStatus } from '../src/services/music.js';

describe('🎵 Service de Musique Suno V6 / Kie.ai', () => {
  it('formatLyricsForSuno formate correctement les couplets, refrains et métadonnées', () => {
    const raw = `[Titre: Pour Aminata]
[Style: Afropop doux]
Couplet 1
Sous le ciel de Ouaga, ton regard brille.

Refrain
Joyeux anniversaire à toi Aminata !

Pont
Que la vie te donne le meilleur.

Outro
Toujours ensemble.`;

    const formatted = formatLyricsForSuno(raw);
    assert.ok(formatted.includes('[Verse 1]'), 'Doit convertir Couplet 1 en [Verse 1]');
    assert.ok(formatted.includes('[Chorus]'), 'Doit convertir Refrain en [Chorus]');
    assert.ok(formatted.includes('[Bridge]'), 'Doit convertir Pont en [Bridge]');
    assert.ok(formatted.includes('[Outro]'), 'Doit convertir Outro en [Outro]');
    assert.ok(!formatted.includes('[Titre:'), 'Doit retirer les métadonnées de titre');
    assert.ok(!formatted.includes('[Style:'), 'Doit retirer les métadonnées de style');
  });

  it('generateKieSong envoie les paramètres attendus par Kie Suno V6', async () => {
    let capturedBody: any = null;
    const mockFetch = (async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({
        code: 200,
        msg: 'success',
        data: { taskId: 'task_suno_test_999' },
      }), { status: 200 });
    }) as typeof fetch;

    const res = await generateKieSong('fake_key_123', {
      lyrics: 'Couplet 1\nParoles de test',
      style: 'Afropop doux',
      voice: 'female',
      title: 'Chanson pour test',
    }, mockFetch);

    assert.equal(res.success, true);
    assert.equal(res.taskId, 'task_suno_test_999');
    assert.equal(capturedBody.model, 'V6');
    assert.equal(capturedBody.customMode, true);
    assert.ok(capturedBody.style.includes('voix féminine'));
  });

  it('pollKieSongStatus extrait correctement l’URL audio au succès', async () => {
    const mockFetch = (async () => {
      return new Response(JSON.stringify({
        code: 200,
        msg: 'success',
        data: {
          status: 'SUCCESS',
          response: {
            sunoData: [
              {
                audioUrl: 'https://cdn.kie.ai/audio/suno_test.mp3',
                duration: 185,
              },
            ],
          },
        },
      }), { status: 200 });
    }) as typeof fetch;

    const res = await pollKieSongStatus('fake_key_123', 'task_suno_test_999', mockFetch);
    assert.equal(res.status, 'success');
    assert.equal(res.audioUrl, 'https://cdn.kie.ai/audio/suno_test.mp3');
    assert.equal(res.duration, 185);
  });

  it('pollKieSongStatus rapporte l’échec quand le statut est FAILED', async () => {
    const mockFetch = (async () => {
      return new Response(JSON.stringify({
        code: 200,
        msg: 'success',
        data: {
          status: 'FAILED',
          errorMessage: 'moderation_flagged',
        },
      }), { status: 200 });
    }) as typeof fetch;

    const res = await pollKieSongStatus('fake_key_123', 'task_suno_test_fail', mockFetch);
    assert.equal(res.status, 'failed');
    assert.equal(res.error, 'moderation_flagged');
  });
});
