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
  audioUrls?: string[] | undefined;
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
  let inLyricsBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (!trimmed) {
      if (inLyricsBody) lyricsLines.push(line);
      continue;
    }

    // Dès qu'on rencontre une balise musicale ([Intro], [Couplet], [Verse], [Refrain]...),
    // tout ce qui suit fait partie intégrante du corps chanté
    if (/^\[\s*(?:intro|couplet|verse|refrain|chorus|pont|bridge|pre-refrain|pré-refrain|outro)\b/i.test(trimmed)) {
      inLyricsBody = true;
      lyricsLines.push(line);
      continue;
    }

    if (inLyricsBody) {
      lyricsLines.push(line);
      continue;
    }

    // Retirer les crochets ou parenthèses englobantes : "[Style: ...]" ou "(Style ...)"
    const unbracketed = trimmed.replace(/^[\[\(](.*)[\]\)]$/, '$1').trim();

    // 1. Détection du titre en début de message (ex: *« LE ROI DU 5 AVRIL »* ou "Titre: ...")
    const explicitTitle = unbracketed.match(/^(?:titre|title)\s*[:=\-]?\s*(.+)$/i);
    let matchedTitleStr: string | null = null;
    if (explicitTitle && explicitTitle[1]) {
      matchedTitleStr = explicitTitle[1].trim();
    } else if (!title && /^[*_«"]+(.+?)[*_»"]+$/.test(unbracketed)) {
      matchedTitleStr = unbracketed.replace(/^[*_«"\s]+|[*_»"\s]+$/g, '').trim();
    }

    if (matchedTitleStr) {
      if (!/^(?:style|voix|voice|genre|rythme)\b/i.test(matchedTitleStr)) {
        title = matchedTitleStr;
        continue;
      }
    }

    // 2. Détection des métadonnées de style et de voix (avec ou sans deux-points/égal)
    const hasMetaKeyword = /(?:^|[|;,\/•]|\s+-\s+)\s*(?:style|genre|rythme|tempo|voix|voice)\b/i.test(unbracketed);
    const hasVoiceMention = /\b(?:voix\s*(?:masculine|féminine|femme|homme|d'homme|de\s*femme)|voix\s*[:=\s-]|voice\s*[:=\s-]|male\s*voice|female\s*voice|chanteur|chanteuse)\b/i.test(unbracketed);

    if (hasMetaKeyword || hasVoiceMention) {
      const segments = unbracketed.split(/[|;,\/•]|\s+-\s+/);
      for (const seg of segments) {
        const s = seg.trim();
        if (!s) continue;

        // Détection de la voix
        const vm = s.match(/^(?:voix|voice)\s*[:=\s-]?\s*(.+)$/i);
        if (vm && vm[1]) {
          voice = vm[1].trim();
        } else if (/\b(?:voix\s*)?(?:masculin(?:e)?|homme|d'homme|male)\b/i.test(s)) {
          voice = 'male';
        } else if (/\b(?:voix\s*)?(?:féminin(?:e)?|femme|de\s*femme|female)\b/i.test(s)) {
          voice = 'female';
        } else if (/\b(?:duo|duet|mixte)\b/i.test(s)) {
          voice = 'duo';
        }

        // Détection du style
        const sm = s.match(/^(?:style|genre|rythme)\s*[:=\s-]?\s*(.+)$/i);
        if (sm && sm[1]) {
          let candidateStyle = sm[1].trim();
          // Si la mention de voix est imbriquée dans le style (ex: "Afrobeat Nigerian, voix masculine")
          if (/\b(?:voix\s*)?(?:masculin(?:e)?|homme|d'homme|male)\b/i.test(candidateStyle)) {
            if (!voice) voice = 'male';
            candidateStyle = candidateStyle.replace(/,?\s*(?:voix\s*)?(?:masculin(?:e)?|homme|d'homme|male)\b/gi, '').trim();
          } else if (/\b(?:voix\s*)?(?:féminin(?:e)?|femme|de\s*femme|female)\b/i.test(candidateStyle)) {
            if (!voice) voice = 'female';
            candidateStyle = candidateStyle.replace(/,?\s*(?:voix\s*)?(?:féminin(?:e)?|femme|de\s*femme|female)\b/gi, '').trim();
          } else if (/\b(?:duo|duet|mixte)\b/i.test(candidateStyle)) {
            if (!voice) voice = 'duo';
            candidateStyle = candidateStyle.replace(/,?\s*(?:duo|duet|mixte)\b/gi, '').trim();
          }
          if (candidateStyle) style = candidateStyle;
        } else if (!style && !/^(?:titre|title)\b/i.test(s) && s.length >= 3) {
          if (/(?:afro|rumba|zouk|gospel|reggae|pop|acoustique|dansant|doux|rap|drill|amapiano|highlife|coupé-décalé)/i.test(s)) {
            // Nettoyer si la voix était collée
            style = s.replace(/,?\s*(?:voix\s*)?(?:masculin(?:e)?|homme|d'homme|féminin(?:e)?|femme|de\s*femme)\b/gi, '').trim();
          }
        }
      }
      continue;
    }

    lyricsLines.push(line);
  }

  let normalizedVoice: 'male' | 'female' | 'duo' | null = null;
  if (voice) {
    const v = voice.toLowerCase();
    if (v.includes('fem') || v.includes('femme') || v.includes('fémin')) normalizedVoice = 'female';
    else if (v.includes('masc') || v.includes('homme') || v.includes('male') || v.includes('garçon')) normalizedVoice = 'male';
    else if (v.includes('duo') || v.includes('duet') || v.includes('mixte')) normalizedVoice = 'duo';
  }

  // Si le style mentionne encore la voix
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

  // 5. Numéros de téléphone internationaux (+226 ou +225...)
  text = replaceOutsideTags(
    text,
    /\+(?:226|225)\s*(\d{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})(?:\s*(\d{2}))?\b/g,
    (_m, a: string, b: string, c: string, d: string, e?: string) => {
      const parts = [a, b, c, d];
      if (e) parts.push(e);
      return parts.map((p) => twoDigitsToFrench(p, true)).join(', ');
    },
  );

  // 6. Numéros de téléphone à 10 chiffres (Côte d'Ivoire ex: 07 08 09 10 11)
  text = replaceOutsideTags(
    text,
    /\b(\d{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})\b/g,
    (_m, a: string, b: string, c: string, d: string, e: string) => {
      return [a, b, c, d, e].map((p) => twoDigitsToFrench(p, true)).join(', ');
    },
  );

  // 7. Numéros de téléphone à 8 chiffres (56 24 05 33 ou 56240533)
  text = replaceOutsideTags(
    text,
    /\b(\d{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})\b/g,
    (_m, a: string, b: string, c: string, d: string) => {
      return [a, b, c, d].map((p) => twoDigitsToFrench(p, true)).join(', ');
    },
  );

  // 8. Numéros à 4 chiffres (5506 -> cinquante-cinq, zéro six ; 2837 -> vingt-huit, trente-sept ; 0510 -> zéro cinq, dix)
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
  } else if (s.includes('zouglou') || s.includes('woyo') || s.includes('wôyô')) {
    prompt = `Authentic Ivorian Zouglou and acoustic Wôyô celebration, 108–114 BPM. Driving acoustic guitar rhythm, organic calabash, tom-tom and djembe percussion, expressive shaker grooves, melodic bassline. ${vocalDesc} Vibrant call-and-response choir, joyous communal storytelling, festive yet conscious West African atmosphere with an instantly memorable chorus.`;
  } else if (s.includes('kizomba') || s.includes('semba') || s.includes('cabo') || s.includes('tarraxinha')) {
    prompt = `Sensual Kizomba and Lusophone Afro-Groove, 86–92 BPM. Warm electric piano chords, nylon guitar arpeggios, smooth 808 sub-bass, delicate syncopated kick, and seductive tropical percussion. ${vocalDesc} Intimate, romantic, deeply hypnotic atmosphere with lush harmonies in the chorus.`;
  } else if (s.includes('afropop') || s.includes('afro pop') || s.includes('naija pop')) {
    prompt = `Modern polished Afro-Pop, 104–112 BPM. Crisp kick, punchy snares, infectious acoustic guitar loops, bright modern synths, and smooth bouncy bassline. ${vocalDesc} Ultra-catchy melodic chorus, radio-ready production, uplifting, joyous and universally appealing.`;
  } else if (s.includes('rap') || s.includes('hip hop') || s.includes('hip-hop') || s.includes('drill') || s.includes('trap')) {
    prompt = `Modern Melodic Afro-Trap and Hip-Hop, 96–105 BPM. Deep sliding 808 bass, crisp rolling hi-hats, emotive acoustic guitar or melancholic piano loop, and punchy snare. ${vocalDesc} Confident flow with melodic singing in the chorus, expressive, powerful and emotionally resonant.`;
  } else if (s.includes('slow') || s.includes('r&b') || s.includes('rnb') || s.includes('soul') || s.includes('afro-soul') || s.includes('afrosoul') || s.includes('blues')) {
    prompt = `Emotional Afro-Soul and Contemporary R&B, 74–82 BPM. Warm Rhodes electric piano, lush string pads, expressive acoustic guitar, gentle live drums, and deep soulful bassline. ${vocalDesc} Heartfelt vocal ad-libs, rich vocal harmonies in the chorus, romantic, soothing and timeless intimacy.`;
  } else if (s.includes('highlife') || s.includes('palm wine') || s.includes('palm-wine') || s.includes('ghana')) {
    prompt = `Classic West African Highlife, 102–108 BPM. Sweet interlocking electric and acoustic guitars, rhythmic brass section, melodic walking bassline, congas, claves, and live drums. ${vocalDesc} Joyous call-and-response harmonies, elegant vintage West African celebration.`;
  } else if (s.includes('makossa') || s.includes('bikutsi') || s.includes('cameroun') || s.includes('douala')) {
    prompt = `High-energy Cameroonian Makossa, 118–125 BPM. Virtuosic funky bassline, bright horn stabs, interlocking rhythm guitars, and syncopated snare grooves. ${vocalDesc} Celebratory, dynamic, and irresistible dance rhythm.`;
  } else if (s.includes('mbalax') || s.includes('sabar') || s.includes('senegal') || s.includes('dakar')) {
    prompt = `Authentic Senegalese Mbalax, 115–124 BPM. Electrifying sabar drum polyrhythms, tama talking drum fills, bright funky guitar chops, and driving bass. ${vocalDesc} Powerful griot-inspired vocal delivery with soaring uplifting chorus.`;
  } else if (s.includes('kompa') || s.includes('compas') || s.includes('haiti') || s.includes('antillais') || s.includes('caraïbe')) {
    prompt = `Smooth Caribbean Kompa Love, 94–100 BPM. Characteristic syncopated hi-hat pattern, lush synthesizer chords, melodic saxophone lines, melodic bass, and sweet guitar solos. ${vocalDesc} Sensual, elegant, and deeply romantic dance groove.`;
  } else if (s.includes('pop') || s.includes('variété') || s.includes('chanson française')) {
    prompt = `Refined Acoustic French Pop, 88–95 BPM. Richly recorded grand piano, warm acoustic nylon and steel guitars, gentle cello accents, subtle ambient percussion. ${vocalDesc} Poetic, crystal-clear vocal prominence, elegant, timeless and emotionally touching.`;
  } else if (s.includes('salsa') || s.includes('merengue') || s.includes('bachata') || s.includes('latin') || s.includes('latino')) {
    prompt = `Vibrant Latin and Afro-Cuban Fusion, 98–105 BPM. Syncopated piano montuno, authentic congas, bongos, güiro, warm acoustic bass, and bright trumpet/brass accents. ${vocalDesc} Passionate and festive dance atmosphere with catchy chorus.`;
  } else if (s.includes('bossa') || s.includes('bossa nova') || s.includes('jazz')) {
    prompt = `Sophisticated Bossa Nova and Afro-Jazz, 84–90 BPM. Nylon fingerpicked guitar syncopation, soft brushed drums, warm acoustic upright bass, delicate flute or muted trumpet fills. ${vocalDesc} Smooth, elegant, and timelessly intimate.`;
  } else if (s.includes('rock') || s.includes('pop rock') || s.includes('pop-rock')) {
    prompt = `Dynamic Melodic Pop-Rock, 110–120 BPM. Clean to overdriven electric rhythm guitars, driving live drums with solid kick and snare, warm melodic bass. ${vocalDesc} Passionate, powerful vocal delivery with soaring melodic chorus.`;
  } else if (s.includes('slam') || s.includes('poésie') || s.includes('poeme') || s.includes('poème') || s.includes('spoken word')) {
    prompt = `Intimate Cinematic Spoken Word and Acoustic Ambience, 72–80 BPM. Soft minimal piano chords, subtle cello, gentle atmospheric pads, and minimal heartbeat percussion. ${vocalDesc} Clear, expressive, and deeply moving poetic delivery.`;
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
    prompt = `${rawStyle.trim()} with professional modern studio production. Crystal-clear 24-bit audio mastering, warm acoustic and electric instruments, melodic bassline, dynamic drums around 94–104 BPM. ${vocalDesc} Balanced stereo imaging, vocal upfront, with a beautiful and memorable chorus.`;
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
    [/davido/gi, 'uplifting Afropop anthem sound'],
    [/rema/gi, 'Afrorave melodic sound'],
    [/asake/gi, 'Fuji-infused energetic Afrobeats sound'],
    [/fally\s*ipupa/gi, 'modern Congolese rumba style'],
    [/koffi\s*olomide/gi, 'Tcha-Tcho rumba style'],
    [/magic\s*system/gi, 'festive Zouglou style'],
    [/dj\s*arafat/gi, 'high-energy Coupé-Décalé style'],
    [/serge\s*beynaud/gi, 'melodic Coupé-Décalé dance sound'],
    [/didi\s*b/gi, 'Ivorian Afro-Rap drill style'],
    [/josey/gi, 'soulful Ivorian Afro-Love sound'],
    [/meiway/gi, 'Zoblazo festive rhythm style'],
    [/bob\s*marley/gi, 'classic roots reggae style'],
    [/alpha\s*blondy/gi, 'African roots reggae style'],
    [/tiken\s*jah(?:\s*fakoly)?/gi, 'conscious West African reggae style'],
    [/sidiki\s*diabat[eé]/gi, 'Manding kora pop style'],
    [/salif\s*keita/gi, 'golden voice Manding acoustic sound'],
    [/youssou\s*n'?dour/gi, 'Sabar Mbalax vocal legend style'],
    [/aya\s*nakamura/gi, 'modern French Afro-R&B pop sound'],
    [/dadju/gi, 'smooth French Afro-Love sound'],
    [/tayc/gi, 'sensual Afro-Lov acoustic sound'],
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
      const tracks = Array.isArray(sunoData) ? sunoData : [];
      const audioUrls: string[] = [];
      for (const track of tracks) {
        const u = track?.audioUrl || track?.audio_url || track?.streamAudioUrl;
        if (u && typeof u === 'string' && u.trim().length > 0) {
          audioUrls.push(u.trim());
        }
      }
      const firstTrack = tracks[0] ?? null;
      const audioUrl = audioUrls[0] || undefined;
      const duration = firstTrack?.duration ? Math.round(Number(firstTrack.duration)) : 180;
      return { status: 'success', audioUrl, audioUrls, duration };
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
  targetDeliveryDelayMinutes?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
  pollIntervalMs?: number | undefined;
  log: (line: string, data?: Record<string, unknown>) => void;
}

/**
 * Lance la production en arrière-plan et gère la livraison WhatsApp dès finalisation.
 */
export async function startBackgroundProduction(opts: BackgroundProductionOpts): Promise<void> {
  const { apiKey, db, orderId, userId, conversationId, sessionName, chatId, title, style, voice, lyrics, protectedSessions = [], log } = opts;
  const productionStartTime = Date.now();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const pollIntervalMs = opts.pollIntervalMs ?? 10_000;

  // Délai de livraison artisanal : 12 à 15 minutes (12 à 14.5 min avec jitter réaliste, ou configuré via env/opts)
  const configuredDelayMin = opts.targetDeliveryDelayMinutes ??
    (process.env.SONG_DELIVERY_DELAY_MINUTES ? Number(process.env.SONG_DELIVERY_DELAY_MINUTES) : NaN);
  const delayMinutes = Number.isFinite(configuredDelayMin) && configuredDelayMin >= 0
    ? configuredDelayMin
    : 12 + Math.random() * 2.5;

  log('🎵 starting music production via Kie.ai Suno V6', {
    orderId,
    style,
    voice,
    targetDelayMinutes: Math.round(delayMinutes * 10) / 10,
  });

  const gen = await generateKieSong(apiKey, { lyrics, voice, style, title, orderId }, fetchImpl);
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
      const pollRes = await pollKieSongStatus(apiKey, taskId, fetchImpl);
      if (pollRes.status === 'running' || pollRes.status === 'pending') {
        return; // continue polling
      }

      clearInterval(poller);

      if (pollRes.status === 'failed') {
        log('🎵 Kie generation failed', { orderId, taskId, error: pollRes.error });
        return;
      }

      const audioUrls = (pollRes.audioUrls && pollRes.audioUrls.length > 0)
        ? pollRes.audioUrls
        : (pollRes.audioUrl ? [pollRes.audioUrl] : []);

      if (pollRes.status === 'success' && audioUrls.length > 0) {
        const primaryAudioUrl = audioUrls[0]!;
        const duration = pollRes.duration || 180;
        log('🎵 Kie generation SUCCEEDED!', { orderId, taskId, tracksCount: audioUrls.length, duration });

        // Calcul déterministe de l'heure de livraison programmée (12 à 15 minutes depuis le déclenchement initial)
        const targetDeliveryMs = productionStartTime + Math.round(delayMinutes * 60 * 1000);
        const scheduledTimeMs = Math.max(Date.now(), targetDeliveryMs);
        const scheduledIso = new Date(scheduledTimeMs).toISOString();

        log('🎵 Scheduling 12-15m delayed delivery', {
          orderId,
          delayMinutes: Math.round(delayMinutes * 10) / 10,
          scheduledAt: scheduledIso,
          tracksCount: audioUrls.length,
        });

        // A. Avancer la commande vers delivered (avec autorité marchande issue de la réaction ⭐)
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
            p_actor: 'merchant',
            p_turn: null,
            p_data: {
              via: 'kie_music_completion',
              taskId,
              audioUrl: primaryAudioUrl,
              audioUrls,
              scheduledDelivery: scheduledIso,
              delayMinutes: Math.round(delayMinutes * 10) / 10,
            },
            p_inferred: false,
          }).catch(() => undefined);
        }

        // B. Livraison sur WhatsApp au client si la session n'est pas protégée
        if (protectedSessions.includes(sessionName)) {
          log('🎵 delivery skipped: session is protected', { session: sessionName });
          return;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
        if (isUuid && db.updateRows) {
          await db.updateRows('orders', `id=eq.${orderId}`, {
            song_generation_id: taskId,
          }).catch(() => undefined);
        }

        const isDual = audioUrls.length > 1;
        const announcementText = isDual ? 'Vos chansons' : 'Votre chanson';

        const textHash = createHash('sha256').update(announcementText).digest('hex');

        // 1. Message texte officiel d'annonce (programmé pour H + 12-15 min)
        await db.rpc('agent_enqueue_outbox', {
          p_user: userId,
          p_conversation: conversationId,
          p_order: orderId,
          p_turn: null,
          p_origin: 'delivery',
          p_kind: 'text',
          p_purpose: 'song',
          p_is_relay: false,
          p_session: sessionName,
          p_chat_id: chatId,
          p_body: announcementText,
          p_media_path: null,
          p_caption: null,
          p_body_hash: textHash,
          p_idempotency_key: `song_delivery_text_${orderId}_${taskId}`,
          p_lock_token: 0,
          p_status: 'pending',
          p_not_before: scheduledIso,
        }).catch((e) => log('failed to enqueue text delivery announcement', { error: (e as Error).message }));

        // 2. Chanson audio Version 1 (programmée 4 secondes après le texte)
        const v1Iso = new Date(scheduledTimeMs + 4_000).toISOString();
        const v1Caption = isDual ? `Version 1 — « *${title}* »` : `« *${title}* »`;
        const v1Hash = createHash('sha256').update(v1Caption).digest('hex');
        await db.rpc('agent_enqueue_outbox', {
          p_user: userId,
          p_conversation: conversationId,
          p_order: orderId,
          p_turn: null,
          p_origin: 'delivery',
          p_kind: 'file',
          p_purpose: 'song',
          p_is_relay: false,
          p_session: sessionName,
          p_chat_id: chatId,
          p_body: null,
          p_media_path: audioUrls[0],
          p_caption: v1Caption,
          p_body_hash: v1Hash,
          p_idempotency_key: `song_delivery_audio_v1_${orderId}_${taskId}`,
          p_lock_token: 0,
          p_status: 'pending',
          p_not_before: v1Iso,
        }).catch((e) => log('failed to enqueue audio delivery v1', { error: (e as Error).message }));

        // 3. Chanson audio Version 2 (si disponible, programmée 9 secondes après le texte)
        if (isDual && audioUrls[1]) {
          const v2Iso = new Date(scheduledTimeMs + 9_000).toISOString();
          const v2Caption = `Version 2 — « *${title}* »`;
          const v2Hash = createHash('sha256').update(v2Caption).digest('hex');
          await db.rpc('agent_enqueue_outbox', {
            p_user: userId,
            p_conversation: conversationId,
            p_order: orderId,
            p_turn: null,
            p_origin: 'delivery',
            p_kind: 'file',
            p_purpose: 'song',
            p_is_relay: false,
            p_session: sessionName,
            p_chat_id: chatId,
            p_body: null,
            p_media_path: audioUrls[1],
            p_caption: v2Caption,
            p_body_hash: v2Hash,
            p_idempotency_key: `song_delivery_audio_v2_${orderId}_${taskId}`,
            p_lock_token: 0,
            p_status: 'pending',
            p_not_before: v2Iso,
          }).catch((e) => log('failed to enqueue audio delivery v2', { error: (e as Error).message }));
        }

        log('🎵 song delivery enqueued to outbox (scheduled for 12-15m)', {
          orderId,
          chatId,
          scheduledAt: scheduledIso,
          versionsCount: audioUrls.length,
        });
      }
    } catch (err) {
      log('🎵 error in polling tick', { error: (err as Error).message });
    }
  }, pollIntervalMs);
}
