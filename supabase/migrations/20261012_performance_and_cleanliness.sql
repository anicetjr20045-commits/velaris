-- ============================================================================
-- VELARIS — OPTIMISATION DE PERFORMANCE, PROPRETÉ SUPABASE & HAUTE CHARGE
-- Migration : 20261012_performance_and_cleanliness.sql
-- ============================================================================

BEGIN;

-- 1. Index sur contacts pour accélérer l'ingestion et la déduplication
CREATE INDEX IF NOT EXISTS idx_contacts_user_wa_jid ON public.contacts (user_id, wa_jid);
CREATE INDEX IF NOT EXISTS idx_contacts_user_phone ON public.contacts (user_id, phone);

-- 2. Index sur conversations pour la résolution instantanée par contact et session
CREATE INDEX IF NOT EXISTS idx_conversations_user_contact ON public.conversations (user_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_chat_id ON public.conversations (user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_session ON public.conversations (session_name, chat_id);

-- 3. Index sur messages pour accélérer le chargement de l'historique et la déduplication
CREATE INDEX IF NOT EXISTS idx_messages_user_wa_key ON public.messages (user_id, wa_message_key);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_desc ON public.messages (conversation_id, created_at DESC);

-- 4. Nettoyage des événements bruts traités de plus de 7 jours (évite la saturation de la base)
-- NOTE : inbound_events utilise la colonne 'received_at' et non 'created_at'
CREATE OR REPLACE FUNCTION public.agent_cleanup_stale_events()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.inbound_events
   WHERE status = 'processed'
     AND received_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5. Procédure atomique pour réinitialiser un client de test (#reset) proprement en 1 seule transaction
CREATE OR REPLACE FUNCTION public.agent_reset_test_client(p_chat_id TEXT, p_phone TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conv_ids UUID[];
  v_contact_ids UUID[];
  v_orders_deleted INT := 0;
  v_messages_deleted INT := 0;
  v_turns_deleted INT := 0;
  v_clean_phone TEXT;
BEGIN
  v_clean_phone := COALESCE(p_phone, NULLIF(regexp_replace(p_chat_id, '[^0-9]', '', 'g'), ''));

  -- Récupération des IDs de contacts
  SELECT array_agg(id) INTO v_contact_ids
    FROM public.contacts
   WHERE wa_jid = p_chat_id
      OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      OR (v_clean_phone IS NOT NULL AND wa_jid LIKE '%' || v_clean_phone || '%');

  -- Récupération des conversations associées
  SELECT array_agg(id) INTO v_conv_ids
    FROM public.conversations
   WHERE chat_id = p_chat_id
      OR (v_contact_ids IS NOT NULL AND contact_id = ANY(v_contact_ids));

  IF v_conv_ids IS NOT NULL AND array_length(v_conv_ids, 1) > 0 THEN
    -- Supprimer les commandes associées
    DELETE FROM public.orders WHERE conversation_id = ANY(v_conv_ids);
    GET DIAGNOSTICS v_orders_deleted = ROW_COUNT;

    -- Supprimer les tours de conversation
    DELETE FROM public.conversation_turns WHERE conversation_id = ANY(v_conv_ids);
    GET DIAGNOSTICS v_turns_deleted = ROW_COUNT;

    -- Supprimer les handoffs
    DELETE FROM public.handoffs WHERE conversation_id = ANY(v_conv_ids);

    -- Supprimer les messages sortants en file
    DELETE FROM public.outbound_messages WHERE conversation_id = ANY(v_conv_ids);

    -- Supprimer l'historique des messages
    DELETE FROM public.messages WHERE conversation_id = ANY(v_conv_ids);
    GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;

    -- Supprimer les conversations
    DELETE FROM public.conversations WHERE id = ANY(v_conv_ids);
  END IF;

  IF v_contact_ids IS NOT NULL AND array_length(v_contact_ids, 1) > 0 THEN
    DELETE FROM public.contacts WHERE id = ANY(v_contact_ids);
  END IF;

  -- Déverrouiller la table d'ingestion brute pour autoriser un nouveau test immédiat
  IF v_clean_phone IS NOT NULL THEN
    DELETE FROM public.inbound_events
     WHERE dedup_key LIKE '%' || v_clean_phone || '%'
        OR (payload->'payload'->>'from') LIKE '%' || v_clean_phone || '%'
        OR (payload->'payload'->>'to') LIKE '%' || v_clean_phone || '%';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'orders_deleted', v_orders_deleted,
    'messages_deleted', v_messages_deleted,
    'turns_deleted', v_turns_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_cleanup_stale_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_reset_test_client(TEXT, TEXT) TO service_role;

COMMIT;
