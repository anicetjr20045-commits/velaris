-- Migration 20261009 — CORRECTIF M3 : crée la RPC agent_set_chat_archived manquante.
--
-- Utilisée par :
--   - le webhook WAHA `chat.archive` (engine/src/ingest/process-event.ts)
--   - l'endpoint HTTP /api/chat-archive (engine/src/ingest/http.ts)
-- Avant ce correctif, les deux appelants échouaient silencieusement (RPC inexistante).
-- L'état d'archivage est persisté dans conversations.ack_log, sans toucher au reste.

CREATE OR REPLACE FUNCTION public.agent_set_chat_archived(
  p_phone TEXT, p_archived BOOLEAN
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone TEXT := NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_count INT := 0;
BEGIN
  IF v_phone IS NULL THEN RETURN 'invalid_phone'; END IF;
  UPDATE public.conversations
     SET ack_log = ack_log || jsonb_build_object('archived', p_archived, 'archived_at', now())
   WHERE regexp_replace(COALESCE(chat_id, ''), '[^0-9]', '', 'g') LIKE '%' || v_phone || '%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN 'ok:' || v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.agent_set_chat_archived(TEXT, BOOLEAN) TO service_role;
