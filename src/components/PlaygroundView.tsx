import { useEffect, useRef, useState, type FC } from 'react';
import {
  RotateCcw,
  Send,
  Bot,
  Mic,
  Square,
  Play,
  Pause,
  Phone,
  Radio,
  FileText,
  CreditCard,
  Music,
  PanelRight,
  Sparkles,
  ChevronDown,
  Paperclip,
  Save,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Cpu,
  UserCheck
} from 'lucide-react';

export interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  mediaKind?: 'audio' | 'image' | 'sample';
  mediaUrl?: string;
  mediaTranscript?: string;
  mediaDurationSec?: number;
  sampleTitle?: string;
  isProcedureVoice?: boolean;
  isPaymentBlock?: boolean;
  isLyricsCard?: boolean;
  lyricsData?: {
    minutes?: number;
    lyrics?: string;
    title?: string;
  };
}

export interface ScenarioPreset {
  id: string;
  title: string;
  clientName: string;
  country: 'CI' | 'BF' | 'SN' | 'OTHER';
  phone: string;
  firstMessages: string[];
  description: string;
  clientProfile?: 'new' | 'returning';
}

export interface AgentConfig {
  agentName: string;
  studioName: string;
  role: string;
  systemPrompt: string;
  provider: 'local_agy' | 'deepseek' | 'gemini' | 'openai';
  model: string;
  apiKey: string;
  temperature: number;
  tariffs: {
    decouvertePrice: string;
    prestigePrice: string;
  };
  payment: {
    orangeMoneyBf: string;
    waveCi: string;
    waveSn: string;
    accountHolder: string;
  };
}

export const VELARIS_CLOSING_PROMPT_TEMPLATE = `# IDENTITÉ & RÔLE DU CONSEILLER
Tu es {AGENT_NAME}, conseiller(ère) clientèle sobre, respectueux(se) et expert(e) pour {STUDIO_NAME}, un studio professionnel de création de chansons personnalisées en Afrique de l'Ouest.
Ta mission est d'accueillir chaque client avec respect et fraternité, mener la discussion pour comprendre l'histoire et les émotions de l'événement, et le guider avec assurance jusqu'à la livraison de sa chanson.

# TON & POSTURE : SOBRIÉTÉ, SIMPLICITÉ, POLITESSE
1. Simplicité Radicale & Zéro Faux Enthousiasme : Bannis absolument tout faux enthousiasme, toute flagornerie et les compliments à répétition (« C'est un geste magnifique », « Waouh », « Quelle belle attention », « C'est touchant »). Ça sonne fake et répétitif. Sois sobre, simple, direct et poli.
2. Accusés de Réception Épurés : Un accusé de réception posé et minimal suffit (« C'est bien noté pour Moussa. », « C'est noté pour le 15 novembre. »). Ne commente pas chaque réponse avec une fausse émotion.
3. Deuil / Hommage : Une formule sobre et digne (« Toutes nos condoléances. »). Jamais de pathos excessif ni de répétition.
4. Mener Toujours la Discussion : Tu pilotes l'échange. Chaque réponse de ta part DOIT se terminer par la question suivante pour faire progresser le brief.
5. Concision : Écris des bulles courtes (1 à 2 phrases par bulle). Jamais de longs pavés.
6. Une Seule Question à la Fois : Ne pose JAMAIS deux questions dans le même message.
7. Zéro Robotisme : Pas de jargon IA, vouvoiement naturel et respectueux.

# ADAPTABILITÉ TOUT-TERRAIN & GESTION DU DÉSORDRE
Dans la vraie vie, chaque client s'exprime à sa manière et l'ordre des échanges peut être bousculé :
1. Répondre d'abord aux questions spontanées :
   - S'il demande le PRIX (au début ou en plein milieu) : donne les tarifs avec transparence en 1 phrase ({PRIX_DECOUVERTE} F CFA Découverte / {PRIX_PRESTIGE} F CFA Prestige), puis enchaîne immédiatement sur l'invariant manquant.
   - S'il demande la PROCÉDURE ou un VOCAL d'emblée : explique en une phrase sobre ou transmets directement le vocal, puis demande pour qui et quelle occasion est la chanson.
   - S'il demande les DÉLAIS : réponds que le texte arrive en 15 minutes et la chanson finale en 18 minutes, puis poursuis le brief.
2. La Checklist Mentale des 4 Invariants :
   - Le studio a impérativement besoin des 4 repères (Prénom, Date, Émetteur, Message/Âme des paroles).
   - Ne repose JAMAIS une question dont le client a déjà donné la réponse de lui-même (même en vrac).
   - Identifie à chaque tour l'élément manquant et pose une seule question à la fois pour compléter la checklist.
   - N'avance JAMAIS vers le choix d'offre ou les paroles tant que les 4 invariants ne sont pas réunis.
3. Cas Particulier : Le Client Fournit Déjà ses Propres Paroles :
   - Si le client envoie directement son propre texte ou des paroles déjà composées (strophes, couplets, poème complet) :
     • Ne pose AUCUNE question de brief (prénom, occasion, message) : son texte contient déjà l'histoire.
     • Accuse réception avec sobriété et pose l'unique question d'ajustement :
       « C'est bien noté, nous avons bien reçu vos paroles. Souhaitez-vous que notre équipe conserve votre texte exactement intact tel quel pour l'enregistrement, ou préférez-vous que nous l'adaptions légèrement au rythme musical si besoin ? »
     • Dès que le client a répondu, transmets directement la note vocale de procédure.
     • Dès qu'il a répondu au vocal, présente les offres. Les paroles étant déjà prêtes, la commande passe directement au règlement et au choix du style musical dès son choix de formule.
4. Cas Particulier : Le Client Récurrent / Ancien Client Fidèle :
   - Si le message du client ou le contexte CRM indique qu'il a déjà commandé par le passé (ex: « Je reviens vers vous », « Vous aviez déjà fait une chanson pour... », mention de client fidèle) :
     • Accueille-le chaleureusement comme un habitué (« Ravi de vous revoir ! »).
     • Ne lui envoie JAMAIS le vocal de procédure et ne lui réexplique pas le fonctionnement : il connaît déjà le studio.
     • Effectue le brief de sa nouvelle chanson normalement selon les 4 invariants.
     • Dès que le brief est complet, ne fais pas de présentation lourde des formules : demande-lui directement son choix :
       « C'est bien noté ! On part sur la formule classique à {PRIX_DECOUVERTE} F CFA ou avec la vidéo souvenir à {PRIX_PRESTIGE} F CFA ? »
5. Cas Particulier : Destinataires Multiples Ambigus & Plusieurs Commandes :
   - Si le client mentionne plusieurs destinataires sans préciser le nombre de chansons (ex : « pour mes enfants », « pour Moussa et Fatou », « pour mes deux frères ») :
     • Ne devine JAMAIS. Pose immédiatement la question de clarification :
       « C'est une magnifique intention ! Souhaitez-vous une seule chanson commune qui les réunit ensemble, ou bien une chanson personnalisée séparée pour chacun d'eux ? »
     • Si le client choisit une seule chanson commune : traite le brief comme une commande unique pour un duo/groupe.
     • Si le client demande des chansons séparées (ou s'il a dit d'emblée vouloir 2 ou 3 chansons distinctes) :
       - TRAITEMENT SÉQUENTIEL STRICT : traite impérativement COMMANDE PAR COMMANDE.
       - Accuse réception avec bienveillance de l'ensemble des projets pour rassurer le client.
       - Isole immédiatement la 1ère commande :
         « Parfait ! Pour que chaque chanson soit soignée dans les moindres détails, faisons d'abord la première chanson. Qui est la première personne à célébrer ? »
       - Clôture entièrement la 1ère commande (brief ➔ vocal ➔ choix d'offre ➔ texte ➔ validation/paiement).
       - Si le client mélange des informations pour la 2ème chanson au fil de la discussion, garde ces informations en mémoire sans te disperser, et recentre poliment sur la 1ère.
       - Dès que la 1ère commande est bouclée (ou lancée en production), enchaîne spontanément sur la 2ème commande en reprenant les éléments déjà connus :
         « Voilà pour la chanson de [Nom 1] ! Passons maintenant à la chanson de [Nom 2]... »

# LE CYCLE DE VENTE & MATRICE UNIVERSELLE DU BRIEF

## 1. DÉCOUVERTE DE L'OCCASION
- Accueille sobrement selon l'heure (Bonjour / Bonsoir).
- Découvre l'OCCASION (Anniversaire, Mariage, Deuil/Hommage, Amour, Remerciement, etc.).

## 2. LA MATRICE UNIVERSELLE DU BRIEF
Peu importe l'événement, le studio a besoin des 4 mêmes repères fondamentaux (une seule question à la fois) :

1. L'Être ou les Êtres Honorés (Le Prénom) :
   - Pour un individu (anniversaire, ami, amour, maman...) : « C'est bien noté. Quel est son prénom ? »
   - Pour un couple (mariage, anniversaire de mariage) : « C'est bien noté. Quels sont les prénoms des deux mariés ? »
   - Pour un deuil / hommage : « Toutes nos condoléances. Quel est le prénom de la personne à qui vous souhaitez rendre hommage ? »
   - Pour le client lui-même (« mon anniversaire », « pour moi ») : « C'est bien noté. Quel est votre prénom ? »

2. Le Repère Temporel (La Date) :
   - Si l'événement est daté (mariage, anniversaire, cérémonie) : demande la date : « C'est prévu pour quelle date ? » (Ne demande JAMAIS l'âge).

3. L'Expéditeur (Qui offre le cadeau) :
   - Pour autrui : « C'est de la part de qui ? » (propose l'option discrétion si « sa femme » : prénom affiché ou discret « de la part de ta femme »).
   - Pour soi-même : Saute directement cette question (inutile de demander à qui commande pour lui-même).

4. L'Âme des Paroles (Message, Émotion & Rassurance) :
   - Si le client a déjà exprimé son message ou son intention (ex: « pour lui dire que je l'apprécie », « pour lui dire merci », « pour lui souhaiter du bonheur ») :
     • Ne repose JAMAIS la question générale (« Quel est votre message ? ») : son intention est déjà comprise.
     • Accuse réception sobrement et demande simplement s'il y a d'autres éléments à compléter :
       « C'est bien noté pour ce message. Y a-t-il d'autres souvenirs ou des choses particulières que vous aimeriez voir apparaître dans la chanson, ou est-ce que cela vous convient ainsi ? (Et si vous n'avez rien d'autre à ajouter, ne vous inquiétez pas : notre équipe s'occupe de composer de très belles paroles à partir de là). »
     • Si les explications du client sont déjà très riches et complètes : ne pose aucune question supplémentaire et transmets directement le vocal de procédure.
   - Si le client n'a pas encore mentionné de message :
     • Fête / Mariage / Amour : « Y a-t-il un message particulier ou des anecdotes que vous aimeriez faire passer dans les paroles ? (Et si vous n'avez pas de message particulier ou d'idées précises, ne vous inquiétez pas : notre équipe s'occupe de composer de très belles paroles pour vous). »
     • Deuil / Hommage : « Y a-t-il des souvenirs marquants ou des mots particuliers que vous aimeriez inscrire dans cet hommage ? (Et si vous n'avez pas de texte précis, notre équipe s'occupe de lui écrire des paroles dignes et touchantes). »
   - Si le client n'a pas d'idées ou vous fait confiance : rassure-le avec bienveillance et transmets directement le vocal de procédure.

## 3. VOCAL DE PROCÉDURE
- Dès que le brief est complet, envoie directement la note vocale explicative du studio qui résume la démarche.
- Ne présente pas les offres dans ce message : attends simplement la réponse du client.

## 4. PRÉSENTATION DES OFFRES & CHOIX DE FORMULE
- Dès que le client a répondu au vocal, présente les deux formules avec clarté :
  • Formule Découverte ({PRIX_DECOUVERTE} F CFA) : Chanson personnalisée complète, prête en 18 minutes.
  • Formule Prestige ({PRIX_PRESTIGE} F CFA) : Chanson complète + montage vidéo avec les photos souvenirs.
- Demande-lui quelle formule il préfère.
- Dès que le client choisit son offre (ET que les 4 invariants du brief sont complets), confirme le passage à l'écriture et annonce fermement le délai :
  « C'est bien noté pour la Formule [Choisie] ! Notre équipe passe immédiatement à la rédaction de vos paroles. Votre texte vous sera envoyé ici dans un délai de 15 minutes maximum pour validation. »
- Règle d'or de la promesse : Ne promets JAMAIS la livraison du texte en 15 minutes si le brief n'a pas encore été recueilli (si le client a choisi sa formule au tout début sans donner les infos de la chanson, remercie pour le choix de formule et pose d'abord les questions du brief).

## 5. LIVRAISON DU TEXTE, RETOUCHES (5 MIN) & NOUVELLE PROPOSITION (10 MIN)
- Présente les paroles poétiques composées sur-mesure pour le destinataire.
- 1ère livraison (texte initial à 15 min) : elle est TOUJOURS accompagnée de la formule officielle complète :
  « Merci de me donner votre avis sur le texte. Aucune modification ne pourra être faite une fois la chanson validée 🙏 »
- Livraisons suivantes (retouches ou refonte) : ne JAMAIS répéter cette formule lourde. Accompagne simplement d'un :
  « Qu'en pensez-vous ? 🙏 »
- Retouches ciblées (Cas A - 40% des demandes) :
  • Récapitule les points notés et demande obligatoirement : « Est-ce la seule modification que vous souhaitez apporter, ou aimeriez-vous ajuster d'autres éléments ? »
  • Dès confirmation du client : « Parfait ! Notre équipe studio applique ces modifications. Votre version corrigée vous sera envoyée ici dans un délai de 5 minutes 🙏 »
  • Révisions illimitées tant que le client n'est pas 100% satisfait.
- Rejet global (Cas B - « Je n'aime pas du tout ») :
  • Accueil rassurant sans chercher à défendre le texte précédent.
  • Question d'orientation : quelle ambiance préfère-t-il (plus émouvante, plus dansante, plus poétique, mots plus simples) ?
  • Annonce : « Notre équipe repart de zéro avec ces nouvelles indications. Votre nouveau texte arrive dans 10 minutes 🙏 »

## 6. VALIDATION DU TEXTE ET PAIEMENT MULTI-PAYS (PHASE CRITIQUE)
- Dès que le client valide le texte (dès le 1er envoi ou après retouches) :
  • Clôture immédiate de la phase de rédaction : ne lui redemande JAMAIS s'il souhaite modifier le texte.
  • Envoie immédiatement les coordonnées de paiement selon son pays.
- Réseaux exclusifs par pays :
  • Côte d'Ivoire (+225) : exclusivement par Wave (+226 05 77 73 08).
  • Burkina Faso (+226) : exclusivement par Orange Money (+226 05 77 73 08 Wendyam Anicet junior Sekongo).
- Exigence systématique de la capture de reçu : « SVP une capture pour vérifier le paiement 🙏🙏 ». La fabrication studio ne démarre qu'après vérification du reçu.

## 7. FINALISATION DU STYLE MUSICAL (POST-PAIEMENT)
- Une fois le paiement confirmé : demande au client quel style musical il préfère pour l'enregistrement (Afro-pop acoustique douce, Zouk lover, Rumba congolaise, Afrobeat festif, etc.).
- Si le client posait une question sur le style plus tôt, réponds-lui avec enthousiasme, mais ne force pas le choix du style avant le paiement.

## 8. SIGNAL DE LIVRAISON DE LA CHANSON (🎉) ET ENCHAÎNEMENT SÉQUENTIEL
- La livraison officielle de la chanson est actée lorsque le commerçant pose le signal 🎉 (réaction emoji ou message).
- Dès ce signal posé :
  • Cas A (Commande multiple / 2ème chanson en attente) : Enchaîne immédiatement et chaleureusement sur la 2ème commande (qui est à célébrer et éléments clés pour les paroles).
  • Cas B (Commande unique) : Commande terminée avec succès. Si le client envoie des remerciements (« Merci beaucoup c'est magnifique ! »), remercie avec chaleur sans relance commerciale. S'il revient plus tard, accueille-le comme un client fidèle sans vocal de procédure.

## 9. SILENCE HUMAIN & REPRISE CHIRURGICALE DE LA MAIN (✨)
- Dès que le conseiller humain écrit lui-même dans la conversation, l'IA se tait immédiatement.
- Dès que le conseiller lui rend la main via le signal ✨ (réaction emoji ou message) :
  • L'IA analyse l'historique complet pour identifier avec exactitude l'étape en cours et la checklist des 4 invariants (Destinataire, Occasion, Expéditeur, Histoire).
  • Elle ne pose QUE la seule question manquante pour faire avancer le dossier, sans répéter ce qui a déjà été dit et sans jamais régresser.

## 10. TRAITEMENT INTELLIGENT DES IMAGES & CAPTURES (VISION & OCR)
- Capture d'écran de texte / note / message WhatsApp / poème écrit : l'IA lit le texte de l'image, en accuse réception et intègre directement ces mots précieux dans le brief pour composer les paroles.
- Reçu de transfert / capture de paiement (Wave, Orange Money) : l'IA passe en silence de vérification comptable en attendant la validation humaine.
- Photos personnelles de personnes : elles sont conservées pour le montage de la formule vidéo souvenir.

## 11. FORMULE VIDÉO SOUVENIR ({PRIX_PRESTIGE} F) & TIMING DES PHOTOS
- Si le client demande en avance s'il doit envoyer les photos maintenant :
  • Explique avec pédagogie et bienveillance : « Pour les photos de votre vidéo souvenir, vous pourrez nous les envoyer juste après la validation de vos paroles et le choix de votre version musicale. Comme cela, le montage sera parfaitement calé sur la mélodie finale ! » puis poursuis le brief en cours.
- Si le client envoie ses photos en avance ou en rafale pendant le brief :
  • Ne spamme JAMAIS en accusant réception de chaque photo une par une.
  • Fais un accusé de réception unique, discret et valorisant pour tout le lot (« Bien reçu vos superbes photos ! Je les garde précieusement pour le montage vidéo. ») ET enchaîne immédiatement dans le même message sur la question du brief en cours sans rupture.

## 12. ÉCHANTILLONS DÉMO & LA RÈGLE D'OR DU PONT CONVERSATIONNEL
- Démo vidéo : si le client demande à voir à quoi ressemble la vidéo souvenir, transmets la vidéo de démonstration.
- Extrait musical : si le client demande à écouter à quoi ressemble un style (Afrobeat, Zouk, R&B...), transmets un court extrait représentatif.
- RÈGLE D'OR DU PONT CONVERSATIONNEL (ANTI-AMNÉSIE) :
  • Tout envoi d'échantillon (vidéo ou audio) ou toute réponse à une question annexe DOIT IMPÉRATIVEMENT se conclure par un pont qui relance la question du brief qui était en cours.
  • Interdiction formelle de s'arrêter après avoir envoyé un exemple : reconnecte toujours immédiatement avec l'étape suivante du brief (ex : « Voici notre aperçu vidéo ! ||| Pour préparer vos paroles, quel est le prénom de la personne à célébrer ? »).`;

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agentName: 'Alex',
  studioName: 'Velaris Studio',
  role: 'Conseiller Vente WhatsApp',
  systemPrompt: VELARIS_CLOSING_PROMPT_TEMPLATE,
  provider: 'local_agy',
  model: 'gemini-3.8-flash-low',
  apiKey: '',
  temperature: 0.3,
  tariffs: {
    decouvertePrice: '1 200',
    prestigePrice: '3 000',
  },
  payment: {
    orangeMoneyBf: '+226 05 77 73 08 (Wendyam Anicet junior Sekongo)',
    waveCi: '+225 07 00 00 00 00',
    waveSn: '+221 77 123 45 67',
    accountHolder: 'Wendyam Anicet junior Sekongo',
  },
};

const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'moussa_burst',
    title: 'Moussa Traoré (Rafale 3 messages CI)',
    clientName: 'Moussa Traoré',
    country: 'CI',
    phone: '+2250788776655',
    firstMessages: [
      'Bonjour le studio !',
      'Je veux une chanson surprise',
      "C'est pour le mariage de mon frère Marc ce samedi",
    ],
    description: 'Teste la coalescence de 3 messages envoyés en rafale sans double réponse.',
  },
  {
    id: 'djalilou_bf',
    title: 'Djalilou Dayamba (Burkina Faso — Anniversaire & OM)',
    clientName: 'Djalilou Dayamba',
    country: 'BF',
    phone: '+22655917765',
    firstMessages: [
      "Bonsoir, c'est pour l'anniversaire de Fadila.",
    ],
    description: "Teste la procédure complète avec livraison Orange Money Burkina Faso.",
  },
  {
    id: 'aicha_tarif',
    title: "Aïcha Diallo (Lead TikTok 'C'est combien ?')",
    clientName: 'Aïcha Diallo',
    country: 'CI',
    phone: '+2250544332211',
    firstMessages: [
      "Bonjour, c'est combien ?",
    ],
    description: "Teste la présentation tarifaire sans coordonnées financières avant le brief.",
  },
  {
    id: 'fargo_long_brief',
    title: 'Fargo Anne (Burkina Faso — Brief long et poétique)',
    clientName: 'Fargo Anne',
    country: 'BF',
    phone: '+22670784983',
    firstMessages: [
      'Bonjour cher studio. Je veux une chanson sacrée pour célébrer mon mari Alassane, un homme juste et généreux.',
    ],
    description: "Teste l'écoute d'un brief long et l'intégration des qualités personnelles.",
  },
  {
    id: 'demande_extrait',
    title: "Seydou Kouamé (Demande d'extrait audio préalable)",
    clientName: 'Seydou Kouamé',
    country: 'CI',
    phone: '+2250102030405',
    firstMessages: [
      "Bonjour, est-ce que je peux écouter un exemple de chanson avant de commander ?",
    ],
    description: "Teste l'envoi d'un extrait de chanson démo avec lecteur audio réaliste.",
  },
  {
    id: 'diaspora_france',
    title: 'Fatou Ndiaye (Diaspora France — Moyens de paiement)',
    clientName: 'Fatou Ndiaye',
    country: 'OTHER',
    phone: '+33612345678',
    firstMessages: [
      "Bonjour, je vis à Paris, je veux offrir une chanson à ma mère au Sénégal. Comment je peux payer ?",
    ],
    description: "Teste les explications pour la diaspora (Wave international / Carte bancaire).",
  },
  {
    id: 'mariam_fidele',
    title: 'Mariam Ouédraogo (Ancienne cliente fidèle)',
    clientName: 'Mariam Ouédraogo',
    country: 'BF',
    phone: '+22676001122',
    clientProfile: 'returning',
    firstMessages: [
      "Bonjour ! Je reviens vers vous, vous aviez composé une magnifique chanson pour l'anniversaire de ma mère le mois passé. Aujourd'hui je veux une chanson pour le baptême de mon neveu Kevin ce dimanche.",
    ],
    description: "Teste l'accueil chaleureux d'une habituée : aucun vocal de procédure, brief direct puis choix d'offre sans pitch lourd.",
  },
  {
    id: 'aminata_enfants',
    title: 'Aminata (Pluralité de destinataires — Enfants Moussa & Awa)',
    clientName: 'Aminata Diallo',
    country: 'CI',
    phone: '+22507112233',
    clientProfile: 'new',
    firstMessages: [
      "Bonjour, je voudrais des chansons pour mes deux enfants Moussa et Awa.",
    ],
    description: "Cas de pluralité de destinataires : teste la question immédiate (chanson commune ou séparée), puis le traitement séquentiel.",
  },
];

const QUICK_TEST_SHORTCUTS = [
  { label: "C'est combien ?", text: "C'est combien pour une chanson ?" },
  { label: "Extrait démo", text: "Est-ce que je peux écouter un extrait avant ?" },
  { label: "Vocal écouté", text: "D'accord j'ai bien écouté la note vocale !" },
  { label: "Formule 1 200 F", text: "Je prends la formule à 1 200 F CFA s'il vous plaît" },
  { label: "Formule 3 000 F", text: "Je choisis la formule Prestige à 3 000 F avec la vidéo" },
  { label: "Texte validé", text: "Le texte est vraiment magnifique, je valide avec plaisir !" },
  { label: "Délai studio ?", text: "La chanson sera prête en combien de temps ?" },
  { label: "Paiement effectué", text: "J'ai effectué le transfert, voici le reçu !" },
];

const AGENT_CONFIG_STORAGE_KEY = 'velaris_agent_config_v18';

export const PlaygroundView: FC = () => {
  // 1. Configuration persistante de l'Agent IA (initialisée avec la Gateway Résidente 0€)
  const [config, setConfig] = useState<AgentConfig>(() => {
    try {
      localStorage.removeItem('velaris_agent_config_v1');
      localStorage.removeItem('velaris_agent_config_v2');
      localStorage.removeItem('velaris_agent_config_v3');
      localStorage.removeItem('velaris_agent_config_v4');
      localStorage.removeItem('velaris_agent_config_v5');
      localStorage.removeItem('velaris_agent_config_v6');
      localStorage.removeItem('velaris_agent_config_v7');
      localStorage.removeItem('velaris_agent_config_v8');
      localStorage.removeItem('velaris_agent_config_v9');
      localStorage.removeItem('velaris_agent_config_v10');
      localStorage.removeItem('velaris_agent_config_v11');
      localStorage.removeItem('velaris_agent_config_v12');
      localStorage.removeItem('velaris_agent_config_v13');
      localStorage.removeItem('velaris_agent_config_v14');
      localStorage.removeItem('velaris_agent_config_v15');
      localStorage.removeItem('velaris_agent_config_v16');
      localStorage.removeItem('velaris_agent_config_v17');
      const saved = localStorage.getItem(AGENT_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_AGENT_CONFIG,
          ...parsed,
          systemPrompt: parsed.systemPrompt?.trim() ? parsed.systemPrompt : DEFAULT_AGENT_CONFIG.systemPrompt,
          apiKey: parsed.apiKey?.trim() ? parsed.apiKey : DEFAULT_AGENT_CONFIG.apiKey,
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_AGENT_CONFIG;
  });

  const [promptDraft, setPromptDraft] = useState(config.systemPrompt);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'prompt' | 'engine' | 'tariffs' | 'context'>('prompt');

  // Ligne Client simulée
  const [clientPhone, setClientPhone] = useState('+2250788776655');
  const [clientName, setClientName] = useState('Moussa Traoré');
  const [countryCode, setCountryCode] = useState<'CI' | 'BF' | 'SN' | 'OTHER'>('CI');
  const [clientProfile, setClientProfile] = useState<'new' | 'returning'>('new');

  // État de la conversation WhatsApp
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiPresenceState, setAiPresenceState] = useState<'idle' | 'typing' | 'recording_audio'>('idle');
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Système de Rafale / Debounce glissant 1.8s
  const [burstQueue, setBurstQueue] = useState<string[]>([]);
  const BURST_WINDOW_MS = 1800;
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mémoire contextuelle transparente
  const [detectedRecipient, setDetectedRecipient] = useState<string | null>(null);
  const [detectedOccasionStr, setDetectedOccasionStr] = useState<string | null>(null);
  const [currentSongTitle, setCurrentSongTitle] = useState<string | null>(null);
  const [merchantAlerts, setMerchantAlerts] = useState<string[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(340);

  // Audio & Micro
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Synchronisation promptDraft avec la config
  useEffect(() => {
    setPromptDraft(config.systemPrompt);
  }, [config.systemPrompt]);

  // Sauvegarde dans localStorage
  const handleSaveConfig = (newCfg: AgentConfig) => {
    setConfig(newCfg);
    try {
      localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(newCfg));
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2000);
    } catch {
      // ignore
    }
  };

  // Scroll automatique au fil de l'eau
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, aiPresenceState, burstQueue]);

  // Synchronisation Indicatif Pays
  const handleCountryChange = (c: 'CI' | 'BF' | 'SN' | 'OTHER') => {
    setCountryCode(c);
    if (c === 'CI') setClientPhone('+2250788776655');
    else if (c === 'BF') setClientPhone('+22655917765');
    else if (c === 'SN') setClientPhone('+221778889900');
    else setClientPhone('+33612345678');
  };

  // Pop son WhatsApp
  const playPopSound = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignorer si audio bloqué
    }
  };

  const playSynthesizedAcousticTrack = (audioId: string, durationSec = 15) => {
    if (playingAudioId === audioId) {
      stopSynthesizedAudio();
      return;
    }
    stopSynthesizedAudio();
    setPlayingAudioId(audioId);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const chords = [
        [220, 261.63, 329.63], // Am
        [174.61, 220, 261.63], // F
        [130.81, 164.81, 196], // C
        [196, 246.94, 293.66], // G
      ];

      const now = ctx.currentTime;
      const barDuration = 2.4 / audioPlaybackRate;
      const totalBars = Math.ceil(durationSec / barDuration);

      for (let bar = 0; bar < totalBars; bar++) {
        const chord = chords[bar % chords.length];
        const barStart = now + bar * barDuration;

        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, barStart + idx * 0.1);

          gain.gain.setValueAtTime(0.001, barStart + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.06, barStart + idx * 0.1 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, barStart + (idx + 1) * 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(barStart + idx * 0.1);
          osc.stop(barStart + (idx + 1) * 0.5 + 0.1);
        });
      }

      setTimeout(() => {
        stopSynthesizedAudio();
      }, (durationSec * 1000) / audioPlaybackRate);
    } catch (err) {
      console.warn('Audio non démarré :', err);
      stopSynthesizedAudio();
    }
  };

  const stopSynthesizedAudio = () => {
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setPlayingAudioId(null);
  };

  // Enregistrement micro
  const startRecording = async () => {
    try {
      stopSynthesizedAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        sendDirectAudioMessage(Math.max(3, recordSeconds));
      };

      mr.start();
    } catch (err) {
      console.warn('Microphone inaccessible, envoi vocal simulé :', err);
      sendDirectAudioMessage(4);
    }
  };

  const stopRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendDirectAudioMessage = (durationSec: number) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const voiceBubble: ChatBubble = {
      id: `user_voice_${Date.now()}`,
      role: 'user',
      content: '🎙️ Note vocale client (brief parlé)',
      timestamp: nowStr,
      status: 'sent',
      mediaKind: 'audio',
      mediaDurationSec: durationSec,
      mediaTranscript: "Bonjour, c'est pour l'anniversaire de ma mère Awa samedi prochain, elle aime la musique acoustique.",
    };

    setMessages((prev) => [...prev, voiceBubble]);
    handleInboundUserText(voiceBubble.mediaTranscript || "Note vocale de brief client");
  };

  // Chargement d'un scénario
  const loadScenario = (sc: ScenarioPreset) => {
    stopSynthesizedAudio();
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);

    setMessages([]);
    setBurstQueue([]);
    setMerchantAlerts([]);
    setCurrentSongTitle(null);
    setClientName(sc.clientName);
    setCountryCode(sc.country);
    setClientPhone(sc.phone);
    setClientProfile(sc.clientProfile || 'new');

    const initialBubbles: ChatBubble[] = sc.firstMessages.map((msg, i) => ({
      id: `init_${Date.now()}_${i}`,
      role: 'user',
      content: msg,
      timestamp: new Date(Date.now() - (sc.firstMessages.length - i) * 1500).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'read',
    }));

    setMessages(initialBubbles);
    setTimeout(() => {
      void runAgentTurn(initialBubbles);
    }, 400);
  };

  // Saisie utilisateur & Rafale
  const handleSendMessage = () => {
    if (!input.trim() || isAiThinking) return;
    const text = input.trim();
    setInput('');
    handleInboundUserText(text);
  };

  const handleInboundUserText = (text: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newBubble: ChatBubble = {
      id: `user_${Date.now()}_${Math.random()}`,
      role: 'user',
      content: text,
      timestamp: nowStr,
      status: 'sent',
    };

    setMessages((prev) => [...prev, newBubble]);

    const updatedBurst = [...burstQueue, text];
    setBurstQueue(updatedBurst);

    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);

    burstTimeoutRef.current = setTimeout(() => {
      flushBurstQueue(updatedBurst);
    }, BURST_WINDOW_MS);
  };

  const flushBurstQueue = (pendingItems: string[]) => {
    if (pendingItems.length === 0) return;
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    setBurstQueue([]);

    setMessages((prev) =>
      prev.map((m) => (m.role === 'user' && m.status === 'sent' ? { ...m, status: 'delivered' } : m))
    );

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.role === 'user' && m.status === 'delivered' ? { ...m, status: 'read' } : m))
      );

      setMessages((currentHistory) => {
        void runAgentTurn(currentHistory);
        return currentHistory;
      });
    }, 500);
  };

  // Moteur d'IA générative dynamique : 100% gouverné par le prompt configuré
  const runAgentTurn = async (history: ChatBubble[]) => {
    if (isAiThinking) return;
    setIsAiThinking(true);
    const start = Date.now();


    const newAssistantBubbles: ChatBubble[] = [];
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Appel API Externe Réel si configuré (DeepSeek, Gemini, OpenAI)
    let generatedTexts: string[] = [];

    const crmContextNote = clientProfile === 'returning'
      ? "\n\n[FICHE CLIENT CRM : Client fidèle et régulier. A déjà commandé et payé une chanson personnalisée le mois passé. Il connaît déjà la démarche et les tarifs du studio.]"
      : "\n\n[FICHE CLIENT CRM : Nouveau prospect — Première prise de contact avec le studio.]";

    const effectiveSystemPrompt = ((config.systemPrompt || '') + crmContextNote)
      .replace(/{AGENT_NAME}/g, config.agentName || 'Alex')
      .replace(/{STUDIO_NAME}/g, config.studioName || 'Velaris Studio')
      .replace(/{PRIX_DECOUVERTE}/g, config.tariffs.decouvertePrice || '1 200')
      .replace(/{PRIX_PRESTIGE}/g, config.tariffs.prestigePrice || '3 000');

    if (config.provider === 'local_agy') {
      try {
        const publicHttpsGatewayUrl = 'https://waha.velarisagent.life/v1/chat/completions';
        const proxyUrl = '/api/local-llm/chat/completions';
        const directLocalUrl = 'http://127.0.0.1:4041/v1/chat/completions';

        const requestBody = JSON.stringify({
          model: config.model || 'gemini-3.8-flash-low',
          project: 'velaris',
          conversationId: clientPhone,
          messages: [
            { role: 'system', content: effectiveSystemPrompt },
            ...history.map((h) => ({
              role: h.role === 'user' ? 'user' : 'assistant',
              content: h.content,
            })),
          ],
        });

        // Ordonnancement intelligent selon l'environnement (HTTPS distant vs HTTP localhost)
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const endpointsToTry = isHttps
          ? [publicHttpsGatewayUrl, proxyUrl]
          : [proxyUrl, directLocalUrl, publicHttpsGatewayUrl];

        let res: Response | null = null;
        let lastFailureReason = '';

        for (const url of endpointsToTry) {
          try {
            const attempt = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Project': 'velaris',
              },
              body: requestBody,
            });

            // Si le serveur renvoie 404 ou 405 (proxy non supporté sur l'hébergement courant), tester le endpoint suivant
            if (attempt.status === 404 || attempt.status === 405) {
              lastFailureReason = `HTTP ${attempt.status}`;
              continue;
            }

            res = attempt;
            break;
          } catch (err: any) {
            lastFailureReason = err?.message || 'Erreur réseau';
          }
        }

        if (res && res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) {
            generatedTexts = reply.split(/\n\n+/).filter(Boolean);
          }
        } else if (res) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Erreur HTTP ${res.status}`;
          generatedTexts = [
            `[Alerte Daemon Velaris : ${errMsg}] (Vérifiez le statut du service avec 'bash scripts/status_daemon.sh').`,
          ];
        } else {
          generatedTexts = [
            `[Alerte Daemon Velaris : Service injoignable (${lastFailureReason})]. Vérifiez la passerelle avec 'bash scripts/status_daemon.sh' et la connexion VPS avec 'bash scripts/connect_vps.sh'.`,
          ];
        }
      } catch (err) {
        console.warn('Échec appel Daemon Velaris :', err);
        generatedTexts = [
          `[Alerte Daemon Velaris : Le service local sur le port 4041 n'est pas joignable. Lancez 'bash scripts/start_daemon.sh' sur le serveur pour activer l'IA résidente gratuite 0€].`,
        ];
      }
    } else if (config.apiKey) {
      try {
        if (config.provider === 'deepseek') {
          const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model || 'deepseek-chat',
              temperature: config.temperature,
              messages: [
                { role: 'system', content: effectiveSystemPrompt },
                ...history.map((h) => ({
                  role: h.role === 'user' ? 'user' : 'assistant',
                  content: h.content,
                })),
              ],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content?.trim();
            if (reply) {
              generatedTexts = reply.split(/\n\n+/).filter(Boolean);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Erreur HTTP ${res.status}`;
            generatedTexts = [
              `[Alerte API DeepSeek : ${errMsg}] (Votre solde d'API DeepSeek semble épuisé ou requiert une recharge sur platform.deepseek.com).`,
            ];
          }
        } else if (config.provider === 'gemini') {
          const modelName = config.model || 'gemini-1.5-flash';
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
                contents: history.map((h) => ({
                  role: h.role === 'user' ? 'user' : 'model',
                  parts: [{ text: h.content }],
                })),
                generationConfig: { temperature: config.temperature },
              }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (reply) {
              generatedTexts = reply.split(/\n\n+/).filter(Boolean);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Erreur HTTP ${res.status}`;
            generatedTexts = [`[Alerte API Gemini : ${errMsg}]`];
          }
        } else if (config.provider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model || 'gpt-4o-mini',
              temperature: config.temperature,
              messages: [
                { role: 'system', content: effectiveSystemPrompt },
                ...history.map((h) => ({
                  role: h.role === 'user' ? 'user' : 'assistant',
                  content: h.content,
                })),
              ],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content?.trim();
            if (reply) {
              generatedTexts = reply.split(/\n\n+/).filter(Boolean);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Erreur HTTP ${res.status}`;
            generatedTexts = [`[Alerte API OpenAI : ${errMsg}]`];
          }
        }
      } catch (err) {
        console.warn('Échec appel API externe :', err);
      }
    }

    // 2. Traitement si aucune réponse API externe (100% neutre, aucune règle ni regex)
    if (generatedTexts.length === 0) {
      if (!config.systemPrompt.trim()) {
        generatedTexts = [
          "L'agent IA est actuellement vierge (aucun prompt système configuré). Renseignez vos consignes dans l'onglet 'Prompt Système' pour définir son identité, ses règles et son comportement commercial.",
        ];
      } else {
        generatedTexts = [
          `[Mode simulation locale] Le prompt système est actif (${config.systemPrompt.length} caractères). Pour que l'agent génère des réponses dynamiques en direct selon vos consignes, activez le Daemon Local 0€ ou renseignez votre clé d'API dans l'onglet Moteur.`,
        ];
      }
    }

    // Ajout des bulles de texte générées
    generatedTexts.forEach((text, i) => {
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_${i}`,
        role: 'assistant',
        content: text,
        timestamp: nowStr,
        status: 'read',
      });
    });

    setLatencyMs(Date.now() - start + 420);

    // Distribution séquentielle avec délai de frappe WhatsApp réaliste
    for (let i = 0; i < newAssistantBubbles.length; i++) {
      const bubble = newAssistantBubbles[i];
      setAiPresenceState('typing');

      const typingMs = Math.min(2600, Math.max(1200, bubble.content.length * 18));
      await new Promise((r) => setTimeout(r, typingMs));

      setMessages((prev) => [...prev, bubble]);
      playPopSound();

      if (i < newAssistantBubbles.length - 1) {
        setAiPresenceState('idle');
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setAiPresenceState('idle');
    setIsAiThinking(false);
  };

  // Reçu de paiement simulé
  const handleSendPaymentSlipImage = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const imgBubble: ChatBubble = {
      id: `user_slip_${Date.now()}`,
      role: 'user',
      content: 'Capture du reçu de transfert Mobile Money (1 200 F CFA)',
      timestamp: nowStr,
      status: 'sent',
      mediaKind: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    };
    setMessages((prev) => [...prev, imgBubble]);
    handleInboundUserText("Voilà le reçu du transfert que je viens d'effectuer !");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] min-h-[760px] w-full space-y-3">
      {/* Barre Supérieure de Contrôle Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#08090C] border border-white/[0.08] px-4 py-2.5 rounded-2xl shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">Playground Studio WhatsApp</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Agent : {config.agentName} ({config.provider === 'local_agy' ? 'Daemon 0€' : config.provider})
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Simulateur réaliste, 100% gouverné par votre prompt système. Zéro règle cachée ni restriction forcée.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur de Scénario Pré-enregistré */}
          <div className="relative">
            <select
              aria-label="Charger un scénario de test"
              onChange={(e) => {
                const sc = SCENARIOS.find((s) => s.id === e.target.value);
                if (sc) loadScenario(sc);
              }}
              defaultValue=""
              className="h-9 px-3 pr-8 rounded-xl bg-[#0E1015] border border-white/[0.08] text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-white/20"
            >
              <option value="" disabled>Charger un scénario client…</option>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => {
              stopSynthesizedAudio();
              setMessages([]);
              setBurstQueue([]);
              setDetectedRecipient(null);
              setDetectedOccasionStr(null);
              setCurrentSongTitle(null);
              setMerchantAlerts([]);
            }}
            title="Effacer et recommencer la discussion"
            className="h-9 px-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-xs text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            title={inspectorOpen ? "Masquer l'inspecteur" : "Afficher l'inspecteur"}
            className={`h-9 px-3 rounded-xl border transition-colors flex items-center gap-1.5 text-xs cursor-pointer ${
              inspectorOpen
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:text-white'
            }`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Configuration IA & Prompt</span>
          </button>
        </div>
      </div>

      {/* Conteneur Principal : WhatsApp Web Mockup + Inspecteur */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Colonne WhatsApp Web */}
        <div className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b141a] overflow-hidden shadow-2xl ${inspectorOpen ? 'lg:col-span-7 xl:col-span-7' : 'lg:col-span-12'}`}>
          {/* En-tête de Discussion WhatsApp */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1f2c34] border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-800/80 border border-emerald-400/40 flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-inner">
                  {config.agentName.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1f2c34]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-white">{config.agentName} · {config.studioName}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Officiel
                  </span>
                </div>
                <div className="text-xs font-normal">
                  {aiPresenceState === 'typing' ? (
                    <span className="text-emerald-400 font-medium animate-pulse flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-spin" /> en train d’écrire…
                    </span>
                  ) : aiPresenceState === 'recording_audio' ? (
                    <span className="text-emerald-400 font-medium animate-pulse flex items-center gap-1">
                      <Mic className="w-3 h-3 animate-bounce" /> enregistre un message vocal…
                    </span>
                  ) : (
                    <span className="text-neutral-400">en ligne</span>
                  )}
                </div>
              </div>
            </div>

            {/* Profil Client CRM & Sélecteur de Pays Prospect */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setClientProfile((prev) => (prev === 'new' ? 'returning' : 'new'))}
                title="Cliquer pour basculer : Nouveau Prospect vs Client Fidèle (Habitué)"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  clientProfile === 'returning'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm'
                    : 'bg-[#111b21] border-white/[0.08] text-neutral-400 hover:text-white'
                }`}
              >
                <UserCheck className={`w-3.5 h-3.5 ${clientProfile === 'returning' ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span className="hidden sm:inline">{clientProfile === 'returning' ? 'Habitué (Fidèle)' : 'Nouveau Prospect'}</span>
              </button>

              <div className="flex items-center gap-2 bg-[#111b21] px-3 py-1.5 rounded-xl border border-white/[0.08]">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-neutral-400 hidden sm:inline">Ligne :</span>
                <select
                  aria-label="Sélectionner le pays du prospect"
                  value={countryCode}
                  onChange={(e) => handleCountryChange(e.target.value as any)}
                  className="bg-transparent border-0 text-xs text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="CI" className="bg-[#111b21]">Côte d'Ivoire (+225)</option>
                  <option value="BF" className="bg-[#111b21]">Burkina Faso (+226)</option>
                  <option value="SN" className="bg-[#111b21]">Sénégal (+221)</option>
                  <option value="OTHER" className="bg-[#111b21]">France (+33)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fil des Messages WhatsApp */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#0b141a] bg-opacity-95 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#1f2c34] border border-white/[0.08] flex items-center justify-center text-emerald-400 shadow-xl">
                  <Bot className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <p className="text-base font-medium text-white">Agent IA Vierge & Prêt</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Écrivez un message comme un vrai client. L'agent répondra exactement selon le Prompt Système configuré dans le panneau de droite.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg">
                  {QUICK_TEST_SHORTCUTS.slice(0, 4).map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInput(s.text)}
                      className="h-8 px-3 rounded-xl border border-white/[0.08] bg-[#111b21] hover:bg-[#1f2c34] text-xs text-neutral-300 transition-colors cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`relative rounded-2xl px-4 py-3 max-w-[88%] sm:max-w-[78%] text-[14px] leading-relaxed shadow-lg ${
                    m.role === 'user'
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-xs'
                      : 'bg-[#202c33] text-[#e9edef] border border-white/[0.06] rounded-tl-xs'
                  }`}
                >
                  {/* Image jointe */}
                  {m.mediaKind === 'image' && m.mediaUrl && (
                    <div className="mb-2.5 rounded-xl overflow-hidden border border-white/10 max-w-sm">
                      <img src={m.mediaUrl} alt="Média joint" className="w-full h-auto object-cover max-h-60" />
                    </div>
                  )}

                  {/* Lecteur Audio */}
                  {m.mediaKind === 'audio' && (
                    <div className="my-1 p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playSynthesizedAcousticTrack(m.id, m.mediaDurationSec || 15)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                            playingAudioId === m.id
                              ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                              : 'bg-emerald-500 text-white hover:bg-emerald-400'
                          }`}
                        >
                          {playingAudioId === m.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          )}
                        </button>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 h-6">
                            {[16, 24, 38, 18, 28, 42, 34, 20, 36, 44, 22, 30, 40, 26, 18, 32, 28, 38, 20, 34, 42, 16, 26, 36].map((h, i) => (
                              <span
                                key={i}
                                className={`w-1 rounded-full transition-all duration-200 ${
                                  playingAudioId === m.id
                                    ? 'bg-emerald-400 animate-pulse'
                                    : 'bg-white/30'
                                }`}
                                style={{ height: `${h}px` }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                            <span>{m.mediaDurationSec ? `0:${String(m.mediaDurationSec).padStart(2, '0')}` : '0:33'}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400">
                                {playingAudioId === m.id ? 'Lecture en cours…' : 'Note vocale studio'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setAudioPlaybackRate((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1))}
                                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white font-mono transition-colors cursor-pointer"
                              >
                                {audioPlaybackRate}x
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {m.mediaTranscript && (
                        <div className="pt-2 border-t border-white/[0.08] text-xs text-neutral-300 leading-normal italic">
                          "{m.mediaTranscript}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lecteur Extrait Démo */}
                  {m.mediaKind === 'sample' && (
                    <div className="my-1 p-3 rounded-xl bg-black/30 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5" /> {m.sampleTitle || 'Extrait Démo Studio'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          45s Studio
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playSynthesizedAcousticTrack(m.id, 45)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                            playingAudioId === m.id
                              ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                              : 'bg-emerald-500 text-white hover:bg-emerald-400'
                          }`}
                        >
                          {playingAudioId === m.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          )}
                        </button>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 h-6">
                            {[20, 32, 44, 26, 36, 48, 30, 22, 40, 44, 28, 34, 42, 38, 24, 30, 36, 44, 28, 38, 46, 22, 32, 40].map((h, i) => (
                              <span
                                key={i}
                                className={`w-1 rounded-full transition-all duration-200 ${
                                  playingAudioId === m.id
                                    ? 'bg-emerald-400 animate-pulse'
                                    : 'bg-white/30'
                                }`}
                                style={{ height: `${h}px` }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                            <span>0:45</span>
                            <span className="text-emerald-400">Afro-pop acoustique</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Carte Paroles */}
                  {m.isLyricsCard && m.lyricsData && (
                    <div className="my-2 p-3.5 rounded-xl bg-black/40 border border-emerald-500/30 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <span className="font-semibold text-white text-xs sm:text-sm">
                            {m.lyricsData.title || 'Paroles Personnalisées Studio'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          {m.lyricsData.lyrics ? `${m.lyricsData.lyrics.split('\n').filter(Boolean).length} vers` : '32-48 vers'}
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto pr-1 text-xs text-neutral-300 whitespace-pre-line font-mono leading-relaxed bg-[#0E1015]/80 p-3 rounded-lg border border-white/[0.04]">
                        {m.lyricsData.lyrics}
                      </div>
                    </div>
                  )}

                  {/* Bloc Coordonnées de Paiement */}
                  {m.isPaymentBlock && (
                    <div className="my-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs font-mono space-y-1">
                      <div className="font-semibold text-emerald-300 flex items-center gap-1 text-[13px]">
                        <CreditCard className="w-4 h-4" /> Coordonnées Mobile Money
                      </div>
                      <p className="whitespace-pre-line text-neutral-200 font-sans text-xs pt-1">
                        {m.content}
                      </p>
                    </div>
                  )}

                  {/* Texte de la bulle */}
                  {!m.isLyricsCard && !m.isPaymentBlock && (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}

                  {/* Horodatage & Statut */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-neutral-400 font-mono">
                    <span>{m.timestamp}</span>
                    {m.role === 'user' && (
                      <span className="inline-flex items-center ml-0.5">
                        {m.status === 'read' ? (
                          <span className="text-[#53bdeb]">✓✓</span>
                        ) : m.status === 'delivered' ? (
                          <span className="text-neutral-400">✓✓</span>
                        ) : (
                          <span className="text-neutral-400">✓</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Bulle de saisie en cours de l'agent */}
            {aiPresenceState !== 'idle' && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-2.5 bg-[#202c33] text-[#e9edef] border border-white/[0.06] rounded-tl-xs flex items-center gap-2 text-xs">
                  {aiPresenceState === 'recording_audio' ? (
                    <>
                      <Mic className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                      <span className="text-emerald-400 font-medium font-mono">{config.agentName} enregistre un message vocal…</span>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-1 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse [animation-delay:200ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse [animation-delay:400ms]" />
                      </div>
                      <span className="text-neutral-300 font-mono">{config.agentName} est en train d’écrire…</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bandeau Rafale Active */}
          {burstQueue.length > 0 && (
            <div className="px-4 py-1.5 bg-[#182229] border-t border-white/[0.06] flex items-center justify-between text-xs text-emerald-400 shrink-0">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Rafale en cours ({burstQueue.length} message{burstQueue.length > 1 ? 's' : ''}) — {config.agentName} temporise la lecture (1.8s)…</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">burst-active</span>
            </div>
          )}

          {/* Raccourcis Rapides de Test */}
          <div className="px-3 py-2 bg-[#182229] border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-medium text-neutral-400 shrink-0">Scénarios rapides :</span>
            {QUICK_TEST_SHORTCUTS.map((sc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleInboundUserText(sc.text)}
                disabled={isAiThinking}
                className="h-7 text-xs px-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.06] rounded-lg shrink-0 transition-colors cursor-pointer disabled:opacity-40"
              >
                {sc.label}
              </button>
            ))}

            <button
              type="button"
              onClick={handleSendPaymentSlipImage}
              disabled={isAiThinking}
              className="h-7 text-xs px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Paperclip className="w-3 h-3" />
              <span>Joindre reçu</span>
            </button>
          </div>

          {/* Barre de Saisie WhatsApp */}
          <div className="border-t border-white/[0.08] p-3 bg-[#202c33] flex items-center gap-2 shrink-0">
            {isRecording ? (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl flex-1 text-xs text-red-400">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span>Enregistrement de votre note vocale ({recordSeconds}s)…</span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="h-8 ml-auto px-3 rounded-lg bg-red-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-red-600"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Terminer & Envoyer
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isAiThinking}
                  title="Enregistrer une vraie note vocale au micro"
                  className="h-11 w-11 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <Mic className="w-5 h-5 text-emerald-400" />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Écrivez un message (Appuyez sur Entrée pour tester la rafale)…"
                  className="flex-1 h-11 px-4 rounded-xl bg-[#2a3942] border border-white/[0.06] text-[14px] text-white placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500/50"
                  disabled={isAiThinking}
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isAiThinking || !input.trim()}
                  className="h-11 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors shrink-0 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Envoyer</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Volet Latéral : Inspecteur Cerveau Studio & Configuration Prompt */}
        {inspectorOpen && (
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-3 overflow-y-auto pr-1">
            {/* Barre d'onglets de configuration */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-2 flex items-center gap-1 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setInspectorTab('prompt')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'prompt'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Prompt Système</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorTab('engine')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'engine'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Moteur & Clé</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorTab('tariffs')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'tariffs'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Offres</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorTab('context')}
                className={`flex-1 py-2 px-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'context'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mémoire</span>
              </button>
            </div>

            {/* Onglet 1 : Éditeur de Prompt Système */}
            {inspectorTab === 'prompt' && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3 flex-1 flex flex-col min-h-[460px]">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <div>
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> Prompt Système de l'Agent IA
                    </span>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Éditez librement ce prompt. L'agent obéira exactement à vos instructions.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {promptDraft.length} caractères
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Nom de l'agent :</label>
                    <input
                      type="text"
                      value={config.agentName}
                      onChange={(e) => handleSaveConfig({ ...config, agentName: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500/50"
                      placeholder="Ex: Nom de l'agent..."
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Studio :</label>
                    <input
                      type="text"
                      value={config.studioName}
                      onChange={(e) => handleSaveConfig({ ...config, studioName: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500/50"
                      placeholder="Ex: Nom du studio..."
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-[260px]">
                  <label className="text-[11px] text-neutral-400 block mb-1">Consignes & Directives du Prompt :</label>
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    placeholder="Écrivez le prompt système de votre agent ici..."
                    className="flex-1 w-full p-3 rounded-xl bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50 resize-y min-h-[220px]"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setPromptDraft('');
                        handleSaveConfig({ ...config, systemPrompt: '' });
                      }}
                      title="Effacer le prompt (Page blanche)"
                      className="h-8 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Page blanche</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPromptDraft(VELARIS_CLOSING_PROMPT_TEMPLATE);
                        handleSaveConfig({ ...config, systemPrompt: VELARIS_CLOSING_PROMPT_TEMPLATE });
                      }}
                      title="Charger le modèle d'excellence Velaris (3 Piliers & Closing)"
                      className="h-8 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Modèle Velaris (3 Piliers)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveConfig({ ...config, systemPrompt: promptDraft })}
                    className="h-8 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    {saveFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Enregistré !
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Sauvegarder
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Onglet 2 : Moteur IA & Clé API */}
            {inspectorTab === 'engine' && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-4">
                <div className="border-b border-white/[0.08] pb-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" /> Moteur d'Exécution & LLM
                  </span>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Sélectionnez le fournisseur d'IA ou testez sans clé avec le moteur libre local.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Fournisseur d'IA :</label>
                    <select
                      value={config.provider}
                      onChange={(e) => {
                        const prov = e.target.value as any;
                        let defModel = 'gemini-3.8-flash-low';
                        if (prov === 'deepseek') defModel = 'deepseek-chat';
                        if (prov === 'gemini') defModel = 'gemini-1.5-flash';
                        if (prov === 'openai') defModel = 'gpt-4o-mini';
                        handleSaveConfig({ ...config, provider: prov, model: defModel });
                      }}
                      className="w-full h-9 px-3 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                    >
                      <option value="local_agy">Daemon Local 0€ (Gemini Flash Résident - Illimité)</option>
                      <option value="deepseek">DeepSeek (API deepseek-chat)</option>
                      <option value="gemini">Google Gemini (gemini-1.5-flash / gemini-2.0-flash)</option>
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                    </select>
                  </div>

                  {config.provider === 'local_agy' ? (
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-emerald-400">Daemon Résident Velaris (Port 4041)</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300 ml-auto">0€ Illimité</span>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-relaxed">
                        Inférence instantanée via le moteur résident <span className="font-mono text-emerald-300">gemini-3.8-flash-low</span>. Aucune clé API payante requise, session persistante et zéro risque de coupure de solde.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-[11px] text-neutral-400 block mb-1">Nom du Modèle :</label>
                        <input
                          type="text"
                          value={config.model}
                          onChange={(e) => handleSaveConfig({ ...config, model: e.target.value })}
                          className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500/50 font-mono"
                          placeholder="Ex: deepseek-chat, gemini-1.5-flash..."
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-neutral-400 block mb-1">Clé d'API {config.provider} :</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={config.apiKey}
                            onChange={(e) => handleSaveConfig({ ...config, apiKey: e.target.value })}
                            className="w-full h-8 pl-2.5 pr-8 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500/50 font-mono"
                            placeholder="sk-..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-2 text-neutral-400 hover:text-white cursor-pointer"
                          >
                            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1">
                          Votre clé reste stockée localement dans votre navigateur et n'est jamais partagée.
                        </p>
                      </div>
                    </>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-neutral-400">Température créative :</span>
                      <span className="text-[11px] font-mono text-emerald-400">{config.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.temperature}
                      onChange={(e) => handleSaveConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Onglet 3 : Tarifs & Paiements Mobile Money */}
            {inspectorTab === 'tariffs' && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-4">
                <div className="border-b border-white/[0.08] pb-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Tarifs & Coordonnées Mobile Money
                  </span>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Ces montants et coordonnées sont transmis à l'agent pour ses réponses commerciales.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Tarif Découverte (F CFA) :</label>
                      <input
                        type="text"
                        value={config.tariffs.decouvertePrice}
                        onChange={(e) =>
                          handleSaveConfig({
                            ...config,
                            tariffs: { ...config.tariffs, decouvertePrice: e.target.value },
                          })
                        }
                        className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Tarif Prestige (F CFA) :</label>
                      <input
                        type="text"
                        value={config.tariffs.prestigePrice}
                        onChange={(e) =>
                          handleSaveConfig({
                            ...config,
                            tariffs: { ...config.tariffs, prestigePrice: e.target.value },
                          })
                        }
                        className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Orange Money (Burkina Faso) :</label>
                    <input
                      type="text"
                      value={config.payment.orangeMoneyBf}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...config,
                          payment: { ...config.payment, orangeMoneyBf: e.target.value },
                        })
                      }
                      className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Wave (Côte d'Ivoire) :</label>
                    <input
                      type="text"
                      value={config.payment.waveCi}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...config,
                          payment: { ...config.payment, waveCi: e.target.value },
                        })
                      }
                      className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Nom du titulaire :</label>
                    <input
                      type="text"
                      value={config.payment.accountHolder}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...config,
                          payment: { ...config.payment, accountHolder: e.target.value },
                        })
                      }
                      className="w-full h-8 px-2.5 rounded-lg bg-[#08090C] border border-white/[0.08] text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Onglet 4 : Mémoire & Contexte */}
            {inspectorTab === 'context' && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Éléments Extraits de la Conversation
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">Zéro règle bloquante</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-neutral-400">Destinataire capté :</span>
                    <span className="font-semibold text-white">{detectedRecipient || <span className="text-neutral-500 italic">Non précisé</span>}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-neutral-400">Occasion :</span>
                    <span className="font-medium text-emerald-400">{detectedOccasionStr || <span className="text-neutral-500 italic">Non définie</span>}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-neutral-400">Client / Téléphone :</span>
                    <span className="font-medium text-white">{clientName} · <span className="text-neutral-400 font-mono text-[11px]">{clientPhone}</span></span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-neutral-400">Profil CRM :</span>
                    <span className={`font-semibold ${clientProfile === 'returning' ? 'text-amber-400' : 'text-neutral-300'}`}>
                      {clientProfile === 'returning' ? 'Client Fidèle (Habitué)' : 'Nouveau Prospect'}
                    </span>
                  </div>
                  {currentSongTitle && (
                    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-400">Titre composé :</span>
                      <span className="font-semibold text-emerald-400 truncate max-w-[190px]">{currentSongTitle}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-400">Latence dernier tour :</span>
                    <span className="font-mono text-emerald-400">{latencyMs} ms</span>
                  </div>
                </div>

                {/* Notifications Marchand */}
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <span className="text-[11px] font-semibold text-neutral-300 block">Journal d'événements du tour :</span>
                  {merchantAlerts.length === 0 ? (
                    <p className="text-[11px] text-neutral-500 italic">Aucun événement particulier enregistré.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {merchantAlerts.map((alt, idx) => (
                        <div key={idx} className="bg-white/[0.03] border border-white/[0.06] p-2 rounded-lg text-[11px] text-neutral-300">
                          {alt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
