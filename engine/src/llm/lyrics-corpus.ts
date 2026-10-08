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
  | 'famille'
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
    "id": "gold-anniv-01",
    "occasion": "anniversaire",
    "style": "Afro-pop acoustique douce et entraînante, guitare acoustique, balafon subtil et percussions chaudes",
    "title": "Deux Étoiles, Un Même Jour",
    "lyrics": "Deux Étoiles, Un Même Jour\n\nDe la part de toute la famille\n\n\n---\n\nIntro\n\nAujourd'hui...\n\nLe onze juillet...\n\nLe ciel...\n\nA choisi...\n\nUne date unique...\n\nPour célébrer...\n\nDeux belles étoiles...\n\nAbdoul Hakim...\n\nEt sa petite nièce...\n\nHuit ans aujourd'hui...\n\nQuelle magnifique coïncidence...\n\nQuel merveilleux cadeau...\n\nDe Dieu...\n\n\n---\n\nCouplet 1\n\nAbdoul Hakim...\n\nDepuis toujours...\n\nTu es un battant...\n\nTu avances...\n\nAvec courage...\n\nEt détermination...\n\nChaque épreuve...\n\nT'a rendu...\n\nPlus fort...\n\nEt aujourd'hui...\n\nToute la famille...\n\nEst fière de toi...\n\nFière de l'homme...\n\nQue tu deviens...\n\n\n---\n\nPré-refrain\n\nLe onze juillet...\n\nEst devenu...\n\nUne date...\n\nTrès spéciale...\n\nCar ce jour-là...\n\nDieu nous a offert...\n\nDeux raisons...\n\nDe sourire...\n\n\n---\n\nRefrain\n\nJoyeux anniversaire...\n\nAbdoul Hakim...\n\nQue Dieu te bénisse...\n\nEt guide chacun...\n\nDe tes pas...\n\nToute la famille...\n\nTe célèbre aujourd'hui...\n\nAvec fierté...\n\nAvec amour...\n\nEt avec reconnaissance...\n\n\n---\n\nCouplet 2\n\nEt comme si Dieu...\n\nVoulait écrire...\n\nUne belle histoire...\n\nLe même jour...\n\nUne petite princesse...\n\nEst venue au monde...\n\nHuit ans plus tard...\n\nComme tu l'avais dit...\n\nEn plaisantant...\n\n\"Grande sœur...\n\nGrouille-toi...\n\nPour que le bébé...\n\nNaïsse le même jour...\n\nQue moi...\"\n\nEt Dieu...\n\nEn a décidé ainsi...\n\nDepuis ce jour...\n\nVous partagez...\n\nLa même date...\n\nLe même bonheur...\n\nEt les mêmes sourires...\n\n\n---\n\nPont\n\nQue Dieu...\n\nVous garde tous les deux...\n\nQu'Il remplisse vos vies...\n\nDe santé...\n\nDe joie...\n\nDe réussite...\n\nEt d'innombrables bénédictions...\n\nQue vos chemins...\n\nSoient toujours...\n\nÉclairés...\n\nPar Sa lumière...\n\n\n---\n\nRefrain Final\n\nJoyeux anniversaire...\n\nAbdoul Hakim...\n\nContinue d'être...\n\nCe battant...\n\nQui fait...\n\nLa fierté...\n\nDe toute la famille...\n\nEt joyeux anniversaire...\n\nÀ notre petite princesse...\n\nQue tes huit ans...\n\nSoient remplis...\n\nDe rires...\n\nDe rêves...\n\nEt de bonheur...\n\nAujourd'hui...\n\nToute la famille...\n\nVous serre très fort...\n\nDans son cœur...\n\n\n---\n\nOutro\n\nLe onze juillet...\n\nSera toujours...\n\nUne date...\n\nPas comme les autres...\n\nDeux anniversaires...\n\nDeux sourires...\n\nDeux bénédictions...\n\nUne seule famille...\n\nQui remercie Dieu...\n\nPour chacun de vous...\n\nJoyeux anniversaire...\n\nAbdoul Hakim...\n\nJoyeux anniversaire...\n\nÀ notre petite princesse...\n\nQue Dieu...\n\nVous protège...\n\nAujourd'hui...\n\nDemain...\n\nEt pour toujours...",
    "lineCount": 124
  },
  {
    "id": "gold-mariage-01",
    "occasion": "mariage",
    "style": "Afro Love / Rumba – Chaleureux, festif, élégant, cuivres doux et guitares rumba",
    "title": "Bienvenue dans Votre Nouveau Bonheur",
    "lyrics": "Titre : Bienvenue dans Votre Nouveau Bonheur\n\n(Afro Love / Rumba – Chaleureux, festif, élégant, rempli de joie, de bénédictions et de convivialité)\n\nIntro\n\nAujourd'hui,\n\nLe village\n\nSourit.\n\nLe quartier\n\nEst en fête.\n\nDeux cœurs\n\nOnt dit\n\nOui.\n\nEt une nouvelle\n\nHistoire\n\nCommence.\n\nBienvenue\n\nÀ Monsieur\n\nEt Madame\n\nYédé.\n\nCette chanson\n\nVous est offerte\n\nAvec affection,\n\nPar celle\n\nQue tout le monde\n\nConnaît\n\nSous le nom\n\nDe Maman Dorothée.\n\n\n---\n\nCouplet Un\n\nHier,\n\nVous avez uni\n\nVos vies.\n\nAujourd'hui,\n\nVous rentrez\n\nChez vous,\n\nMain dans la main,\n\nLe cœur\n\nRempli\n\nD'amour.\n\nLe plus beau\n\nCommence\n\nMaintenant.\n\nConstruire\n\nUn foyer,\n\nPartager\n\nLes joies,\n\nTraverser\n\nLes saisons,\n\nEt avancer\n\nToujours\n\nEnsemble.\n\n\n---\n\nPré-Refrain\n\nLe mariage,\n\nC'est deux cœurs\n\nQui apprennent\n\nÀ marcher\n\nDu même pas.\n\nDeux regards\n\nQui se comprennent.\n\nDeux vies\n\nQui deviennent\n\nUne seule\n\nFamille.\n\n\n---\n\nRefrain\n\nFélicitations,\n\nMonsieur\n\nEt Madame\n\nYédé !\n\nQue votre maison\n\nSoit remplie\n\nDe rires.\n\nQue votre table\n\nNe manque\n\nJamais\n\nDe pain.\n\nQue vos journées\n\nSoient pleines\n\nDe bonheur.\n\nEt que votre amour\n\nGrandisse\n\nChaque jour\n\nUn peu plus.\n\n\n---\n\nCouplet Deux\n\nLes voisins\n\nVous regardent\n\nAvec joie.\n\nLes amis\n\nVous souhaitent\n\nLe meilleur.\n\nQue le respect\n\nHabite\n\nVotre maison.\n\nQue le pardon\n\nVous rapproche.\n\nQue la confiance\n\nSoit votre force.\n\nEt que Dieu\n\nVous accompagne\n\nÀ chaque\n\nÉtape\n\nDe votre vie.\n\n\n---\n\nPont\n\nAujourd'hui,\n\nLes fleurs\n\nSont belles.\n\nLes sourires\n\nSont sincères.\n\nLes cœurs\n\nSont heureux.\n\nEt tout le quartier\n\nSe réjouit\n\nDe voir\n\nNaître\n\nCe beau foyer.\n\n\n---\n\nRefrain Final\n\nFélicitations,\n\nMonsieur\n\nEt Madame\n\nYédé !\n\nQue Dieu\n\nBénisse\n\nVotre union.\n\nQu'Il vous accorde\n\nLa paix,\n\nLa santé,\n\nLa prospérité,\n\nDe beaux enfants,\n\nEt une longue vie\n\nRemplie\n\nD'amour.\n\n\n---\n\nOutro\n\nDe la part\n\nDe Maman Dorothée,\n\nRecevez\n\nCes quelques mots\n\nDu fond\n\nDu cœur.\n\nBienvenue\n\nDans cette nouvelle\n\nVie.\n\nQue votre amour\n\nNe cesse\n\nJamais\n\nDe fleurir.\n\nEncore\n\nToutes nos félicitations,\n\nMonsieur\n\nEt Madame\n\nYédé.\n\nQue Dieu\n\nVeille\n\nSur votre foyer,\n\nAujourd'hui,\n\nDemain,\n\nEt pour toujours.",
    "lineCount": 153
  },
  {
    "id": "gold-amour-01",
    "occasion": "amour",
    "style": "R&B Afrobeat romantique et sincère, guitare nylon et harmonies vocales soyeuses",
    "title": "Philippe André – Notre Histoire Écrite par le Destin",
    "lyrics": "Philippe André – Notre Histoire Écrite par le Destin\n\n(Chanson d'amour – Romantique et sincère, de la part de N'Guessan Dorothée)\n\nIntro\n\nIl y a des rencontres que l'on oublie...\n\nEt il y a celles qui changent une vie.\n\nLa nôtre a commencé derrière un écran...\n\nSur Facebook...\n\nMais aujourd'hui, elle est devenue une magnifique réalité.\n\nCette chanson est pour toi,\n\nPhilippe André,\n\nDe la part de celle qui t'aime,\n\nN'Guessan Dorothée.\n\n\n---\n\nCouplet 1\n\nQui aurait cru qu'un simple message,\n\nChangerait le cours de notre histoire ?\n\nNos cœurs se sont trouvés,\n\nSans même se connaître.\n\nJour après jour,\n\nLes mots sont devenus des sentiments.\n\nEt aujourd'hui,\n\nJe remercie Dieu\n\nD'avoir croisé ton chemin.\n\nTu es entré dans ma vie\n\nAvec simplicité,\n\nEt tu as rempli mon cœur\n\nD'un bonheur que je n'attendais plus.\n\n\n---\n\nPré-refrain\n\nLe temps nous rapproche,\n\nLa distance ne nous sépare plus.\n\nCar bientôt,\n\nLe quinze août,\n\nJe pourrai enfin te serrer dans mes bras.\n\n\n---\n\nRefrain\n\nPhilippe André,\n\nJe t'attends avec le sourire.\n\nChaque jour qui passe\n\nMe rapproche de toi.\n\nJe prie pour que notre histoire\n\nSoit bâtie sur l'amour,\n\nLe respect,\n\nLa fidélité\n\nEt surtout...\n\nLa vérité.\n\nNe nous faisons jamais de mal.\n\nParlons-nous avec le cœur.\n\nCar un amour sincère\n\nNe grandit que dans la confiance.\n\n\n---\n\nCouplet 2\n\nJe ne veux ni mensonge,\n\nNi promesses sans lendemain.\n\nJe veux simplement\n\nUn homme vrai,\n\nQui marche à mes côtés,\n\nDans les bons\n\nComme dans les mauvais moments.\n\nConstruisons notre histoire\n\nMain dans la main.\n\nAvec Dieu devant nous,\n\nEt l'amour comme chemin.\n\nJe crois en nous,\n\nEt je crois en notre avenir.\n\n\n---\n\nPont\n\nLe quinze août sera un jour spécial.\n\nCelui où le virtuel\n\nLaissera définitivement place au réel.\n\nQue cette rencontre\n\nSoit le début\n\nD'une belle aventure,\n\nRemplie de complicité,\n\nDe paix\n\nEt de bonheur.\n\n\n---\n\nRefrain final\n\nPhilippe André,\n\nMerci d'être entré dans ma vie.\n\nJe veux continuer\n\nÀ écrire cette histoire avec toi.\n\nRestons toujours honnêtes,\n\nToujours sincères,\n\nToujours vrais.\n\nCar c'est la vérité\n\nQui fait durer les plus beaux amours.\n\nDe la part de N'Guessan Dorothée,\n\nReçois cette chanson\n\nComme une déclaration remplie d'amour,\n\nDe confiance\n\nEt d'espérance.\n\n\n---\n\nOutro\n\nPhilippe André...\n\nJe t'attends avec impatience.\n\nQue Dieu protège chacun de tes pas,\n\nQu'Il veille sur ton voyage,\n\nEt qu'Il bénisse notre histoire.\n\nLe meilleur est devant nous.\n\nÀ très bientôt...\n\nJe t'aime, et j'ai hâte de te retrouver.",
    "lineCount": 95
  },
  {
    "id": "gold-hommage-01",
    "occasion": "hommage",
    "style": "Ballade acoustique émouvante, kora délicate, guitare classique et violons discrets",
    "title": "À Mon Ami au Grand Cœur",
    "lyrics": "À Mon Ami au Grand Cœur\n\n(Chanson d'hommage – Afro love inspirante et émouvante. Une voix masculine chaleureuse, remplie de reconnaissance, d'admiration et de bénédictions.)\n\nIntro\n\nIl y a des rencontres\n\nQue Dieu écrit\n\nLui-même.\n\nDes amitiés\n\nQui deviennent\n\nDes bénédictions.\n\nAujourd'hui,\n\nJe veux rendre hommage\n\nÀ un homme\n\nAu cœur immense.\n\nUn ami\n\nPrécieux.\n\n\n---\n\nCouplet 1\n\nC'est au sein\n\nDe la grande famille\n\nDes natifs de juillet\n\nQue nos chemins\n\nSe sont croisés.\n\nEt depuis ce jour,\n\nJ'ai découvert\n\nUn homme exceptionnel.\n\nToujours souriant,\n\nToujours jovial,\n\nToujours prêt\n\nÀ tendre la main.\n\nÀ ses côtés,\n\nLa joie\n\nTrouve toujours\n\nSa place.\n\n\n---\n\nPré-refrain\n\nTu possèdes\n\nUn cœur immense,\n\nUn cœur sincère,\n\nUn cœur protecteur.\n\nTu fais du bien\n\nSans rien attendre.\n\nEt c'est pour cela\n\nQue je suis fière\n\nDe marcher\n\nÀ tes côtés.\n\n\n---\n\nRefrain\n\nMerci,\n\nMon ami précieux.\n\nTa sincérité\n\nEst une richesse.\n\nTa présence\n\nEst un cadeau.\n\nQue la main de Dieu\n\nRepose toujours\n\nSur toi,\n\nSur ta famille,\n\nEt sur tout\n\nCe que tu entreprends.\n\n\n---\n\nCouplet 2\n\nJe chéris\n\nChaque instant\n\nPartagé avec toi.\n\nTu inspires\n\nLa confiance,\n\nLe respect\n\nEt la paix.\n\nQue Dieu\n\nTe garde toujours\n\nVisible\n\nAux yeux de ceux\n\nQui t'aiment,\n\nEt invisible\n\nAux yeux\n\nDe tes ennemis.\n\nQu'Il te place\n\nToujours\n\nAu bon endroit,\n\nAu bon moment.\n\n\n---\n\nPont\n\nQue le Seigneur\n\nSoit ton bouclier,\n\nTa force,\n\nTa lumière.\n\nQu'Il fasse de toi\n\nLa tête\n\nEt jamais\n\nLa queue.\n\nQu'Il ouvre devant toi\n\nLes portes\n\nQue personne\n\nNe pourra fermer.\n\n\n---\n\nRefrain final\n\nMerci,\n\nMon ami précieux.\n\nQue tes jours\n\nSoient remplis\n\nDe bonheur,\n\nDe paix,\n\nDe santé\n\nEt de succès.\n\nQue Dieu\n\nContinue\n\nDe te bénir,\n\nDe t'élever\n\nEt de protéger\n\nTous ceux\n\nQui te sont chers.\n\n\n---\n\nOutro\n\nCet hommage\n\nVient du fond\n\nDe mon cœur.\n\nParce que\n\nLes vrais amis\n\nSont rares.\n\nMerci\n\nD'être celui\n\nQue tu es.\n\nQue Dieu\n\nVeille sur toi,\n\nAujourd'hui,\n\nDemain,\n\nEt pour toujours.\n\nAmen.",
    "lineCount": 121
  },
  {
    "id": "gold-famille-01",
    "occasion": "famille",
    "style": "Chanson festive familiale, percussions chaudes, balafon et cuivres festifs",
    "title": "La Fierté de Ma Maman",
    "lyrics": "La Fierté de Ma Maman\n\n(Chanson festive – Offerte par Diamoutene Saffiatou à son fils Bamba Arouna, en l'honneur d'une fête. Une chanson pleine de fierté, de bénédictions et d'amour familial.)\n\nIntro\n\nAujourd'hui...\n\nLa musique résonne.\n\nLes tambours battent.\n\nLes cœurs sont en fête.\n\nCette chanson\n\nEst offerte\n\nPar une maman\n\nQui aime son fils\n\nPlus que tout.\n\nDiamoutene Saffiatou\n\nChante aujourd'hui\n\nPour son fils,\n\nBamba Arouna.\n\n\n---\n\nCouplet 1\n\nBamba Arouna,\n\nDepuis le jour\n\nOù Dieu t'a confié à moi,\n\nTu es devenu\n\nUne immense joie\n\nDans mon cœur.\n\nJe t'ai vu grandir.\n\nTomber.\n\nTe relever.\n\nApprendre.\n\nEt devenir\n\nChaque jour\n\nUn homme de valeur.\n\nTon père,\n\nBamba Mory,\n\nEt moi,\n\nNous remercions Dieu\n\nPour la grâce\n\nDe t'avoir dans nos vies.\n\n\n---\n\nPré-refrain\n\nMon fils...\n\nQuoi qu'il arrive,\n\nN'oublie jamais\n\nD'où tu viens.\n\nGarde toujours\n\nLe respect,\n\nL'humilité,\n\nEt la foi.\n\nCar ce sont\n\nLes plus grandes richesses\n\nQu'une mère\n\nPuisse transmettre.\n\n\n---\n\nRefrain\n\nBamba Arouna,\n\nQue Dieu te protège.\n\nQu'Il éclaire\n\nTous tes chemins.\n\nQu'Il te donne\n\nLa santé,\n\nLa paix,\n\nLe bonheur,\n\nLa réussite,\n\nEt une longue vie.\n\nQue chacun de tes pas\n\nSoit accompagné\n\nPar Sa bénédiction.\n\nAujourd'hui,\n\nToute la fête\n\nCélèbre ton bonheur.\n\n\n---\n\nCouplet 2\n\nJe suis fière\n\nDe l'homme\n\nQue tu deviens.\n\nContinue\n\nÀ honorer\n\nTa famille.\n\nContinue\n\nÀ respecter\n\nLes anciens.\n\nContinue\n\nÀ croire\n\nEn tes rêves.\n\nCar avec Dieu,\n\nAucune montagne\n\nN'est trop haute.\n\nEt aucune victoire\n\nN'est impossible.\n\n\n---\n\nPont\n\nQue cette fête\n\nSoit remplie\n\nDe joie,\n\nDe rires,\n\nDe danses\n\nEt de bénédictions.\n\nQue tous ceux\n\nQui sont réunis\n\nAujourd'hui\n\nPartagent\n\nLe bonheur\n\nQui remplit\n\nNos cœurs.\n\n\n---\n\nRefrain final\n\nBamba Arouna,\n\nMon fils,\n\nTu es\n\nMa fierté.\n\nMon sourire.\n\nMa bénédiction.\n\nQue le Seigneur\n\nTe garde,\n\nTe fortifie,\n\nEt t'accorde\n\nUne vie\n\nRemplie de succès.\n\nQue ton nom\n\nSoit toujours\n\nSynonyme\n\nD'honneur\n\nEt de dignité.\n\n\n---\n\nOutro\n\nBamba Arouna...\n\nCette voix\n\nEst celle\n\nDe ta maman,\n\nDiamoutene Saffiatou,\n\nQui prie chaque jour\n\nPour ton bonheur.\n\nTon père,\n\nBamba Mory,\n\nS'unit également\n\nÀ ces bénédictions.\n\nQue Dieu veille sur toi,\n\nAujourd'hui,\n\nDemain,\n\nEt pour toute ta vie.\n\nBonne fête, mon fils.\n\nNous t'aimons infiniment.",
    "lineCount": 134
  }
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
