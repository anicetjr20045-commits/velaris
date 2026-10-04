/**
 * Service de composition et retouche poétique autonome de paroles.
 * Format 100% compatible Suno avec balises de structure [Couplet], [Refrain], [Pont], [Outro].
 */

import type { LlmProvider } from './provider.js';

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
  const systemPrompt = `Tu es le compositeur et parolier officiel du studio ${input.studioName ?? 'Velaris Studio'}.
Tu rédiges les paroles d'une chanson personnalisée poétique, émouvante et rythmée, prête à être chantée et enregistrée en studio (format Suno).

Règles impératives de composition :
1. Structure complète :
   [Style: ${input.style || 'Afro-pop acoustique douce et chaleureuse'}]
   [Couplet 1] (4 à 6 vers posant le décor avec mention claire du prénom ${input.recipientName})
   [Refrain] (4 vers entraînants, mélodieux et mémorables)
   [Couplet 2] (4 à 6 vers intégrant les souvenirs, anecdotes ou qualités)
   [Refrain]
   [Pont] (2 à 4 vers d'émotion pure et d'intensité)
   [Outro] (2 vers de bénédiction / célébration)
2. Mentionne distinctement le prénom « ${input.recipientName} » dans les couplets et le refrain.
3. Rimes soignées, poésie authentique, vocabulaire chaleureux et respectueux d'Afrique de l'Ouest.
4. Longueur totale : entre 1 200 et 2 400 caractères.
5. Zéro commentaire, zéro bavardage hors des paroles.

Réponds obligatoirement par un objet JSON pur :
{
  "title": "Titre poétique de la chanson",
  "lyrics": "Texte intégral des paroles avec les balises [Couplet 1], [Refrain], etc."
}`;

  const memoriesText = input.memories?.length
    ? input.memories.map((m) => `- ${m}`).join('\n')
    : '(aucun souvenir particulier fourni)';

  const userPrompt = `Détails de la commande :
- Destinataire : ${input.recipientName} (${input.recipientRelation || 'proche'})
- Occasion : ${input.occasion}
- De la part de : ${input.senderName || 'une personne qui l\'aime'}
- Style : ${input.style || 'Afro-pop acoustique'}
- Langue : ${input.language || 'Français'}
- Souvenirs et qualités :
${memoriesText}

Rédige les paroles complètes et renvoie l'objet JSON.`;

  const res = await llm.completeJson({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1500,
    temperature: 0.3,
  });

  const title = typeof res.data.title === 'string' && res.data.title.trim()
    ? res.data.title.trim()
    : `Chanson pour ${input.recipientName}`;
  const lyrics = typeof res.data.lyrics === 'string' && res.data.lyrics.trim()
    ? res.data.lyrics.trim()
    : '';

  if (!lyrics || lyrics.length < 200) {
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
1. Conserve impérativement 85% à 90% de la structure, du refrain et des vers de la version existante qui convenaient déjà au client.
2. Modifie UNIQUEMENT les vers ou les strophes directement ciblés par la demande du client.
3. Préserve la métrique, les rimes et le rythme musical.
4. Longueur totale : entre 1 200 et 2 500 caractères.
5. Zéro commentaire, zéro bavardage hors des paroles.

Réponds obligatoirement par un objet JSON pur :
{
  "title": "Titre de la chanson",
  "lyrics": "Texte intégral corrigé avec les balises [Couplet 1], [Refrain], etc."
}`;

  const userPrompt = `Paroles existantes (V1) :
${input.existingLyrics}

Modifications demandées par le client :
${input.changeRequest}

Destinataire : ${input.recipientName}
Occasion : ${input.occasion}

Applique les modifications chirurgicales et renvoie l'objet JSON avec les paroles révisées.`;

  const res = await llm.completeJson({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1500,
    temperature: 0.2,
  });

  const title = typeof res.data.title === 'string' && res.data.title.trim()
    ? res.data.title.trim()
    : `Chanson pour ${input.recipientName}`;
  const lyrics = typeof res.data.lyrics === 'string' ? res.data.lyrics.trim() : '';

  if (!lyrics || lyrics.length < 200) {
    throw new Error('Paroles révisées générées invalides ou trop courtes');
  }

  return { title, lyrics };
}
