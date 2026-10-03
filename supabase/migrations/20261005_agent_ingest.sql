-- ============================================================================
-- VELARIS — INGESTION WHATSAPP ET BOÎTE D'ENVOI (fonctions atomiques)
-- Migration : 20261005_agent_ingest.sql   (après 20261004_agent_core.sql)
-- Référence : ARCHITECTURE_AGENT_DEFINITIVE.md (v2), § 7
--
-- Le moteur n'a accès à la base que par PostgREST (clé secrète). Chaque étape
-- d'ingestion est donc UNE fonction = UNE transaction = UN aller-retour réseau.
-- Remplace la logique de waha-bridge (suite de requêtes REST non atomiques).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Journal brut des événements (I2)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_record_inbound_event(
  p_session TEXT, p_event_type TEXT, p_dedup_key TEXT, p_payload JSONB, p_source TEXT DEFAULT 'webhook'
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO inbound_events (session_name, user_id, event_type, dedup_key, payload, source)
  VALUES (p_session, (SELECT w.user_id FROM wa_sessions w WHERE w.session_name = p_session),
          p_event_type, p_dedup_key, p_payload, p_source)
  ON CONFLICT (session_name, event_type, dedup_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;   -- NULL = doublon déjà reçu
END $$;

CREATE OR REPLACE FUNCTION public.agent_mark_inbound_event(p_id BIGINT, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE inbound_events SET status = p_status, reason = p_reason, processed_at = now() WHERE id = p_id;
$$;

-- ----------------------------------------------------------------------------
-- 2. Message (entrant, écho de nos envois, ou message tapé par le gérant)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_ingest_message(
  p_session       TEXT,
  p_chat_id       TEXT,
  p_from_me       BOOLEAN,
  p_wa_message_id TEXT,
  p_wa_key        TEXT,
  p_wa_timestamp  TIMESTAMPTZ,
  p_body          TEXT,
  p_media_kind    TEXT,
  p_media_path    TEXT,
  p_push_name     TEXT,
  p_body_hash     TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID; v_owner TEXT; v_contact UUID; v_conv UUID; v_msg UUID; v_out RECORD;
  v_quiet INT; v_wait INT; v_turn UUID; v_phone TEXT;
BEGIN
  SELECT w.user_id, w.engine_owner INTO v_user, v_owner FROM wa_sessions w WHERE w.session_name = p_session;
  IF v_user IS NULL THEN RETURN jsonb_build_object('outcome', 'unknown_session'); END IF;

  -- Sérialise la création contact/conversation pour ce client (verrou de transaction)
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || '|' || p_chat_id, 0));

  v_phone := CASE WHEN p_chat_id LIKE '%@c.us' THEN NULLIF(regexp_replace(split_part(p_chat_id, '@', 1), '[^0-9]', '', 'g'), '') END;
  SELECT c.id INTO v_contact FROM contacts c WHERE c.user_id = v_user AND c.wa_jid = p_chat_id LIMIT 1;
  IF v_contact IS NULL AND v_phone IS NOT NULL THEN
    SELECT c.id INTO v_contact FROM contacts c WHERE c.user_id = v_user AND c.phone = v_phone LIMIT 1;
    IF v_contact IS NOT NULL THEN UPDATE contacts SET wa_jid = p_chat_id WHERE id = v_contact AND wa_jid IS NULL; END IF;
  END IF;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (user_id, name, phone, wa_jid, source)
    VALUES (v_user, CASE WHEN p_from_me THEN NULL ELSE NULLIF(p_push_name, '') END, v_phone, p_chat_id, 'whatsapp')
    RETURNING id INTO v_contact;
  ELSIF NOT p_from_me AND NULLIF(p_push_name, '') IS NOT NULL THEN
    UPDATE contacts SET name = p_push_name, updated_at = now()
     WHERE id = v_contact AND (name IS NULL OR name = 'Client WhatsApp');
  END IF;

  SELECT cv.id INTO v_conv FROM conversations cv WHERE cv.user_id = v_user AND cv.contact_id = v_contact
   ORDER BY cv.created_at LIMIT 1;
  IF v_conv IS NULL THEN
    INSERT INTO conversations (user_id, contact_id, funnel_stage, session_name, chat_id, last_message_at)
    VALUES (v_user, v_contact, 'new', p_session, p_chat_id, now())
    RETURNING id INTO v_conv;
  ELSE
    UPDATE conversations SET session_name = p_session, chat_id = p_chat_id, last_message_at = now(), updated_at = now()
     WHERE id = v_conv;
  END IF;

  -- Message déjà connu (double livraison message / message.any, rattrapage) : rien d'autre
  IF p_wa_key IS NOT NULL AND EXISTS (SELECT 1 FROM messages m WHERE m.user_id = v_user AND m.wa_message_key = p_wa_key) THEN
    RETURN jsonb_build_object('outcome', 'duplicate', 'user_id', v_user, 'conversation_id', v_conv);
  END IF;

  IF p_from_me THEN
    -- Écho d'un de nos envois ? D'abord par identifiant, puis par empreinte du corps (I4)
    SELECT o.id, o.origin INTO v_out FROM outbound_messages o
     WHERE o.user_id = v_user AND p_wa_key IS NOT NULL AND o.wa_message_key = p_wa_key LIMIT 1;
    IF v_out.id IS NULL AND p_body_hash IS NOT NULL THEN
      SELECT o.id, o.origin INTO v_out FROM outbound_messages o
       WHERE o.session_name = p_session AND o.chat_id = p_chat_id AND o.body_hash = p_body_hash
         AND o.status IN ('sending','sent','unknown') AND o.created_at > now() - interval '10 minutes'
       ORDER BY o.created_at DESC LIMIT 1;
    END IF;

    IF v_out.id IS NOT NULL THEN
      UPDATE outbound_messages
         SET status = 'sent', sent_at = COALESCE(sent_at, now()),
             wa_message_id = COALESCE(wa_message_id, p_wa_message_id),
             wa_message_key = COALESCE(wa_message_key, p_wa_key)
       WHERE id = v_out.id;
      UPDATE messages SET wa_message_id = COALESCE(wa_message_id, p_wa_message_id),
                          wa_message_key = COALESCE(wa_message_key, p_wa_key),
                          wa_timestamp = COALESCE(wa_timestamp, p_wa_timestamp)
       WHERE outbox_id = v_out.id
      RETURNING id INTO v_msg;
      IF v_msg IS NULL THEN
        INSERT INTO messages (user_id, conversation_id, role, direction, body, media_kind, media_path,
                              wa_message_id, wa_message_key, wa_timestamp, outbox_id)
        VALUES (v_user, v_conv,
                CASE WHEN v_out.origin = 'merchant_ui' THEN 'human_agent' ELSE 'assistant' END,
                'outbound', p_body, p_media_kind, p_media_path, p_wa_message_id, p_wa_key, p_wa_timestamp, v_out.id)
        RETURNING id INTO v_msg;
      END IF;
      RETURN jsonb_build_object('outcome', 'echo', 'user_id', v_user, 'conversation_id', v_conv, 'message_id', v_msg);
    END IF;

    -- Message réellement tapé par le gérant : il prend la main (I5), avant tout envoi suivant de l'agent
    INSERT INTO messages (user_id, conversation_id, role, direction, body, media_kind, media_path,
                          wa_message_id, wa_message_key, wa_timestamp)
    VALUES (v_user, v_conv, 'human_agent', 'outbound', p_body, p_media_kind, p_media_path,
            p_wa_message_id, p_wa_key, p_wa_timestamp)
    RETURNING id INTO v_msg;
    UPDATE conversations SET last_merchant_at = now() WHERE id = v_conv;
    PERFORM agent_set_control(v_conv, 'human', 'merchant_reply', 'merchant');
    INSERT INTO handoffs (user_id, conversation_id, origin, reason)
    VALUES (v_user, v_conv, 'merchant', 'merchant_reply')
    ON CONFLICT (conversation_id) WHERE status = 'open' DO NOTHING;
    UPDATE outbound_messages SET status = 'cancelled', error = 'merchant_took_over'
     WHERE conversation_id = v_conv AND origin = 'agent' AND status IN ('pending','proposed');
    -- Lecture du message du gérant (§ 15) : dans la même file que la conversation
    IF v_owner = 'velaris_engine' THEN
      INSERT INTO conversation_turns (user_id, conversation_id, trigger, status, inbound_message_ids, ready_at)
      VALUES (v_user, v_conv, 'merchant_message', 'scheduled', ARRAY[v_msg], now())
      RETURNING id INTO v_turn;
    END IF;
    RETURN jsonb_build_object('outcome', 'merchant', 'user_id', v_user, 'conversation_id', v_conv,
                              'message_id', v_msg, 'turn_id', v_turn);
  END IF;

  -- Message du client
  INSERT INTO messages (user_id, conversation_id, role, direction, body, media_kind, media_path,
                        wa_message_id, wa_message_key, wa_timestamp, transcript_status)
  VALUES (v_user, v_conv, 'user', 'inbound', p_body, p_media_kind, p_media_path,
          p_wa_message_id, p_wa_key, p_wa_timestamp,
          CASE WHEN p_media_kind = 'audio' THEN 'pending' END)
  RETURNING id INTO v_msg;

  IF v_owner = 'velaris_engine' THEN
    SELECT COALESCE(sp.quiet_window_ms, 4000), COALESCE(sp.max_batch_wait_ms, 12000) INTO v_quiet, v_wait
      FROM (SELECT 1) one LEFT JOIN studio_personas sp ON sp.user_id = v_user;
    v_turn := agent_buffer_inbound(v_user, v_conv, v_msg, v_quiet, v_wait, p_media_kind = 'audio');
  ELSE
    UPDATE conversations SET last_inbound_at = now() WHERE id = v_conv;
  END IF;
  RETURN jsonb_build_object('outcome', 'inbound', 'user_id', v_user, 'conversation_id', v_conv,
                            'message_id', v_msg, 'turn_id', v_turn);
END $$;

-- ----------------------------------------------------------------------------
-- 3. Réaction du gérant (commande) — les réactions du client n'arrivent jamais ici
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_ingest_reaction(
  p_session TEXT, p_chat_id TEXT, p_reacted_key TEXT, p_emoji TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID; v_owner TEXT; v_conv UUID; v_cmd TEXT; v_turn UUID;
BEGIN
  SELECT w.user_id, w.engine_owner INTO v_user, v_owner FROM wa_sessions w WHERE w.session_name = p_session;
  IF v_user IS NULL THEN RETURN jsonb_build_object('outcome', 'unknown_session'); END IF;

  -- Conversation : par le message réagi, sinon par le correspondant
  SELECT m.conversation_id INTO v_conv FROM messages m
   WHERE m.user_id = v_user AND m.wa_message_key = p_reacted_key LIMIT 1;
  IF v_conv IS NULL THEN
    SELECT cv.id INTO v_conv FROM conversations cv JOIN contacts c ON c.id = cv.contact_id
     WHERE cv.user_id = v_user AND c.wa_jid = p_chat_id ORDER BY cv.created_at LIMIT 1;
  END IF;
  IF v_conv IS NULL THEN RETURN jsonb_build_object('outcome', 'conversation_not_found'); END IF;

  -- p_emoji arrive normalisé (sans sélecteur de variante ni teinte) ; on normalise les clés de la même façon
  SELECT kv.value INTO v_cmd
    FROM studio_personas sp, jsonb_each_text(sp.reaction_commands) kv
   WHERE sp.user_id = v_user AND replace(kv.key, U&'\FE0F', '') = p_emoji
   LIMIT 1;
  IF v_cmd IS NULL THEN
    RETURN jsonb_build_object('outcome', 'no_command', 'user_id', v_user, 'conversation_id', v_conv);
  END IF;
  IF v_owner <> 'velaris_engine' THEN
    RETURN jsonb_build_object('outcome', 'engine_not_owner', 'user_id', v_user, 'conversation_id', v_conv);
  END IF;

  INSERT INTO conversation_turns (user_id, conversation_id, trigger, status, trigger_data, ready_at)
  VALUES (v_user, v_conv, 'merchant_reaction', 'scheduled',
          jsonb_build_object('emoji', p_emoji, 'command', v_cmd, 'reacted_key', p_reacted_key), now())
  RETURNING id INTO v_turn;
  RETURN jsonb_build_object('outcome', 'command', 'command', v_cmd, 'user_id', v_user,
                            'conversation_id', v_conv, 'turn_id', v_turn);
END $$;

-- ----------------------------------------------------------------------------
-- 4. Statut de session (écriture seulement au changement)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_ingest_session_status(p_session TEXT, p_waha_status TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev TEXT; v_new TEXT; v_user UUID;
BEGIN
  v_new := CASE upper(COALESCE(p_waha_status, ''))
             WHEN 'WORKING' THEN 'connected'
             WHEN 'SCAN_QR_CODE' THEN 'scanning'
             WHEN 'STARTING' THEN 'connecting'
             WHEN 'FAILED' THEN 'failed'
             ELSE 'disconnected' END;
  SELECT w.status, w.user_id INTO v_prev, v_user FROM wa_sessions w WHERE w.session_name = p_session FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'unknown_session'); END IF;
  IF v_prev IS DISTINCT FROM v_new OR (v_new = 'connected' AND p_phone IS NOT NULL) THEN
    UPDATE wa_sessions
       SET status = v_new, updated_at = now(),
           phone_number = COALESCE(NULLIF(p_phone, ''), phone_number),
           last_seen_at = CASE WHEN v_new = 'connected' THEN now() ELSE last_seen_at END
     WHERE session_name = p_session;
  END IF;
  RETURN jsonb_build_object('outcome', 'ok', 'previous', v_prev, 'current', v_new, 'user_id', v_user);
END $$;

-- ----------------------------------------------------------------------------
-- 5. Fin d'un envoi (boîte d'envoi → historique des messages)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_finish_send(
  p_outbox UUID, p_status TEXT, p_wa_message_id TEXT DEFAULT NULL, p_wa_key TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL, p_retry_in_seconds INT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; v_msg UUID;
BEGIN
  SELECT * INTO o FROM outbound_messages WHERE id = p_outbox FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  -- L'écho WhatsApp arrive souvent AVANT la réponse de WAHA : l'envoi est déjà 'sent'.
  -- On complète seulement les identifiants manquants, sans second message.
  IF o.status = 'sent' AND p_status = 'sent' THEN
    UPDATE outbound_messages
       SET wa_message_id = COALESCE(wa_message_id, p_wa_message_id), wa_message_key = COALESCE(wa_message_key, p_wa_key)
     WHERE id = p_outbox;
    RETURN 'already_sent';
  END IF;
  IF o.status <> 'sending' THEN RETURN 'not_sending'; END IF;

  IF p_status = 'sent' THEN
    UPDATE outbound_messages
       SET status = 'sent', sent_at = now(), error = NULL,
           wa_message_id = COALESCE(p_wa_message_id, wa_message_id), wa_message_key = COALESCE(p_wa_key, wa_message_key)
     WHERE id = p_outbox;
    IF o.conversation_id IS NOT NULL THEN
      -- L'écho a pu arriver avant la réponse de WAHA : on complète sa ligne au lieu d'en créer une seconde
      UPDATE messages SET outbox_id = p_outbox
       WHERE user_id = o.user_id AND p_wa_key IS NOT NULL AND wa_message_key = p_wa_key
      RETURNING id INTO v_msg;
      IF v_msg IS NULL THEN
        SELECT id INTO v_msg FROM messages WHERE outbox_id = p_outbox LIMIT 1;
      END IF;
      IF v_msg IS NULL THEN
        INSERT INTO messages (user_id, conversation_id, role, direction, body, media_path, wa_message_id, wa_message_key, outbox_id, turn_id)
        VALUES (o.user_id, o.conversation_id,
                CASE WHEN o.origin = 'merchant_ui' THEN 'human_agent' WHEN o.origin = 'system_alert' THEN 'system' ELSE 'assistant' END,
                'outbound', COALESCE(o.body, o.caption), o.media_path, p_wa_message_id, p_wa_key, p_outbox, o.turn_id);
      END IF;
      IF o.origin = 'agent' THEN
        UPDATE conversations SET last_agent_outbound_at = now(), last_message_at = now() WHERE id = o.conversation_id;
      END IF;
    END IF;
    RETURN 'ok';
  ELSIF p_status = 'unknown' THEN
    -- Délai dépassé : le message a pu partir. Jamais de nouvel essai ; l'écho tranchera.
    UPDATE outbound_messages SET status = 'unknown', error = p_error WHERE id = p_outbox;
    RETURN 'ok';
  ELSIF p_status = 'retry' THEN
    IF o.attempts >= 3 THEN
      UPDATE outbound_messages SET status = 'failed', error = p_error WHERE id = p_outbox;
      RETURN 'failed';
    END IF;
    UPDATE outbound_messages
       SET status = 'pending', error = p_error,
           not_before = now() + make_interval(secs => GREATEST(COALESCE(p_retry_in_seconds, 5), 1))
     WHERE id = p_outbox;
    RETURN 'ok';
  ELSIF p_status = 'failed' THEN
    UPDATE outbound_messages SET status = 'failed', error = p_error WHERE id = p_outbox;
    RETURN 'ok';
  END IF;
  RAISE EXCEPTION 'agent_finish_send: statut invalide %', p_status;
END $$;

-- Mise en boîte d'envoi idempotente (la clé d'idempotence rend un double appel sans effet)
CREATE OR REPLACE FUNCTION public.agent_enqueue_outbox(
  p_user UUID, p_conversation UUID, p_order UUID, p_turn UUID, p_origin TEXT, p_kind TEXT, p_purpose TEXT,
  p_is_relay BOOLEAN, p_session TEXT, p_chat_id TEXT, p_body TEXT, p_media_path TEXT, p_caption TEXT,
  p_body_hash TEXT, p_idempotency_key TEXT, p_lock_token BIGINT, p_status TEXT DEFAULT 'pending',
  p_not_before TIMESTAMPTZ DEFAULT now(), p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF p_status NOT IN ('pending','proposed') THEN RAISE EXCEPTION 'agent_enqueue_outbox: statut initial invalide %', p_status; END IF;
  INSERT INTO outbound_messages (user_id, conversation_id, order_id, turn_id, origin, kind, purpose, is_relay,
                                 session_name, chat_id, body, media_path, caption, body_hash, idempotency_key,
                                 lock_token, status, not_before, expires_at)
  VALUES (p_user, p_conversation, p_order, p_turn, p_origin, p_kind, p_purpose, COALESCE(p_is_relay, FALSE),
          p_session, p_chat_id, p_body, p_media_path, p_caption, p_body_hash, p_idempotency_key,
          p_lock_token, p_status, COALESCE(p_not_before, now()), p_expires_at)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM outbound_messages WHERE idempotency_key = p_idempotency_key; END IF;
  RETURN v_id;
END $$;

-- Envois à traiter (le moteur lit la file par PostgREST via cette fonction, bornée)
CREATE OR REPLACE FUNCTION public.agent_pending_outbox(p_limit INT DEFAULT 20)
RETURNS SETOF public.outbound_messages
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM outbound_messages
   WHERE status = 'pending' AND not_before <= now()
   ORDER BY not_before, created_at
   LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

-- Événements restés 'received' (processus interrompu) : à retraiter
CREATE OR REPLACE FUNCTION public.agent_stale_inbound_events(p_older_than_seconds INT DEFAULT 10, p_limit INT DEFAULT 50)
RETURNS SETOF public.inbound_events
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM inbound_events
   WHERE status = 'received' AND received_at < now() - make_interval(secs => p_older_than_seconds)
   ORDER BY received_at
   LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

-- ----------------------------------------------------------------------------
-- 6. Droits : moteur uniquement (service_role)
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.agent_record_inbound_event(TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_mark_inbound_event(BIGINT,TEXT,TEXT)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_ingest_message(TEXT,TEXT,BOOLEAN,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_ingest_reaction(TEXT,TEXT,TEXT,TEXT)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_ingest_session_status(TEXT,TEXT,TEXT)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_finish_send(UUID,TEXT,TEXT,TEXT,TEXT,INT)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_pending_outbox(INT)                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_enqueue_outbox(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_enqueue_outbox(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) TO service_role;
REVOKE ALL ON FUNCTION public.agent_stale_inbound_events(INT,INT)                  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.agent_record_inbound_event(TEXT,TEXT,TEXT,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_mark_inbound_event(BIGINT,TEXT,TEXT)           TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_ingest_message(TEXT,TEXT,BOOLEAN,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_ingest_reaction(TEXT,TEXT,TEXT,TEXT)           TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_ingest_session_status(TEXT,TEXT,TEXT)          TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_finish_send(UUID,TEXT,TEXT,TEXT,TEXT,INT)      TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_pending_outbox(INT)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_stale_inbound_events(INT,INT)                  TO service_role;

COMMIT;
