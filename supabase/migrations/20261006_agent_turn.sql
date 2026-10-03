-- ============================================================================
-- VELARIS — BOUCLE DES TOURS (contexte, effets, journal, transcription, reprise)
-- Migration : 20261006_agent_turn.sql   (après 20261004 et 20261005)
-- Référence : ARCHITECTURE_AGENT_DEFINITIVE.md (v2), § 7.4 à § 7.6, § 11, § 14
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Contexte complet d'un tour, en une seule lecture
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_turn_context(p_turn UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; c RECORD; v JSONB;
BEGIN
  SELECT * INTO t FROM conversation_turns WHERE id = p_turn;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM conversations WHERE id = t.conversation_id;

  v := jsonb_build_object(
    'turn', jsonb_build_object('id', t.id, 'trigger', t.trigger, 'trigger_data', t.trigger_data,
                               'inbound_message_ids', to_jsonb(t.inbound_message_ids), 'lock_token', t.lock_token),
    'conversation', jsonb_build_object(
        'id', c.id, 'user_id', c.user_id, 'contact_id', c.contact_id, 'control_mode', c.control_mode,
        'control_reason', c.control_reason, 'control_actor', c.control_actor, 'focus_order_id', c.focus_order_id,
        'pending_question', c.pending_question, 'ack_log', c.ack_log, 'low_conf_streak', c.low_conf_streak,
        'repeat_question_count', c.repeat_question_count, 'discount_requests', c.discount_requests,
        'supersede_streak', c.supersede_streak, 'session_name', c.session_name, 'chat_id', c.chat_id,
        'last_merchant_at', c.last_merchant_at, 'last_inbound_at', c.last_inbound_at),
    'contact', (SELECT jsonb_build_object('name', ct.name, 'phone', ct.phone, 'wa_jid', ct.wa_jid)
                  FROM contacts ct WHERE ct.id = c.contact_id),
    'contact_facts', (SELECT to_jsonb(f) FROM agent_contact_facts(c.contact_id) f),
    'session_owner', (SELECT w.engine_owner FROM wa_sessions w WHERE w.session_name = c.session_name),
    'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'version', o.version, 'stage', o.stage, 'payment_status', o.payment_status,
        'catalogue_code', o.catalogue_code, 'price_xof', o.price_xof, 'deliverable', o.deliverable,
        'payment_policy', o.payment_policy, 'occasion', o.occasion, 'recipient_name', o.recipient_name,
        'recipient_name_confirmed', o.recipient_name_confirmed, 'recipient_relation', o.recipient_relation,
        'sender_name', o.sender_name, 'style', o.style, 'voice', o.voice, 'language', o.language,
        'memories_count', jsonb_array_length(o.memories), 'revision_count', o.revision_count,
        'payment_instructions_count', o.payment_instructions_count,
        'has_payment_deferral', o.payment_deferral IS NOT NULL,
        'lyrics_sent_at', o.lyrics_sent_at, 'stage_changed_at', o.stage_changed_at,
        'payment_instructions_at', o.payment_instructions_at, 'payment_confirmed_at', o.payment_confirmed_at,
        'photos_count', (SELECT count(*) FROM order_assets a WHERE a.order_id = o.id AND a.kind = 'photo'))
        ORDER BY o.created_at)
      FROM orders o WHERE o.conversation_id = c.id AND o.stage NOT IN ('delivered','closed','cancelled')), '[]'::jsonb),
    'persona', (SELECT to_jsonb(sp) FROM studio_personas sp WHERE sp.user_id = c.user_id),
    'catalogue', COALESCE((SELECT jsonb_agg(to_jsonb(sc) ORDER BY sc.sort_order, sc.price_xof)
                             FROM studio_catalogues sc WHERE sc.user_id = c.user_id AND sc.is_active), '[]'::jsonb),
    'step_policies', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM studio_step_policies p WHERE p.user_id = c.user_id), '[]'::jsonb),
    'templates', COALESCE((SELECT jsonb_object_agg(tp.key, tp.body) FROM studio_templates tp WHERE tp.user_id = c.user_id), '{}'::jsonb),
    'assets', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'purpose', a.purpose,
                          'occasion', a.occasion, 'storage_path', a.storage_path, 'caption', a.caption))
                         FROM studio_assets a WHERE a.user_id = c.user_id AND a.is_active), '[]'::jsonb),
    'handoff', (SELECT jsonb_build_object('id', h.id, 'origin', h.origin, 'reason', h.reason,
                         'ack_sent', h.ack_sent_at IS NOT NULL, 'relay_log', h.relay_log, 'opened_at', h.opened_at)
                  FROM handoffs h WHERE h.conversation_id = c.id AND h.status = 'open'),
    'inbound', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'transcript', m.transcript,
                            'transcript_status', m.transcript_status, 'media_kind', m.media_kind, 'media_path', m.media_path,
                            'role', m.role) ORDER BY COALESCE(m.wa_timestamp, m.created_at), m.created_at)
                          FROM messages m WHERE m.id = ANY (t.inbound_message_ids)), '[]'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'at') FROM (
                          SELECT jsonb_build_object('role', m.role, 'text', COALESCE(m.transcript, m.body), 'media_kind', m.media_kind,
                                                    'at', m.created_at) AS x
                            FROM messages m WHERE m.conversation_id = c.id AND NOT (m.id = ANY (t.inbound_message_ids))
                           ORDER BY m.created_at DESC LIMIT 10) r), '[]'::jsonb),
    'agent_msgs_last_hour', (SELECT count(*) FROM outbound_messages o
                              WHERE o.conversation_id = c.id AND o.origin = 'agent'
                                AND o.status IN ('sending','sent','unknown') AND o.sending_at > now() - interval '1 hour'),
    'recent_agent_bodies', COALESCE((SELECT jsonb_agg(o.body) FROM outbound_messages o
                              WHERE o.conversation_id = c.id AND o.origin = 'agent' AND o.body IS NOT NULL
                                AND o.status IN ('pending','sending','sent','unknown','proposed')
                                AND o.created_at > now() - interval '24 hours'), '[]'::jsonb),
    'now', now()
  );
  RETURN v;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Effets sur la conversation (liste fermée)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_conversation_effect(p_conversation UUID, p_kind TEXT, p_data JSONB DEFAULT '{}')
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; v_reason TEXT; v_exp TIMESTAMPTZ; v_mins INT; v_r TEXT;
BEGIN
  SELECT id, user_id INTO c FROM conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  CASE p_kind
  WHEN 'handoff' THEN
    v_reason := p_data->>'reason';
    -- Une prise de main du gérant reste la sienne : l'agent ne la remplace jamais par sa propre passation
    IF EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation AND control_mode = 'human' AND control_actor = 'merchant') THEN
      RETURN 'merchant_already_in_control';
    END IF;
    SELECT agent_handoff_expiry_minutes INTO v_mins FROM studio_personas WHERE user_id = c.user_id;
    v_exp := CASE WHEN v_mins IS NOT NULL AND v_reason IN ('ask_human','low_confidence','loop','discount','out_of_catalogue','guard_failure')
                  THEN now() + make_interval(mins => v_mins) END;
    v_r := agent_set_control(p_conversation, 'human', 'handoff:' || v_reason, 'agent', v_exp);
    INSERT INTO handoffs (user_id, conversation_id, origin, reason, detail)
    VALUES (c.user_id, p_conversation, 'agent', v_reason, p_data->>'detail')
    ON CONFLICT (conversation_id) WHERE status = 'open' DO NOTHING;
    UPDATE conversation_turns SET status = 'cancelled', outcome = 'handoff', finished_at = now()
     WHERE conversation_id = p_conversation AND status = 'scheduled' AND trigger = 'followup';
    RETURN v_r;
  WHEN 'close' THEN
    v_r := agent_set_control(p_conversation, 'closed', 'stop_request', 'agent');
    UPDATE conversation_turns SET status = 'cancelled', outcome = 'closed', finished_at = now()
     WHERE conversation_id = p_conversation AND status = 'scheduled';
    RETURN v_r;
  WHEN 'resume' THEN
    RETURN agent_set_control(p_conversation, 'ai', 'merchant_return', 'merchant');
  WHEN 'handoff_ack_sent' THEN
    UPDATE handoffs SET ack_sent_at = now() WHERE conversation_id = p_conversation AND status = 'open' AND ack_sent_at IS NULL;
  WHEN 'mark_ack' THEN
    UPDATE conversations SET ack_log = ack_log || jsonb_build_object(p_data->>'key', now()) WHERE id = p_conversation;
  WHEN 'mark_relay' THEN
    UPDATE handoffs SET relay_log = relay_log || jsonb_build_object(p_data->>'key', now())
     WHERE conversation_id = p_conversation AND status = 'open';
  WHEN 'bump_counter' THEN
    IF p_data->>'counter' = 'discount_requests' THEN
      UPDATE conversations SET discount_requests = discount_requests + 1 WHERE id = p_conversation;
    ELSIF p_data->>'counter' = 'repeat_question_count' THEN
      UPDATE conversations SET repeat_question_count = repeat_question_count + 1 WHERE id = p_conversation;
    ELSE RETURN 'unknown_counter'; END IF;
  WHEN 'reset_repeat' THEN
    UPDATE conversations SET repeat_question_count = 0 WHERE id = p_conversation;
  WHEN 'pending_question' THEN
    UPDATE conversations SET pending_question = CASE WHEN jsonb_typeof(p_data->'question') = 'object' THEN p_data->'question' END
     WHERE id = p_conversation;
  WHEN 'low_conf_streak' THEN
    UPDATE conversations SET low_conf_streak = GREATEST(0, LEAST(10, (p_data->>'value')::int)) WHERE id = p_conversation;
  WHEN 'focus_order' THEN
    UPDATE conversations SET focus_order_id = (p_data->>'order_id')::uuid WHERE id = p_conversation;
  WHEN 'schedule_followup' THEN
    IF NOT EXISTS (SELECT 1 FROM conversation_turns WHERE conversation_id = p_conversation AND status = 'scheduled' AND trigger = 'followup') THEN
      INSERT INTO conversation_turns (user_id, conversation_id, trigger, status, trigger_data, ready_at)
      VALUES (c.user_id, p_conversation, 'followup', 'scheduled', p_data - 'at', (p_data->>'at')::timestamptz);
    END IF;
  ELSE
    RETURN 'unknown_effect';
  END CASE;
  RETURN 'ok';
END $$;

-- ----------------------------------------------------------------------------
-- 3. Effets sur une commande hors transitions (liste fermée ; version incrémentée)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_order_effect(p_order UUID, p_expected_version INT, p_kind TEXT, p_data JSONB DEFAULT '{}')
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD;
BEGIN
  SELECT id, version INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  CASE p_kind
  WHEN 'payment_deferral' THEN
    UPDATE orders SET payment_deferral = p_data || jsonb_build_object('at', now()) WHERE id = p_order;
  WHEN 'change_request' THEN
    UPDATE orders SET change_requests = change_requests || jsonb_build_array(p_data || jsonb_build_object('at', now())) WHERE id = p_order;
  WHEN 'own_lyrics' THEN
    UPDATE orders SET client_own_lyrics = p_data->>'text' WHERE id = p_order;
  WHEN 'lyrics' THEN
    UPDATE orders SET lyrics = p_data->>'text', lyrics_message_id = (p_data->>'message_id')::uuid,
                      lyrics_source = COALESCE(p_data->>'source', 'merchant_whatsapp') WHERE id = p_order;
  WHEN 'payment_claim' THEN
    UPDATE orders SET payment_claim_message_id = COALESCE((p_data->>'message_id')::uuid, payment_claim_message_id) WHERE id = p_order;
  ELSE
    RETURN 'unknown_effect';
  END CASE;
  UPDATE orders SET version = version + 1 WHERE id = p_order;
  RETURN 'ok';
END $$;

-- ----------------------------------------------------------------------------
-- 4. Supersession : les messages du tour rejoignent le tampon suivant (§ 7.6)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_supersede_turn(p_turn UUID, p_conversation UUID, p_token BIGINT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD;
BEGIN
  SELECT * INTO t FROM conversation_turns WHERE id = p_turn AND lock_token = p_token AND status = 'running' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_running'; END IF;
  UPDATE conversation_turns
     SET inbound_message_ids = t.inbound_message_ids || (SELECT array_agg(x) FROM unnest(inbound_message_ids) x WHERE NOT (x = ANY (t.inbound_message_ids))),
         first_event_at = LEAST(first_event_at, t.first_event_at)
   WHERE conversation_id = p_conversation AND status = 'collecting';
  UPDATE conversations SET supersede_streak = supersede_streak + 1 WHERE id = p_conversation;
  PERFORM agent_finish_turn(p_turn, p_conversation, p_token, 'superseded', 'newer_inbound');
  RETURN 'ok';
END $$;

-- ----------------------------------------------------------------------------
-- 5. Reprise des tours interrompus (§ 7.5) : jamais de régénération après un envoi possible
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_recover_stale_turns()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; n INT := 0;
BEGIN
  FOR t IN
    SELECT ct.* FROM conversation_turns ct
     WHERE ct.status = 'running'
       AND NOT EXISTS (SELECT 1 FROM automation_locks l
                        WHERE l.conversation_id = ct.conversation_id AND l.token = ct.lock_token AND l.lease_until > now())
     FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM automation_locks WHERE conversation_id = t.conversation_id AND token = t.lock_token;
    IF EXISTS (SELECT 1 FROM outbound_messages o WHERE o.turn_id = t.id AND o.status IN ('sending','sent','unknown')) THEN
      UPDATE conversation_turns SET status = 'failed', outcome = 'crashed_after_send', finished_at = now() WHERE id = t.id;
      PERFORM agent_conversation_effect(t.conversation_id, 'handoff', jsonb_build_object('reason', 'agent_crash'));
    ELSIF EXISTS (SELECT 1 FROM conversation_turns x WHERE x.conversation_id = t.conversation_id AND x.status = 'collecting') THEN
      UPDATE conversation_turns
         SET inbound_message_ids = t.inbound_message_ids || (SELECT COALESCE(array_agg(y), '{}') FROM unnest(inbound_message_ids) y WHERE NOT (y = ANY (t.inbound_message_ids)))
       WHERE conversation_id = t.conversation_id AND status = 'collecting';
      UPDATE conversation_turns SET status = 'superseded', outcome = 'recovered_merged', finished_at = now() WHERE id = t.id;
    ELSE
      UPDATE outbound_messages SET status = 'cancelled', error = 'turn_recovered' WHERE turn_id = t.id AND status IN ('pending','proposed');
      UPDATE conversation_turns SET status = 'collecting', lock_token = NULL, started_at = NULL, ready_at = now()
       WHERE id = t.id;
    END IF;
    n := n + 1;
  END LOOP;
  -- Passations de l'agent arrivées à expiration : retour à l'agent, seulement si le gérant n'a rien écrit
  UPDATE conversations cv SET control_mode = 'ai', control_reason = 'handoff_expired', control_actor = 'system',
         control_set_at = now(), control_expires_at = NULL
   WHERE cv.control_mode = 'human' AND cv.control_actor = 'agent'
     AND cv.control_expires_at IS NOT NULL AND cv.control_expires_at < now()
     AND (cv.last_merchant_at IS NULL OR cv.last_merchant_at < cv.control_set_at);
  RETURN n;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Transcription d'un vocal et journal des tours
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agent_set_transcript(p_message UUID, p_transcript TEXT, p_status TEXT, p_media_path TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('done','failed') THEN RAISE EXCEPTION 'agent_set_transcript: statut invalide %', p_status; END IF;
  UPDATE messages SET transcript = NULLIF(trim(p_transcript), ''), transcript_status = p_status,
                      media_path = COALESCE(p_media_path, media_path)
   WHERE id = p_message;
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.agent_log_turn(p JSONB)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO agent_turn_logs (turn_id, user_id, conversation_id, policy_version, orders_before, understanding,
                               target_resolution, decision, actions, draft, guard_results, final_outbox_ids,
                               outcome, models, tokens, latency_ms)
  VALUES ((p->>'turn_id')::uuid, (p->>'user_id')::uuid, (p->>'conversation_id')::uuid, COALESCE(p->>'policy_version', 'v0'),
          p->'orders_before', p->'understanding', p->'target_resolution', p->'decision', p->'actions', p->'draft',
          p->'guard_results',
          COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p->'final_outbox_ids', '[]'::jsonb)) x), '{}'),
          COALESCE(p->>'outcome', 'unknown'), p->'models', p->'tokens', (p->>'latency_ms')::int);
$$;

-- ----------------------------------------------------------------------------
-- 7. Droits
-- ----------------------------------------------------------------------------

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.agent_turn_context(UUID)',
    'public.agent_conversation_effect(UUID,TEXT,JSONB)',
    'public.agent_order_effect(UUID,INT,TEXT,JSONB)',
    'public.agent_supersede_turn(UUID,UUID,BIGINT)',
    'public.agent_recover_stale_turns()',
    'public.agent_set_transcript(UUID,TEXT,TEXT,TEXT)',
    'public.agent_log_turn(JSONB)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
