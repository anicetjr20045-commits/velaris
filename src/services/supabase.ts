import { createClient } from '@supabase/supabase-js';
import type { ConversationItem, AutomationRule, AutomationMediaKind, PipelineLead, StudioMetrics } from '../types';

/* Bornes des listes chargées par le Studio (protège les quotas gratuits Supabase) */
const LIST_LIMIT = 300;
const ORDER_LIMIT = 500;

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
    const { data, error } = await supabase
      .from('conversations')
      .select('id, funnel_stage, summary, last_message_at, ack_log, contacts(name, phone)')
      .order('last_message_at', { ascending: false })
      .limit(LIST_LIMIT);

    if (error) {
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((c: any) => {
      const ack = c.ack_log || {};
      const isArchived = Boolean(ack.archived);

      // Statut non-lu fiable :
      // 1. Si ack.unread est explicitement défini (ex. forcé manuellement)
      // 2. Si un message a été reçu après la dernière consultation (last_message_at > last_read_at)
      // 3. Sinon, par défaut le statut funnel_stage === 'new'
      let unread = c.funnel_stage === 'new';
      if (typeof ack.unread === 'boolean') {
        unread = ack.unread;
      }
      if (ack.last_read_at && c.last_message_at) {
        unread = new Date(c.last_message_at).getTime() > new Date(ack.last_read_at).getTime();
      }

      return {
        id: c.id,
        name: c.contacts?.name || 'Client WhatsApp',
        phone: c.contacts?.phone || '',
        lastExchange: c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent',
        status: mapFunnelStage(c.funnel_stage),
        preview: c.summary ? c.summary.slice(0, 90) + '...' : 'En discussion WhatsApp',
        facts: c.summary,
        unread,
        isArchived,
        archivedAt: ack.archived_at || undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Récupère les automatisations du studio connecté (ou règles démo si visiteur non connecté)
 */
export async function getLiveAutomationRules(): Promise<AutomationRule[]> {
  try {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('id, name, trigger_value, action_type, text_body, media_path, caption, enabled')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      emoji: r.trigger_value || '\u26A1',
      action: r.text_body || r.caption || '',
      active: !!r.enabled,
      kind: actionTypeToKind(r.action_type, r.media_path),
      mediaPath: r.media_path || undefined,
      mediaName: r.media_path ? mediaNameOf(r.media_path) : undefined,
    }));
  } catch {
    return [];
  }
}

const STAGE_TO_FUNNEL: Record<PipelineLead['stage'], string> = {
  nouveau: 'new',
  en_discussion: 'qualifying',
  devis: 'presenting',
  studio: 'paid',
  livre: 'delivered',
};

/* Enum funnel_stage : new, qualifying, presenting, objection, payment_pending, paid, delivered, lost */
function funnelToPipelineStage(stage: string | null): PipelineLead['stage'] {
  switch ((stage || '').toLowerCase()) {
    case 'new': return 'nouveau';
    case 'presenting':
    case 'payment_pending': return 'devis';
    case 'paid': return 'studio';
    case 'delivered': return 'livre';
    default: return 'en_discussion';
  }
}

/**
 * Pipeline de closing du studio connecté, construit sur les conversations WhatsApp réelles
 */
export async function getLivePipelineLeads(): Promise<PipelineLead[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, funnel_stage, summary, last_message_at, contacts(name, phone, occasion)')
      .order('last_message_at', { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return data.map((c: any) => {
      const ct = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
      return {
        id: c.id,
        name: ct?.name || ct?.phone || 'Client WhatsApp',
        phone: ct?.phone || undefined,
        lastExchange: c.last_message_at
          ? new Date(c.last_message_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'Récent',
        lastExchangeAt: c.last_message_at || undefined,
        stage: funnelToPipelineStage(c.funnel_stage),
        tag: ct?.occasion || undefined,
        summary: c.summary || undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function updateLeadStage(conversationId: string, stage: PipelineLead['stage']): Promise<boolean> {
  const { error } = await supabase
    .from('conversations')
    .update({ funnel_stage: STAGE_TO_FUNNEL[stage], updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  return !error;
}

/**
 * Écritures des règles d'automatisation (RLS : uniquement les règles du studio connecté)
 */
export async function setAutomationRuleEnabled(id: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('automation_rules')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function setAllAutomationRulesEnabled(enabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('automation_rules')
    .update({ enabled, updated_at: new Date().toISOString() })
    .neq('enabled', enabled);
  return !error;
}

/* Le moteur velaris-agent envoie send_media via WAHA /api/sendFile : la vidéo se distingue par son extension */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;

function actionTypeToKind(actionType: string | null, mediaPath: string | null): AutomationMediaKind {
  if (actionType === 'send_voice') return 'voice';
  if (actionType === 'send_media') return mediaPath && VIDEO_EXT.test(mediaPath) ? 'video' : 'document';
  return 'text';
}

/* '<uid>/automations/1727000000000-grille.pdf' -> 'grille.pdf' */
export function mediaNameOf(path: string): string {
  return (path.split('/').pop() || path).replace(/^\d{10,}-/, '');
}

export const AUTOMATION_MEDIA_BUCKET = 'product-files';
export const AUTOMATION_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

/**
 * Dépose un média d'automatisation dans le dossier privé du studio (RLS storage : <uid>/…)
 */
export async function uploadAutomationMedia(file: Blob, filename: string): Promise<{ path: string } | { error: string }> {
  if (file.size > AUTOMATION_MEDIA_MAX_BYTES) return { error: 'Fichier trop lourd (16 Mo maximum).' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: 'Connectez-vous pour enregistrer un média.' };
  const safe = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]/g, '_').slice(-80);
  const path = `${session.user.id}/automations/${Date.now()}-${safe}`;
  // Type sans paramètre de codec : le moteur choisit alors la conversion WAHA adaptée
  const contentType = (file.type || 'application/octet-stream').split(';')[0];
  const { error } = await supabase.storage.from(AUTOMATION_MEDIA_BUCKET).upload(path, file, { contentType, upsert: false });
  return error ? { error: error.message } : { path };
}

export async function getAutomationMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(AUTOMATION_MEDIA_BUCKET).createSignedUrl(path, 3600);
  return error || !data ? null : data.signedUrl;
}

export async function removeAutomationMedia(path: string): Promise<void> {
  await supabase.storage.from(AUTOMATION_MEDIA_BUCKET).remove([path]);
}

export async function saveAutomationRule(rule: {
  id?: string;
  name: string;
  emoji: string;
  action: string;
  active: boolean;
  kind?: AutomationMediaKind;
  mediaPath?: string;
}): Promise<string | null> {
  const kind = rule.kind ?? 'text';
  const row = {
    name: rule.name,
    trigger_type: 'reaction',
    trigger_value: rule.emoji,
    action_type: kind === 'text' ? 'send_text' : kind === 'voice' ? 'send_voice' : 'send_media',
    text_body: kind === 'text' ? rule.action : null,
    media_path: kind === 'text' ? null : rule.mediaPath ?? null,
    caption: kind === 'document' || kind === 'video' ? rule.action || null : null,
    enabled: rule.active,
  };
  if (rule.id) {
    const { error } = await supabase.from('automation_rules').update({ ...row, updated_at: new Date().toISOString() }).eq('id', rule.id);
    return error ? null : rule.id;
  }
  const { data, error } = await supabase.from('automation_rules').insert(row).select('id').single();
  return error || !data ? null : data.id;
}

export async function deleteAutomationRule(id: string): Promise<boolean> {
  const { error } = await supabase.from('automation_rules').delete().eq('id', id);
  return !error;
}

/**
 * Récupère les métriques du studio connecté (ou métriques démo si visiteur non connecté)
 */
export async function getLiveStudioMetrics(): Promise<StudioMetrics> {
  const empty: StudioMetrics = { totalRevenue: 0, ordersDelivered: 0, ordersActive: 0, adLeadsCount: 0, conversionRate: 0, currency: 'FCFA' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    // Visiteur ou nouveau studio : métriques initialisées à zéro
    if (!session?.user) return empty;

    // Utilisateur connecté : métriques STRICTEMENT isolées à son studio (RLS)
    const [balanceRes, ordersRes, convRes] = await Promise.all([
      supabase.from('revenue_opening_balances').select('amount_cents').limit(1).maybeSingle(),
      supabase.from('orders').select('amount_cents, status').order('created_at', { ascending: false }).limit(ORDER_LIMIT),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
    ]);

    const opening = balanceRes.data?.amount_cents ? Number(balanceRes.data.amount_cents) / 100 : 0;
    let ordersSum = 0;
    let deliveredCount = 0;
    let activeCount = 0;
    for (const order of ordersRes.data || []) {
      const amt = Number(order.amount_cents || 0) / 100;
      if (order.status === 'delivered') {
        ordersSum += amt;
        deliveredCount++;
      } else if (order.status === 'validated' || order.status === 'pending') {
        ordersSum += amt;
        activeCount++;
      }
    }

    // Conversion : commandes payées ou livrées rapportées aux discussions ouvertes (briefs)
    const briefs = convRes.count ?? 0;
    const paid = deliveredCount + (ordersRes.data || []).filter(o => o.status === 'validated').length;
    return {
      totalRevenue: opening + ordersSum,
      ordersDelivered: deliveredCount,
      ordersActive: activeCount,
      adLeadsCount: briefs,
      conversionRate: briefs > 0 ? Math.round((Math.min(paid, briefs) / briefs) * 1000) / 10 : 0,
      currency: 'FCFA',
    };
  } catch {
    return empty;
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
      .order('created_at', { ascending: false })
      .limit(ORDER_LIMIT);

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

/**
 * Récupère les messages d'une conversation spécifique (ou de toutes les conversations récentes)
 */
export async function getLiveMessages(conversationId?: string): Promise<any[]> {
  try {
    let query = supabase
      .from('messages')
      .select('id, role, direction, body, created_at, conversation_id, conversations(contact_id, contacts(name, phone))')
      .order('created_at', { ascending: false });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    // Les 50 plus récents, rendus dans l'ordre chronologique
    const { data, error } = await query.limit(50);
    if (error || !data) return [];
    return data.reverse();
  } catch {
    return [];
  }
}

/**
 * Recherche multi-tables sécurisée par RLS pour le Copilot IA (contacts, commandes, conversations)
 */
export async function searchStudioData(term: string): Promise<{
  contacts: any[];
  orders: any[];
  conversations: any[];
  messages: any[];
}> {
  // Filtrage côté Postgres (ilike) et résultats bornés : jamais de téléchargement de tables entières.
  // Les caractères réservés de la syntaxe PostgREST (virgule, parenthèses) sont neutralisés.
  const clean = term.trim().replace(/[%_,()*"\\]/g, ' ').replace(/\s+/g, ' ').slice(0, 60);
  const empty = { contacts: [], orders: [], conversations: [], messages: [] };
  if (clean.length < 2) return empty;
  const like = `%${clean}%`;
  try {
    const [contactsRes, convsRes, msgsRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, name, phone, occasion, price_quoted_cents, notes, created_at')
        .or(`name.ilike.${like},phone.ilike.${like},occasion.ilike.${like},notes.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('conversations')
        .select('id, funnel_stage, summary, last_message_at, contacts(id, name, phone, occasion)')
        .ilike('summary', like)
        .order('last_message_at', { ascending: false })
        .limit(20),
      supabase
        .from('messages')
        .select('id, role, direction, body, created_at, conversation_id')
        .ilike('body', like)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const contacts = contactsRes.data || [];
    const contactIds = contacts.map(c => c.id).slice(0, 20);

    // Conversations et commandes des contacts trouvés par nom / téléphone
    const [convByContact, ordersRes] = contactIds.length
      ? await Promise.all([
          supabase
            .from('conversations')
            .select('id, funnel_stage, summary, last_message_at, contacts(id, name, phone, occasion)')
            .in('contact_id', contactIds)
            .order('last_message_at', { ascending: false })
            .limit(20),
          supabase
            .from('orders')
            .select('id, amount_cents, currency, status, payment_method, notes, created_at, contacts(name, phone, occasion)')
            .in('contact_id', contactIds)
            .order('created_at', { ascending: false })
            .limit(20),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }];

    const convs = new Map<string, any>();
    for (const c of [...(convByContact.data || []), ...(convsRes.data || [])]) convs.set(c.id, c);

    return {
      contacts,
      orders: ordersRes.data || [],
      conversations: [...convs.values()],
      messages: msgsRes.data || [],
    };
  } catch {
    return empty;
  }
}

export type StudioLiveTable = 'messages' | 'conversations' | 'orders' | 'automation_rules' | 'contacts';

/**
 * Abonnement Realtime Supabase aux tables du studio (RLS appliquée côté serveur).
 * Retourne la fonction de désabonnement.
 */
export function subscribeStudioRealtime(
  tables: StudioLiveTable[],
  onChange: (table: StudioLiveTable) => void
): () => void {
  let channel = supabase.channel(`studio-live-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`);
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(table));
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Recherche une conversation complète par numéro de téléphone (fragment accepté : +226…, 07…, 5835…)
 * Compare sur les chiffres uniquement, avec ou sans indicatif.
 */
export async function findConversationByPhone(fragment: string): Promise<{
  contact: any | null;
  conversation: any | null;
  messages: any[];
  orders: any[];
}> {
  const digits = fragment.replace(/\D/g, '');
  const empty = { contact: null, conversation: null, messages: [], orders: [] };
  if (digits.length < 4) return empty;
  try {
    // Pré-filtre Postgres sur les 4 derniers chiffres (les numéros peuvent contenir des espaces)
    const tail = digits.slice(-4);
    const tailPattern = `%${tail.split('').join('%')}%`;
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, phone, occasion, price_quoted_cents, notes, created_at')
      .ilike('phone', tailPattern)
      .limit(200);
    const contact = (contacts || []).find((c: any) => phoneMatches(c.phone, digits)) || null;
    if (!contact) return empty;

    const [convRes, ordersRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, funnel_stage, summary, last_message_at')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id, amount_cents, status, payment_method, created_at')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false }),
    ]);

    const conversation = convRes.data || null;
    const messages = conversation ? await getLiveMessages(conversation.id) : [];
    return { contact, conversation, messages, orders: ordersRes.data || [] };
  } catch {
    return empty;
  }
}

/**
 * Compare deux numéros sur leurs chiffres : correspondance si l'un contient l'autre
 * (gère l'indicatif +225 / +226 et les numéros locaux 07…).
 */
export function phoneMatches(phone: string | null | undefined, digits: string): boolean {
  if (!phone || !digits) return false;
  const p = phone.replace(/\D/g, '');
  if (!p) return false;
  if (p.includes(digits)) return true;
  // Numéro local avec 0 initial (ex. 07 88 12 43) contre numéro international
  const local = digits.replace(/^0+/, '');
  return local.length >= 4 && p.includes(local);
}

/**
 * Enregistre un message sortant dans Supabase pour garder l'historique synchrone
 */
export async function recordOutboundMessage(conversationId: string, body: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      direction: 'outbound',
      body: body,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Met à jour le statut d'archivage d'une conversation dans Supabase (diffusion Realtime immédiate)
 */
export async function updateConversationArchiveStatus(conversationId: string, isArchived: boolean): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('conversations')
      .select('ack_log')
      .eq('id', conversationId)
      .maybeSingle();

    const ackLog = (current?.ack_log as Record<string, unknown>) || {};
    const updatedAckLog = {
      ...ackLog,
      archived: isArchived,
      archived_at: isArchived ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from('conversations')
      .update({ ack_log: updatedAckLog, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return !error;
  } catch (err) {
    console.error('Error updating conversation archive status:', err);
    return false;
  }
}

/**
 * Met à jour le statut de lecture d'une conversation dans Supabase (diffusion Realtime immédiate)
 */
export async function updateConversationReadStatus(conversationId: string, unread: boolean): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('conversations')
      .select('ack_log')
      .eq('id', conversationId)
      .maybeSingle();

    const ackLog = (current?.ack_log as Record<string, unknown>) || {};
    const updatedAckLog = {
      ...ackLog,
      unread: unread,
      last_read_at: unread ? null : new Date().toISOString(),
    };

    const { error } = await supabase
      .from('conversations')
      .update({ ack_log: updatedAckLog, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return !error;
  } catch (err) {
    console.error('Error updating conversation read status:', err);
    return false;
  }
}


