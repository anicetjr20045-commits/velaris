export interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  occasion: string;
  recipient: string;
  style: 'afro_love' | 'acoustique' | 'zouk' | 'rumba' | 'gospel' | 'mandingue' | string;
  voiceGender?: 'femme' | 'homme' | 'duo';
  status: 'brief_recu' | 'paroles_pretes' | 'paiement_valide' | 'production_suno' | 'livre';
  amount: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'Moov' | 'Moov Money' | 'MTN' | string;
  createdAt: string;
  voiceNoteUrl?: string;
  transcription?: string;
  lyrics?: {
    title: string;
    verse1: string;
    chorus: string;
    verse2: string;
    outro: string;
  };
  audioTrackUrl?: string;
  deliveryDate?: string;
}

export interface StudioMetrics {
  totalRevenue: number;
  ordersDelivered: number;
  ordersActive: number;
  adLeadsCount: number;
  conversionRate: number;
  currency: string;
}

export interface AcademyModule {
  id: string;
  title: string;
  duration: string;
  lessonsCount: number;
  level: 'Débutant' | 'Intermédiaire' | 'Mastery';
  description: string;
  icon: string;
  completed?: boolean;
}

export interface ConversationItem {
  id: string;
  name: string;
  phone: string;
  lastExchange: string;
  status: 'en_discussion' | 'nouveau' | 'devis' | 'livre';
  preview: string;
  facts?: string;
  fullMessage?: string;
  unread?: boolean;
}

export interface PipelineLead {
  id: string;
  name: string;
  phone?: string;
  lastExchange: string;
  stage: 'nouveau' | 'en_discussion' | 'paiement' | 'livre';
  tag?: string;
  summary?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  emoji: string;
  action: string;
  active: boolean;
}

export interface AutomationLog {
  id: string;
  ruleName: string;
  recipient: string;
  status: 'Envoyé' | 'Échoué';
  date: string;
}

export interface WhatsAppLine {
  id: string;
  name: string;
  role: string;
  phone?: string;
  status: 'connected' | 'qr_pending' | 'disconnected';
  isPrimary?: boolean;
}
