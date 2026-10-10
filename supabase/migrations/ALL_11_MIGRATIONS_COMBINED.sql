-- ============================================================================
-- VELARIS — AUTO-PROVISIONING AUTOMATIQUE DES STUDIOS ET SESSIONS WAHA
-- Migration : 20261007_auto_provision_studios.sql
-- ============================================================================

-- 1. Fonction d'auto-provisioning d'un studio pour n'importe quel utilisateur
CREATE OR REPLACE FUNCTION public.velaris_provision_studio_for_user(
  p_user_id UUID,
  p_studio_name TEXT DEFAULT NULL,
  p_manager_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_name TEXT;
  v_manager_name TEXT;
  v_session_name TEXT;
BEGIN
  v_studio_name := COALESCE(NULLIF(trim(p_studio_name), ''), 'Mon Studio Chansons');
  v_manager_name := COALESCE(NULLIF(trim(p_manager_name), ''), 'Créateur');
  v_session_name := 'studio_' || left(p_user_id::text, 8);

  -- A. wa_sessions : liaison de la session studio au moteur velaris_engine
  INSERT INTO public.wa_sessions (
    user_id, session_name, status, engine_owner, created_at, updated_at
  ) VALUES (
    p_user_id, v_session_name, 'disconnected', 'velaris_engine', now(), now()
  )
  ON CONFLICT (session_name) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    engine_owner = 'velaris_engine',
    updated_at = now();

  -- B. studio_personas : configuration IA complète par défaut
  INSERT INTO public.studio_personas (
    user_id,
    agent_enabled,
    studio_name,
    agent_name,
    manager_first_name,
    tone,
    formal_address,
    emoji_policy,
    timezone,
    agent_hours,
    manager_hours,
    followup_hours,
    payment_window_hours,
    alert_phone,
    agent_session_name,
    cap_reception,
    cap_procedure_voice,
    cap_lyrics_followup,
    cap_payment,
    cap_lyrics_draft,
    cap_auto_production,
    cap_video,
    delivery_mode,
    relay_mode,
    quiet_window_ms,
    max_batch_wait_ms,
    handoff_sla_minutes,
    max_agent_msgs_per_hour,
    max_open_orders,
    max_followups,
    followup_delay_hours,
    max_free_revisions,
    brief_field_order,
    lyrics_author,
    payment_methods,
    reaction_commands,
    daily_llm_budget_xof
  ) VALUES (
    p_user_id,
    true,
    v_studio_name,
    'Alex',
    v_manager_name,
    'chaleureux',
    true,
    'none',
    'Africa/Ouagadougou',
    '{"all":["00:00","24:00"]}'::jsonb,
    '{"mon":["07:30","22:00"],"tue":["07:30","22:00"],"wed":["07:30","22:00"],"thu":["07:30","22:00"],"fri":["07:30","22:00"],"sat":["08:00","22:00"],"sun":["09:00","21:00"]}'::jsonb,
    '{"all":["08:00","20:30"]}'::jsonb,
    '{"all":["07:00","21:00"]}'::jsonb,
    '22656240533',
    v_session_name,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    'live',
    'safe_templates',
    4000,
    12000,
    15,
    6,
    3,
    2,
    24,
    2,
    ARRAY['occasion', 'recipient_name', 'offer'],
    'manager',
    '[{"provider":"Orange Money","number":"+22656240533","holder":"Velaris","country":"BF"},{"provider":"Wave","number":"+22656240533","holder":"Velaris","country":"BF"}]'::jsonb,
    '{"✨":"resume_ai","🎵":"confirm_and_produce","🎉":"mark_delivered","📝":"mark_as_lyrics"}'::jsonb,
    1500
  )
  ON CONFLICT (user_id) DO UPDATE SET
    agent_session_name = EXCLUDED.agent_session_name,
    updated_at = now();

  -- C. studio_catalogues : 3 forfaits clés en main (Essentiel, Signature, Prestige)
  INSERT INTO public.studio_catalogues (
    user_id, code, label, description, price_xof, deliverable, lyrics_lead_minutes, production_lead_minutes, payment_policy, required_fields, is_active, sort_order
  ) VALUES
    (p_user_id, 'essentiel', 'Essentiel', 'Chanson personnalisée 1 couplet 1 refrain, livrée en audio haute qualité.', 1200, 'audio', 8, 18, 'after_lyrics_validation', ARRAY['occasion','recipient_name'], true, 1),
    (p_user_id, 'signature', 'Signature', 'Chanson personnalisée complète 2 couplets 1 refrain, arrangements riches.', 3000, 'audio', 8, 18, 'after_lyrics_validation', ARRAY['occasion','recipient_name'], true, 2),
    (p_user_id, 'prestige', 'Prestige', 'Chanson complète personnalisée + clip vidéo diaporama photos souvenir.', 5000, 'audio_video', 8, 18, 'after_lyrics_validation', ARRAY['occasion','recipient_name'], true, 3)
  ON CONFLICT (user_id, code) DO NOTHING;

END;
$$;

-- 2. Mise à jour du trigger d'inscription auth.users
CREATE OR REPLACE FUNCTION public.velaris_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.velaris_provision_studio_for_user(
    NEW.id,
    NEW.raw_user_meta_data ->> 'studio_name',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS velaris_on_auth_user_created ON auth.users;
CREATE TRIGGER velaris_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.velaris_handle_new_user();
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
-- Migration 20261009 — CORRECTIF M17 : métriques studio réelles pour le copilot.
--
-- Avant, le copilot injectait des chiffres codés en dur dans son prompt
-- (633 conversations, 637 contacts, 623 commandes, 40340 messages) présentés
-- comme "DONNÉES TEMPS RÉEL DU STUDIO". Désormais, les vrais compteurs sont lus en base.

CREATE OR REPLACE FUNCTION public.copilot_studio_metrics()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_contacts', (SELECT count(*) FROM public.contacts),
    'total_conversations', (SELECT count(*) FROM public.conversations),
    'active_conversations', (SELECT count(*) FROM public.conversations
                              WHERE last_message_at > now() - interval '30 days'
                                AND COALESCE(funnel_stage, '') NOT IN ('delivered', 'closed', 'cancelled')),
    'total_orders', (SELECT count(*) FROM public.orders),
    'total_inbound_messages', (SELECT count(*) FROM public.messages),
    'total_outbound_messages', (SELECT count(*) FROM public.outbound_messages)
  );
$$;

REVOKE ALL ON FUNCTION public.copilot_studio_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_studio_metrics() TO service_role;
-- Migration 20261009 — Délai anti-rafale à 20 secondes (demande du gérant).
--
-- Avant : quiet_window_ms = 4s, max_batch_wait_ms = 12s (trop court : les rafales
-- de 3-4 messages du client déclenchaient des tours qui se chevauchaient).
-- Après : 20s de silence après le dernier message avant de répondre, avec un
-- plafond de 60s même si le client continue d'écrire sans pause.

ALTER TABLE public.studio_personas
  DROP CONSTRAINT IF EXISTS studio_personas_quiet_window_ms_check,
  DROP CONSTRAINT IF EXISTS studio_personas_max_batch_wait_ms_check;

ALTER TABLE public.studio_personas
  ADD CONSTRAINT studio_personas_quiet_window_ms_check CHECK (quiet_window_ms BETWEEN 1500 AND 60000),
  ADD CONSTRAINT studio_personas_max_batch_wait_ms_check CHECK (max_batch_wait_ms BETWEEN 3000 AND 120000);

ALTER TABLE public.studio_personas
  ALTER COLUMN quiet_window_ms SET DEFAULT 20000,
  ALTER COLUMN max_batch_wait_ms SET DEFAULT 60000;

-- Appliquer aux studios existants (qui ont encore les anciennes valeurs par défaut)
UPDATE public.studio_personas
   SET quiet_window_ms = 20000, max_batch_wait_ms = 60000
 WHERE quiet_window_ms = 4000 AND max_batch_wait_ms = 12000;
-- Migration 20261009 — 🎉 (mark_delivered) depuis l'étape audio_delivered.
--
-- Cas réel : le gérant envoie la chanson audio lui-même, puis réagit 🎉 sur le message
-- pour signaler que la livraison est effectuée. Sans cette transition,
-- agent_transition_order('creative', 'delivery_sent') renvoyait 'transition_forbidden'
-- et la commande restait bloquée en audio_delivered, sans aucun retour au gérant.
--
-- La commande explicite du gérant prime (actor = 'merchant' : les portes croisées
-- de paiement ne s'appliquent pas — c'est son studio).
-- Rejouable : ON CONFLICT DO NOTHING (clé primaire track, from_state, event).

INSERT INTO public.order_transitions (track, from_state, event, to_state, allowed_actors)
VALUES ('creative', 'audio_delivered', 'delivery_sent', 'delivered', ARRAY['merchant','system'])
ON CONFLICT (track, from_state, event) DO NOTHING;
-- Migration 20261009 — lyrics_source : autoriser les valeurs écrites par les réactions 🎵/📝.
--
-- Bug réel détecté par le bac à sable : le handler `confirm_and_produce` (🎵) écrit
-- lyrics_source = 'merchant_reaction' et `mark_as_lyrics` (📝) écrit
-- 'merchant_reaction_mark', mais la contrainte chk_lyrics_source ne les autorisait pas.
-- Résultat : toute réaction 🎵/📝 échouait en violation de contrainte, sans retour.
-- Rejouable.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_lyrics_source;
ALTER TABLE public.orders ADD CONSTRAINT chk_lyrics_source CHECK (lyrics_source IS NULL OR lyrics_source IN
  ('merchant_whatsapp','merchant_studio','ai_draft_approved','merchant_reaction','merchant_reaction_mark'));
-- Migration 20261009 — outbox purpose : autoriser 'reaction_confirm'.
--
-- Bug réel détecté par le bac à sable : le handler `confirm_and_produce` (🎵)
-- met en file un message de confirmation avec purpose = 'reaction_confirm',
-- mais la contrainte outbound_messages_purpose_check ne l'autorisait pas.
-- Résultat : toute réaction 🎵 échouait en violation de contrainte, sans retour.
-- Rejouable.

ALTER TABLE public.outbound_messages DROP CONSTRAINT IF EXISTS outbound_messages_purpose_check;
ALTER TABLE public.outbound_messages ADD CONSTRAINT outbound_messages_purpose_check CHECK (purpose IN
  ('reply','handoff_ack','stop_ack','identity','payment_instructions','payment_claim_ack','procedure_voice',
   'offers_voice','sample','lyrics','song','video','status_eta','owner_alert','followup','merchant','reaction_confirm'));
-- Migration 20261009 — Ajoute la commande 🎉 → mark_delivered aux studios existants.
--
-- Le mapping par défaut de reaction_commands contient désormais :
--   ✨ → resume_ai (rendre la main à l'IA)
--   🎵 → confirm_and_produce (ce texte part en chanson, voix/style extraits)
--   🎉 → mark_delivered (la livraison de la chanson est effectuée)
--   📝 → mark_as_lyrics (enregistrer comme paroles)
-- Cette migration ajoute 🎉 aux lignes existantes qui ne l'ont pas encore.

UPDATE public.studio_personas
   SET reaction_commands = reaction_commands || '{"🎉":"mark_delivered"}'::jsonb
 WHERE NOT (reaction_commands ? '🎉');
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
-- Migration 20261009 — Nettoyage : supprime la transition morte
-- 'brief_complete --procedure_voice_sent--> lyrics_in_progress'.
-- Aucun code ne l'émettait ; elle n'apparaissait jamais dans le cycle de vie des commandes.
-- Supprimée aussi de engine/src/domain/orders.ts, types.ts et 20261004_agent_core.sql
-- (le test de parité exige l'identité stricte TS ≡ SQL).

DELETE FROM public.order_transitions
 WHERE track = 'creative'
   AND from_state = 'brief_complete'
   AND event = 'procedure_voice_sent';
-- Migration 20261009 — CORRECTIF C5 : ajoute le trigger 'retry' à conversation_turns.
--
-- Quand le fournisseur LLM (DeepSeek/Kie.ai) est en panne, le moteur retient le tour
-- et planifie une reprise avec backoff exponentiel au lieu d'envoyer une réponse incohérente.
-- La reprise utilise trigger='retry', status='scheduled', prête à être réclamée par agent_claim_turn.

DO $$
BEGIN
  -- La contrainte inline est auto-nommée conversation_turns_trigger_check ; on la remplace proprement.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_turns_trigger_check'
  ) THEN
    ALTER TABLE public.conversation_turns DROP CONSTRAINT conversation_turns_trigger_check;
  END IF;
END $$;

ALTER TABLE public.conversation_turns ADD CONSTRAINT conversation_turns_trigger_check
  CHECK (trigger IN ('client_message','merchant_message','merchant_reaction','merchant_command',
                     'followup','payment_event','production_event','relay_check','sla_check','retry'));
