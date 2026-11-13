import { createHash } from 'node:crypto';
/**
 * Service de production musicale Suno V6 via Kie.ai et livraison WhatsApp.
 *
 * Déclenché par la réaction emoji 🎵 (confirm_and_produce).
 * - Formate les paroles selon les conventions Suno V6 ([Verse], [Chorus]...)
 * - Envoie la requête de génération à l'API officielle Kie.ai (POST /generate)
 * - Suit la génération en arrière-plan via polling périodique (record-info)
 * - Dès que le morceau est prêt :
 *     1. Fait progresser la commande vers 'delivery_sent' (agent_transition_order)
 *     2. Met en file WhatsApp (outbox) la note vocale pour livraison au client
 * - Respecte strictement la protection des sessions sensibles (ex: anicet2)
 */

import type { Db } from '../db/rest.js';

export const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';

export interface KieSongInput {
  lyrics: string;
  voice?: 'male' | 'female' | 'duo' | string | null | undefined;
  style?: string | null | undefined;
  title?: string | null | undefined;
  orderId?: string | null | undefined;
}

export interface KieGenerateResponse {
  success: boolean;
  taskId?: string | undefined;
  error?: string | undefined;
}

export interface KiePollResponse {
  status: 'pending' | 'running' | 'success' | 'failed';
  audioUrl?: string | undefined;
  duration?: number | undefined;
  error?: string | undefined;
}

export interface ParsedLyricsHeader {
  style: string | null;
  voice: 'male' | 'female' | 'duo' | null;
  rawVoice: string | null;
  title: string | null;
  lyrics: string;
}

/**
 * Analyse chirurgicale de l'en-tête du message de paroles.
 * Extrait le style, la voix (normalisée) et le titre si présents.
 * Retire intégralement les lignes d'en-tête pour ne laisser que les paroles pures.
 */
export function parseLyricsHeader(raw: string): ParsedLyricsHeader {
  let style: string | null = null;
  let voice: string | null = null;
  let title: string | null = null;
  const lines = raw.split('\n');
  const lyricsLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Enlever crochets extérieurs si présents : "[Style: ...]" -> "Style: ..."
    const unbracketed = trimmed.replace(/^\[(.*)\]$/, '$1').trim();

    // Détection des métadonnées (Style, Voix, Voice, Titre, Title)
    if (
      /^(?:style|voix|voice|titre|title)\s*[:=]/i.test(unbracketed) ||
      /\|\s*(?:voix|voice|style|titre|title)\s*[:=]/i.test(unbracketed)
    ) {
      const segments = unbracketed.split(/[|;]/);
      for (const seg of segments) {
        const s = seg.trim();
        const sm = s.match(/^style\s*[:=]\s*(.+)$/i);
        const vm = s.match(/^(?:voix|voice)\s*[:=]\s*(.+)$/i);
        const tm = s.match(/^(?:titre|title)\s*[:=]\s*(.+)$/i);
        if (sm && sm[1]) style = sm[1].trim();
        if (vm && vm[1]) voice = vm[1].trim();
        if (tm && tm[1]) title = tm[1].trim();
      }
      continue;
    }

    lyricsLines.push(line);
  }

  let normalizedVoice: 'male' | 'female' | 'duo' | null = null;
  if (voice) {
    const v = voice.toLowerCase();
    if (v.includes('fem') || v.includes('femme') || v.includes('fémin')) normalizedVoice = 'female';
    else if (v.includes('masc') || v.includes('homme')) normalizedVoice = 'male';
    else if (v.includes('duo') || v.includes('duet') || v.includes('mixte')) normalizedVoice = 'duo';
  }

  // Si le style mentionne aussi la voix (ex: "Style: Afro-love voix femme")
  if (!normalizedVoice && style) {
    const s = style.toLowerCase();
    if (s.includes('femme') || s.includes('féminine') || s.includes('voix femme') || s.includes('voix féminine')) {
      normalizedVoice = 'female';
    } else if (s.includes('homme') || s.includes('masculin') || s.includes('voix homme') || s.includes('voix masculine')) {
      normalizedVoice = 'male';
    } else if (s.includes('duo') || s.includes('duet')) {
      normalizedVoice = 'duo';
    }
  }

  return {
    style,
    voice: normalizedVoice,
    rawVoice: voice,
    title,
    lyrics: lyricsLines.join('\n').trim(),
  };
}

/**
 * Conversion déterministe d'un nombre à deux chiffres en lettres françaises.
 */
export function twoDigitsToFrench(n: number | string, padZero = false): string {
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'];

  const num = typeof n === 'number' ? n : parseInt(n, 10);
  if (isNaN(num)) return String(n);

  if (num < 10) return padZero ? `zéro ${units[num]}` : (units[num] ?? String(num));
  if (num < 20) return teens[num - 10] ?? String(num);
  if (num < 70) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (u === 0) return tens[t] ?? String(num);
    if (u === 1) return `${tens[t]} et un`;
    return `${tens[t]}-${units[u]}`;
  }
  if (num < 80) {
    const u = num - 60;
    if (u === 11) return 'soixante et onze';
    return `soixante-${teens[u - 10]}`;
  }
  if (num < 90) {
    const u = num - 80;
    if (u === 0) return 'quatre-vingts';
    return `quatre-vingt-${units[u]}`;
  }
  if (num < 100) {
    const u = num - 80;
    return `quatre-vingt-${teens[u - 10]}`;
  }
  return String(num);
}

/**
 * Conversion d'un entier en mots français complets (jusqu'à 999 999).
 */
export function numberToFrenchWords(n: number | string): string {
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];

  function below100(num: number): string {
    return twoDigitsToFrench(num, false);
  }

  function below1000(num: number): string {
    if (num < 100) return below100(num);
    const h = Math.floor(num / 100);
    const rem = num % 100;
    const hStr = h === 1 ? 'cent' : `${units[h]} cent${rem === 0 ? 's' : ''}`;
    if (rem === 0) return hStr;
    return `${hStr} ${below100(rem)}`;
  }

  const num = typeof n === 'number' ? n : parseInt(n, 10);
  if (isNaN(num)) return String(n);
  if (num < 1000) return below1000(num);
  if (num < 1000000) {
    const k = Math.floor(num / 1000);
    const rem = num % 1000;
    const kStr = k === 1 ? 'mille' : `${below1000(k)} mille`;
    if (rem === 0) return kStr;
    return `${kStr} ${below1000(rem)}`;
  }
  return String(num);
}

const FRENCH_MONTHS: Record<string, string> = {
  '01': 'janvier', '1': 'janvier',
  '02': 'février', '2': 'février',
  '03': 'mars', '3': 'mars',
  '04': 'avril', '4': 'avril',
  '05': 'mai', '5': 'mai',
  '06': 'juin', '6': 'juin',
  '07': 'juillet', '7': 'juillet',
  '08': 'août', '8': 'août',
  '09': 'septembre', '9': 'septembre',
  '10': 'octobre',
  '11': 'novembre',
  '12': 'décembre',
};

/**
 * Optimisation phonétique et structurale du texte pour l'audio Suno :
 * - Sections normalisées ([Verse 1], [Chorus], [Bridge], [Outro]...)
 * - Numéros de téléphone décomposés 2 par 2 avec virgules (5506 -> cinquante-cinq, zéro six)
 * - Dates complètes converties en toutes lettres (12/05/2024 -> douze mai deux mille vingt-quatre)
 * - Chiffres et ordinaux transcrits (10 ans -> dix ans, 1er -> premier, 100% -> cent pour cent)
 * - Sigles articulés avec tirets (PDG -> P-D-G, VIP -> V-I-P)
 * - Respect scrupuleux des rimes et de la poésie, sans sur-optimisation parasite.
 */
export function formatLyricsForSuno(raw: string): string {
  // 1. Extraire les métadonnées pour isoler les paroles pures
  const parsed = parseLyricsHeader(raw);
  let text = parsed.lyrics;

  // 2. Sections Suno normalisées
  const SECTION: [RegExp, string][] = [
    [/^\(?\s*couplet\s*(\d*)\s*\)?$/i, 'Verse'],
    [/^\(?\s*refrain\s*\)?$/i, 'Chorus'],
    [/^\(?\s*pont\s*\)?$/i, 'Bridge'],
    [/^\(?\s*outro\s*\)?$/i, 'Outro'],
    [/^\(?\s*intro\s*\)?$/i, 'Intro'],
  ];

  const sectionLines = text.split('\n').map((line) => {
    const t = line.trim();
    for (const [re, tag] of SECTION) {
      const m = re.exec(t);
      if (m) return `[${tag}${m[1] ? ` ${m[1]}` : ''}]`;
    }
    return line;
  });
  text = sectionLines.join('\n');

  // Remplacement sélectif en ignorant les lignes d'en-tête de section ([Verse 1]...)
  function replaceOutsideTags(str: string, re: RegExp, replacer: string | ((...args: any[]) => string)): string {
    return str
      .split('\n')
      .map((line) => {
        if (/^\s*\[.*\]\s*$/.test(line)) return line;
        return typeof replacer === 'function' ? line.replace(re, replacer) : line.replace(re, replacer);
      })
      .join('\n');
  }

  // 3. Dates complètes JJ/MM/AAAA ou JJ-MM-AAAA
  text = replaceOutsideTags(
    text,
    /\b(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](19\d\d|20\d\d)\b/g,
    (_m, d: string, m: string, y: string) => {
      const dayStr = d === '1' || d === '01' ? 'premier' : numberToFrenchWords(d);
      const monthStr = FRENCH_MONTHS[m] || m;
      const yearStr = numberToFrenchWords(y);
      return `${dayStr} ${monthStr} ${yearStr}`;
    },
  );

  // 4. Dates courtes JJ/MM (ex: 15/04)
  text = replaceOutsideTags(
    text,
    /\b(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[0-2])\b/g,
    (_m, d: string, m: string) => {
      const dayStr = d === '1' || d === '01' ? 'premier' : numberToFrenchWords(d);
      const monthStr = FRENCH_MONTHS[m] || m;
      return `${dayStr} ${monthStr}`;
    },
  );

  // 5. Numéros de téléphone internationaux (+226 56 24 05 33)
  text = replaceOutsideTags(
    text,
    /\+226\s*(\d{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})\b/g,
    (_m, a: string, b: string, c: string, d: string) => {
      return [a, b, c, d].map((p) => twoDigitsToFrench(p, true)).join(', ');
    },
  );

  // 6. Numéros de téléphone à 8 chiffres (56 24 05 33 ou 56240533)
  text = replaceOutsideTags(
    text,
    /\b(\d{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})\b/g,
    (_m, a: string, b: string, c: string, d: string) => {
      return [a, b, c, d].map((p) => twoDigitsToFrench(p, true)).join(', ');
    },
  );

  // 7. Numéros à 4 chiffres (5506 -> cinquante-cinq, zéro six ; 2837 -> vingt-huit, trente-sept ; 0510 -> zéro cinq, dix)
  // Ne pas transformer les années précédées de prépositions temporelles (en 2024, depuis 1995)
  text = replaceOutsideTags(
    text,
    /(?<!(?:en|l'an|année|depuis)\s+)\b([0-9]{2})([0-9]{2})\b/g,
    (match: string, p1: string, p2: string) => {
      const n = parseInt(match, 10);
      if (n >= 1950 && n <= 2099) {
        return numberToFrenchWords(n);
      }
      return `${twoDigitsToFrench(p1, true)}, ${twoDigitsToFrench(p2, true)}`;
    },
  );

  // 8. Ordinaux (1er, 1ère, 2ème...)
  text = replaceOutsideTags(text, /\b1(?:er|ère)\b/gi, (m: string) =>
    m.toLowerCase().includes('ère') ? 'première' : 'premier',
  );
  text = replaceOutsideTags(text, /\b(\d+)(?:ème|eme|e)\b/gi, (_m, d: string) => {
    const w = numberToFrenchWords(d);
    return w.endsWith('e') ? `${w.slice(0, -1)}ième` : `${w}ième`;
  });

  // 9. Pourcentages et devises
  text = replaceOutsideTags(text, /\b(\d+)\s*%/g, (_m, d: string) => `${numberToFrenchWords(d)} pour cent`);
  text = replaceOutsideTags(text, /\b(\d+)\s*€/g, (_m, d: string) => `${numberToFrenchWords(d)} euros`);
  text = replaceOutsideTags(
    text,
    /\b(\d+)\s*(?:FCFA|F\s*CFA)\b/gi,
    (_m, d: string) => `${numberToFrenchWords(d)} francs CFA`,
  );

  // 10. Chiffres isolés restants (ex: 20 ans -> vingt ans)
  text = replaceOutsideTags(text, /\b(\d+)\b/g, (_m, d: string) => numberToFrenchWords(d));

  // 11. Sigles professionnels et ouest-africains (épelés avec tirets pour une prononciation distincte)
  const ACRONYMS = ['PDG', 'DG', 'DRH', 'VIP', 'USA', 'ONG', 'SAV', 'SMS', 'CDI', 'CDD', 'CEO', 'BTP', 'SARL'];
  for (const acr of ACRONYMS) {
    const re = new RegExp(`\\b${acr}\\b`, 'g');
    text = replaceOutsideTags(text, re, acr.split('').join('-'));
  }

  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4900);
}

/**
 * Moteur d'enrichissement stylistique et acoustique professionnel pour Suno V6.
 * Intègre les 4 styles de référence Velaris, l'adaptation dynamique de la voix
 * (masculine, féminine, duo), le mastering de studio, et la neutralisation
 * préventive des mots bannis ou noms d'artistes qui bloquent la modération Suno.
 */
export function optimizeSunoStylePrompt(
  rawStyle?: string | null,
  voice?: 'male' | 'female' | 'duo' | string | null,
): string {
  const s = (rawStyle || '').trim().toLowerCase();
  const v = (voice || '').trim().toLowerCase();

  // 1. Timbre vocal riche et naturel avec élocution française claire
  let vocalDesc = 'The lead vocal should be expressive, tender, and full of genuine emotion, with clear French pronunciation and natural phrasing.';
  if (v.includes('fem') || v.includes('femme') || v.includes('fémin')) {
    vocalDesc = 'Expressive, tender female lead vocal, crystalline emotional tone, clear French pronunciation and natural phrasing, with rich harmonies in the chorus.';
  } else if (v.includes('masc') || v.includes('homme') || v.includes('male')) {
    vocalDesc = 'Expressive, soulful male lead vocal, rich warm tone, clear French pronunciation and natural phrasing, with rich harmonies in the chorus.';
  } else if (v.includes('duo') || v.includes('duet') || v.includes('mixte')) {
    vocalDesc = 'Emotional male and female duet, interwoven lead vocals, rich complementary harmonies, call-and-response chorus, with clear French pronunciation.';
  }

  let prompt = '';

  // 2. Sélection du prompt calibré selon le style demandé
  if (
    s.includes('doux') ||
    s.includes('afro-love') ||
    s.includes('afro love') ||
    s.includes('love') ||
    s.includes('romantique') ||
    s.includes('intime') ||
    s.includes('calme')
  ) {
    // STYLE 1 : Emotional Afro-Love with a Warm African Groove (90-98 BPM)
    prompt = `Style: Emotional Afro-Love with a Warm African Groove\nCreate a beautiful, soulful Afro-Love song with a gentle, rhythmic African groove, around 90–98 BPM. Use warm acoustic guitar, soft piano, subtle African percussion, smooth bass, and delicate strings to create a heartfelt, uplifting atmosphere. ${vocalDesc} Add soft backing vocals and rich harmonies in the chorus to make it memorable and moving. Keep the vocals upfront and the instrumental balanced so every word of the lyrics is clearly heard and understood. The overall feeling should be intimate, grateful, loving, and deeply touching, with a beautiful, melodic chorus that stays in the listener’s heart.`;
  } else if (
    s.includes('dansant') ||
    s.includes('afrobeat') ||
    s.includes('afrobeats') ||
    s.includes('fete') ||
    s.includes('fête') ||
    s.includes('ambiance') ||
    s.includes('dynamique')
  ) {
    // STYLE 2 : Ultra-energetic Afrobeats (120-130 BPM)
    prompt = `Ultra-energetic Afrobeats, fast tempo (120–130 BPM). Heavy, driving drum patterns with strong kick, snappy snares, rolling percussions (congas, djembé, shakers), and vibrant rhythmic loops. Bouncy, infectious bassline with bright, melodic synth leads and highlife-style guitars for groove. ${vocalDesc} Call-and-response vocals, chant-style hooks, and layered harmonies to create a festive, crowd-hype atmosphere. The chorus must be explosive, repetitive, and instantly memorable. Overall mood: celebratory, powerful, and extremely danceable, designed to make people move non-stop.`;
  } else if (
    s.includes('rumba') ||
    s.includes('roomba') ||
    s.includes('congol') ||
    s.includes('kinshasa')
  ) {
    // STYLE 3 : Authentic Congolese Rumba (95-105 BPM)
    prompt = `Authentic Congolese Rumba — warm, elegant, melodic and danceable.\nClassic Central African rumba groove with clean electric guitar arpeggios, interlocking lead and rhythm guitars, deep melodic bassline, soft congas and bongos, subtle shakers, and restrained live drums. ${vocalDesc} Rich harmonies and call-and-response choir, gradually building toward a joyful, powerful chorus. Moderate tempo around 95–105 BPM, flowing syncopation, warm organic instrumentation, expressive guitar solos, festive but dignified atmosphere. Keep the production traditional Congolese rumba, not Afrobeat, not modern pop, with a strong sense of cultural celebration and communal singing.`;
  } else if (
    s.includes('coupé') ||
    s.includes('coupe') ||
    s.includes('decal') ||
    s.includes('décal') ||
    s.includes('abidjan') ||
    s.includes('ivoirien')
  ) {
    // STYLE 4 : High-energy Ivorian Coupé-Décalé (128-132 BPM)
    prompt = `High-energy Ivorian Coupé-Décalé fused with Afro Drill and stadium anthem vibes. Fast tempo (128–132 BPM), explosive percussion, driving kick, groovy bassline, rhythmic chants, crowd shouts, whistles, claps, and call-and-response vocals. Bright African synths, powerful brass stabs, and infectious dance grooves that create a festive football atmosphere. ${vocalDesc} The production should feel triumphant, motivational, and made for a packed stadium, with dynamic builds, massive choruses, and nonstop dance energy from start to finish.`;
  } else if (s.includes('zouk')) {
    prompt = `Sensual Zouk Love with modern Afro-Caribbean production, 88–94 BPM. Lush electric piano, warm nylon guitar, smooth 808 sub-bass, delicate percussion, and seductive tropical rhythm. ${vocalDesc} Romantic, warm, and deeply melodic chorus.`;
  } else if (s.includes('reggae')) {
    prompt = `Roots Reggae with warm West African acoustic feel, 76–82 BPM. Heavy one-drop drum groove, deep melodic bassline, clean upbeat offbeat guitar chops, gentle organ, and soft brass accents. ${vocalDesc} Authentic conscious groove, positive uplifting message.`;
  } else if (s.includes('gospel') || s.includes('louange') || s.includes('priere') || s.includes('prière') || s.includes('chretien') || s.includes('chrétien')) {
    prompt = `Uplifting African Gospel — emotional praise and worship, 94–100 BPM. Warm organ, grand piano, rhythmic acoustic guitar, dynamic live bass, and subtle African percussion. ${vocalDesc} Soaring call-and-response choir harmonies in the chorus. Sacred and inspiring.`;
  } else if (s.includes('manding') || s.includes('kora') || s.includes('balafon') || s.includes('griot') || s.includes('tradition')) {
    prompt = `Modern Acoustic Mandingue — West African storytelling, 82–88 BPM. Authentic kora arpeggios, balafon melodies, resonant acoustic guitar, and gentle calabash percussion. ${vocalDesc} Noble, timeless, and deeply touching acoustic atmosphere.`;
  } else if (s.includes('goumbe') || s.includes('goumbé') || s.includes('folk')) {
    prompt = `Lively Goumbé and West African Folk Celebration, 105–115 BPM. Driving acoustic guitar rhythm, organic woodblock and calabash percussion, festive brass, and buoyant bass. ${vocalDesc} Joyous communal atmosphere.`;
  } else if (s.includes('amapiano')) {
    prompt = `Soulful Amapiano with lush private school piano chords, 112–115 BPM. Signature resonant log drum bassline, warm shaker loops, airy saxophone fills, and delicate keys. ${vocalDesc} Hypnotic and deeply groovy.`;
  } else if (s.includes('ballade') || s.includes('acoustique') || s.includes('guitare')) {
    prompt = `Intimate Acoustic Ballad — raw emotion and purity, 78–85 BPM. Solo acoustic fingerpicked guitar, soft grand piano, warm subtle cello, and gentle room ambience. ${vocalDesc} Pure, heartfelt intimacy.`;
  } else if (rawStyle && rawStyle.trim().length > 2 && !rawStyle.toLowerCase().includes('auto') && !rawStyle.toLowerCase().includes('défaut')) {
    prompt = `${rawStyle.trim()} with authentic West African acoustic groove and modern studio production. Balanced mix, warm acoustic guitar, melodic bassline, organic percussion, around 92–100 BPM. ${vocalDesc} Catchy and emotional chorus.`;
  } else {
    // Style par défaut : Afro-Love
    prompt = `Style: Emotional Afro-Love with a Warm African Groove\nCreate a beautiful, soulful Afro-Love song with a gentle, rhythmic African groove, around 90–98 BPM. Use warm acoustic guitar, soft piano, subtle African percussion, smooth bass, and delicate strings to create a heartfelt, uplifting atmosphere. ${vocalDesc} Add soft backing vocals and rich harmonies in the chorus to make it memorable and moving. Keep the vocals upfront and the instrumental balanced so every word of the lyrics is clearly heard and understood. The overall feeling should be intimate, grateful, loving, and deeply touching, with a beautiful, melodic chorus that stays in the listener’s heart.`;
  }

  // 3. Assainissement anti-blocage modération Suno :
  // - Remplacement du mot 'skank' (terme de guitare reggae souvent mal interprété par les filtres IA)
  let cleaned = prompt.replace(/\bskank(?:ing)?\b/gi, 'upbeat offbeat guitar chops');

  // - Remplacement des noms d'artistes sous copyright (rejetés automatiquement par Suno V6)
  const ARTIST_REPLACEMENTS: [RegExp, string][] = [
    [/burna\s*boy/gi, 'modern Afropop star sound'],
    [/wizkid/gi, 'smooth Afrobeats sound'],
    [/fally\s*ipupa/gi, 'modern Congolese rumba style'],
    [/magic\s*system/gi, 'festive Zouglou style'],
    [/dj\s*arafat/gi, 'high-energy Coupé-Décalé style'],
    [/bob\s*marley/gi, 'classic roots reggae style'],
    [/koffi\s*olomide/gi, 'Tcha-Tcho rumba style'],
    [/sidiki\s*diabat[eé]/gi, 'Manding kora pop style'],
  ];
  for (const [re, repl] of ARTIST_REPLACEMENTS) {
    cleaned = cleaned.replace(re, repl);
  }

  return cleaned.trim().slice(0, 1000);
}

export async function generateKieSong(
  apiKey: string,
  input: KieSongInput,
  fetchImpl: typeof fetch = fetch,
): Promise<KieGenerateResponse> {
  const lyrics = formatLyricsForSuno(input.lyrics);
  const fullStyle = optimizeSunoStylePrompt(input.style, input.voice);
  const title = (input.title || 'Chanson personnalisée').slice(0, 80);

  try {
    const res = await fetchImpl(`${KIE_API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: lyrics,
        style: fullStyle,
        title,
        customMode: true,
        instrumental: false,
        model: 'V6',
        callBackUrl: 'https://waha.velarisagent.life/api/suno-callback',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: { taskId?: string };
    } | null;

    if (!res.ok || !json || json.code !== 200 || !json.data?.taskId) {
      const errMsg = json?.msg || `HTTP ${res.status}`;
      return { success: false, error: `Kie generate failed: ${errMsg}` };
    }

    return { success: true, taskId: String(json.data.taskId) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Interroge l'état d'avancement d'une tâche Suno V6
 */
export async function pollKieSongStatus(
  apiKey: string,
  taskId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KiePollResponse> {
  try {
    const res = await fetchImpl(`${KIE_API_BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: {
        status?: string;
        errorMessage?: string;
        failReason?: string;
        response?: { sunoData?: Array<{ audioUrl?: string; audio_url?: string; streamAudioUrl?: string; duration?: number }> };
        sunoData?: Array<{ audioUrl?: string; audio_url?: string; streamAudioUrl?: string; duration?: number }>;
      };
    } | null;

    if (!res.ok || !json || json.code !== 200) {
      return { status: 'pending', error: json?.msg || `HTTP ${res.status}` };
    }

    const data = json.data;
    if (!data) return { status: 'pending' };

    const rawStatus = String(data.status || '').toUpperCase();
    const sunoData = data.response?.sunoData || data.sunoData || [];

    if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETE') {
      const firstTrack = Array.isArray(sunoData) && sunoData.length > 0 ? sunoData[0] : null;
      const audioUrl = firstTrack?.audioUrl || firstTrack?.audio_url || firstTrack?.streamAudioUrl;
      const duration = firstTrack?.duration ? Math.round(Number(firstTrack.duration)) : 180;
      return { status: 'success', audioUrl: audioUrl || undefined, duration };
    }

    if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
      return { status: 'failed', error: data.errorMessage || data.failReason || 'generation_interrupted' };
    }

    return { status: 'running' };
  } catch (err) {
    return { status: 'pending', error: (err as Error).message };
  }
}

export interface BackgroundProductionOpts {
  apiKey: string;
  db: Db;
  orderId: string;
  userId: string;
  conversationId: string;
  sessionName: string;
  chatId: string;
  title: string;
  style: string;
  voice?: string | null | undefined;
  lyrics: string;
  protectedSessions?: readonly string[] | undefined;
  log: (line: string, data?: Record<string, unknown>) => void;
}

/**
 * Lance la production en arrière-plan et gère la livraison WhatsApp dès finalisation.
 */
export async function startBackgroundProduction(opts: BackgroundProductionOpts): Promise<void> {
  const { apiKey, db, orderId, userId, conversationId, sessionName, chatId, title, style, voice, lyrics, protectedSessions = [], log } = opts;

  log('🎵 starting music production via Kie.ai Suno V6', { orderId, style, voice });

  const gen = await generateKieSong(apiKey, { lyrics, voice, style, title, orderId });
  if (!gen.success || !gen.taskId) {
    log('🎵 Kie music generation launch failed', { orderId, error: gen.error });
    return;
  }

  const taskId = gen.taskId;
  log('🎵 Kie taskId obtained, polling started', { orderId, taskId });

  // Boucle de polling (toutes les 10s jusqu'à 8 minutes max)
  const maxPolls = 48; // 48 * 10s = 480s = 8 min
  let polls = 0;

  const poller = setInterval(async () => {
    polls++;
    if (polls > maxPolls) {
      clearInterval(poller);
      log('🎵 Kie polling timed out after 8 minutes', { orderId, taskId });
      return;
    }

    try {
      const pollRes = await pollKieSongStatus(apiKey, taskId);
      if (pollRes.status === 'running' || pollRes.status === 'pending') {
        return; // continue polling
      }

      clearInterval(poller);

      if (pollRes.status === 'failed') {
        log('🎵 Kie generation failed', { orderId, taskId, error: pollRes.error });
        return;
      }

      if (pollRes.status === 'success' && pollRes.audioUrl) {
        const audioUrl = pollRes.audioUrl;
        const duration = pollRes.duration || 180;
        log('🎵 Kie generation SUCCEEDED!', { orderId, taskId, audioUrl, duration });

        // A. Avancer la commande vers delivered
        const currentOrders = await db.queryTable?.<Array<{ version: number; stage: string }>>(
          'orders',
          `id=eq.${orderId}&select=version,stage&limit=1`,
        ).catch(() => []);
        const curOrder = currentOrders?.[0];
        if (curOrder) {
          await db.rpc('agent_transition_order', {
            p_order: orderId,
            p_expected_version: curOrder.version,
            p_track: 'creative',
            p_event: 'delivery_sent',
            p_actor: 'system',
            p_turn: null,
            p_data: { via: 'kie_music_completion', taskId, audioUrl },
            p_inferred: false,
          }).catch(() => undefined);
        }

        // B. Livraison sur WhatsApp au client si la session n'est pas protégée
        if (protectedSessions.includes(sessionName)) {
          log('🎵 delivery skipped: session is protected', { session: sessionName });
          return;
        }

        const caption = `Votre chanson personnalisée « *${title}* » (${style}) vient de sortir du studio ! Bonne écoute 🎵`;

        // Sauvegarder l'identifiant de génération Suno / Kie sur la commande
        if (db.updateRows) {
          await db.updateRows('orders', `id=eq.${orderId}`, {
            song_generation_id: taskId,
          }).catch(() => undefined);
        }

        const bodyHash = createHash('sha256').update(caption || '').digest('hex');

        await db.rpc('agent_enqueue_outbox', {
          p_user: userId,
          p_conversation: conversationId,
          p_order: orderId,
          p_turn: null,
          p_origin: 'delivery',
          p_kind: 'voice',
          p_purpose: 'song',
          p_is_relay: false,
          p_session: sessionName,
          p_chat_id: chatId,
          p_body: null,
          p_media_path: audioUrl,
          p_caption: caption,
          p_body_hash: bodyHash,
          p_idempotency_key: `song_delivery_audio_${orderId}_${taskId}`,
          p_lock_token: 0,
          p_status: 'pending',
        }).catch((e) => log('failed to enqueue audio delivery', { error: (e as Error).message }));

        log('🎵 song delivery enqueued to outbox', { orderId, chatId });
      }
    } catch (err) {
      log('🎵 error in polling tick', { error: (err as Error).message });
    }
  }, 10_000);
}
