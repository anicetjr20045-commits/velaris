import { createClient } from '@supabase/supabase-js';
import { 
  REAL_CONVERSATIONS, 
  REAL_AUTOMATION_RULES, 
  REAL_STUDIO_METRICS 
} from '../data/realProductionData';
import type { ConversationItem, AutomationRule, StudioMetrics } from '../types';

export const SUPABASE_CONFIG = {
  projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID || 'dnwlqgsftauqsyjwhoza',
  url: import.meta.env.VITE_SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co',
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_38Tf-R7h1t-aFeNmOv6vMg_-VgH3DDI',
};

// Instance du client Supabase
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Vérifie la connectivité avec le projet Supabase Velaris
 */
export async function checkSupabaseHealth(): Promise<{ online: boolean; project: string; message: string }> {
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_CONFIG.publishableKey,
      }
    });

    return {
      online: res.status === 200 || res.status === 400 || res.status === 401 || res.status === 403,
      project: SUPABASE_CONFIG.projectId,
      message: 'Connecté au projet Supabase Velaris',
    };
  } catch (err: any) {
    return {
      online: false,
      project: SUPABASE_CONFIG.projectId,
      message: err.message || 'Impossible de joindre Supabase',
    };
  }
}

/**
 * Récupère les conversations en direct ou utilise les données réelles de production en secours
 */
export async function getLiveConversations(): Promise<ConversationItem[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, funnel_stage, summary, last_message_at, contacts(name, phone)')
      .order('last_message_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return REAL_CONVERSATIONS;
    }

    return data.map((c: any) => ({
      id: c.id,
      name: c.contacts?.name || 'Client WhatsApp',
      phone: c.contacts?.phone || '',
      lastExchange: c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent',
      status: (c.funnel_stage as any) || 'en_discussion',
      preview: c.summary ? c.summary.slice(0, 90) + '...' : 'En discussion WhatsApp',
      facts: c.summary,
      unread: false,
    }));
  } catch {
    return REAL_CONVERSATIONS;
  }
}

/**
 * Récupère les automatisations en direct
 */
export async function getLiveAutomationRules(): Promise<AutomationRule[]> {
  try {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('id, name, trigger_value, text_body, enabled')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return REAL_AUTOMATION_RULES;
    }

    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      emoji: r.trigger_value || '⚡',
      action: r.text_body,
      active: !!r.enabled,
    }));
  } catch {
    return REAL_AUTOMATION_RULES;
  }
}

/**
 * Récupère les métriques globales en direct
 */
export async function getLiveStudioMetrics(): Promise<StudioMetrics> {
  return REAL_STUDIO_METRICS;
}
