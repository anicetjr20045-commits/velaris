-- Migration 20261009 — CORRECTIF M10 : reprise des tours 'failed' par le balayeur.
--
-- Avant, un tour marqué 'failed' (crash du worker : LLM, TemplateError, RPC...) n'était jamais
-- retraité : les messages du client restaient orphelins jusqu'à son prochain message.
-- Désormais, le balayeur replanifie les tours 'failed' récents (échoués il y a moins de 15 minutes)
-- avec un plafond de tentatives (attempts < 3) pour éviter toute boucle infinie sur bug persistant.
-- Les tours ayant déjà (peut-être) envoyé des messages ne sont JAMAIS rejoués (risque de doublon) :
-- ils restent 'failed' pour inspection manuelle.

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

  -- CORRECTIF M10 : reprise des tours 'failed' récents (jamais retraités avant).
  FOR t IN
    SELECT ct.* FROM conversation_turns ct
     WHERE ct.status = 'failed'
       AND ct.finished_at > now() - interval '15 minutes'
       AND COALESCE(ct.attempts, 0) < 3
       AND ct.outcome IS DISTINCT FROM 'crashed_after_send'
       AND NOT EXISTS (SELECT 1 FROM outbound_messages o
                        WHERE o.turn_id = ct.id AND o.status IN ('sending','sent','unknown'))
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Annuler les envois en attente du tour échoué avant de le rejouer
    UPDATE outbound_messages SET status = 'cancelled', error = 'turn_retry'
     WHERE turn_id = t.id AND status IN ('pending','proposed');
    UPDATE conversation_turns
       SET status = 'scheduled',
           outcome = 'retrying_after_crash',
           error = NULL,
           lock_token = NULL,
           started_at = NULL,
           ready_at = now() + interval '60 seconds'
     WHERE id = t.id;
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
