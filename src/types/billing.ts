export interface StudioCredits {
  /** Solde actuel de crédits */
  balance: number;
  /** Coût en crédits par chanson générée (1 crédit = 85 F CFA) */
  songCostCredits: number;
  /** Coût en micro-crédits par requête IA Copilot (0.05 crédit = ~4.25 F CFA) */
  aiPromptCostCredits: number;
  /** Montant en F CFA par crédit */
  cfaPerCredit: number;
  /** Historique des mouvements de crédits */
  history: CreditTransaction[];
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'song_generation' | 'ai_prompt' | 'refund' | 'initial_grant';
  amount: number; // positif pour crédit, négatif pour débit
  balanceAfter: number;
  reason: string;
  date: string;
  reference?: string;
  orderId?: string;
}

export type SubscriptionPlanId = 'free' | 'monthly' | 'quarterly';

export interface SubscriptionInfo {
  planId: SubscriptionPlanId;
  planName: string;
  priceXOF: number;
  status: 'active' | 'expired' | 'canceled' | 'trial';
  startedAt: string;
  expiresAt: string | null;
  autoRenew: boolean;
  lastPaymentRef?: string;
  lastPaymentMethod?: string;
  checkoutSessionId?: string;
}

export interface SasPayCheckoutRequest {
  amount: number;
  currency?: string;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface SasPayCheckoutResponse {
  id: string;
  checkoutUrl: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  slug: string;
  amount: string;
  currency: string;
  description: string;
}

export interface KieSongGenerationRequest {
  prompt: string;
  lyrics?: string;
  style: string;
  title: string;
  clientName: string;
  clientPhone: string;
  orderId?: string;
  customMode?: boolean;
  instrumental?: boolean;
}

export interface KieSongResult {
  taskId: string;
  status: 'pending' | 'success' | 'failed';
  title: string;
  style: string;
  clientName: string;
  clientPhone: string;
  orderId: string;
  isNewClient: boolean;
  audioUrl?: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  duration?: number;
  createdAt: string;
  completedAt?: string;
  isSimulation?: boolean;
  notice?: string;
}

export interface SongAutomationConfig {
  enabled: boolean;
  reactionEmoji: string;
  autoDeliverWhatsApp: boolean;
  notifyOnComplete: boolean;
  ordersCreatedCount: number;
  lastTriggeredAt?: string;
}
