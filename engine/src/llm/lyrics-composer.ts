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
  recipientRelation?: string | null | undefined;
  senderName?: string | null | undefined;
  style?: string | null | undefined;
  voice?: 'male' | 'female' | 'duo' | string | null | undefined;
  language?: string | null | undefined;
  memories?: readonly string[] | undefined;
  studioName?: string | undefined;
}

export interface ReviseLyricsInput {
  existingLyrics: string;
  changeRequest: string;
  recipientName: string;
  occasion: string;
  studioName?: string | undefined;
}

export interface LyricsResult {
  title: string;
  lyrics: string;
}

export interface ChatMessageForBrief {
  role: 'client' | 'agent' | 'merchant';
  text: string;
  createdAt?: string;
  isVoice?: boolean;
}

export interface ExtractLyricsBriefInput {
  messages: readonly ChatMessageForBrief[];
  reactedText?: string | null;
  studioName?: string;
}

export interface SongBriefTarget {
  recipientName: string;
  recipientRelation?: string | null;
  senderName?: string | null;
  occasion: string;
  style?: string | null;
  voice?: 'male' | 'female' | 'duo' | null;
  language?: string | null;
  memories: string[];
  explanation?: string | null;
}

export interface ExtractLyricsBriefResult {
  briefs: SongBriefTarget[];
  isMultiSong: boolean;
  notes?: string;
}

/**
 * Extrait avec précision le ou les briefs de chanson à partir de l'historique d'une discussion.
 * Résout les rôles complexes (intermédiaire vs narrateur vs destinataire) et sépare les commandes multiples.
 */
export async function extractLyricsBriefFromChat(
  llm: LlmProvider,
  input: ExtractLyricsBriefInput,
): Promise<ExtractLyricsBriefResult> {
  const formattedChat = input.messages
    .filter((m) => m.text && m.text.trim().length > 0)
    .map((m) => {
      const tag = m.role === 'client' ? 'Client' : m.role === 'merchant' ? 'Gérant' : 'Studio';
      const voiceTag = m.isVoice ? ' [Note vocale transcrite]' : '';
      return `${tag}${voiceTag}: ${m.text.trim()}`;
    })
    .join('\n');

  const reactedAnchor = input.reactedText
    ? `\n\nANCRE PARTICULIÈRE (Message ciblé par la réaction du gérant) :\n"${input.reactedText.trim()}"`
    : '';

  const systemPrompt = `Tu es le directeur artistique et analyste en chef d'élite du studio ${input.studioName ?? 'Velaris Studio'}.
Ta mission est d'extraire avec une rigueur absolue toutes les informations nécessaires à la rédaction de paroles de chansons personnalisées à partir de l'historique d'une conversation WhatsApp (incluant les messages écrits et les transcriptions des notes vocales).

DÉFIS MAJEURS ET RÈGLES STRICTES D'ANALYSE :

1. RÉSOLUTION DES RÔLES (QUI CHANTE À QUI ?) :
   - En Afrique de l'Ouest et dans les commandes de studio, il arrive très fréquemment qu'une personne WhatsApp soit un INTERMÉDIAIRE qui passe commande pour le compte de quelqu'un d'autre (ex: une amie qui commande pour sa copine Fatou afin de l'offrir au mari de sa copine).
   - "senderName" (Expéditeur / Voix narrative de la chanson) : Doit impérativement être la personne AU NOM DE QUI la chanson s'exprime (dans l'exemple, c'est l'épouse Fatou, et NON l'amie intermédiaire WhatsApp !). Si le client commande directement pour son propre proche, "senderName" est le prénom ou statut du client.
   - "recipientName" (Destinataire) : La personne fêtée / honorée par la chanson (dans l'exemple, c'est le mari).
   - "recipientRelation" : Le lien entre la voix narrative et le destinataire (ex: époux, épouse, mère, père, ami d'enfance, mentor...).

2. COMMANDES MULTIPLES / MULTI-TEXTES :
   - Si le client demande 2 chansons différentes (ex: une pour sa mère Awa et une pour son père Moussa), sépare STRICTEMENT les deux fiches dans le tableau "briefs" et mets "isMultiSong": true.
   - Chaque fiche doit contenir uniquement les souvenirs, prénoms et qualités qui lui appartiennent.
   - Si le client ne commande qu'une seule chanson, renvoie un tableau "briefs" avec un seul élément et "isMultiSong": false.

3. SOUVENIRS, QUALITÉS & ANECDOTES :
   - Extraire tous les détails concrets disséminés dans la conversation (surnoms, dates, années d'épreuves, qualités morales, expressions, remerciements, prières ou vœux).
   - Conserver les vrais mots du client, sans inventer des faits non mentionnés.

4. OCCASION, STYLE & VOIX SOUHAITÉE :
   - Identifier précisément l'occasion (anniversaire, mariage, déclaration d'amour, hommage, naissance, etc.).
   - Si un style musical est suggéré par le client ou le gérant (ex: "un truc doux", "afrobeat", "zouk", "acoustique", "dansant"), le noter fidèlement. Sinon, laisser null.
   - "voice" ("male" | "female" | "duo" | null) : Identifier la voix appropriée.
     * Si mention explicite ("voix homme", "voix masculine", "chanteur") -> "male".
     * Si mention explicite ("voix femme", "voix féminine", "chanteuse") -> "female".
     * Si un homme commande pour lui-même (ex: "chanson pour moi-même YACOU Le Roi") -> "male".
     * Si une femme commande pour son mari/fiancé sans précision de voix -> "female" (chanteuse qui porte sa voix) ou selon le contexte.

Format JSON strict obligatoire :
{
  "isMultiSong": boolean,
  "briefs": [
    {
      "recipientName": "Prénom du destinataire",
      "recipientRelation": "Lien de relation",
      "senderName": "Personne au nom de qui la chanson parle",
      "occasion": "Occasion exacte",
      "style": "Style musical ou null",
      "voice": "male" | "female" | "duo" | null,
      "language": "Français",
      "memories": ["Anecdote 1", "Qualité 2"],
      "explanation": "Explication de la dynamique des rôles"
    }
  ]
}`;

  const userPrompt = `Voici la discussion avec le client :
${formattedChat || '(discussion vide)'}
${reactedAnchor}

Analyse la discussion, résous les rôles, extrais les détails clés et renvoie le JSON pur.`;

  const res = await llm.completeJson({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2000,
    temperature: 0.1,
  });

  const data = res.data as any;
  const isMultiSong = Boolean(data.isMultiSong);
  const rawBriefs = Array.isArray(data.briefs) ? data.briefs : [];

  const briefs: SongBriefTarget[] = rawBriefs.map((b: any) => {
    let rawVoice: 'male' | 'female' | 'duo' | null = null;
    if (typeof b.voice === 'string') {
      const vl = b.voice.toLowerCase();
      if (vl.includes('masc') || vl.includes('homme') || vl.includes('male')) rawVoice = 'male';
      else if (vl.includes('fem') || vl.includes('female')) rawVoice = 'female';
      else if (vl.includes('duo') || vl.includes('duet') || vl.includes('mixte')) rawVoice = 'duo';
    }

    return {
      recipientName: typeof b.recipientName === 'string' && b.recipientName.trim() ? b.recipientName.trim() : 'Mon Proche',
      recipientRelation: typeof b.recipientRelation === 'string' ? b.recipientRelation.trim() : null,
      senderName: typeof b.senderName === 'string' ? b.senderName.trim() : null,
      occasion: typeof b.occasion === 'string' && b.occasion.trim() ? b.occasion.trim() : 'Chanson personnalisée',
      style: typeof b.style === 'string' ? b.style.trim() : null,
      voice: rawVoice,
      language: typeof b.language === 'string' ? b.language.trim() : 'Français',
      memories: Array.isArray(b.memories) ? b.memories.map((m: any) => String(m).trim()).filter(Boolean) : [],
      explanation: typeof b.explanation === 'string' ? b.explanation.trim() : null,
    };
  });

  // Fallback si la liste est vide mais qu'on a du texte
  if (briefs.length === 0) {
    briefs.push({
      recipientName: 'Mon Proche',
      recipientRelation: 'Proche',
      senderName: null,
      occasion: 'Chanson personnalisée',
      style: 'Afro-pop acoustique douce',
      language: 'Français',
      memories: [],
      explanation: 'Extraction par défaut',
    });
  }

  return {
    briefs,
    isMultiSong,
  };
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
   [Style: ${input.style || 'Afro-pop acoustique douce et entraînante'} | Voix: ${input.voice === 'male' ? 'masculine' : input.voice === 'duo' ? 'duo' : 'féminine'}]
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
- Voix souhaitée : ${input.voice === 'male' ? 'voix masculine (chanteur)' : input.voice === 'duo' ? 'voix duo mixte' : 'voix féminine (chanteuse)'}
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
