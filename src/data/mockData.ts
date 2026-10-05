import type { 
  Order, 
  StudioMetrics, 
  AcademyModule, 
  ConversationItem, 
  PipelineLead, 
  AutomationRule, 
  AutomationLog, 
  WhatsAppLine 
} from '../types';

export const INITIAL_METRICS: StudioMetrics = {
  totalRevenue: 0,
  ordersDelivered: 0,
  ordersActive: 0,
  adLeadsCount: 0,
  conversionRate: 0,
  currency: 'FCFA',
};

export const INITIAL_ORDERS: Order[] = [];

export const ACADEMY_MODULES: AcademyModule[] = [
  {
    id: 'mod-1',
    title: 'Machine à Musique IA : Créer des Hits Personnalisés',
    duration: '45 min',
    lessonsCount: 6,
    level: 'Débutant',
    description: 'Prendre en main Suno & Kie.ai, paramétrer les styles africains (Afrobeat, Zouk, Rumba, Acoustique) et générer des voix professionnelles sans fausse note.',
    icon: 'Music2',
    completed: true,
  },
  {
    id: 'mod-2',
    title: 'Publicités Facebook & TikTok à Fort Impact Émotionnel',
    duration: '1h 15 min',
    lessonsCount: 8,
    level: 'Intermédiaire',
    description: 'Le script publicitaire exact qui génère 30 à 50 messages WhatsApp par jour pour moins de 3 000 F CFA de budget média.',
    icon: 'Flame',
    completed: true,
  },
  {
    id: 'mod-3',
    title: 'Closing WhatsApp : Vendre à 3 000 F et 5 000 F sans Forcer',
    duration: '50 min',
    lessonsCount: 7,
    level: 'Intermédiaire',
    description: 'La technique du texte d’abord : comment faire valider les paroles avant le paiement pour déclencher l’achat immédiat sur Wave ou Orange Money.',
    icon: 'MessageSquareText',
    completed: false,
  },
  {
    id: 'mod-4',
    title: 'Automatisation & Scaling : Faire Vendre son Studio par l’IA',
    duration: '1h 00 min',
    lessonsCount: 5,
    level: 'Mastery',
    description: 'Brancher le QR Code WhatsApp et activer l’agent de production automatique pour livrer les chansons d’un simple clic ou emoji.',
    icon: 'Bot',
    completed: false,
  },
];

export const MOCK_CONVERSATIONS: ConversationItem[] = [];

export const MOCK_PIPELINE_LEADS: PipelineLead[] = [];

export const MOCK_AUTOMATIONS: AutomationRule[] = [];

export const MOCK_AUTOMATION_LOGS: AutomationLog[] = [];

export const MOCK_WHATSAPP_LINES: WhatsAppLine[] = [];
