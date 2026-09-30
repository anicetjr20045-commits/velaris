-- =========================================================================
-- VELARIS STUDIO OS — MULTI-TENANT & ROW LEVEL SECURITY ISOLATION
-- =========================================================================
-- Garantit une étanchéité absolue des données entre chaque client/entrepreneur.
-- Chaque compte possède ses propres contacts, conversations, commandes et automatisations.
-- =========================================================================

-- 1. Configuration des valeurs par défaut automatiques pour user_id = auth.uid()
ALTER TABLE public.contacts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.conversations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.messages ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.orders ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.automation_rules ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.wa_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.revenue_opening_balances ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Suppression des anciennes politiques permissives
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "automation_rules_select_policy" ON public.automation_rules;
DROP POLICY IF EXISTS "wa_sessions_select_policy" ON public.wa_sessions;
DROP POLICY IF EXISTS "revenue_opening_balances_select_policy" ON public.revenue_opening_balances;

DROP POLICY IF EXISTS "contacts_all_auth" ON public.contacts;
DROP POLICY IF EXISTS "conversations_all_auth" ON public.conversations;
DROP POLICY IF EXISTS "messages_all_auth" ON public.messages;
DROP POLICY IF EXISTS "orders_all_auth" ON public.orders;
DROP POLICY IF EXISTS "automation_rules_all_auth" ON public.automation_rules;
DROP POLICY IF EXISTS "wa_sessions_all_auth" ON public.wa_sessions;

-- 3. POLITIQUES STRICTES D'ISOLATION PAR UTILISATEUR

-- --- CONTACTS ---
-- Lecture : Utilisateur authentifié voit ses contacts, Anon voit les contacts démo (user_id IS NULL)
CREATE POLICY "contacts_select_auth" ON public.contacts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contacts_select_anon" ON public.contacts
  FOR SELECT TO anon
  USING (user_id IS NULL);

CREATE POLICY "contacts_insert_auth" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_update_auth" ON public.contacts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_delete_auth" ON public.contacts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- --- CONVERSATIONS ---
CREATE POLICY "conversations_select_auth" ON public.conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "conversations_select_anon" ON public.conversations
  FOR SELECT TO anon
  USING (user_id IS NULL);

CREATE POLICY "conversations_insert_auth" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_update_auth" ON public.conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_delete_auth" ON public.conversations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- --- MESSAGES ---
CREATE POLICY "messages_select_auth" ON public.messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "messages_select_anon" ON public.messages
  FOR SELECT TO anon
  USING (
    user_id IS NULL OR 
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id IS NULL)
  );

CREATE POLICY "messages_insert_auth" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
  );

-- --- COMMANDES (ORDERS) ---
CREATE POLICY "orders_select_auth" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "orders_select_anon" ON public.orders
  FOR SELECT TO anon
  USING (user_id IS NULL);

CREATE POLICY "orders_insert_auth" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update_auth" ON public.orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_delete_auth" ON public.orders
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- --- RÈGLES D'AUTOMATISATION ---
CREATE POLICY "automation_rules_select_auth" ON public.automation_rules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "automation_rules_select_anon" ON public.automation_rules
  FOR SELECT TO anon
  USING (user_id IS NULL);

CREATE POLICY "automation_rules_insert_auth" ON public.automation_rules
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "automation_rules_update_auth" ON public.automation_rules
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "automation_rules_delete_auth" ON public.automation_rules
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- --- SESSIONS WAHA WHATSAPP ---
CREATE POLICY "wa_sessions_select_auth" ON public.wa_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "wa_sessions_select_anon" ON public.wa_sessions
  FOR SELECT TO anon
  USING (user_id IS NULL);

CREATE POLICY "wa_sessions_insert_auth" ON public.wa_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "wa_sessions_update_auth" ON public.wa_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "wa_sessions_delete_auth" ON public.wa_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- --- SOLDE D'OUVERTURE REVENUS ---
CREATE POLICY "revenue_opening_balances_select_auth" ON public.revenue_opening_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "revenue_opening_balances_select_anon" ON public.revenue_opening_balances
  FOR SELECT TO anon
  USING (user_id IS NULL);

CREATE POLICY "revenue_opening_balances_insert_auth" ON public.revenue_opening_balances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "revenue_opening_balances_update_auth" ON public.revenue_opening_balances
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. TRIGGER AUTOMATIQUE D'INITIALISATION D'ESPACE STUDIO À L'INSCRIPTION
CREATE OR REPLACE FUNCTION public.handle_new_studio_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Initialisation du solde de départ du nouveau studio
  INSERT INTO public.revenue_opening_balances (user_id, amount_cents, currency, as_of_date)
  VALUES (NEW.id, 0, 'XOF', CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- 2. Initialisation des 3 règles d'automatisation standard pour le studio
  INSERT INTO public.automation_rules (user_id, name, trigger_type, trigger_value, text_body, enabled)
  VALUES 
    (NEW.id, 'Formule Découverte (1 200 F)', 'reaction', '🖖🏻', 'Bonjour ! Nous créons votre chanson personnalisée dès 1 200 F CFA. Quel est le prénom du destinataire ?', true),
    (NEW.id, 'Formule Complète (3 000 F)', 'reaction', '😊', 'Notre formule complète avec montage photos et 2 versions masterisées est à 3 000 F CFA. Tout dépend de vous 😊', true),
    (NEW.id, 'Accompagnement Studio', 'reaction', '🙏', 'Votre commande est bien reçue par le studio. Notre équipe prépare vos paroles !', true)
  ON CONFLICT DO NOTHING;

  -- 3. Création de la session WAHA réservée au nouveau client
  INSERT INTO public.wa_sessions (user_id, session_name, status)
  VALUES (NEW.id, 'studio_' || substr(NEW.id::text, 1, 8), 'scanning')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_studio_user();
