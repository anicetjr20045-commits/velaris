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
