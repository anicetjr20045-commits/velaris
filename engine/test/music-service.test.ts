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

    // 5. Zouglou / Wôyô
    const zouglou = optimizeSunoStylePrompt('Zouglou woyo', 'male');
    assert.ok(zouglou.includes('Authentic Ivorian Zouglou'), 'Doit inclure le template Zouglou');
    assert.ok(zouglou.includes('108–114 BPM'), 'Doit inclure 108-114 BPM');

    // 6. Kizomba
    const kizomba = optimizeSunoStylePrompt('Kizomba sensual', 'female');
    assert.ok(kizomba.includes('Sensual Kizomba'), 'Doit inclure le template Kizomba');
    assert.ok(kizomba.includes('86–92 BPM'), 'Doit inclure 86-92 BPM');

    // 7. Kompa
    const kompa = optimizeSunoStylePrompt('Kompa antillais', 'duo');
    assert.ok(kompa.includes('Smooth Caribbean Kompa Love'), 'Doit inclure le template Kompa');

    // Sanitization modération Suno & artistes copyright
    const reggae = optimizeSunoStylePrompt('Reggae skank like Bob Marley and Aya Nakamura', 'male');
    assert.ok(!reggae.includes('skank'), 'Le mot skank doit être assaini');
    assert.ok(reggae.includes('upbeat offbeat guitar chops'), 'Skank doit être remplacé par upbeat offbeat guitar chops');
    assert.ok(!reggae.includes('Bob Marley'), 'Le nom Bob Marley doit être assaini');
    assert.ok(!reggae.includes('Aya Nakamura'), 'Le nom Aya Nakamura doit être assaini');
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
    assert.deepEqual(res.audioUrls, ['https://cdn.kie.ai/audio/suno_test.mp3']);
    assert.equal(res.duration, 185);
  });

  it('pollKieSongStatus extrait les 2 versions audio (Version 1 & Version 2) fournies par Suno V6', async () => {
    const mockFetch = (async () => {
      return new Response(JSON.stringify({
        code: 200,
        msg: 'success',
        data: {
          status: 'SUCCESS',
          response: {
            sunoData: [
              {
                audioUrl: 'https://cdn.kie.ai/audio/track_v1.mp3',
                duration: 180,
              },
              {
                audioUrl: 'https://cdn.kie.ai/audio/track_v2.mp3',
                duration: 185,
              },
            ],
          },
        },
      }), { status: 200 });
    }) as typeof fetch;

    const res = await pollKieSongStatus('fake_key_123', 'task_suno_dual_track', mockFetch);
    assert.equal(res.status, 'success');
    assert.equal(res.audioUrl, 'https://cdn.kie.ai/audio/track_v1.mp3');
    assert.deepEqual(res.audioUrls, [
      'https://cdn.kie.ai/audio/track_v1.mp3',
      'https://cdn.kie.ai/audio/track_v2.mp3',
    ]);
  });

  it('startBackgroundProduction programme la livraison des 2 versions à 12-15 minutes avec not_before PostgreSQL', async () => {
    const enqueuedCalls: any[] = [];
    const transitionCalls: any[] = [];
    const logs: string[] = [];

    const mockDb: any = {
      queryTable: async () => [{ version: 2, stage: 'in_production' }],
      rpc: async (fn: string, params: any) => {
        if (fn === 'agent_enqueue_outbox') {
          enqueuedCalls.push(params);
          return 'outbox_uuid_test';
        }
        if (fn === 'agent_transition_order') {
          transitionCalls.push(params);
          return 'ok';
        }
        return null;
      },
      updateRows: async () => [{ id: 'order_test_uuid' }],
    };

    const mockFetch = (async (url: string) => {
      if (url.includes('/generate/record-info')) {
        return new Response(JSON.stringify({
          code: 200,
          msg: 'success',
          data: {
            status: 'SUCCESS',
            response: {
              sunoData: [
                { audioUrl: 'https://cdn.kie.ai/audio/version1.mp3', duration: 180 },
                { audioUrl: 'https://cdn.kie.ai/audio/version2.mp3', duration: 182 },
              ],
            },
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        code: 200,
        msg: 'success',
        data: { taskId: 'task_suno_dual_123' },
      }), { status: 200 });
    }) as typeof fetch;

    const { startBackgroundProduction } = await import('../src/services/music.js');

    const startTime = Date.now();
    // Test avec délai fixé à 13 minutes
    await startBackgroundProduction({
      apiKey: 'test_key',
      db: mockDb,
      orderId: 'b7c25a1e-97f6-4d74-a038-f86a2e4e1122',
      userId: 'user_test_uuid',
      conversationId: 'conv_test_uuid',
      sessionName: 'Test',
      chatId: '22656240533@c.us',
      title: 'Pour Mariam',
      style: 'Afro-love doux',
      lyrics: '[Verse 1]\nParoles pour Mariam',
      targetDeliveryDelayMinutes: 13,
      pollIntervalMs: 20,
      fetchImpl: mockFetch,
      log: (line, data) => logs.push(`${line} ${JSON.stringify(data ?? {})}`),
    });

    // Attendre l'exécution de la boucle de polling
    await new Promise((r) => setTimeout(r, 60));

    // 1. Vérifier la transition d'état
    assert.equal(transitionCalls.length, 1);
    assert.equal(transitionCalls[0].p_event, 'delivery_sent');
    assert.equal(transitionCalls[0].p_actor, 'merchant');
    assert.equal(transitionCalls[0].p_data.taskId, 'task_suno_dual_123');
    assert.deepEqual(transitionCalls[0].p_data.audioUrls, [
      'https://cdn.kie.ai/audio/version1.mp3',
      'https://cdn.kie.ai/audio/version2.mp3',
    ]);

    // 2. Vérifier les 3 messages en boîte d'envoi (Annonce texte + Version 1 + Version 2)
    assert.equal(enqueuedCalls.length, 3, 'Doit enfiler le texte d annonce + Version 1 + Version 2');

    // Message 1 : Annonce texte
    const msgText = enqueuedCalls[0];
    assert.equal(msgText.p_kind, 'text');
    assert.equal(msgText.p_idempotency_key, 'song_delivery_text_b7c25a1e-97f6-4d74-a038-f86a2e4e1122_task_suno_dual_123');
    assert.ok(msgText.p_body.includes('Votre chanson personnalisée « *Pour Mariam* »'));
    assert.ok(msgText.p_body.includes('1ère version : Version 1'));
    assert.ok(msgText.p_body.includes('2ème version : Version 2'));
    const scheduledTextTime = new Date(msgText.p_not_before).getTime();
    const delayFromStartMin = (scheduledTextTime - startTime) / (60 * 1000);
    assert.ok(delayFromStartMin >= 12.8 && delayFromStartMin <= 13.2, `Le texte doit être planifié à 13 min (reçu: ${delayFromStartMin.toFixed(2)} min)`);

    // Message 2 : Version 1 Audio
    const msgV1 = enqueuedCalls[1];
    assert.equal(msgV1.p_kind, 'file');
    assert.equal(msgV1.p_media_path, 'https://cdn.kie.ai/audio/version1.mp3');
    assert.equal(msgV1.p_caption, 'Version 1 — « *Pour Mariam* »');
    assert.equal(msgV1.p_idempotency_key, 'song_delivery_audio_v1_b7c25a1e-97f6-4d74-a038-f86a2e4e1122_task_suno_dual_123');
    const scheduledV1Time = new Date(msgV1.p_not_before).getTime();
    assert.equal(scheduledV1Time - scheduledTextTime, 4000, 'Version 1 doit être programmée 4s après le texte');

    // Message 3 : Version 2 Audio
    const msgV2 = enqueuedCalls[2];
    assert.equal(msgV2.p_kind, 'file');
    assert.equal(msgV2.p_media_path, 'https://cdn.kie.ai/audio/version2.mp3');
    assert.equal(msgV2.p_caption, 'Version 2 — « *Pour Mariam* »');
    assert.equal(msgV2.p_idempotency_key, 'song_delivery_audio_v2_b7c25a1e-97f6-4d74-a038-f86a2e4e1122_task_suno_dual_123');
    const scheduledV2Time = new Date(msgV2.p_not_before).getTime();
    assert.equal(scheduledV2Time - scheduledTextTime, 9000, 'Version 2 doit être programmée 9s après le texte');
  });

  it('startBackgroundProduction isole strictement plusieurs générations concurrentes sans collision', async () => {
    const enqueuedMap = new Map<string, any[]>();

    const mockDbFor = (orderId: string): any => ({
      queryTable: async () => [{ version: 1, stage: 'in_production' }],
      rpc: async (fn: string, params: any) => {
        if (fn === 'agent_enqueue_outbox') {
          const list = enqueuedMap.get(orderId) ?? [];
          list.push(params);
          enqueuedMap.set(orderId, list);
          return 'outbox_uuid';
        }
        return 'ok';
      },
      updateRows: async () => [],
    });

    const createMockFetch = (taskId: string, prefix: string): typeof fetch => {
      return (async (url: string) => {
        if (url.includes('/generate/record-info')) {
          return new Response(JSON.stringify({
            code: 200,
            msg: 'success',
            data: {
              status: 'SUCCESS',
              response: {
                sunoData: [
                  { audioUrl: `https://cdn.kie.ai/audio/${prefix}_v1.mp3`, duration: 180 },
                  { audioUrl: `https://cdn.kie.ai/audio/${prefix}_v2.mp3`, duration: 185 },
                ],
              },
            },
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          code: 200,
          msg: 'success',
          data: { taskId },
        }), { status: 200 });
      }) as typeof fetch;
    };

    const { startBackgroundProduction } = await import('../src/services/music.js');

    // Lancer 2 productions en parallèle pour 2 clients distincts
    const p1 = startBackgroundProduction({
      apiKey: 'key',
      db: mockDbFor('order_client_A'),
      orderId: 'order_client_A',
      userId: 'user1',
      conversationId: 'conv1',
      sessionName: 'Test',
      chatId: '22650000001@c.us',
      title: 'Chanson Client A',
      style: 'Afro-love',
      lyrics: '[Verse 1]\nA',
      targetDeliveryDelayMinutes: 12,
      pollIntervalMs: 20,
      fetchImpl: createMockFetch('task_A', 'clientA'),
      log: () => {},
    });

    const p2 = startBackgroundProduction({
      apiKey: 'key',
      db: mockDbFor('order_client_B'),
      orderId: 'order_client_B',
      userId: 'user2',
      conversationId: 'conv2',
      sessionName: 'Test',
      chatId: '22650000002@c.us',
      title: 'Chanson Client B',
      style: 'Dansant',
      lyrics: '[Verse 1]\nB',
      targetDeliveryDelayMinutes: 14,
      pollIntervalMs: 20,
      fetchImpl: createMockFetch('task_B', 'clientB'),
      log: () => {},
    });

    await Promise.all([p1, p2]);
    await new Promise((r) => setTimeout(r, 60));

    const msgsA = enqueuedMap.get('order_client_A') ?? [];
    const msgsB = enqueuedMap.get('order_client_B') ?? [];

    assert.equal(msgsA.length, 3, 'Client A doit recevoir 3 messages');
    assert.equal(msgsB.length, 3, 'Client B doit recevoir 3 messages');

    // Vérifier l'isolation totale
    assert.ok(msgsA[0].p_body.includes('Chanson Client A'));
    assert.equal(msgsA[1].p_media_path, 'https://cdn.kie.ai/audio/clientA_v1.mp3');
    assert.equal(msgsA[2].p_media_path, 'https://cdn.kie.ai/audio/clientA_v2.mp3');

    assert.ok(msgsB[0].p_body.includes('Chanson Client B'));
    assert.equal(msgsB[1].p_media_path, 'https://cdn.kie.ai/audio/clientB_v1.mp3');
    assert.equal(msgsB[2].p_media_path, 'https://cdn.kie.ai/audio/clientB_v2.mp3');
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
