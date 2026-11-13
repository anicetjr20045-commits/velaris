import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLyricsForSuno,
  generateKieSong,
  pollKieSongStatus,
  optimizeSunoStylePrompt,
  parseLyricsHeader,
  twoDigitsToFrench,
  numberToFrenchWords,
} from '../src/services/music.js';

describe('🎵 Service de Musique Suno V6 / Kie.ai', () => {
  it('parseLyricsHeader extrait déterministement le style, la voix et le titre', () => {
    // Cas 1 : En-tête combiné standard
    const r1 = parseLyricsHeader(`[Style: Afro-love doux | Voix: Masculine]
[Titre: Pour Aminata]
Couplet 1
Sous le ciel de Ouaga, ton regard brille.`);
    assert.equal(r1.style, 'Afro-love doux');
    assert.equal(r1.voice, 'male');
    assert.equal(r1.title, 'Pour Aminata');
    assert.ok(r1.lyrics.startsWith('Couplet 1'), 'Les métadonnées doivent être retirées des paroles');

    // Cas 2 : Lignes séparées sans crochets
    const r2 = parseLyricsHeader(`Style : Dansant
Voix : Féminine
Refrain
La fête continue`);
    assert.equal(r2.style, 'Dansant');
    assert.equal(r2.voice, 'female');
    assert.equal(r2.title, null);

    // Cas 3 : Rumba en duo
    const r3 = parseLyricsHeader(`[Style: Authentique Rumba congolaise | Voix: Duo]
Couplet 1
Kinshasa la nuit`);
    assert.equal(r3.style, 'Authentique Rumba congolaise');
    assert.equal(r3.voice, 'duo');

    // Cas 4 : Coupé-décalé avec virgule
    const r4 = parseLyricsHeader(`[Style: Coupé-décalé , Voix: Homme]
Couplet 1
On s'enjaille`);
    assert.equal(r4.style, 'Coupé-décalé');
    assert.equal(r4.voice, 'male');

    // Cas 5 : Avec parenthèses
    const r5 = parseLyricsHeader(`(Style: Dansant)
(Voix: Féminine)
Refrain
Danse`);
    assert.equal(r5.style, 'Dansant');
    assert.equal(r5.voice, 'female');

    // Cas 6 : Voix en premier puis style
    const r6 = parseLyricsHeader(`[Voix: Duo | Style: Rumba congolaise]
Couplet 1
Amour`);
    assert.equal(r6.style, 'Rumba congolaise');
    assert.equal(r6.voice, 'duo');
  });

  it('twoDigitsToFrench et numberToFrenchWords convertissent fidèlement les chiffres', () => {
    assert.equal(twoDigitsToFrench(55), 'cinquante-cinq');
    assert.equal(twoDigitsToFrench('06', true), 'zéro six');
    assert.equal(twoDigitsToFrench(28), 'vingt-huit');
    assert.equal(twoDigitsToFrench(37), 'trente-sept');
    assert.equal(twoDigitsToFrench('05', true), 'zéro cinq');
    assert.equal(twoDigitsToFrench(10), 'dix');

    assert.equal(numberToFrenchWords(2024), 'deux mille vingt-quatre');
    assert.equal(numberToFrenchWords(20), 'vingt');
    assert.equal(numberToFrenchWords(100), 'cent');
  });

  it('formatLyricsForSuno optimise la phonétique française (téléphones, dates, sigles, chiffres)', () => {
    const raw = `[Style: Afro-love doux | Voix: Masculine]
(Couplet 1)
Appelle le 5506 ou le 2837 ou au 0510
Le PDG fête ses 20 ans le 12/05/2024
En 2024 il a réussi à 100% avec 50000 FCFA
(Refrain)
C'est le 1er jour de bonheur !`;

    const formatted = formatLyricsForSuno(raw);
    // Vérifications phonétiques
    assert.ok(formatted.includes('cinquante-cinq, zéro six'), 'Doit lire 5506 deux par deux avec virgule');
    assert.ok(formatted.includes('vingt-huit, trente-sept'), 'Doit lire 2837 deux par deux avec virgule');
    assert.ok(formatted.includes('zéro cinq, dix'), 'Doit lire 0510 deux par deux avec virgule');
    assert.ok(formatted.includes('P-D-G'), 'Doit articuler le sigle PDG');
    assert.ok(formatted.includes('vingt ans'), 'Doit convertir 20 ans en vingt ans');
    assert.ok(formatted.includes('douze mai deux mille vingt-quatre'), 'Doit transcrire la date 12/05/2024 en lettres');
    assert.ok(formatted.includes('deux mille vingt-quatre'), 'Doit convertir l’année 2024');
    assert.ok(formatted.includes('cent pour cent'), 'Doit convertir 100% en cent pour cent');
    assert.ok(formatted.includes('cinquante mille francs CFA'), 'Doit convertir 50000 FCFA');
    assert.ok(formatted.includes('premier jour'), 'Doit convertir 1er en premier');

    // Sections
    assert.ok(formatted.includes('[Verse 1]'), 'Doit convertir (Couplet 1) en [Verse 1]');
    assert.ok(formatted.includes('[Chorus]'), 'Doit convertir (Refrain) en [Chorus]');

    // Nettoyage en-tête
    assert.ok(!formatted.includes('[Style:'), 'Doit retirer la balise Style');
    assert.ok(!formatted.includes('Voix:'), 'Doit retirer la balise Voix');
  });

  it('optimizeSunoStylePrompt applique les 4 templates calibrés et la voix dynamique', () => {
    // 1. Doux / Afro-Love
    const afro = optimizeSunoStylePrompt('Afro-love doux', 'female');
    assert.ok(afro.includes('Emotional Afro-Love with a Warm African Groove'), 'Doit inclure le titre du template');
    assert.ok(afro.includes('90–98 BPM'), 'Doit inclure le BPM calibré');
    assert.ok(afro.includes('acoustic guitar'), 'Doit inclure acoustic guitar');
    assert.ok(afro.includes('female lead vocal'), 'Doit inclure la voix féminine');

    // 2. Dansant / Afrobeats
    const afrobeat = optimizeSunoStylePrompt('Dansant', 'male');
    assert.ok(afrobeat.includes('Ultra-energetic Afrobeats'), 'Doit inclure le template Afrobeats');
    assert.ok(afrobeat.includes('120–130 BPM'), 'Doit inclure 120-130 BPM');
    assert.ok(afrobeat.includes('male lead vocal'), 'Doit inclure la voix masculine');

    // 3. Rumba / Roomba
    const rumba = optimizeSunoStylePrompt('Roomba congolaise', 'duo');
    assert.ok(rumba.includes('Authentic Congolese Rumba'), 'Doit inclure le template Rumba');
    assert.ok(rumba.includes('95–105 BPM'), 'Doit inclure 95-105 BPM');
    assert.ok(rumba.includes('duet'), 'Doit inclure le duo vocal');

    // 4. Coupé-Décalé
    const coupe = optimizeSunoStylePrompt('Coupé-décalé ivoirien', 'male');
    assert.ok(coupe.includes('High-energy Ivorian Coupé-Décalé'), 'Doit inclure le template Coupé-Décalé');
    assert.ok(coupe.includes('128–132 BPM'), 'Doit inclure 128-132 BPM');
    assert.ok(coupe.includes('male lead vocal'), 'Doit inclure la voix masculine');

    // Sanitization modération Suno
    const reggae = optimizeSunoStylePrompt('Reggae skank like Bob Marley', 'male');
    assert.ok(!reggae.includes('skank'), 'Le mot skank doit être assaini');
    assert.ok(reggae.includes('upbeat offbeat guitar chops'), 'Skank doit être remplacé par upbeat offbeat guitar chops');
    assert.ok(!reggae.includes('Bob Marley'), 'Le nom d’artiste direct doit être assaini');
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
      lyrics: '[Style: Afro-love doux | Voix: Féminine]\nCouplet 1\nParoles de test',
      style: 'Afro-love doux',
      voice: 'female',
      title: 'Chanson pour test',
    }, mockFetch);

    assert.equal(res.success, true);
    assert.equal(res.taskId, 'task_suno_test_999');
    assert.equal(capturedBody.model, 'V6');
    assert.equal(capturedBody.customMode, true);
    assert.ok(capturedBody.style.includes('female lead vocal'));
    assert.ok(capturedBody.style.includes('acoustic guitar'));
    assert.ok(capturedBody.prompt.includes('[Verse 1]'));
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
