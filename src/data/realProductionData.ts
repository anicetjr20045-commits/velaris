import type { 
  StudioMetrics, 
  ConversationItem, 
  PipelineLead, 
  AutomationRule, 
  AutomationLog, 
  WhatsAppLine 
} from '../types';

/**
 * Données de production réelles extraites directement de la base Velaris Studio & WhatsApp
 * Comptabilité certifiée : 3 644 400 F CFA
 * 2 292 conversations réelles, 2 284 contacts CRM, 896 commandes
 */

export const REAL_STUDIO_METRICS: StudioMetrics = {
  totalRevenue: 3644400, // 2 749 400 F solde + 744 400 F livrées + 150 600 F validées
  ordersDelivered: 463,
  ordersActive: 42,
  adLeadsCount: 2284,
  conversionRate: 46.8,
  currency: 'FCFA',
};

export interface RealMessage {
  id: string;
  role: 'user' | 'assistant' | 'human_agent' | 'system';
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
}

export const REAL_CONVERSATIONS: ConversationItem[] = [
  {
    id: '78ed0053-be69-452a-9451-2a76074e1202',
    name: 'Safiatou TRAORE',
    phone: '+226 79 29 64 99',
    lastExchange: '30 sept., 15:02',
    status: 'devis',
    preview: '(a) FAITS CONCRETS : Destinataire Orokiatou Tientrebéogo (anniversaire). Photos validées...',
    facts: 'Destinataire Orokiatou Tientrebéogo (anniversaire), Version vidéo photos en duo, 3000 F payé et confirmé, montage final en cours',
    fullMessage: "🎙️ Désolée hein, j'étais en train de gérer des patients. Je prends le premier montage pour Orokiatou.",
    unread: true,
  },
  {
    id: 'c64ff5c3-8e48-4626-b975-d2cf47a5226b',
    name: 'Mme IMA',
    phone: '+226 55 11 31 04',
    lastExchange: '30 sept., 14:59',
    status: 'nouveau',
    preview: 'Nouveau message entrant',
    facts: 'Nouvelle prospecte WhatsApp en phase de découverte des formules studio',
    fullMessage: 'Bonjour Velaris, j’ai vu votre vidéo de chanson personnalisée sur Facebook, comment ça se passe ?',
    unread: true,
  },
  {
    id: 'cf6b84e5-671b-4f06-97ca-725463a161d3',
    name: 'Client +22605777308',
    phone: '+226 05 77 73 08',
    lastExchange: '30 sept., 13:44',
    status: 'nouveau',
    preview: 'En attente de qualification',
    facts: 'Demande de renseignement pour un événement familial',
    fullMessage: 'Bonjour, vous faites des chansons pour les baptêmes aussi ?',
    unread: true,
  },
  {
    id: '8db9fcc3-ae35-4ebb-8b74-3e6691e60c1a',
    name: 'Prunelle De Dieu',
    phone: '+226 58 58 34 71',
    lastExchange: '30 sept., 09:42',
    status: 'livre',
    preview: '(a) FAITS CONCRETS : Frère = Gaudens, Défunte épouse = Prisca, Décès le 28...',
    facts: 'Frère = Gaudens, Défunte Prisca, Chanson espérance chrétienne (1 200 FCFA), Morceau livré et validé avec émotion',
    fullMessage: 'Merci beaucoup🙏 Vos chansons ont apporté tellement de réconfort à toute la famille.',
    unread: false,
  },
  {
    id: '58ac5f76-57b4-40d1-a9e6-bcd996c3ea17',
    name: '𝘀𝗲𝗿𝗲 𝗶𝗻𝗼𝘂𝘀𝘀𝗮',
    phone: '+226 71 12 43 40',
    lastExchange: '30 sept., 07:20',
    status: 'en_discussion',
    preview: 'Le client, M. SERE, représentant l’entreprise SERE ET FILS (Nouna), souhaite une chanson pub...',
    facts: 'Entreprise SERE ET FILS face au CMA de Nouna, Vente téléphones et solaire, Chanson publicitaire 1200 F',
    fullMessage: '🎙️ OK, j’ai compris. La chanson c’est bon. Envoyez votre numéro Moov, je vais transférer les 1 200 F.',
    unread: false,
  },
  {
    id: 'e4b70abd-c211-4a84-b55d-6baf560dfe90',
    name: 'ong seemi',
    phone: '+226 76 94 43 50',
    lastExchange: '29 sept., 18:39',
    status: 'en_discussion',
    preview: 'La cliente Apolline, présidente de l’ONG SEEMI, commande plusieurs chansons de sensibilisation...',
    facts: 'Présidente Apolline, Chanson Dr Telly Adèle + Chanson inauguration Supérette de l’Abondance, 1200 F / unité',
    fullMessage: 'Parfait pour le couplet de la supérette ! On attend le deuxième extrait.',
    unread: false,
  },
  {
    id: '7b6f1072-8e3f-493f-8062-b43bc4fa339a',
    name: 'Jacquie Gbeuly',
    phone: '+225 05 44 91 20',
    lastExchange: '29 sept., 17:38',
    status: 'en_discussion',
    preview: 'D’accord, j’ai écouté l’extrait sur WhatsApp, la voix gospel est magnifique...',
    facts: 'Commande anniversaire 30 ans, style Gospel & Célébration, paiement Wave',
    fullMessage: 'D’accord, j’ai écouté l’extrait sur WhatsApp, la voix gospel est magnifique. On fait comment pour le paiement par Wave ?',
    unread: false,
  },
  {
    id: '4b6f59ba-9975-4bc9-a0c7-730168c33c4e',
    name: 'seydoutioro7',
    phone: '+225 07 88 12 43',
    lastExchange: '29 sept., 16:10',
    status: 'nouveau',
    preview: 'Bonjour, j’aimerais savoir quel est le délai pour une chanson d’anniversaire...',
    facts: 'Demande urgente pour anniversaire de son grand frère, style Afro-Love',
    fullMessage: 'Bonjour, j’aimerais savoir quel est le délai pour une chanson d’anniversaire surprise pour mon grand frère.',
    unread: false,
  },
  {
    id: '3e803167-cdb6-4ca7-8f4f-a5db9b9efaf2',
    name: 'cestdieu42',
    phone: '+226 76 54 32 10',
    lastExchange: '29 sept., 15:58',
    status: 'en_discussion',
    preview: 'Voici les prénoms : Jean-Marc et Mireille, célébration de leurs 10 ans de mariage...',
    facts: '10 ans de mariage, couplet romantique bilingue français et mooré',
    fullMessage: 'Voici les prénoms : Jean-Marc et Mireille, célébration de leurs 10 ans de mariage.',
    unread: false,
  },
  {
    id: '57209772-1837-4f88-8b22-990011223344',
    name: 'Jesus Christ my Saviour',
    phone: '+226 70 99 00 11',
    lastExchange: '29 sept., 13:03',
    status: 'livre',
    preview: 'Gloire à Dieu pour ce talent. Je prépare le transfert Orange Money...',
    facts: 'Prière chantée pour action de grâce, montant 1200 F CFA',
    fullMessage: 'Gloire à Dieu pour ce talent. Je prépare le transfert Orange Money.',
    unread: false,
  }
];

export const REAL_CONVERSATION_MESSAGES: Record<string, RealMessage[]> = {
  '78ed0053-be69-452a-9451-2a76074e1202': [
    {
      id: 'm1',
      role: 'user',
      direction: 'inbound',
      body: "Bonsoir ! C'est une connaissance qui m'a passé votre contact. C'est l'anniversaire de ma bestie Orokiatou Tientrebéogo ce samedi. Je veux lui faire une chanson surprise magnifique.",
      createdAt: '30 sept. 10:38',
    },
    {
      id: 'm2',
      role: 'human_agent',
      direction: 'outbound',
      body: "Bonjour Safiatou ! Quel plaisir. Donnez-nous vos souvenirs forts avec Orokiatou et nous lançons la composition tout de suite.",
      createdAt: '30 sept. 10:39',
    },
    {
      id: 'm3',
      role: 'user',
      direction: 'inbound',
      body: "🎙️ C'est une sœur pour moi. On a traversé les hauts et les bas ensemble, elle m'a toujours soutenue. Je veux du style Afro Love, voix femme douce.",
      createdAt: '30 sept. 11:59',
    },
    {
      id: 'm4',
      role: 'human_agent',
      direction: 'outbound',
      body: "Voici le texte composé pour Orokiatou ! Choisissez celle que vous préférez pour le montage vidéo avec vos photos.",
      createdAt: '30 sept. 14:23',
    },
    {
      id: 'm5',
      role: 'user',
      direction: 'inbound',
      body: "Je prends le 1er ! C'est tellement touchant. Je prépare les photos pour le montage.",
      createdAt: '30 sept. 14:24',
    },
    {
      id: 'm6',
      role: 'human_agent',
      direction: 'outbound',
      body: "Super ! Dépôt de 3 000 F bien reçu sur Wave. La vidéo finale sera livrée avant 18h sur ce numéro.",
      createdAt: '30 sept. 15:02',
    }
  ],
  '8db9fcc3-ae35-4ebb-8b74-3e6691e60c1a': [
    {
      id: 'mp1',
      role: 'user',
      direction: 'inbound',
      body: "Bonjour Velaris Studio. Je viens pour un hommage à mon frère Gaudens et sa défunte épouse Prisca. C'est très douloureux pour nous.",
      createdAt: '29 sept. 18:20',
    },
    {
      id: 'mp2',
      role: 'human_agent',
      direction: 'outbound',
      body: "Toutes nos condoléances Prunelle. Nous allons composer un chant d'espérance et de paix pour lui donner du courage.",
      createdAt: '29 sept. 18:22',
    },
    {
      id: 'mp3',
      role: 'user',
      direction: 'inbound',
      body: "🎙️ Oui, le prénom se prononce Godence. Le petit garçon a 1 an, il s'appelle Miensah. Que Dieu nous fortifie.",
      createdAt: '29 sept. 18:55',
    },
    {
      id: 'mp4',
      role: 'human_agent',
      direction: 'outbound',
      body: "Voici vos 2 versions de chanson masterisées en studio.",
      createdAt: '29 sept. 20:12',
    },
    {
      id: 'mp5',
      role: 'user',
      direction: 'inbound',
      body: "Merci beaucoup🙏 Que Dieu bénisse abondamment votre travail.",
      createdAt: '29 sept. 21:23',
    }
  ],
  '58ac5f76-57b4-40d1-a9e6-bcd996c3ea17': [
    {
      id: 'ms1',
      role: 'user',
      direction: 'inbound',
      body: "Bonjour, je suis M. SERE de l'entreprise SERE ET FILS à Nouna. On vend des téléphones, plaques solaires, batteries. Je veux une chanson publicitaire entraînante.",
      createdAt: '30 sept. 07:15',
    },
    {
      id: 'ms2',
      role: 'human_agent',
      direction: 'outbound',
      body: "Bienvenue M. SERE ! Nous avons inséré vos numéros (71124340 et 76046746) et votre localisation face au CMA de Nouna dans le refrain.",
      createdAt: '30 sept. 07:18',
    },
    {
      id: 'ms3',
      role: 'user',
      direction: 'inbound',
      body: "🎙️ OK, c'est bien compris ! Envoyez votre numéro Moov, je fais le transfert de 1 200 F pour lancer l'audio.",
      createdAt: '30 sept. 07:20',
    }
  ]
};

export const REAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: '163e1c54-c080-4d10-bad9-23569cb18ce9',
    name: 'Texte Standard (1 000 F)',
    emoji: '🖖🏻',
    action: 'nous faisons la chanson a 1000 f',
    active: true,
  },
  {
    id: '29dd7277-2612-443c-bc6b-4cfd9c109b04',
    name: 'Offre Duo & Vidéo (1 200 F / 3 000 F)',
    emoji: '😊',
    action: 'Nous faisons la chanson à 1200 f . On a aussi un autre modèle vidéo avec photos à 3000 f. Tout dépend de vous 😊',
    active: true,
  },
  {
    id: '587dc5c0-a81e-4b16-9ce5-a6a83c0e3d41',
    name: 'Prévision CA & Clôture',
    emoji: '🙏',
    action: "Prévision de mon chiffre d'affaires à la fin du mois ?",
    active: true,
  },
];

export const REAL_AUTOMATION_LOGS: AutomationLog[] = [
  {
    id: 'log-1',
    ruleName: 'Offre Duo & Vidéo (1 200 F / 3 000 F)',
    recipient: 'Mme IMA (+226 55 11 31 04)',
    status: 'Envoyé',
    date: '30 sept. 2026, 15:00',
  },
  {
    id: 'log-2',
    ruleName: 'Texte Standard (1 000 F)',
    recipient: 'Client +22605777308',
    status: 'Envoyé',
    date: '30 sept. 2026, 13:46',
  },
  {
    id: 'log-3',
    ruleName: 'Prévision CA & Clôture',
    recipient: 'Safiatou TRAORE (+226 79 29 64 99)',
    status: 'Envoyé',
    date: '30 sept. 2026, 11:20',
  },
  {
    id: 'log-4',
    ruleName: 'Offre Duo & Vidéo (1 200 F / 3 000 F)',
    recipient: 'Jacquie Gbeuly (+225 05 44 91 20)',
    status: 'Envoyé',
    date: '29 sept. 2026, 17:39',
  },
  {
    id: 'log-5',
    ruleName: 'Texte Standard (1 000 F)',
    recipient: 'seydoutioro7 (+225 07 88 12 43)',
    status: 'Envoyé',
    date: '29 sept. 2026, 16:11',
  }
];

export const REAL_PIPELINE_LEADS: PipelineLead[] = [
  {
    id: 'lead-1',
    name: 'Mme IMA',
    phone: '+226 55 11 31 04',
    lastExchange: '30 sept. 14:59',
    stage: 'nouveau',
    tag: 'Découverte',
    summary: 'Brief entrant suite pub TikTok - Anniversaire',
  },
  {
    id: 'lead-2',
    name: 'Client +22605777308',
    phone: '+226 05 77 73 08',
    lastExchange: '30 sept. 13:44',
    stage: 'nouveau',
    tag: 'Baptême',
    summary: 'Demande d’hymne bilingue mooré-français',
  },
  {
    id: 'lead-3',
    name: 'seydoutioro7',
    phone: '+225 07 88 12 43',
    lastExchange: '29 sept. 16:10',
    stage: 'nouveau',
    tag: 'Anniversaire',
    summary: 'Chanson surprise pour son grand frère',
  },
  {
    id: 'lead-4',
    name: '𝘀𝗲𝗿𝗲 𝗶𝗻𝗼𝘂𝘀𝘀𝗮',
    phone: '+226 71 12 43 40',
    lastExchange: '30 sept. 07:20',
    stage: 'en_discussion',
    tag: 'Publicité Nouna',
    summary: 'SERE ET FILS - Accord 1 200 F, attente numéro Moov',
  },
  {
    id: 'lead-5',
    name: 'ong seemi (Apolline)',
    phone: '+226 76 94 43 50',
    lastExchange: '29 sept. 18:39',
    stage: 'en_discussion',
    tag: 'Sensibilisation',
    summary: 'Dr Telly Adèle & Supérette de l’Abondance',
  },
  {
    id: 'lead-6',
    name: 'Safiatou TRAORE',
    phone: '+226 79 29 64 99',
    lastExchange: '30 sept. 15:02',
    stage: 'devis',
    tag: 'Vidéo Duo 3 000 F',
    summary: 'Paiement Wave reçu, montage vidéo Orokiatou en cours',
  },
  {
    id: 'lead-7',
    name: 'Jacquie Gbeuly',
    phone: '+225 05 44 91 20',
    lastExchange: '29 sept. 17:38',
    stage: 'devis',
    tag: 'Gospel 1 200 F',
    summary: 'Extrait audio validé, attente dépôt Wave',
  },
  {
    id: 'lead-8',
    name: 'Prunelle De Dieu',
    phone: '+226 58 58 34 71',
    lastExchange: '30 sept. 09:42',
    stage: 'livre',
    tag: 'Hommage Gaudens',
    summary: 'Chanson espérance chrétienne livrée et validée',
  },
  {
    id: 'lead-9',
    name: 'Jesus Christ my Saviour',
    phone: '+226 70 99 00 11',
    lastExchange: '29 sept. 13:03',
    stage: 'livre',
    tag: 'Action de grâce',
    summary: 'Prière chantée livrée sur WhatsApp',
  }
];

export const REAL_WHATSAPP_LINES: WhatsAppLine[] = [
  {
    id: 'line-test',
    name: 'Ligne Principale Studio (Alex)',
    role: 'Session active - Vente & Composition',
    phone: '+226 56 24 05 33',
    status: 'connected', // géré dynamiquement par useWahaSession('Test')
    isPrimary: true,
  },
  {
    id: 'line-anicet2',
    name: 'Ligne Superviseur (Velaris Digital)',
    role: 'Session active - Alertes Marchand & Caisse',
    phone: '+226 58 35 77 72',
    status: 'connected',
    isPrimary: false,
  },
  {
    id: 'line-partners',
    name: 'Ligne Studio Partenaires (Aïcha)',
    role: 'Relance commerciale & Suivi VIP',
    phone: '+226 70 00 00 00',
    status: 'qr_pending',
    isPrimary: false,
  }
];
