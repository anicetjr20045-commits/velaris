import type { 
  StudioMetrics, 
  ConversationItem, 
  PipelineLead, 
  AutomationRule, 
  AutomationLog, 
  WhatsAppLine 
} from '../types';

export const REAL_STUDIO_METRICS: StudioMetrics = {
  totalRevenue: 0,
  ordersDelivered: 0,
  ordersActive: 0,
  adLeadsCount: 0,
  conversionRate: 0,
  currency: 'FCFA',
};

export interface RealMessage {
  id: string;
  role: 'user' | 'assistant' | 'human_agent' | 'system';
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
}

export const REAL_CONVERSATIONS: ConversationItem[] = [];

export const REAL_CONVERSATION_MESSAGES: Record<string, RealMessage[]> = {};

export const REAL_AUTOMATION_RULES: AutomationRule[] = [];

export const REAL_AUTOMATION_LOGS: AutomationLog[] = [];

export const REAL_PIPELINE_LEADS: PipelineLead[] = [];

export const REAL_WHATSAPP_LINES: WhatsAppLine[] = [];
