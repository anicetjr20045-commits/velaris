/**
 * Corpus poétique de référence et ADN de style maison (Studio Velaris).
 * Capitalise sur la vraie plume du patron : textes longs, amples, poétiques et structurés.
 * Interdiction formelle des textes courts ou bâclés.
 */

export type SongOccasion =
  | 'anniversaire'
  | 'mariage'
  | 'amour'
  | 'hommage'
  | 'naissance'
  | 'fete'
  | 'institution'
  | 'autre';

export interface CorpusSong {
  id: string;
  occasion: SongOccasion;
  style: string;
  title: string;
  lyrics: string;
  lineCount: number;
}

const STRIP = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Détection déterministe de l'occasion à partir d'un texte libre (brief client, occasion, souvenirs).
 * Robuste aux accents, priorités préservées (ex: « anniversaire de mariage » => mariage).
 */
export function detectOccasion(raw: string): SongOccasion {
  const t = STRIP(raw);
  if (!t) return 'autre';

  // 1. Mariage AVANT anniversaire (« anniversaire de mariage / noces » = mariage)
  if (/\bnoces?\b|\bmariage|\bepou[sx]|\bmari[ée]?s?\b|\bwedding\b|\bfianc/.test(t)) {
    return 'mariage';
  }

  // 2. Hommage / deuil / disparition
  if (
    /\bhommage\b|in memoriam|\bdeces\b|\bdefunt|\bdisparition\b|\brepos\b|en memoire|\benterrement\b|\bdeuil\b|qui nous a quitt|au ciel/.test(
      t,
    )
  ) {
    return 'hommage';
  }

  // 3. Naissance / baptême
  if (/\bnaissance\b|\bbapt[eê]me\b|nouveau-?ne|\bbebe\b|venue au monde|\bbaby\b|accouche/.test(t)) {
    return 'naissance';
  }

  // 4. Fête des pères / mères
  if (/bonne fete|fete des (pere|mere|papa|maman)|fete (papa|maman|des pere|des mere)/.test(t)) {
    return 'fete';
  }

  // 5. Anniversaire de naissance
  if (/\banniversaire\b|joyeux anniversaire|bon anniversaire|\bbirthday\b|\bans?\b/.test(t)) {
    return 'anniversaire';
  }

  // 6. Église / entreprise / association / institution
  if (
    /\beglise\b|paroisse|\bpasteur|\bchorale\b|institution|entreprise|\bsociete\b|association|\bclub\b|\bequipe\b|\becole\b|universite/.test(
      t,
    )
  ) {
    return 'institution';
  }

  // 7. Amour / déclaration / romance
  if (/\bamour\b|saint-?valentin|\bvalentin|declaration|\bcherie?\b|\bcheri\b|je t'aime|\blove\b|mon c[oœ]ur/.test(t)) {
    return 'amour';
  }

  return 'autre';
}

/**
 * Bibliothèque d'étalons d'or (Golden Patron Hits).
 * Textes authentiques, généreux et longs (~35 à 45 vers utiles), conformes au calibre du fondateur.
 */
export const GOLDEN_PATRON_CORPUS: readonly CorpusSong[] = [
  {
    id: 'gold-anniv-01',
    occasion: 'anniversaire',
    style: 'Afro-pop acoustique douce et entraînante',
    title: 'Lumière de nos Vies — Joyeux Anniversaire Sarah',
    lyrics: `[Style: Afro-pop acoustique douce et entraînante, guitare acoustique, balafon subtil et percussions chaudes]

[Intro]
Ohhhh… Na na na…
Aujourd'hui le soleil se lève avec une éclat particulier…
Un jour béni pour célébrer une femme d'exception…
Cette chanson vient du cœur… pour toi, Sarah…

[Couplet 1]
Depuis tant d'années que tu éclaires notre chemin…
Chaque matin à tes côtés est une grâce entre nos mains…
Ton sourire efface nos doutes et apaise nos tempêtes…
Une force tranquille qui jamais ne s'arrête…
Tu donnes sans compter, avec amour et sincérité…
Dans tes yeux purs, nous avons trouvé la paix et la clarté…

[Pré-Refrain]
Et quand la musique commence à résonner…
Tout le monde se lève pour te couronner…
Écoute la mélodie qui monte pour toi…

[Refrain]
Joyeux anniversaire Sarah, reine de nos cœurs…
Que le Tout-Puissant inonde ta vie de bonheur…
Santé, longue vie, élévation et prospérité…
Sarah, nous chantons ta douceur et ta beauté…
Joyeux anniversaire Sarah, sois bénie à jamais…

[Couplet 2]
Rappelle-toi les épreuves que nous avons surmontées…
Toujours digne et debout, tu ne t'es jamais résignée…
Pour ta famille et tes proches, tu es un précieux trésor…
Ton courage vaut bien plus que toutes les richesses et l'or…
Aujourd'hui nous fêtons tes victoires et ta générosité…
Reçois ces mots d'amour gravés pour l'éternité…

[Refrain]
Joyeux anniversaire Sarah, reine de nos cœurs…
Que le Tout-Puissant inonde ta vie de bonheur…
Santé, longue vie, élévation et prospérité…
Sarah, nous chantons ta douceur et ta beauté…
Joyeux anniversaire Sarah, sois bénie à jamais…

[Pont]
Que les portes du succès s'ouvrent grandes devant toi…
Que chaque prière de ton cœur trouve sa voie…
Que le Seigneur garde tes pas dans la lumière…
Sarah, ton nom résonne comme une fière prière…

[Refrain Final]
Joyeux anniversaire Sarah, reine de nos cœurs…
Que le Tout-Puissant inonde ta vie de bonheur…
Santé, longue vie, élévation et prospérité…
Sarah, nous chantons ta douceur et ta beauté…
Joyeux anniversaire Sarah… Oh oui, joyeux anniversaire…

[Outro]
Danse et souris, ce jour est le tien…
Nous t'aimons tellement fort…
Joyeux anniversaire Sarah…
Pour toujours…`,
    lineCount: 46,
  },
  {
    id: 'gold-amour-01',
    occasion: 'amour',
    style: 'R&B Afrobeat romantique et sensuel',
    title: 'Mon Évidence — Pour Aminata',
    lyrics: `[Style: R&B Afrobeat romantique et sensuel, guitare nylon, basse ronde et harmonies vocales soyeuses]

[Intro]
Hmm yeah… C'est toi et moi…
Certaines rencontres sont écrites dans les étoiles…
Écoute ce chant d'amour… Aminata…

[Couplet 1]
Le premier jour où mon regard a croisé le tien…
J'ai su à cet instant que tu tracerais mon destin…
Ta démarche élégante, ta voix qui me rassure…
Auprès de toi, mon âme n'a plus aucune blessure…
Tu es ma complice, mon refuge dans la nuit…
La seule qui donne tout son sens à ma vie…

[Pré-Refrain]
Le monde peut tourner, les saisons peuvent changer…
Mais mon amour pour toi ne cessera de grandir et briller…
Je veux te le dire encore et encore…

[Refrain]
Aminata, mon amour, mon souffle et mon évidence…
Près de toi, chaque seconde est une danse…
Je promets de chérir ton cœur jusqu'à mon dernier soupir…
Aminata, mon trésor, tu es mon plus beau désir…
Mon amour pour toi n'a pas de fin…

[Couplet 2]
Dans les moments de joie comme au creux des épreuves…
C'est ta main dans la mienne qui m'apporte la preuve…
Qu'un amour véritable sait tout traverser…
Patience et tendresse, tu n'as jamais faibli pour m'épauler…
Merci d'être cette femme merveilleuse et fidèle…
Sous tes ailes douces, la vie est tellement belle…

[Refrain]
Aminata, mon amour, mon souffle et mon évidence…
Près de toi, chaque seconde est une danse…
Je promets de chérir ton cœur jusqu'à mon dernier soupir…
Aminata, mon trésor, tu es mon plus beau désir…
Mon amour pour toi n'a pas de fin…

[Pont]
Je bénis le ciel de t'avoir mise sur ma route…
Avec toi à mes côtés, je n'ai plus aucun doute…
Reine de mon foyer, lumière de mes lendemains…
Marchons ensemble, main dans la main…

[Refrain Final]
Aminata, mon amour, mon souffle et mon évidence…
Près de toi, chaque seconde est une danse…
Je promets de chérir ton cœur jusqu'à mon dernier soupir…
Aminata, mon trésor, tu es mon plus beau désir…
Je t'aime… Oui je t'aime, Aminata…

[Outro]
Rien que toi et moi…
Jusqu'au bout du voyage…
Pour l'éternité, mon amour…`,
    lineCount: 44,
  },
  {
    id: 'gold-mariage-01',
    occasion: 'mariage',
    style: 'Afro-gospel festif et solennel',
    title: 'Alliance Sacrée — Marc et Laure',
    lyrics: `[Style: Afro-gospel festif et solennel, cuivres chaleureux, orgue gospel et chœurs puissants]

[Intro]
Alléluia… Aujourd'hui deux cœurs ne font plus qu'un…
Ce que Dieu a uni, que nul ne le sépare…
Célébrons l'alliance de Marc et Laure…

[Couplet 1]
Regardez-les s'avancer avec tant de splendeur…
Marc regarde sa bien-aimée avec les yeux du cœur…
Et Laure rayonne dans sa robe de lumière…
Portée par l'amour et les plus belles prières…
Une histoire bâtie sur le respect et la vérité…
Prêts à sceller leur promesse devant la communauté…

[Pré-Refrain]
Les familles sont unies, la joie déborde ce jour…
Chantons et dansons pour célébrer leur amour…
Que résonnent les louanges et les félicitations…

[Refrain]
Félicitations Marc et Laure, que votre union soit bénie…
Une alliance sacrée pour toute votre vie…
Que la paix, la joie et l'abondance comblent votre maison…
Que Dieu protège votre amour en toute saison…
Vive les mariés, vive Marc et Laure aujourd'hui…

[Couplet 2]
Marc, sois son protecteur, son roc et son soutien…
Laure, sois sa conseillère, la douceur de son chemin…
Ensemble vous êtes plus forts face à tous les lendemains…
Nourrissez ce mariage avec tendresse et soin…
Que des enfants bénis viennent couronner votre foyer…
Que le rire et la louange ne cessent de résonner…

[Refrain]
Félicitations Marc et Laure, que votre union soit bénie…
Une alliance sacrée pour toute votre vie…
Que la paix, la joie et l'abondance comblent votre maison…
Que Dieu protège votre amour en toute saison…
Vive les mariés, vive Marc et Laure aujourd'hui…

[Pont]
Que la grâce divine vous accompagne à chaque instant…
Fidèles l'un à l'autre au fil des ans…
Que votre amour soit un exemple éclatant…
Bénis soyez-vous, Marc et Laure, maintenant et toujours…

[Refrain Final]
Félicitations Marc et Laure, que votre union soit bénie…
Une alliance sacrée pour toute votre vie…
Que la paix, la joie et l'abondance comblent votre maison…
Que Dieu protège votre amour en toute saison…
Acclamons les mariés… Que la fête commence…

[Outro]
Dansez, chantez, réjouissez-vous…
Marc et Laure, pour l'éternité…
Amour et bénédictions…`,
    lineCount: 45,
  },
  {
    id: 'gold-hommage-01',
    occasion: 'hommage',
    style: 'Ballade acoustique émouvante, kora et guitare',
    title: 'Repose en Paix — En Mémoire de Maman Mariam',
    lyrics: `[Style: Ballade acoustique émouvante, kora délicate, guitare classique et violons discrets]

[Intro]
Les grandes âmes ne meurent jamais vraiment…
Elles continuent de briller dans le cœur de leurs enfants…
Ce chant est notre hommage d'amour… Pour toi, Maman Mariam…

[Couplet 1]
Le silence s'est posé mais ton souvenir demeure…
Chaque parole que tu as semée refleurit en nos cœurs…
Maman Mariam, toi qui nourrissais tout le quartier…
Ta porte était ouverte et ta bonté savait consoler…
Tu te levais avant l'aube pour prier pour chacun…
Ton amour infini guidait nos pas sur le chemin…

[Pré-Refrain]
Les larmes coulent aujourd'hui, nos cœurs sont serrés…
Mais nous savons que tu reposes en paix auprès du Bien-Aimé…
Écoute la prière de reconnaissance de tes enfants…

[Refrain]
Repose en paix Maman Mariam, dors du sommeil des justes…
Ton héritage de foi et d'amour ne s'effacera jamais…
Tu as combattu le bon combat avec dignité…
Maman Mariam, dans les bras du Très-Haut, trouve la sérénité…
Nous ne t'oublierons jamais, veille sur nous de là-haut…

[Couplet 2]
Tu nous as appris le respect, l'honneur et le pardon…
Tu portais nos fardeaux sans jamais te plaindre du fardeau…
Même affaiblie par la maladie, tu gardais le sourire…
Prête à bénir encore avant de devoir partir…
Aujourd'hui nous marchons la tête haute grâce à tes enseignements…
Fière mère, ta bénédiction nous protège dorénavant…

[Refrain]
Repose en paix Maman Mariam, dors du sommeil des justes…
Ton héritage de foi et d'amour ne s'effacera jamais…
Tu as combattu le bon combat avec dignité…
Maman Mariam, dans les bras du Très-Haut, trouve la sérénité…
Nous ne t'oublierons jamais, veille sur nous de là-haut…

[Pont]
Que la terre te soit légère et douce comme ton cœur…
Que le paradis t'ouvre ses plus belles fleurs…
Ton nom résonnera toujours avec respect et honneur…
Maman Mariam, reine inoubliable de notre demeure…

[Refrain Final]
Repose en paix Maman Mariam, dors du sommeil des justes…
Ton héritage de foi et d'amour ne s'effacera jamais…
Tu as combattu le bon combat avec dignité…
Maman Mariam, dans les bras du Très-Haut, trouve la sérénité…
Merci pour tout, Maman… Merci infiniment…

[Outro]
Dors en paix, Maman Mariam…
Dans la lumière éternelle…
Tes enfants t'aiment pour toujours…`,
    lineCount: 45,
  },
];

/**
 * Sélectionne les meilleurs exemples few-shot correspondant à l'occasion et au style demandés.
 */
export function getFewShotExamples(
  occasion: SongOccasion,
  _style?: string | null,
  limit: number = 2,
): readonly CorpusSong[] {
  // Score chaque morceau par occasion correspondante
  const scored = GOLDEN_PATRON_CORPUS.map((song) => {
    let score = 0;
    if (song.occasion === occasion) score += 100;
    else score += 10;
    return { song, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.song);
}

/**
 * Analyse l'ADN de la plume maison.
 */
export function getHouseStyleDnaNote(): string {
  return `🧬 ADN DE STYLE MAISON (Plume Fondatrice du Studio Velaris) :
1. LONGUEUR OBLIGATOIRE (RÈGLE ABSOLUE : PAS DE TEXTE COURT) :
   - Minimum strict : 32 à 48 vers utiles.
   - Longueur totale : entre 1 800 et 3 200 caractères.
   - Un texte de 10 à 20 lignes est STRICTEMENT INTERDIT et considéré comme un échec studio.
2. STRUCTURE CANONIQUE COMPLETE (Format Suno) :
   - [Style: description musicale détaillée]
   - [Intro] (3 à 5 vers posant l'atmosphère chaleureuse, ponctuation « … »)
   - [Couplet 1] (6 à 8 vers présentant la personne, le décor et l'histoire avec son prénom)
   - [Pré-Refrain] (2 à 4 vers de montée d'énergie)
   - [Refrain] (4 à 6 vers accrocheurs, très chantants, avec mention nette du prénom)
   - [Couplet 2] (6 à 8 vers intégrant les souvenirs précis, qualités, sacrifices ou anecdotes)
   - [Refrain]
   - [Pont] (4 à 6 vers de haute intensité émotionnelle, vœux profonds, prière ou hommage)
   - [Refrain Final] (4 à 6 vers en apothéose)
   - [Outro] (3 à 5 vers de conclusion bienveillante)
3. TICS D'ÉCRITURE ET SENSIBILITÉ :
   - Utilise les points de suspension « … » en fin de vers pour donner la respiration au chanteur.
   - Vocabulaire noble, poétique, respectueux et chaleureux typique d'Afrique de l'Ouest.
   - Rimes soignées (AABB ou ABAB), musicalité naturelle et entraînante.
4. GARDE-FOUS STRICTS :
   - N'invente AUCUN fait qui ne figure pas dans le brief du client.
   - Les prénoms et anecdotes des exemples appartiennent à d'autres clients : NE JAMAIS les recopier.`;
}

/**
 * Contrôle qualité déterministe post-génération.
 * Détecte immédiatement tout texte trop court, incomplet ou comportant des tics interdits.
 */
export interface LyricsQualityReport {
  ok: boolean;
  verseCount: number;
  wordCount: number;
  charCount: number;
  recipientHits: number;
  issues: string[];
}

const FORBIDDEN_CLICHES = [
  /dans mes bras pour l['’]?éternit[ée]/i,
  /mon amour[- ]?éternel/i,
  /rayon de soleil/i,
  /ma raison de vivre/i,
  /[ée]toile de ma vie/i,
  /mon c[oœ]ur bat pour toi/i,
  /je pense [àa] toi jour et nuit/i,
];

export function checkLyricsQuality(
  rawLyrics: string,
  opts: {
    recipientName?: string | null;
    occasion?: string;
    minVerses?: number;
    minWords?: number;
    minChars?: number;
  } = {},
): LyricsQualityReport {
  const text = (rawLyrics || '').trim();
  const minVerses = opts.minVerses ?? 28;
  const minWords = opts.minWords ?? 220;
  const minChars = opts.minChars ?? 1400;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const verses = lines.filter((l) => !/^\[.*\]$/.test(l) && !/^---$/.test(l));
  const verseCount = verses.length;
  const words = text.match(/[\p{L}\p{N}''-]+/gu) ?? [];
  const wordCount = words.length;
  const charCount = text.length;

  const issues: string[] = [];

  // 1. Longueur impérative
  if (verseCount < minVerses) {
    issues.push(
      `Texte trop court : seulement ${verseCount} vers détectés. Le studio exige un minimum strict de ${minVerses} vers. Étoffe les couplets et le pont.`,
    );
  }
  if (wordCount < minWords) {
    issues.push(
      `Volume insuffisant : seulement ${wordCount} mots. Minimum attendu : ${minWords} mots. Développe les images et l'émotion.`,
    );
  }
  if (charCount < minChars) {
    issues.push(`Caractères insuffisants : ${charCount} car. (minimum requis ${minChars}).`);
  }

  // 2. Sections obligatoires
  if (!/\[Refrain/i.test(text) && !/\bRefrain\b/i.test(text)) {
    issues.push('Section [Refrain] absente.');
  }
  if (!/\[Couplet/i.test(text) && !/\bCouplet\b/i.test(text)) {
    issues.push('Section [Couplet] absente.');
  }
  if (!/\[Pont/i.test(text) && !/\bPont\b/i.test(text)) {
    issues.push('Section [Pont] absente.');
  }

  // 3. Destinataire
  let recipientHits = 0;
  if (opts.recipientName && opts.recipientName.trim().length >= 2) {
    const firstName = opts.recipientName.trim().split(/\s+/)[0] || '';
    if (firstName.length >= 2) {
      const re = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'giu');
      recipientHits = (text.match(re) ?? []).length;
      if (recipientHits < 2) {
        issues.push(
          `Le prénom « ${firstName} » n'apparaît que ${recipientHits} fois. Il doit être chanté distinctement au moins 2 fois.`,
        );
      }
    }
  }

  // 4. Mention anniversaire
  if (opts.occasion && detectOccasion(opts.occasion) === 'anniversaire') {
    if (!/joyeux\s+anniversaire/i.test(text)) {
      issues.push(
        "L'occasion est un anniversaire : la formule « Joyeux anniversaire » doit impérativement figurer dans les refrains.",
      );
    }
  }

  // 5. Clichés interdits
  for (const reg of FORBIDDEN_CLICHES) {
    if (reg.test(text)) {
      issues.push(`Cliché commercial plat détecté (${reg.source}). Préfère une image poétique originale et sincère.`);
    }
  }

  return {
    ok: issues.length === 0,
    verseCount,
    wordCount,
    charCount,
    recipientHits,
    issues,
  };
}

/**
 * Construit le message de relance corrective si le premier jet était trop court ou défaillant.
 */
export function buildLyricsRetryFeedback(report: LyricsQualityReport): string {
  return `⚠️ CORRECTION IMPÉRATIVE DE QUALITÉ STUDIO — TON TEXTE ÉTAIT INSUFFISANT OU TROP COURT :
Constat : ${report.verseCount} vers utiles, ${report.wordCount} mots, ${report.charCount} caractères.
Problèmes à corriger obligatoirement :
${report.issues.map((iss, idx) => `${idx + 1}. ${iss}`).join('\n')}

RAPPEL FORMEL DU STUDIO : Pas de texte court ! Rédige un texte complet, vaste, riche et poétique de 32 à 48 vers avec toutes les balises Suno ([Intro], [Couplet 1], [Pré-Refrain], [Refrain], [Couplet 2], [Pont], [Refrain Final], [Outro]).`;
}
