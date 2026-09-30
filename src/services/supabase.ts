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
function mapFunnelStage(stage: string): 'en_discussion' | 'nouveau' | 'devis' | 'livre' {
  if (!stage) return 'en_discussion';
  const s = stage.toLowerCase();
  if (s === 'new' || s === 'nouveau') return 'nouveau';
  if (s === 'delivered' || s === 'livre') return 'livre';
  if (s === 'paid' || s === 'presenting' || s === 'devis') return 'devis';
  return 'en_discussion';
}

/**
 * Récupère les conversations du studio connecté (ou données démo si visiteur non connecté)
 */
export async function getLiveConversations(): Promise<ConversationItem[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isUser = !!session?.user;

    const { data, error } = await supabase
      .from('conversations')
      .select('id, funnel_stage, summary, last_message_at, contacts(name, phone)')
      .order('last_message_at', { ascending: false });

    if (error) {
      return isUser ? [] : REAL_CONVERSATIONS;
    }

    if (!data || data.length === 0) {
      return isUser ? [] : REAL_CONVERSATIONS;
    }

    return data.map((c: any) => ({
      id: c.id,
      name: c.contacts?.name || 'Client WhatsApp',
      phone: c.contacts?.phone || '',
      lastExchange: c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent',
      status: mapFunnelStage(c.funnel_stage),
      preview: c.summary ? c.summary.slice(0, 90) + '...' : 'En discussion WhatsApp',
      facts: c.summary,
      unread: c.funnel_stage === 'new',
    }));
  } catch {
    return [];
  }
}

/**
 * Récupère les automatisations du studio connecté (ou règles démo si visiteur non connecté)
 */
export async function getLiveAutomationRules(): Promise<AutomationRule[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isUser = !!session?.user;

    const { data, error } = await supabase
      .from('automation_rules')
      .select('id, name, trigger_value, text_body, enabled')
      .order('created_at', { ascending: false });

    if (error) {
      return isUser ? [] : REAL_AUTOMATION_RULES;
    }

    if (!data || data.length === 0) {
      return isUser ? [] : REAL_AUTOMATION_RULES;
    }

    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      emoji: r.trigger_value || '⚡',
      action: r.text_body,
      active: !!r.enabled,
    }));
  } catch {
    return [];
  }
}

/**
 * Récupère les métriques du studio connecté (ou métriques démo si visiteur non connecté)
 */
export async function getLiveStudioMetrics(): Promise<StudioMetrics> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isUser = !!session?.user;

    const [balanceRes, ordersRes] = await Promise.all([
      supabase.from('revenue_opening_balances').select('amount_cents').limit(1).maybeSingle(),
      supabase.from('orders').select('amount_cents, status'),
    ]);

    if (!isUser) {
      return REAL_STUDIO_METRICS;
    }

    // Utilisateur connecté : métriques STRICTEMENT isolées à son studio
    const opening = balanceRes.data?.amount_cents ? Number(balanceRes.data.amount_cents) / 100 : 0;
    let ordersSum = 0;
    let deliveredCount = 0;
    let activeCount = 0;

    if (ordersRes.data && ordersRes.data.length > 0) {
      for (const order of ordersRes.data) {
        const amt = Number(order.amount_cents || 0) / 100;
        if (order.status === 'delivered') {
          ordersSum += amt;
          deliveredCount++;
        } else if (order.status === 'validated' || order.status === 'pending') {
          ordersSum += amt;
          activeCount++;
        }
      }
    }

    const total = opening + ordersSum;

    return {
      totalRevenue: total,
      ordersDelivered: deliveredCount,
      ordersActive: activeCount,
      adLeadsCount: 0,
      conversionRate: deliveredCount + activeCount > 0 ? 100 : 0,
      currency: 'FCFA',
    };
  } catch {
    return {
      totalRevenue: 0,
      ordersDelivered: 0,
      ordersActive: 0,
      adLeadsCount: 0,
      conversionRate: 0,
      currency: 'FCFA',
    };
  }
}

/**
 * Récupère les commandes du studio de l'utilisateur connecté
 */
export async function getLiveOrders(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, amount_cents, currency, status, payment_method, notes, created_at, contacts(name, phone, occasion)')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((o: any) => ({
      id: o.id,
      clientName: o.contacts?.name || 'Client WhatsApp',
      clientPhone: o.contacts?.phone || '',
      occasion: o.contacts?.occasion || 'Commande personnalisée',
      recipient: o.contacts?.name || '',
      style: 'afro_love',
      status: o.status === 'delivered' ? 'livre' : o.status === 'validated' ? 'paiement_valide' : 'brief_recu',
      amount: Number(o.amount_cents || 120000) / 100,
      paymentMethod: o.payment_method || 'Wave',
      createdAt: new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    }));
  } catch {
    return [];
  }
}

/**
 * Crée une nouvelle commande rattachée automatiquement au studio connecté via RLS
 */
export async function createLiveOrder(order: {
  clientName: string;
  clientPhone: string;
  occasion: string;
  amount: number;
  paymentMethod?: string;
  status?: string;
}): Promise<{ id: string } | null> {
  try {
    // 1. Créer le contact (hérite de user_id = auth.uid())
    const { data: contact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        name: order.clientName,
        phone: order.clientPhone,
        occasion: order.occasion,
        price_quoted_cents: Math.round(order.amount * 100),
      })
      .select('id')
      .single();

    if (contactErr || !contact) {
      console.error('Error creating contact:', contactErr);
      return null;
    }

    // 2. Créer la conversation associée
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        contact_id: contact.id,
        funnel_stage: order.status === 'livre' ? 'delivered' : 'paid',
        summary: `Commande ${order.occasion} pour ${order.clientName} (${order.amount} F CFA)`,
      })
      .select('id')
      .single();

    // 3. Créer la commande
    const { data: ord, error: ordErr } = await supabase
      .from('orders')
      .insert({
        contact_id: contact.id,
        conversation_id: conv?.id,
        amount_cents: Math.round(order.amount * 100),
        currency: 'XOF',
        status: order.status === 'livre' ? 'delivered' : 'validated',
        payment_method: order.paymentMethod || 'Wave',
        notes: `Créé depuis le Studio OS - ${order.occasion}`,
      })
      .select('id')
      .single();

    if (ordErr || !ord) {
      console.error('Error creating order:', ordErr);
      return null;
    }

    return { id: ord.id };
  } catch (err) {
    console.error('Exception in createLiveOrder:', err);
    return null;
  }
}
