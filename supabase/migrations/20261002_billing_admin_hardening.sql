-- =========================================================================
-- VELARIS — DURCISSEMENT FACTURATION, AUTOMATISATIONS & CONSOLE ADMIN
-- Projet : dnwlqgsftauqsyjwhoza
-- Idempotent : peut être rejoué sans effet de bord.
--
-- Contenu :
--   1. Profils : ligne créée à l'inscription, drapeau administrateur
--   2. Grand livre des crédits : idempotence des paiements (référence unique)
--   3. RPC atomiques : débit, remboursement, application d'un paiement
--   4. Journal des générations Kie.ai côté serveur
--   5. Automatisations : colonnes du moteur velaris-agent, unicité des déclencheurs
--   6. RPC de la console de direction (réservées aux administrateurs)
-- =========================================================================

-- 1. PROFILS --------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Crédits de bienvenue : même valeur que l'interface (15). À réduire si des
-- inscriptions multiples sont constatées (chaque crédit coûte une génération réelle).
CREATE OR REPLACE FUNCTION public.velaris_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, studio_name, credits)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'studio_name', 15)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount_cfa, credits_added, transaction_ref, payment_provider, status, kind, reason)
  VALUES (NEW.id, 0, 15, 'WELCOME-' || NEW.id::text, 'VELARIS', 'SUCCESS', 'initial_grant', 'Dotation de bienvenue')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Le grand livre doit exister avant le déclencheur (colonnes kind / reason)
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'purchase';
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC(10, 2);
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP TRIGGER IF EXISTS velaris_on_auth_user_created ON auth.users;
CREATE TRIGGER velaris_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.velaris_handle_new_user();

-- Rattrapage des comptes existants sans profil
INSERT INTO public.profiles (id, email, credits)
SELECT u.id, u.email, 15 FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

UPDATE public.profiles p SET email = u.email
FROM auth.users u WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;

-- 2. GRAND LIVRE ----------------------------------------------------------

-- Un webhook rejoué (fenêtre de 300 s) ne doit jamais créditer deux fois
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_ref
  ON public.credit_transactions (transaction_ref)
  WHERE transaction_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_kind ON public.credit_transactions (kind);

-- Aucune écriture directe depuis le navigateur : uniquement via les RPC ci-dessous
REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM anon, authenticated;
-- profiles : aucune politique UPDATE n'existe, le solde et is_admin restent donc
-- non modifiables depuis le client (RLS). Ne pas ajouter de politique UPDATE large.

-- 3. RPC ATOMIQUES --------------------------------------------------------

-- Débit atomique (aucune course possible : UPDATE conditionnel unique)
CREATE OR REPLACE FUNCTION public.velaris_consume_credits_for(
  p_user UUID, p_amount NUMERIC, p_kind TEXT, p_reason TEXT, p_ref TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.profiles
     SET credits = credits - p_amount, updated_at = NOW()
   WHERE id = p_user AND credits >= p_amount
  RETURNING credits INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount_cfa, credits_added, transaction_ref, payment_provider, status, kind, reason, balance_after)
  VALUES (p_user, 0, -p_amount, p_ref, 'VELARIS', 'SUCCESS', p_kind, left(p_reason, 200), v_balance);

  RETURN v_balance;
END;
$$;

-- Variante utilisateur : ne peut débiter que son propre solde (micro-crédits Copilot)
CREATE OR REPLACE FUNCTION public.velaris_consume_credits(p_amount NUMERIC, p_kind TEXT, p_reason TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_kind NOT IN ('ai_prompt') THEN
    RAISE EXCEPTION 'kind_not_allowed';
  END IF;
  RETURN public.velaris_consume_credits_for(auth.uid(), p_amount, p_kind, p_reason, NULL);
END;
$$;

-- Remboursement (génération échouée) : service_role uniquement
CREATE OR REPLACE FUNCTION public.velaris_refund_credits(p_user UUID, p_amount NUMERIC, p_reason TEXT, p_ref TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  INSERT INTO public.credit_transactions (user_id, amount_cfa, credits_added, transaction_ref, payment_provider, status, kind, reason)
  VALUES (p_user, 0, p_amount, p_ref, 'VELARIS', 'SUCCESS', 'refund', left(p_reason, 200))
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user;
    RETURN v_balance; -- remboursement déjà appliqué
  END IF;

  UPDATE public.profiles SET credits = credits + p_amount, updated_at = NOW()
   WHERE id = p_user RETURNING credits INTO v_balance;
  UPDATE public.credit_transactions SET balance_after = v_balance WHERE transaction_ref = p_ref;
  RETURN v_balance;
END;
$$;

-- Paiement SasPay confirmé (webhook) : idempotent sur la référence de transaction
CREATE OR REPLACE FUNCTION public.velaris_apply_payment(
  p_user UUID, p_amount_cfa NUMERIC, p_ref TEXT, p_type TEXT, p_plan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits NUMERIC := 0;
  v_balance NUMERIC;
  v_days INT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_ref IS NULL OR length(p_ref) < 4 THEN
    RAISE EXCEPTION 'missing_reference';
  END IF;

  IF p_type = 'SUBSCRIPTION' THEN
    IF p_plan = 'quarterly' AND p_amount_cfa >= 7000 THEN
      v_days := 90;
    ELSIF p_plan = 'monthly' AND p_amount_cfa >= 3000 THEN
      v_days := 30;
    ELSE
      RAISE EXCEPTION 'amount_does_not_match_plan';
    END IF;
  ELSE
    v_credits := round(p_amount_cfa / 85.0, 2);
    IF v_credits <= 0 THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount_cfa, credits_added, transaction_ref, payment_provider, status, kind, reason, metadata)
  VALUES (p_user, p_amount_cfa, v_credits, p_ref, 'SASPAY', 'SUCCESS',
          CASE WHEN p_type = 'SUBSCRIPTION' THEN 'subscription' ELSE 'purchase' END,
          CASE WHEN p_type = 'SUBSCRIPTION' THEN 'Abonnement ' || p_plan ELSE 'Recharge SasPay' END,
          jsonb_build_object('plan', p_plan, 'type', p_type))
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_processed');
  END IF;

  IF p_type = 'SUBSCRIPTION' THEN
    -- Renouvellement : on prolonge à partir de l'échéance en cours si elle est future
    UPDATE public.profiles
       SET subscription_status = 'ACTIVE',
           subscription_plan = p_plan,
           subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, NOW()), NOW()) + make_interval(days => v_days),
           updated_at = NOW()
     WHERE id = p_user
    RETURNING subscription_expires_at, credits INTO v_expires, v_balance;
  ELSE
    UPDATE public.profiles SET credits = credits + v_credits, updated_at = NOW()
     WHERE id = p_user RETURNING credits INTO v_balance;
  END IF;

  UPDATE public.credit_transactions SET balance_after = v_balance WHERE transaction_ref = p_ref;
  RETURN jsonb_build_object('applied', true, 'credits', v_credits, 'balance', v_balance, 'expires_at', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION public.velaris_consume_credits_for(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.velaris_refund_credits(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.velaris_apply_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.velaris_consume_credits(NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.velaris_consume_credits(NUMERIC, TEXT, TEXT) TO authenticated;

-- 4. GÉNÉRATIONS KIE.AI ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.song_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT UNIQUE,
  order_ref TEXT,
  client_name TEXT,
  client_phone TEXT,
  title TEXT,
  style TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  audio_url TEXT,
  duration NUMERIC,
  error TEXT,
  credits_charged NUMERIC(10, 2) NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_song_generations_user ON public.song_generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_song_generations_status ON public.song_generations (status);

ALTER TABLE public.song_generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "song_generations_select_own" ON public.song_generations;
CREATE POLICY "song_generations_select_own" ON public.song_generations
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Écritures : Edge Function kie-generate (service_role) uniquement

-- 5. AUTOMATISATIONS ------------------------------------------------------

ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'send_text';
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS media_path TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE public.automation_rules ALTER COLUMN text_body DROP NOT NULL;
ALTER TABLE public.automation_rules ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Deux règles actives sur le même emoji = routage ambigu (double envoi au client)
-- Si des doublons existent déjà, l'index n'est pas créé (avis affiché) : les dédoublonner puis rejouer.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_rules_active_trigger
    ON public.automation_rules (user_id, trigger_type, trigger_value)
    WHERE enabled;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Doublons de déclencheurs actifs : index uq_automation_rules_active_trigger non créé';
END;
$$;

-- wa_sessions : le Studio peut tenir à jour SA ligne (studio_<8 premiers caractères>)
DROP POLICY IF EXISTS "wa_sessions_upsert_own" ON public.wa_sessions;
CREATE POLICY "wa_sessions_upsert_own" ON public.wa_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND session_name = 'studio_' || left((SELECT auth.uid())::text, 8));
DROP POLICY IF EXISTS "wa_sessions_update_own" ON public.wa_sessions;
CREATE POLICY "wa_sessions_update_own" ON public.wa_sessions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND session_name = 'studio_' || left((SELECT auth.uid())::text, 8));

-- Index composites utilisés par les listes paginées du Studio
CREATE INDEX IF NOT EXISTS idx_conversations_user_last ON public.conversations (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders (user_id, created_at DESC);

-- 6. CONSOLE DE DIRECTION -------------------------------------------------

CREATE OR REPLACE FUNCTION public.velaris_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.velaris_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v JSONB;
BEGIN
  IF NOT public.velaris_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'studios_total',        (SELECT count(*) FROM public.profiles),
    'studios_new_30d',      (SELECT count(*) FROM public.profiles WHERE created_at > NOW() - INTERVAL '30 days'),
    'subs_active_monthly',  (SELECT count(*) FROM public.profiles WHERE subscription_status = 'ACTIVE' AND subscription_plan = 'monthly' AND subscription_expires_at > NOW()),
    'subs_active_quarterly',(SELECT count(*) FROM public.profiles WHERE subscription_status = 'ACTIVE' AND subscription_plan = 'quarterly' AND subscription_expires_at > NOW()),
    'revenue_total_cfa',    (SELECT COALESCE(sum(amount_cfa), 0) FROM public.credit_transactions WHERE payment_provider = 'SASPAY' AND status = 'SUCCESS'),
    'revenue_30d_cfa',      (SELECT COALESCE(sum(amount_cfa), 0) FROM public.credit_transactions WHERE payment_provider = 'SASPAY' AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '30 days'),
    'credits_sold',         (SELECT COALESCE(sum(credits_added), 0) FROM public.credit_transactions WHERE kind = 'purchase'),
    'credits_granted',      (SELECT COALESCE(sum(credits_added), 0) FROM public.credit_transactions WHERE kind = 'initial_grant'),
    'credits_consumed',     (SELECT COALESCE(-sum(credits_added), 0) FROM public.credit_transactions WHERE credits_added < 0),
    'credits_refunded',     (SELECT COALESCE(sum(credits_added), 0) FROM public.credit_transactions WHERE kind = 'refund'),
    'credits_outstanding',  (SELECT COALESCE(sum(credits), 0) FROM public.profiles),
    'songs_total',          (SELECT count(*) FROM public.song_generations),
    'songs_success',        (SELECT count(*) FROM public.song_generations WHERE status = 'success'),
    'songs_failed',         (SELECT count(*) FROM public.song_generations WHERE status = 'failed'),
    'songs_delivered',      (SELECT count(*) FROM public.song_generations WHERE delivered_at IS NOT NULL),
    'briefs_total',         (SELECT count(*) FROM public.conversations),
    'orders_paid',          (SELECT count(*) FROM public.orders WHERE status IN ('validated', 'delivered')),
    'orders_delivered',     (SELECT count(*) FROM public.orders WHERE status = 'delivered'),
    'wa_sessions_connected',(SELECT count(*) FROM public.wa_sessions WHERE status = 'connected'),
    'generated_at',         NOW()
  ) INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.velaris_admin_studios(p_limit INT DEFAULT 200)
RETURNS TABLE (
  id UUID, email TEXT, studio_name TEXT, credits NUMERIC, subscription_status TEXT,
  subscription_plan TEXT, subscription_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ, wa_status TEXT, orders_count BIGINT, songs_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.velaris_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.id, p.email, p.studio_name, p.credits, p.subscription_status, p.subscription_plan,
         p.subscription_expires_at, p.created_at, u.last_sign_in_at,
         (SELECT w.status FROM public.wa_sessions w WHERE w.user_id = p.id ORDER BY w.last_seen_at DESC NULLS LAST LIMIT 1),
         (SELECT count(*) FROM public.orders o WHERE o.user_id = p.id),
         (SELECT count(*) FROM public.song_generations s WHERE s.user_id = p.id)
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
   ORDER BY p.created_at DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.velaris_admin_transactions(p_limit INT DEFAULT 100)
RETURNS TABLE (
  id UUID, user_id UUID, email TEXT, kind TEXT, amount_cfa NUMERIC, credits_added NUMERIC,
  balance_after NUMERIC, transaction_ref TEXT, payment_provider TEXT, status TEXT, reason TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.velaris_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT t.id, t.user_id, p.email, t.kind, t.amount_cfa, t.credits_added, t.balance_after,
         t.transaction_ref, t.payment_provider, t.status, t.reason, t.created_at
    FROM public.credit_transactions t
    LEFT JOIN public.profiles p ON p.id = t.user_id
   ORDER BY t.created_at DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

REVOKE ALL ON FUNCTION public.velaris_admin_kpis() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velaris_admin_studios(INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velaris_admin_transactions(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.velaris_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.velaris_admin_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.velaris_admin_studios(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.velaris_admin_transactions(INT) TO authenticated;

-- Désigner l'administrateur (à exécuter une fois, en remplaçant l'email) :
-- UPDATE public.profiles SET is_admin = TRUE WHERE email = 'votre-email@domaine.com';
