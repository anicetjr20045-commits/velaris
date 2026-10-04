/**
 * Tests de qualité pour le compositeur de paroles et le corpus maison.
 * Vérifie l'interdiction stricte des textes courts et l'application du calibre patron.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectOccasion,
  GOLDEN_PATRON_CORPUS,
  getFewShotExamples,
  getHouseStyleDnaNote,
  checkLyricsQuality,
  buildLyricsRetryFeedback,
} from '../src/llm/lyrics-corpus.js';
import { composeLyrics, reviseLyrics } from '../src/llm/lyrics-composer.js';
import type { LlmProvider, JsonCompletionRequest, JsonCompletion } from '../src/llm/provider.js';

describe('lyrics-corpus: détection des occasions', () => {
  test('anniversaire de naissance', () => {
    assert.equal(detectOccasion('Joyeux anniversaire Sarah 25 ans'), 'anniversaire');
    assert.equal(detectOccasion('Fête de ses 30 ans'), 'anniversaire');
  });

  test('mariage prime sur anniversaire (anniversaire de mariage)', () => {
    assert.equal(detectOccasion('Notre anniversaire de mariage / 10 ans de noces'), 'mariage');
    assert.equal(detectOccasion('Chanson pour mes futurs époux Marc et Laure'), 'mariage');
  });

  test('hommage / deuil', () => {
    assert.equal(detectOccasion('Hommage à notre mère décédée Mariam'), 'hommage');
    assert.equal(detectOccasion('In memoriam pour celui qui nous a quittés'), 'hommage');
  });

  test('naissance / baptême', () => {
    assert.equal(detectOccasion('Pour la naissance de notre petit bébé Ethan'), 'naissance');
    assert.equal(detectOccasion('Baptême de notre fille'), 'naissance');
  });

  test('fête des pères / mères', () => {
    assert.equal(detectOccasion('Bonne fête Papa chéri'), 'fete');
    assert.equal(detectOccasion('Fête des mères pour Maman Thérèse'), 'fete');
  });

  test('amour / romance', () => {
    assert.equal(detectOccasion("Déclaration d'amour pour ma chérie Aminata"), 'amour');
    assert.equal(detectOccasion("Je t'aime mon cœur"), 'amour');
  });
});

describe('lyrics-corpus: bibliothèque étalon et ADN maison', () => {
  test('la bibliothèque contient des hits étalons longs (> 35 vers)', () => {
    assert.ok(GOLDEN_PATRON_CORPUS.length >= 4);
    for (const hit of GOLDEN_PATRON_CORPUS) {
      assert.ok(hit.lineCount >= 35, `Le hit ${hit.id} doit avoir au moins 35 vers`);
      assert.ok(hit.lyrics.includes('[Intro]'));
      assert.ok(hit.lyrics.includes('[Refrain]'));
      assert.ok(hit.lyrics.includes('[Couplet 1]'));
      assert.ok(hit.lyrics.includes('[Pont]'));
      assert.ok(hit.lyrics.includes('[Outro]'));
    }
  });

  test('getFewShotExamples sélectionne les exemples pertinents', () => {
    const annivHits = getFewShotExamples('anniversaire', 'Afro-pop', 2);
    assert.equal(annivHits.length, 2);
    assert.equal(annivHits[0]?.occasion, 'anniversaire');

    const amourHits = getFewShotExamples('amour', null, 2);
    assert.equal(amourHits[0]?.occasion, 'amour');
  });

  test("l'ADN maison interdit explicitement les textes courts", () => {
    const dna = getHouseStyleDnaNote();
    assert.match(dna, /PAS DE TEXTE COURT/i);
    assert.match(dna, /32 à 48 vers/i);
    assert.match(dna, /STRICTEMENT INTERDIT/i);
  });
});

describe('lyrics-corpus: contrôle qualité déterministe', () => {
  test('un hit patron complet passe le contrôle avec succès', () => {
    const hit = GOLDEN_PATRON_CORPUS.find((h) => h.id === 'gold-anniv-01')!;
    const report = checkLyricsQuality(hit.lyrics, {
      recipientName: 'Sarah',
      occasion: 'anniversaire',
      minVerses: 25,
      minWords: 200,
      minChars: 1200,
    });
    assert.equal(report.ok, true);
    assert.equal(report.issues.length, 0);
    assert.ok(report.verseCount >= 30);
    assert.ok(report.recipientHits >= 3);
  });

  test('un brouillon court est impitoyablement rejeté', () => {
    const shortDraft = `[Style: Afro-pop]
[Intro]
Bonjour tout le monde.
[Couplet 1]
Sarah est gentille.
Elle est courageuse.
[Refrain]
Joyeux anniversaire Sarah.`;

    const report = checkLyricsQuality(shortDraft, {
      recipientName: 'Sarah',
      occasion: 'anniversaire',
    });

    assert.equal(report.ok, false);
    assert.ok(report.issues.some((i) => i.includes('Texte trop court')));
    assert.ok(report.issues.some((i) => i.includes('Section [Pont] absente')));

    const retryPrompt = buildLyricsRetryFeedback(report);
    assert.match(retryPrompt, /Pas de texte court/i);
  });

  test('cliché plat interdit est détecté', () => {
    const draftWithCliché = `[Style: Afro-pop]
[Intro]
C'est pour toi…
[Couplet 1]
Tu es le rayon de soleil de ma vie…
Sarah tu es ma douceur…
[Refrain]
Joyeux anniversaire Sarah…
[Pont]
Prière pour toi…
[Outro]
Fin…`;

    const report = checkLyricsQuality(draftWithCliché, { recipientName: 'Sarah' });
    assert.ok(report.issues.some((i) => i.includes('Cliché')));
  });
});

describe('lyrics-composer: composeLyrics & reviseLyrics', () => {
  test('composeLyrics génère un texte complet et long avec les balises Suno', async () => {
    const sampleLyrics = `[Style: Afro-pop acoustique]
[Intro]
Ohhh… Bienvenue à tous…
Aujourd'hui nous célébrons une reine…
Sarah, cette chanson est pour toi…

[Couplet 1]
Depuis le premier jour que tu es parmi nous…
Ta générosité et ta douceur sont douces comme le miel…
Tu portes la famille sur tes épaules solides…
Chaque道 sourire que tu donnes est une étoile qui nous guide…
Sarah, ton cœur ne connaît pas la rancœur…
Tu sèmes l'espérance et la joie à chaque heure…

[Pré-Refrain]
La musique commence à résonner…
Tout le monde est debout pour t'acclamer…

[Refrain]
Joyeux anniversaire Sarah, notre fierté…
Que Dieu bénisse ta vie pour l'éternité…
Santé, bonheur, élévation et longue vie…
Sarah, reine de nos cœurs aujourd'hui…

[Couplet 2]
Rappelle-toi nos épreuves et nos combats passés…
Tu n'as jamais baissé les bras, toujours déterminée…
Merci pour tes sacrifices consentis dans l'ombre…
Grâce à ta prière, nos chemins ne sont plus sombres…
Aujourd'hui nous t'honorons avec respect et amour…
Sois comblée de grâces chaque jour…

[Refrain]
Joyeux anniversaire Sarah, notre fierté…
Que Dieu bénisse ta vie pour l'éternité…
Santé, bonheur, élévation et longue vie…
Sarah, reine de nos cœurs aujourd'hui…

[Pont]
Que les bénédictions du ciel descendent sur toi…
Que chaque porte fermée s'ouvre devant tes pas…
Sarah, nous sommes fiers de marcher à tes côtés…
Une lumière éclatante pour toute notre maisonnée…

[Refrain Final]
Joyeux anniversaire Sarah, notre fierté…
Que Dieu bénisse ta vie pour l'éternité…
Santé, bonheur, élévation et longue vie…
Sarah, reine de nos cœurs aujourd'hui…

[Outro]
Danse et réjouis-toi en ce jour béni…
Sarah, nous t'aimons pour la vie…
Joyeux anniversaire…`;

    const fakeLlm: LlmProvider = {
      name: 'deepseek-chat',
      async completeJson(req: JsonCompletionRequest): Promise<JsonCompletion> {
        assert.match(req.system, /PAS DE TEXTE COURT/i);
        assert.match(req.system, /Lumière de nos Vies/); // Golden hit injecté
        return {
          data: {
            title: 'Lumière Éternelle pour Sarah',
            lyrics: sampleLyrics,
          },
          model: 'deepseek-chat',
          usage: { promptTokens: 300, completionTokens: 450, cacheHitTokens: 100 },
          latencyMs: 120,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const res = await composeLyrics(fakeLlm, {
      recipientName: 'Sarah',
      occasion: 'anniversaire',
      style: 'Afro-pop acoustique',
    });

    assert.equal(res.title, 'Lumière Éternelle pour Sarah');
    assert.ok(res.lyrics.includes('[Intro]'));
    assert.ok(res.lyrics.includes('[Refrain]'));
    assert.ok(res.lyrics.includes('Joyeux anniversaire Sarah'));
    assert.ok(res.lyrics.length > 1000);
  });

  test('composeLyrics déclenche une relance corrective si le premier jet est trop court', async () => {
    let callCount = 0;
    const shortLyrics = `[Style: Afro-pop]
[Intro] Court
[Couplet 1] Sarah
[Refrain] Joyeux anniversaire Sarah`;

    const longLyrics = `[Style: Afro-pop acoustique]
[Intro]
Ohhh… Ambiance de fête…
Sarah, ce jour est à toi…
[Couplet 1]
Tu es notre guide et notre inspiration…
Chaque instant passé avec toi est une bénédiction…
Ta présence apaise nos cœurs troublés…
Sarah, tu as toujours su nous relever…
Un cœur d'or et une force tranquille…
Dans ce monde agité, tu es notre asile…
[Pré-Refrain]
Levons nos verres pour célébrer…
[Refrain]
Joyeux anniversaire Sarah, notre lumière…
Que la grâce descende sur toi entière…
Santé, paix et longévité…
Sarah chérie pour l'éternité…
[Couplet 2]
Toutes ces années d'amour et de fidélité…
Tu as semé le bonheur sans jamais hésiter…
Merci pour ta bonté et ta générosité…
[Refrain]
Joyeux anniversaire Sarah, notre lumière…
Que la grâce descende sur toi entière…
Santé, paix et longévité…
Sarah chérie pour l'éternité…
[Pont]
Que Dieu t'accorde ses plus grands bienfaits…
Dans la joie et le parfait succès…
[Refrain Final]
Joyeux anniversaire Sarah, notre lumière…
[Outro]
Pour toujours avec toi…
Sarah…`;

    const fakeLlm: LlmProvider = {
      name: 'deepseek-chat',
      async completeJson(req: JsonCompletionRequest): Promise<JsonCompletion> {
        callCount++;
        if (callCount === 1) {
          return {
            data: { title: 'Titre Court', lyrics: shortLyrics },
            model: 'deepseek-chat',
            usage: { promptTokens: 200, completionTokens: 50, cacheHitTokens: 0 },
            latencyMs: 80,
            attempts: 1,
            reasoningDiscarded: false,
          };
        }
        // Second appel (relance corrective)
        assert.ok(req.messages.some((m) => typeof m.content === 'string' && m.content.includes('CORRECTION IMPÉRATIVE')));
        return {
          data: { title: 'Titre Corrigé et Étoffé', lyrics: longLyrics },
          model: 'deepseek-chat',
          usage: { promptTokens: 350, completionTokens: 400, cacheHitTokens: 0 },
          latencyMs: 140,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const res = await composeLyrics(fakeLlm, {
      recipientName: 'Sarah',
      occasion: 'anniversaire',
    });

    assert.equal(callCount, 2, 'Doit avoir fait 2 appels (1 jet + 1 relance corrective)');
    assert.equal(res.title, 'Titre Corrigé et Étoffé');
    assert.ok(res.lyrics.length > shortLyrics.length);
  });

  test('reviseLyrics applique les modifications en conservant la longueur et la structure', async () => {
    const existing = `[Style: Afro-pop]
[Intro] Pour Awa
[Couplet 1] Awa est merveilleuse et courageuse
Dans chaque épreuve elle nous a guidés
[Refrain] Awa mon amour et ma complice
Bénie soit ta vie pour l'éternité
[Outro] Fin en douceur`;

    const revisedLyrics = `[Style: Afro-pop]
[Intro] Pour Fatou
[Couplet 1] Fatou est merveilleuse et courageuse
Dans chaque épreuve elle nous a guidés
[Refrain] Fatou mon amour et ma complice
Bénie soit ta vie pour l'éternité
[Outro] Fin en douceur`;

    const fakeLlm: LlmProvider = {
      name: 'deepseek-chat',
      async completeJson(_req: JsonCompletionRequest): Promise<JsonCompletion> {
        return {
          data: { title: 'Chanson pour Fatou', lyrics: revisedLyrics },
          model: 'deepseek-chat',
          usage: { promptTokens: 200, completionTokens: 100, cacheHitTokens: 0 },
          latencyMs: 90,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };

    const res = await reviseLyrics(fakeLlm, {
      existingLyrics: existing,
      changeRequest: 'Remplacer Awa par Fatou',
      recipientName: 'Fatou',
      occasion: 'amour',
    });

    assert.equal(res.title, 'Chanson pour Fatou');
    assert.ok(res.lyrics.includes('Fatou'));
  });
});
