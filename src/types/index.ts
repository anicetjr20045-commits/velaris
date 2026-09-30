export interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  occasion: string;
  recipient: string;
  style: 'afro_love' | 'acoustique' | 'zouk' | 'rumba' | 'gospel';
  status: 'brief_recu' | 'paroles_pretes' | 'paiement_valide' | 'production_suno' | 'livre';
  amount: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'Moov' | 'MTN';
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
