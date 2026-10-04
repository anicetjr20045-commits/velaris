/**
 * Service de composition et retouche poétique autonome de paroles.
 * Format 100% compatible Suno avec balises de structure complètes.
 * Intègre l'ADN de style maison et la bibliothèque de référence (Golden Hits) du fondateur.
 * RÈGLE ABSOLUE : PAS DE TEXTE COURT.
 */

import type { LlmProvider } from './provider.js';
import {
  detectOccasion,
  getHouseStyleDnaNote,
  getFewShotExamples,
  checkLyricsQuality,
  buildLyricsRetryFeedback,
  type SongOccasion,
} from './lyrics-corpus.js';

export interface ComposeLyricsInput {
  recipientName: string;
  occasion: string;
  recipientRelation?: string | null;
  senderName?: string | null;
  style?: string | null;
  language?: string | null;
  memories?: readonly string[];
  studioName?: string;
}

export interface ReviseLyricsInput {
  existingLyrics: string;
  changeRequest: string;
  recipientName: string;
  occasion: string;
  studioName?: string;
}

export interface LyricsResult {
  title: string;
  lyrics: string;
}

export async function composeLyrics(
  llm: LlmProvider,
  input: ComposeLyricsInput,
): Promise<LyricsResult> {
  const occasionType: SongOccasion = detectOccasion(input.occasion);
  const goldenExamples = getFewShotExamples(occasionType, input.style, 2);
  const dnaNote = getHouseStyleDnaNote();

  const examplesPrompt = goldenExamples
    .map(
      (ex, idx) =>
        `--- EXEMPLE DE RÉFÉRENCE MAISON ${idx + 1} (${ex.title} - ${ex.occasion}) ---\n${ex.lyrics}`,
    )
    .join('\n\n');

  const birthdayInstruction =
    occasionType === 'anniversaire'
      ? '4. OCCASION ANNIVERSAIRE : la formule exacte « Joyeux anniversaire » DOIT impérativement apparaître dans CHAQUE refrain de manière naturelle et chantante.'
      : '';

  const systemPrompt = `Tu es le compositeur et parolier officiel d'élite du studio ${input.studioName ?? 'Velaris Studio'}.
Tu rédiges les paroles intégrales d'une chanson personnalisée poétique, émouvante, noble et rythmée, prête à être chantée et enregistrée en studio (format 100% compatible Suno).

${dnaNote}

🎨 EXEMPLES DE LA PLUME MAISON À ÉGALER EN QUALITÉ ET EN LONGUEUR :
${examplesPrompt}

RÈGLES D'OR DE COMPOSITION DU STUDIO :
1. INTERDICTION FORMELLE DE FAIRE COURT (RÈGLE ABSOLUE DU FONDATEUR) :
   - Fournis un texte ample, généreux et complet d'au moins 32 à 48 vers utiles.
   - Ne résume jamais, ne tronque aucune section.
   - Les couplets doivent être riches (6 à 8 vers chacun), le pont profond (4 à 6 vers), l'outro soignée.
2. Structure Suno obligatoire avec balises :
   [Style: ${input.style || 'Afro-pop acoustique douce et entraînante'}]
   [Intro] (3 à 5 vers posant l'atmosphère chaleureuse avec « … »)
   [Couplet 1] (6 à 8 vers posant le décor avec mention claire du prénom ${input.recipientName})
   [Pré-Refrain] (2 à 4 vers de montée d'énergie)
   [Refrain] (4 à 6 vers entraînants, mélodieux et mémorables, répétant le prénom ${input.recipientName})
   [Couplet 2] (6 à 8 vers intégrant les souvenirs précis, anecdotes, qualités ou épreuves surmontées)
   [Refrain]
   [Pont] (4 à 6 vers de haute intensité émotionnelle, prière, vœux profonds ou hommage)
   [Refrain Final] (4 à 6 vers en apothéose)
   [Outro] (3 à 5 vers de conclusion bienveillante)
3. Mentionne distinctement le prénom « ${input.recipientName} » dans les couplets et les refrains.
${birthdayInstruction}
5. Rimes soignées (AABB ou ABAB), musicalité fluide, vocabulaire chaleureux et respectueux d'Afrique de l'Ouest.
6. Zéro bavardage, zéro commentaire hors de l'objet JSON.

Réponds obligatoirement par un objet JSON pur :
{
  "title": "Titre poétique et valorisant de la chanson",
  "lyrics": "Texte intégral des paroles avec toutes les balises Suno [Intro], [Couplet 1], etc."
}`;

  const memoriesText = input.memories?.length
    ? input.memories.map((m) => `- ${m}`).join('\n')
    : '(aucun souvenir particulier fourni)';

  const userPrompt = `Détails de la commande studio :
- Destinataire : ${input.recipientName} (${input.recipientRelation || 'proche'})
- Occasion : ${input.occasion}
- De la part de : ${input.senderName || "une personne qui l'aime profondément"}
- Style musical souhaité : ${input.style || 'Afro-pop acoustique douce'}
- Langue : ${input.language || 'Français'}
- Souvenirs, qualités et anecdotes à intégrer :
${memoriesText}

Rédige les paroles complètes et généreuses (longueur patron : 32 à 48 vers) et renvoie l'objet JSON.`;

  const res = await llm.completeJson({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2500,
    temperature: 0.3,
  });

  let title =
    typeof res.data.title === 'string' && res.data.title.trim()
      ? res.data.title.trim()
      : `Chanson pour ${input.recipientName}`;
  let lyrics = typeof res.data.lyrics === 'string' ? res.data.lyrics.trim() : '';

  if (!lyrics || lyrics.length < 50) {
    throw new Error('Paroles générées vides ou invalides');
  }

  // Contrôle qualité déterministe (calibre patron)
  const quality = checkLyricsQuality(lyrics, {
    recipientName: input.recipientName,
    occasion: input.occasion,
    minVerses: 26,
    minWords: 200,
    minChars: 1300,
  });

  // Si le premier jet est trop court ou défaillant, relance corrective automatique ciblée
  if (!quality.ok) {
    try {
      const retryFeedback = buildLyricsRetryFeedback(quality);
      const retryRes = await llm.completeJson({
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: JSON.stringify({ title, lyrics }) },
          { role: 'user', content: retryFeedback },
        ],
        maxTokens: 2500,
        temperature: 0.25,
      });

      const retryTitle =
        typeof retryRes.data.title === 'string' && retryRes.data.title.trim()
          ? retryRes.data.title.trim()
          : title;
      const retryLyrics =
        typeof retryRes.data.lyrics === 'string' ? retryRes.data.lyrics.trim() : '';

      if (retryLyrics.length > lyrics.length) {
        title = retryTitle;
        lyrics = retryLyrics;
      }
    } catch (retryErr) {
      console.warn('Relance corrective paroles ignorée, conservation du premier jet:', retryErr);
    }
  }

  if (lyrics.length < 150) {
    throw new Error('Paroles générées invalides ou trop courtes');
  }

  return { title, lyrics };
}

export async function reviseLyrics(
  llm: LlmProvider,
  input: ReviseLyricsInput,
): Promise<LyricsResult> {
  const systemPrompt = `Tu es le compositeur et parolier officiel du studio ${input.studioName ?? 'Velaris Studio'}.
Tu dois apporter une correction chirurgicale et ciblée à des paroles déjà existantes, selon les souhaits exacts du client.

Règles impératives de retouche :
1. CONSERVE IMPÉRATIVEMENT 80% À 90% DE LA STRUCTURE ET DES VERS existants qui convenaient déjà au client.
2. Modifie UNIQUEMENT les vers ou les strophes directement concernés par la demande de modification.
3. RÈGLE MAISON : NE RACCOURCIS JAMAIS LE TEXTE. La chanson doit conserver toute sa richesse, son amplitude et sa longueur d'origine.
4. Préserve la métrique, les rimes et le rythme musical Suno.
5. Zéro commentaire, zéro bavardage hors de l'objet JSON.

Réponds obligatoirement par un objet JSON pur :
{
  "title": "Titre de la chanson",
  "lyrics": "Texte intégral corrigé avec les balises Suno [Intro], [Couplet 1], [Refrain], etc."
}`;

  const userPrompt = `Paroles existantes (V1) :
${input.existingLyrics}

Modifications demandées par le client :
${input.changeRequest}

Destinataire : ${input.recipientName}
Occasion : ${input.occasion}

Applique les modifications chirurgicales en préservant l'intégralité de la longueur et du texte non modifié, puis renvoie l'objet JSON.`;

  const res = await llm.completeJson({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2500,
    temperature: 0.2,
  });

  const title =
    typeof res.data.title === 'string' && res.data.title.trim()
      ? res.data.title.trim()
      : `Chanson pour ${input.recipientName}`;
  const lyrics = typeof res.data.lyrics === 'string' ? res.data.lyrics.trim() : '';

  if (!lyrics || lyrics.length < 100) {
    throw new Error('Paroles révisées générées invalides ou trop courtes');
  }

  return { title, lyrics };
}
