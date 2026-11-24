import { useEffect, useMemo, useState, type FC } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Wand2
} from 'lucide-react';
import type { AcademyModule } from '../types';

interface AcademyViewProps {
  modules: AcademyModule[];
}

/* ------------------------------------------------------------------ */
/* CURRICULUM DES LEÇONS & RESSOURCES ATTACHÉES                       */
/* ------------------------------------------------------------------ */

interface LessonResource {
  id: string;
  title: string;
  type: 'prompt' | 'script' | 'link';
  content: string;
  url?: string;
}

interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  description: string;
  keyPoints: string[];
  resources: LessonResource[];
  videoUrl?: string;
}

interface ModuleData {
  id: string;
  title: string;
  shortTitle: string;
  duration: string;
  level: string;
  description: string;
  lessons: Lesson[];
}

const MASTERCLASS_MODULES: ModuleData[] = [
  {
    id: 'mod-1',
    title: 'Machine à Musique IA : Créer des Hits Personnalisés',
    shortTitle: 'Création Musicale',
    duration: '45 min',
    level: 'Débutant',
    description: 'Prendre en main Suno & Kie.ai, paramétrer les styles africains (Afrobeat, Zouk, Rumba, Mandingue) et sortir des masters émouvants sans fausse note.',
    lessons: [
      {
        id: 'l-1-1',
        title: 'Le flux de production complet en 18 minutes',
        durationMinutes: 6,
        description: 'La méthode pas-à-pas pour passer du brief vocal du client au fichier audio final livré sur WhatsApp sans perte de temps.',
        keyPoints: [
          'Chaque étape a un chrono strict : 3 min de brief, 5 min de texte, 7 min de génération Suno, 3 min de livraison.',
          'Conserver un dossier clair par client : brief vocal, paroles validées, et les 2 masters audio générés.',
          'Valider le prénom du destinataire avant de lancer la moindre génération.'
        ],
        resources: [
          {
            id: 'r-suno-app',
            title: 'Accès Studio Suno AI',
            type: 'link',
            content: 'Ouvrir la plateforme de composition musicale Suno',
            url: 'https://suno.com'
          },
          {
            id: 'r-flow-checklist',
            title: 'Checklist Chrono 18 Minutes',
            type: 'script',
            content: `1. Écoute du brief (2 min) : noter prénom + relation + occasion + 2 souvenirs.
2. Génération des paroles (3 min) : injecter dans le prompt de structure couplet/refrain.
3. Validation client (instantanée) : envoyer le texte par WhatsApp.
4. Création Suno (8 min) : lancer 2 versions parallèles avec style afro-acoustique.
5. Export & Livraison (5 min) : MP3 HD renommé « Chanson pour [Prénom] - Djelia.mp3 » envoyé en fichier audio.`
          }
        ]
      },
      {
        id: 'l-1-2',
        title: 'Écrire des paroles qui déclenchent les larmes',
        durationMinutes: 9,
        description: 'La structure narrative qui transforme 3 anecdotes banales en un hymne inoubliable pour le destinataire.',
        keyPoints: [
          'Toujours demander 2 ou 3 faits précis (un lieu, une habitude, une phrase culte) plutôt que des compliments vagues.',
          'Placer le prénom deux fois dans le refrain pour maximiser l’impact émotionnel.',
          'Soigner le pont musical : c’est là que repose le sommet de l’émotion avant le refrain final.'
        ],
        resources: [
          {
            id: 'r-structure-lyrics',
            title: 'Structure Type d’une Chanson Émotionnelle',
            type: 'script',
            content: `[Intro douce - guitare ou piano]
[Couplet 1 - La rencontre ou les débuts, rappel d'un souvenir précis]
[Pré-refrain - Montée en émotion, gratitude]
[Refrain - Dédicace directe avec répétition du prénom de la personne]
[Couplet 2 - Le quotidien, ce qui la rend unique pour ses proches]
[Pont - Moment intime, déclaration solennelle]
[Refrain final - Chœurs puissants et célébration]
[Outro - Mot de fin chaleureux et fondu musical]`
          }
        ]
      },
      {
        id: 'l-1-3',
        title: 'Les styles africains qui cartonnent dans Suno',
        durationMinutes: 8,
        description: 'Les bons tags de styles à combiner pour obtenir une production ouest-africaine moderne et chaleureuse.',
        keyPoints: [
          'Associer l’acoustique aux percussions modernes : Afro-love, acoustic guitar, soft log drums, soulful warm vocals.',
          'Toujours spécifier le tempo (80-95 BPM pour les ballades émotionnelles, 110-120 BPM pour les anniversaires festifs).',
          'Éviter de surcharger les tags : 4 à 6 descripteurs précis suffisent pour préserver la clarté de la voix.'
        ],
        resources: [
          {
            id: 'r-prompt-afrolove',
            title: 'Prompt Suno : Afro-Love Acoustique',
            type: 'prompt',
            content: `[Style] Afro-love, gentle acoustic guitar, soulful West African male lead vocal, warm log drum, intimate percussion, 88 bpm, emotional ballad, clean studio production, tender romantic harmonies`
          },
          {
            id: 'r-prompt-gospel',
            title: 'Prompt Suno : Louange & Bénédiction',
            type: 'prompt',
            content: `[Style] African gospel, uplifting organ, acoustic piano, rhythmic hand claps, powerful female vocal lead, uplifting harmonies, joyous church atmosphere, 96 bpm, emotional gratitude`
          },
          {
            id: 'r-prompt-zouk',
            title: 'Prompt Suno : Zouk & Gouyad Célébration',
            type: 'prompt',
            content: `[Style] Zouk love, smooth warm keyboard pads, soft tropical drums, tender male and female duet, 92 bpm, romantic and festive anniversary, polished melodic arrangement`
          }
        ]
      },
      {
        id: 'l-1-4',
        title: 'Gestion des voix : genre, timbre et langues locales',
        durationMinutes: 7,
        description: 'Mélanger français et langues locales (Mooré, Dioula, Baoulé, Lingala) sans déformer la mélodie.',
        keyPoints: [
          'Insérer des expressions en langue locale dans le refrain pour un ancrage culturel immédiat.',
          'Régénérer plutôt que corriger manuellement un mot mal articulé par l’IA.',
          'Choisir le genre de voix en miroir : voix féminine pour une mère/sœur, voix masculine pour une déclaration d’amour.'
        ],
        resources: [
          {
            id: 'r-guide-langues',
            title: 'Guide d’Insertion des Phrases Locales',
            type: 'script',
            content: `Exemples d'accroches universelles à insérer dans le refrain :
- Mooré : « Barka wendé », « Fo ya mam sūm » (Merci à Dieu, tu es mon cœur)
- Dioula / Bambara : « I ni tché », « N'kanu » (Merci à toi, mon amour)
- Lingala : « Bolingo na ngai », « Melesi mingi » (Mon amour, merci beaucoup)
- Baoulé : « Mo n'dê », « Mo yé » (Sois bénie)`
          }
        ]
      },
      {
        id: 'l-1-5',
        title: 'Sélectionner le master et préparer le fichier',
        durationMinutes: 8,
        description: 'Les critères d’écoute pour retenir la meilleure prise et la nettoyer avant l’envoi au client.',
        keyPoints: [
          'Écouter les 30 premières secondes au casque et sur haut-parleur smartphone (le rendu client final).',
          'Vérifier que le prénom est articulé sans la moindre ambiguïté phonétique.',
          'Exporter en MP3 320 kbps et nommer le fichier proprement : sans tags génériques.'
        ],
        resources: [
          {
            id: 'r-naming-convention',
            title: 'Règle de Nommage Professionnelle',
            type: 'script',
            content: `Format de fichier recommandé :
Chanson pour [Prénom] - Dédicace [Occasion] - Master Studio.mp3
Exemple : Chanson pour Aminata - Anniversaire 30 ans - Master Studio.mp3`
          }
        ]
      },
      {
        id: 'l-1-6',
        title: 'Livraison WhatsApp et capture de réaction',
        durationMinutes: 7,
        description: 'Comment livrer le morceau pour transformer immédiatement le client en ambassadeur et recueillir une preuve sociale.',
        keyPoints: [
          'Envoyer le fichier sous deux formes : bulle audio WhatsApp (lecture directe) ET document joint (téléchargement propre).',
          'Demander une note vocale de réaction ou une vidéo d’écoute lors de la découverte du cadeau.',
          'Proposer la vidéo paroles animée en montée de gamme pour 1 500 F CFA supplémentaires.'
        ],
        resources: [
          {
            id: 'r-delivery-script',
            title: 'Script WhatsApp de Livraison',
            type: 'script',
            content: `Votre chanson personnalisée est prête et masterisée.

Voici votre morceau :
1. En écoute immédiate ci-dessous.
2. En fichier haute définition ci-joint pour le conserver précieusement.

Faites-nous un petit retour vocal après écoute, nous avons hâte de savoir ce que vous en pensez.`
          }
        ]
      }
    ]
  },
  {
    id: 'mod-2',
    title: 'Publicités TikTok & Meta à Fort Impact Émotionnel',
    shortTitle: 'Publicité & Trafic',
    duration: '1h 15 min',
    level: 'Intermédiaire',
    description: 'Le script publicitaire exact qui génère 30 à 50 messages WhatsApp qualifiés par jour pour moins de 3 000 F CFA de budget média.',
    lessons: [
      {
        id: 'l-2-1',
        title: 'Le budget test de 5 000 F CFA',
        durationMinutes: 8,
        description: 'Comment structurer votre premier test publicitaire sans risquer votre capital.',
        keyPoints: [
          'Lancer 3 vidéos différentes avec 1 500 F CFA par jour sur 3 jours.',
          'Un seul objectif de campagne : messages WhatsApp entrants.',
          'Ne jamais couper une publicité avant 48 heures de diffusion.'
        ],
        resources: [
          {
            id: 'r-meta-ads',
            title: 'Gestionnaire de Publicités Meta',
            type: 'link',
            content: 'Ouvrir Meta Ads Manager pour lancer vos campagnes',
            url: 'https://adsmanager.facebook.com'
          }
        ]
      },
      {
        id: 'l-2-2',
        title: 'L’accroche des 3 premières secondes',
        durationMinutes: 10,
        description: 'Capter immédiatement l’attention dans le flux TikTok ou Facebook avec une réaction authentique.',
        keyPoints: [
          'Commencer par le visage ému de quelqu’un qui écoute, jamais par un logo ou une animation.',
          'Ajouter un sous-titre contrasté lisible sans activer le son du téléphone.',
          'Une seule promesse claire : « Une vraie chanson qui porte son prénom ».'
        ],
        resources: [
          {
            id: 'r-hook-script',
            title: 'Script Vidéo TikTok 15 Secondes',
            type: 'script',
            content: `[0 à 3s] Gros plan sur une personne les yeux brillants avec ses écouteurs.
Texte à l'écran : « Elle ne s'attendait pas à entendre son propre prénom dans la chanson... »
[3 à 10s] Extrait du refrain avec le prénom bien distinct.
[10 à 15s] Texte d'action : « Offre-lui une chanson personnalisée livrée en moins d'une heure. Clique sur le lien en bio. »`
          }
        ]
      },
      {
        id: 'l-2-3',
        title: 'Ciblage large et événements de vie',
        durationMinutes: 9,
        description: 'Laisser l’algorithme Meta trouver vos acheteurs grâce aux centres d’intérêts d’anniversaire.',
        keyPoints: [
          'Cibler : « Amis proches de personnes dont l’anniversaire est dans 7 jours ».',
          'Cibler les fiançailles récentes (moins de 3 mois) et les anniversaires de mariage.',
          'Définir l’emplacement géographique : villes principales (Abidjan, Douala, Yaoundé, Ouagadougou, Cotonou).'
        ],
        resources: [
          {
            id: 'r-targeting-sheet',
            title: 'Fiche des Centres d’Intérêt Rentables',
            type: 'script',
            content: `Audiences prioritaires sur Meta Ads :
- Événements de vie > Amis de personnes ayant leur anniversaire dans 0 à 7 jours
- Événements de vie > Anniversaire dans 30 jours
- Événements de vie > Récemment fiancés
- Âge cible : 22 - 45 ans
- Emplacement : Instagram Feed & Stories + Facebook Feed`
          }
        ]
      },
      {
        id: 'l-2-4',
        title: 'Le message WhatsApp pré-rempli',
        durationMinutes: 9,
        description: 'Maximiser le taux de conversion dès que le prospect clique sur la publicité.',
        keyPoints: [
          'Le message pré-rempli doit être ultra-simple : « Bonjour, je souhaite une chanson pour [Prénom] pour son [Occasion]. »',
          'Éviter les messages de démarrage trop formels qui freinent le premier contact.',
          'Brancher la réponse instantanée de l’agent dans les 10 secondes.'
        ],
        resources: [
          {
            id: 'r-whatsapp-link-gen',
            title: 'Générateur de Lien WhatsApp wa.me',
            type: 'link',
            content: 'Créer un lien WhatsApp avec message pré-rempli',
            url: 'https://create.wa.link'
          }
        ]
      }
    ]
  },
  {
    id: 'mod-3',
    title: 'Closing WhatsApp : Vendre à 1 200 F et 3 000 F sans Forcer',
    shortTitle: 'Closing WhatsApp',
    duration: '50 min',
    level: 'Intermédiaire',
    description: 'La technique du texte d’abord : faire valider les paroles avant le paiement pour déclencher l’achat immédiat sur Wave ou Orange Money.',
    lessons: [
      {
        id: 'l-3-1',
        title: 'Répondre en moins de 3 minutes',
        durationMinutes: 6,
        description: 'Pourquoi la vitesse de réaction multiplie par deux le nombre de paiements enregistrés.',
        keyPoints: [
          'Un lead chaud répond 4 fois plus dans les 5 premières minutes.',
          'Poser une seule question par message pour faciliter la réponse.',
          'Privilégier la note vocale courte pour créer une relation humaine immédiate.'
        ],
        resources: [
          {
            id: 'r-welcome-script',
            title: 'Script d’Accueil Chaleureux',
            type: 'script',
            content: `Bonjour et bienvenue au Studio.

Nous créons des chansons sur-mesure pour les moments précieux : anniversaires, mariages, hommages ou déclarations.

Pour démarrer, quel est le prénom de la personne et l'occasion fêtée ? Une note vocale suffit.`
          }
        ]
      },
      {
        id: 'l-3-2',
        title: 'La technique du texte d’abord',
        durationMinutes: 8,
        description: 'Rendre la commande irrésistible en montrant l’histoire du client déjà écrite.',
        keyPoints: [
          'Écrire le premier jet des paroles avant d’exiger le paiement.',
          'Quand le client lit son propre prénom et ses anecdotes dans le texte, la décision est prise.',
          'Limiter à une seule session de retouches pour préserver votre temps.'
        ],
        resources: [
          {
            id: 'r-lyrics-pitch',
            title: 'Script de Présentation des Paroles',
            type: 'script',
            content: `Voici le premier jet des paroles composées pour [Prénom] :

[Coller les paroles ici]

Prenez le temps de lire le refrain avec son prénom. Qu'en pensez-vous ? Nous pouvons ajuster un détail si besoin avant de lancer la musique au studio.`
          }
        ]
      },
      {
        id: 'l-3-3',
        title: 'Annoncer le prix et les moyens locaux',
        durationMinutes: 7,
        description: 'Présenter la formule avec assurance sur Wave, Orange Money et MTN.',
        keyPoints: [
          'Toujours présenter la formule de base à 1 200 F et l’option vidéo à 3 000 F.',
          'Donner les coordonnées de paiement complètes en un seul message lisible.',
          'Demander simplement la capture du transfert pour lancer l’enregistrement.'
        ],
        resources: [
          {
            id: 'r-payment-script',
            title: 'Script de Paiement Wave & Orange Money',
            type: 'script',
            content: `Parfait, les paroles sont validées.

Vous pouvez régler via nos comptes officiels :
- Wave / Orange Money : [Votre numéro] (Nom : [Votre Nom])
- Montant : 1 200 F CFA

Dès que le transfert est fait, envoyez-nous la capture ici pour lancer la production immédiate.`
          }
        ]
      },
      {
        id: 'l-3-4',
        title: 'Traiter l’objection « C’est trop cher »',
        durationMinutes: 8,
        description: 'Recadrer le prix par rapport à la valeur émotionnelle d’un cadeau mémorable.',
        keyPoints: [
          'Comparer la chanson à un gâteau ou un bouquet de fleurs qui disparaissent en 48 heures.',
          'Rappeler que la chanson sera réécoutée pendant des années par toute la famille.',
          'Rappeler la garantie : le client n’a payé qu’après avoir validé le texte de ses propres yeux.'
        ],
        resources: [
          {
            id: 'r-objection-script',
            title: 'Réponse à l’Objection Tarifaire',
            type: 'script',
            content: `Je comprends tout à fait. Un gâteau ou un bouquet coûtent souvent 5 000 à 10 000 F et sont oubliés le lendemain.

La chanson de [Prénom], elle, restera pour toujours. Elle l'écoutera à chaque anniversaire avec vos souvenirs et son prénom dedans.`
          }
        ]
      }
    ]
  },
  {
    id: 'mod-4',
    title: 'Automatisation & Scaling : Faire Vendre son Studio par l’IA',
    shortTitle: 'Automatisation & Scale',
    duration: '1h 00 min',
    level: 'Mastery',
    description: 'Brancher son numéro WhatsApp au cockpit Velaris pour livrer les chansons et encaisser les commissions en pilote automatique.',
    lessons: [
      {
        id: 'l-4-1',
        title: 'Connecter son numéro dédié par QR Code',
        durationMinutes: 10,
        description: 'Séparer sa ligne professionnelle de son numéro privé pour assurer la continuité du service 24/7.',
        keyPoints: [
          'Toujours utiliser une puce dédiée au studio, jamais son WhatsApp personnel.',
          'Vérifier que la session WAHA est en statut vert connecté.',
          'Activer les réponses automatiques d’accueil en dehors des heures de pointe.'
        ],
        resources: [
          {
            id: 'r-waha-guide',
            title: 'Documentation WAHA Gateway',
            type: 'link',
            content: 'Guide officiel de configuration de l’API WhatsApp',
            url: 'https://waha.devlike.pro'
          }
        ]
      },
      {
        id: 'l-4-2',
        title: 'Passer la barre des 20 commandes par jour',
        durationMinutes: 14,
        description: 'La méthode d’organisation par lots pour produire plus sans épuiser son temps.',
        keyPoints: [
          'Produire par lots : écriture des paroles le matin, génération Suno l’après-midi.',
          'Déléguer l’accueil initial à l’agent conversationnel pour ne traiter que les clients chauds.',
          'Réinvestir 30 % des bénéfices nets dans les publicités qui performent.'
        ],
        resources: [
          {
            id: 'r-scale-checklist',
            title: 'Routine Quotidienne du Studio (20 ventes/jour)',
            type: 'script',
            content: `8h30 - 9h30 : Relève des briefs de la nuit et écriture des paroles par lots de 5.
10h00 - 12h00 : Sessions Suno et génération des masters audio.
14h00 - 15h30 : Livraisons WhatsApp et recueil des premiers retours vocaux.
16h00 - 17h00 : Analyse du budget publicitaire et optimisation des créations.
18h00 - 19h00 : Clôture des commandes du soir et vérification des soldes.`
          }
        ]
      }
    ]
  }
];

const STORAGE_KEY = 'velaris_academy_progress_v2';

export const AcademyView: FC<AcademyViewProps> = () => {
  // Navigation
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'points' | 'resources'>('points');

  // Lecteur Vidéo & Simulation Masterclass
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Progression persistée en localStorage
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['l-1-1'];
    } catch {
      return ['l-1-1'];
    }
  });

  const activeModule = MASTERCLASS_MODULES[activeModuleIndex] || MASTERCLASS_MODULES[0];
  const activeLesson = activeModule.lessons[activeLessonIndex] || activeModule.lessons[0];

  const totalLessonsCount = useMemo(() => {
    return MASTERCLASS_MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
  }, []);

  const totalCompletedCount = useMemo(() => {
    return completedLessonIds.length;
  }, [completedLessonIds]);

  const progressPercent = Math.min(100, Math.round((totalCompletedCount / totalLessonsCount) * 100));

  // Sauvegarde de la progression
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedLessonIds));
    } catch {
      // Ignore
    }
  }, [completedLessonIds]);

  // Réinitialisation du chrono lors du changement de leçon
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [activeLesson.id]);

  // Simulation de lecture fluide pour l'immersion vidéo
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const lessonTotalSeconds = activeLesson.durationMinutes * 60;

    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 * playbackRate;
          if (next >= lessonTotalSeconds) {
            setIsPlaying(false);
            // Marque automatiquement comme vu
            if (!completedLessonIds.includes(activeLesson.id)) {
              setCompletedLessonIds((list) => [...list, activeLesson.id]);
            }
            return lessonTotalSeconds;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackRate, activeLesson.id, activeLesson.durationMinutes, completedLessonIds]);

  // Basculer l'état terminé
  const toggleComplete = (lessonId: string) => {
    setCompletedLessonIds((prev) =>
      prev.includes(lessonId) ? prev.filter((id) => id !== lessonId) : [...prev, lessonId]
    );
  };

  // Passer à la leçon suivante
  const goToNextLesson = () => {
    if (activeLessonIndex < activeModule.lessons.length - 1) {
      setActiveLessonIndex(activeLessonIndex + 1);
    } else if (activeModuleIndex < MASTERCLASS_MODULES.length - 1) {
      setActiveModuleIndex(activeModuleIndex + 1);
      setActiveLessonIndex(0);
    }
  };

  // Copie de ressource en 1 clic
  const handleCopyResource = async (res: LessonResource) => {
    try {
      await navigator.clipboard.writeText(res.content);
      setCopiedId(res.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = res.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopiedId(res.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isCurrentLessonDone = completedLessonIds.includes(activeLesson.id);
  const totalSeconds = activeLesson.durationMinutes * 60;
  const progressRatio = totalSeconds > 0 ? (currentTime / totalSeconds) * 100 : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* ============================================================ */}
      {/* 1. EN-TÊTE SUPÉRIEUR ÉPURÉ & PROGRESSION GLOBALE             */}
      {/* ============================================================ */}
      <header className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#E2BD6B] font-semibold">
                Académie Studio
              </span>
              <span className="text-white/20">·</span>
              <span className="text-xs text-[#8A90A0]">Cursus Vidéo & Boîte à Outils</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Formation Maître Chanson Personnalisée
            </h1>
          </div>

          <div className="flex items-center gap-4 bg-[#050608] border border-white/[0.06] px-4 py-2.5 rounded-2xl">
            <div className="text-right">
              <p className="text-xs font-mono font-bold text-white">
                {totalCompletedCount} / {totalLessonsCount} leçons
              </p>
              <p className="text-[10px] text-[#8A90A0]">{progressPercent}% terminé</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center font-mono text-xs font-bold text-[#E2BD6B]">
              {progressPercent}%
            </div>
          </div>
        </div>

        {/* Barre de progression fine continue */}
        <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E2BD6B] to-[#10D98E] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Sélecteur horizontal sobre des 4 Modules */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {MASTERCLASS_MODULES.map((m, idx) => {
            const isSelected = idx === activeModuleIndex;
            const moduleDone = m.lessons.every((l) => completedLessonIds.includes(l.id));
            const completedInMod = m.lessons.filter((l) => completedLessonIds.includes(l.id)).length;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveModuleIndex(idx);
                  setActiveLessonIndex(0);
                }}
                className={`p-3 rounded-2xl text-left transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? 'bg-[#0E1015] border-[#E2BD6B]/50 shadow-lg shadow-black/40'
                    : 'bg-[#050608]/60 border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-[#8A90A0] mb-1">
                  <span className={isSelected ? 'text-[#E2BD6B] font-bold' : ''}>0{idx + 1}</span>
                  {moduleDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10D98E]" />
                  ) : (
                    <span className="text-[10px] text-white/40">
                      {completedInMod}/{m.lessons.length}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-white truncate">{m.shortTitle}</p>
                <p className="text-[10px] text-[#8A90A0] truncate">{m.duration}</p>
              </button>
            );
          })}
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. ZONE CENTRALE (8 COLONNES PLAYER / 4 COLONNES PLAYLIST)    */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================ */}
        {/* COLONNE GAUCHE (8/12) : LECTEUR VIDÉO & CONTENU LEÇON        */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 space-y-5">
          {/* Cadre Lecteur Vidéo 16:9 Immersion */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#050608] overflow-hidden shadow-2xl relative">
            {activeLesson.videoUrl ? (
              <video
                src={activeLesson.videoUrl}
                controls
                playsInline
                className="w-full aspect-video bg-black"
              />
            ) : (
              <div className="relative w-full aspect-video bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#121620] via-[#08090C] to-[#040406] flex flex-col justify-between p-6 sm:p-8 select-none">
                {/* En-tête discret du lecteur */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] text-[11px] font-mono text-white/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E2BD6B] animate-pulse" />
                    <span>
                      Module 0{activeModuleIndex + 1} · Leçon 0{activeLessonIndex + 1}
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] text-[11px] font-mono text-white/60">
                    {activeLesson.durationMinutes} min de cours
                  </span>
                </div>

                {/* Titre & Bouton Central Play */}
                <div className="text-center space-y-4 my-auto z-10 max-w-xl mx-auto">
                  <p className="text-xs font-mono uppercase tracking-widest text-[#E2BD6B]">
                    {activeModule.shortTitle}
                  </p>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    {activeLesson.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#8A90A0] line-clamp-2 max-w-md mx-auto">
                    {activeLesson.description}
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-all cursor-pointer shadow-xl active:scale-95"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-black" />
                          <span>Mettre en pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-black translate-x-0.5" />
                          <span>Lancer la leçon vidéo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Barre de contrôle du lecteur vidéo */}
                <div className="space-y-2.5 z-10 pt-2">
                  {/* Timeline interactive */}
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const ratio = clickX / rect.width;
                      setCurrentTime(ratio * totalSeconds);
                    }}
                    className="w-full h-1.5 rounded-full bg-white/10 hover:h-2.5 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div
                      className="h-full bg-[#E2BD6B] rounded-full transition-all"
                      style={{ width: `${progressRatio}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/70">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-1.5 hover:text-white transition-colors cursor-pointer"
                        title={isPlaying ? 'Pause' : 'Lecture'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentTime(0)}
                        className="p-1.5 hover:text-white transition-colors cursor-pointer"
                        title="Recommencer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <span className="font-mono text-[11px] text-white/60">
                        {formatSeconds(currentTime)} / {formatSeconds(totalSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Vitesse */}
                      <button
                        type="button"
                        onClick={() => {
                          const rates = [1, 1.25, 1.5, 2];
                          const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                          setPlaybackRate(rates[nextIdx]);
                        }}
                        className="px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white/[0.15] text-[10px] font-mono text-white/80 transition-colors cursor-pointer"
                      >
                        {playbackRate}x
                      </button>

                      {/* Mute */}
                      <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-1.5 hover:text-white transition-colors cursor-pointer"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Barre d'action sous la vidéo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#08090C] border border-white/[0.06]">
            <div>
              <span className="text-[11px] font-mono text-[#E2BD6B]">
                Leçon {activeLessonIndex + 1} sur {activeModule.lessons.length}
              </span>
              <h3 className="text-base font-bold text-white leading-snug">{activeLesson.title}</h3>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => toggleComplete(activeLesson.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all ${
                  isCurrentLessonDone
                    ? 'bg-[#10D98E]/15 border border-[#10D98E]/30 text-[#10D98E]'
                    : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isCurrentLessonDone ? 'Leçon terminée' : 'Marquer comme terminée'}</span>
              </button>

              <button
                type="button"
                onClick={goToNextLesson}
                className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white/90 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Leçon suivante"
              >
                <span>Suivante</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Onglets sous la vidéo : Points Clés & Ressources */}
          <div className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('points')}
                className={`text-xs font-semibold pb-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'points'
                    ? 'border-[#E2BD6B] text-white'
                    : 'border-transparent text-[#8A90A0] hover:text-white'
                }`}
              >
                Points Clés de la Leçon
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('resources')}
                className={`text-xs font-semibold pb-2 border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'resources'
                    ? 'border-[#E2BD6B] text-white'
                    : 'border-transparent text-[#8A90A0] hover:text-white'
                }`}
              >
                <span>Ressources & Copier-Coller</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/[0.08] text-[10px] font-mono text-white/60">
                  {activeLesson.resources.length}
                </span>
              </button>
            </div>

            {/* Contenu Onglet 1 : Points clés */}
            {activeTab === 'points' && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs text-[#8A90A0] leading-relaxed">
                  {activeLesson.description}
                </p>

                <div className="space-y-2.5 pt-2">
                  {activeLesson.keyPoints.map((point, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-[#050608] border border-white/[0.05] flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#E2BD6B]/10 text-[#E2BD6B] flex items-center justify-center font-mono text-[11px] font-bold shrink-0 mt-0.5">
                        0{i + 1}
                      </span>
                      <p className="text-xs sm:text-sm text-white/90 leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contenu Onglet 2 : Ressources & Copier-Coller */}
            {activeTab === 'resources' && (
              <div className="space-y-3 animate-in fade-in">
                {activeLesson.resources.length > 0 ? (
                  <div className="space-y-3">
                    {activeLesson.resources.map((res) => {
                      const isCopied = copiedId === res.id;
                      const isLink = res.type === 'link';

                      return (
                        <div
                          key={res.id}
                          className="p-4 rounded-2xl bg-[#050608] border border-white/[0.06] space-y-2.5 hover:border-white/[0.1] transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {isLink ? (
                                <ExternalLink className="w-3.5 h-3.5 text-[#E2BD6B]" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-[#10D98E]" />
                              )}
                              <h4 className="text-xs font-bold text-white">{res.title}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-[#8A90A0] font-mono">
                                {res.type}
                              </span>
                            </div>

                            {isLink && res.url ? (
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[11px] font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                              >
                                <span>Ouvrir</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCopyResource(res)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isCopied
                                    ? 'bg-[#10D98E] text-black font-bold'
                                    : 'bg-white text-black hover:bg-neutral-200'
                                }`}
                              >
                                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Copié !' : 'Copier'}</span>
                              </button>
                            )}
                          </div>

                          {!isLink && (
                            <pre className="p-3 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] text-white/80 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                              {res.content}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#050608] border border-white/[0.04] text-center text-xs text-[#8A90A0]">
                    Aucune ressource externe requise pour cette leçon. Tout est expliqué dans les points clés.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLONNE DROITE (4/12) : PLAYLIST DU MODULE & BOÎTE À OUTILS */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-5">
          {/* Playlist des leçons du module actif */}
          <div className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A90A0]">
                  Playlist du Module
                </span>
                <h3 className="text-sm font-bold text-white">{activeModule.shortTitle}</h3>
              </div>
              <span className="text-xs font-mono text-[#8A90A0]">{activeModule.duration}</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {activeModule.lessons.map((lesson, idx) => {
                const isCurrent = idx === activeLessonIndex;
                const isDone = completedLessonIds.includes(lesson.id);

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setActiveLessonIndex(idx)}
                    className={`w-full p-3 rounded-2xl text-left transition-all duration-150 border flex items-center justify-between gap-3 cursor-pointer ${
                      isCurrent
                        ? 'bg-[#0E1015] border-[#E2BD6B]/50 shadow-md'
                        : 'bg-[#050608]/40 border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] shrink-0 font-bold ${
                          isDone
                            ? 'bg-[#10D98E]/15 text-[#10D98E]'
                            : isCurrent
                              ? 'bg-[#E2BD6B]/20 text-[#E2BD6B]'
                              : 'bg-white/[0.04] text-white/40'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-xs truncate ${
                            isCurrent ? 'font-bold text-white' : 'text-white/80'
                          }`}
                        >
                          {lesson.title}
                        </p>
                        <p className="text-[10px] text-[#8A90A0]">{lesson.durationMinutes} min</p>
                      </div>
                    </div>

                    {isCurrent && isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-[#E2BD6B] animate-ping shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Boîte à Outils Rapide : Les 3 Prompts & Scripts Clés */}
          <div className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-[#E2BD6B]" />
              <h3 className="text-xs font-bold text-white">Boîte à Outils Essentielle</h3>
            </div>
            <p className="text-[11px] text-[#8A90A0] leading-relaxed">
              Les scripts et prompts fondamentaux à garder sous la main pour produire et closer rapidement.
            </p>

            <div className="space-y-2 pt-1">
              {/* Outil 1 : Prompt Suno Afro-Love */}
              <div className="p-3 rounded-2xl bg-[#050608] border border-white/[0.05] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Suno : Afro-Love Ballad</p>
                  <p className="text-[10px] text-[#8A90A0]">Prompt guitare & voix chaude</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyResource({
                      id: 'box-suno-1',
                      title: 'Suno Afro-Love',
                      type: 'prompt',
                      content: `[Style] Afro-love, gentle acoustic guitar, soulful West African male lead vocal, warm log drum, intimate percussion, 88 bpm, emotional ballad, clean studio production, tender romantic harmonies`
                    })
                  }
                  className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[10px] font-semibold text-white cursor-pointer"
                >
                  {copiedId === 'box-suno-1' ? 'Copié' : 'Copier'}
                </button>
              </div>

              {/* Outil 2 : Pitch Paroles */}
              <div className="p-3 rounded-2xl bg-[#050608] border border-white/[0.05] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Pitch Paroles WhatsApp</p>
                  <p className="text-[10px] text-[#8A90A0]">Technique du texte d'abord</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyResource({
                      id: 'box-pitch-2',
                      title: 'Pitch Paroles',
                      type: 'script',
                      content: `Voici le premier jet des paroles composées pour [Prénom] :\n\n[Coller les paroles]\n\nPrenez le temps de lire le refrain avec son prénom. Qu'en pensez-vous ? Nous pouvons ajuster un détail si besoin avant de lancer la musique au studio.`
                    })
                  }
                  className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[10px] font-semibold text-white cursor-pointer"
                >
                  {copiedId === 'box-pitch-2' ? 'Copié' : 'Copier'}
                </button>
              </div>

              {/* Outil 3 : Coordonnées Wave & OM */}
              <div className="p-3 rounded-2xl bg-[#050608] border border-white/[0.05] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Encaissement Wave / OM</p>
                  <p className="text-[10px] text-[#8A90A0]">Coordonnées pour paiement</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyResource({
                      id: 'box-pay-3',
                      title: 'Encaissement Wave',
                      type: 'script',
                      content: `Vous pouvez régler via nos comptes officiels :\n- Wave / Orange Money : [Votre numéro] (Nom : [Votre Nom])\n- Montant : 1 200 F CFA\n\nDès que le transfert est fait, envoyez-nous la capture ici pour lancer la production immédiate.`
                    })
                  }
                  className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[10px] font-semibold text-white cursor-pointer"
                >
                  {copiedId === 'box-pay-3' ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
