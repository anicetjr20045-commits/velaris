/**
 * Service de purge et réinitialisation chirurgicale d'un contact de test.
 * Permet au marchand d'effacer instantanément toute trace (messages, brief,
 * commandes, mémoire et état de discussion) pour recommencer un test à blanc
 * en conditions réelles sur WhatsApp.
 */

import type { RestDb } from '../db/rest.js';

export interface ResetClientResult {
  ok: boolean;
  identifier: string;
  cleanPhone: string;
  deletedContacts: number;
  deletedConversations: number;
  deletedMessages: number;
  deletedOrders: number;
  deletedTurns: number;
  deletedEvents: number;
  error?: string;
}

export async function resetTestClient(db: RestDb, identifier: string): Promise<ResetClientResult> {
  const trimmed = identifier.trim();
  const cleanPhone = trimmed.replace(/\D/g, '');

  if (!trimmed && !cleanPhone) {
    return {
      ok: false,
      identifier,
      cleanPhone: '',
      deletedContacts: 0,
      deletedConversations: 0,
      deletedMessages: 0,
      deletedOrders: 0,
      deletedTurns: 0,
      deletedEvents: 0,
      error: 'Identifiant vide',
    };
  }

  try {
    // 1. Recherche des contacts cibles
    const contactFilters: string[] = [];
    if (trimmed.includes('-') && trimmed.length === 36) {
      contactFilters.push(`id.eq.${trimmed}`);
    }
    contactFilters.push(`wa_jid.eq.${trimmed}`);
    if (cleanPhone) {
      contactFilters.push(`phone.eq.${cleanPhone}`);
      contactFilters.push(`wa_jid.like.*${cleanPhone}*`);
      contactFilters.push(`phone.like.*${cleanPhone}*`);
    }

    const contactQuery = `or=(${contactFilters.join(',')})&select=id,name,phone,wa_jid`;
    const contacts = await db.queryTable<Array<{ id: string; name: string | null; phone: string | null; wa_jid: string | null }>>(
      'contacts',
      contactQuery,
    ).catch(() => []);

    const contactIds = Array.from(new Set(contacts.map((c) => c.id)));

    // 2. Recherche des conversations cibles
    const convFilters: string[] = [];
    if (contactIds.length > 0) {
      convFilters.push(`contact_id.in.(${contactIds.join(',')})`);
    }
    convFilters.push(`chat_id.eq.${trimmed}`);
    if (cleanPhone) {
      convFilters.push(`chat_id.like.*${cleanPhone}*`);
    }

    const convQuery = `or=(${convFilters.join(',')})&select=id,chat_id`;
    const convs = await db.queryTable<Array<{ id: string; chat_id: string }>>(
      'conversations',
      convQuery,
    ).catch(() => []);

    const convIds = Array.from(new Set(convs.map((c) => c.id)));

    let deletedOrders = 0;
    let deletedTurns = 0;
    let deletedMessages = 0;
    let deletedConversations = 0;
    let deletedContacts = 0;
    let deletedEvents = 0;

    // 3. Suppression des commandes (orders)
    const orderFilters: string[] = [];
    if (convIds.length > 0) orderFilters.push(`conversation_id.in.(${convIds.join(',')})`);
    if (contactIds.length > 0) orderFilters.push(`contact_id.in.(${contactIds.join(',')})`);

    if (orderFilters.length > 0) {
      const oQuery = orderFilters.length > 1 ? `or=(${orderFilters.join(',')})` : orderFilters[0]!;
      const delO = await db.deleteRows<Array<{ id: string }>>('orders', oQuery).catch(() => []);
      deletedOrders = delO.length;
    }

    // 4. Suppression des tours, messages et conversations
    if (convIds.length > 0) {
      const inConvs = `conversation_id=in.(${convIds.join(',')})`;

      // Supprime les tours de file d'attente
      const delT = await db.deleteRows<Array<{ id: string }>>('conversation_turns', inConvs).catch(() => []);
      deletedTurns = delT.length;

      // Supprime les handoffs
      await db.deleteRows<Array<{ id: string }>>('handoffs', inConvs).catch(() => []);

      // Supprime les messages d'outbox
      await db.deleteRows<Array<{ id: string }>>('outbound_messages', inConvs).catch(() => []);

      // Supprime les messages
      const delM = await db.deleteRows<Array<{ id: string }>>('messages', inConvs).catch(() => []);
      deletedMessages = delM.length;

      // Supprime les conversations elles-mêmes
      const delC = await db.deleteRows<Array<{ id: string }>>('conversations', `id=in.(${convIds.join(',')})`).catch(() => []);
      deletedConversations = delC.length;
    }

    // 5. Suppression des contacts
    if (contactIds.length > 0) {
      const delCt = await db.deleteRows<Array<{ id: string }>>('contacts', `id=in.(${contactIds.join(',')})`).catch(() => []);
      deletedContacts = delCt.length;
    }

    // 6. Purge des inbound_events pour effacer la clé de déduplication (permet de renvoyer le même message immédiatement)
    if (cleanPhone) {
      const delEv = await db.deleteRows<Array<{ id: number }>>(
        'inbound_events',
        `or=(dedup_key.like.*${cleanPhone}*,payload->payload->>from.like.*${cleanPhone}*,payload->payload->>to.like.*${cleanPhone}*)`,
      ).catch(() => []);
      deletedEvents = delEv.length;
    }

    return {
      ok: true,
      identifier: trimmed,
      cleanPhone,
      deletedContacts,
      deletedConversations,
      deletedMessages,
      deletedOrders,
      deletedTurns,
      deletedEvents,
    };
  } catch (err: any) {
    return {
      ok: false,
      identifier: trimmed,
      cleanPhone,
      deletedContacts: 0,
      deletedConversations: 0,
      deletedMessages: 0,
      deletedOrders: 0,
      deletedTurns: 0,
      deletedEvents: 0,
      error: err.message || String(err),
    };
  }
}
