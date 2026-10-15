import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLyricsForSuno, generateKieSong, pollKieSongStatus, optimizeSunoStylePrompt } from '../src/services/music.js';

describe('🎵 Service de Musique Suno V6 / Kie.ai', () => {
  it('optimizeSunoStylePrompt enrichit fidèlement les styles acoustiques pour Suno V6', () => {
    // Afro-love
    const afro = optimizeSunoStylePrompt('Afro-love doux', 'female');
    assert.ok(afro.includes('Afro-love'), 'Doit inclure Afro-love');
    assert.ok(afro.includes('acoustic guitar'), 'Doit inclure acoustic guitar');
    assert.ok(afro.includes('female lead vocal'), 'Doit inclure female lead vocal');
    assert.ok(afro.includes('85 bpm'), 'Doit inclure le tempo');

    // Gospel
    const gospel = optimizeSunoStylePrompt('Gospel de louange', 'male');
    assert.ok(gospel.includes('African gospel'), 'Doit mapper vers African gospel');
    assert.ok(gospel.includes('choir'), 'Doit inclure choir');
    assert.ok(gospel.includes('male lead vocal'), 'Doit inclure male lead vocal');
    assert.ok(gospel.includes('96 bpm'), 'Doit inclure 96 bpm');

    // Zouk
    const zouk = optimizeSunoStylePrompt('Zouk love', 'duo');
    assert.ok(zouk.includes('Zouk love'), 'Doit inclure Zouk love');
    assert.ok(zouk.includes('duet'), 'Doit inclure duet');
    assert.ok(zouk.includes('90 bpm'), 'Doit inclure 90 bpm');

    // Rumba
    const rumba = optimizeSunoStylePrompt('Rumba congolaise', 'male');
    assert.ok(rumba.includes('Congolese rumba'), 'Doit inclure Congolese rumba');
    assert.ok(rumba.includes('88 bpm'), 'Doit inclure 88 bpm');

    // Mandingue
    const mandingue = optimizeSunoStylePrompt('Acoustique mandingue kora', 'male');
    assert.ok(mandingue.includes('Manding acoustic'), 'Doit inclure Manding acoustic');
    assert.ok(mandingue.includes('82 bpm'), 'Doit inclure 82 bpm');
  });

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

  it('generateKieSong envoie les paramètres attendus par Kie Suno V6 avec style optimisé', async () => {
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
    assert.ok(capturedBody.style.includes('female lead vocal'));
    assert.ok(capturedBody.style.includes('acoustic guitar'));
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
