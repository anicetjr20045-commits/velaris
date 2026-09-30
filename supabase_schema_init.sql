-- =========================================================================
-- VELARIS STUDIO OS — INITIALISATION COMPLÈTE DE LA BASE DE DONNÉES SUPABASE
-- Projet : Velaris (dnwlqgsftauqsyjwhoza)
-- Exécutable directement dans : Supabase Dashboard > SQL Editor (>_) > New Query
-- =========================================================================

-- 1. Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Table des Contacts CRM WhatsApp
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT,
    phone TEXT,
    wa_jid TEXT,
    source TEXT DEFAULT 'whatsapp',
    occasion TEXT,
    notes TEXT,
    price_quoted_cents INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des Conversations WhatsApp
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    funnel_stage TEXT DEFAULT 'new',
    ai_paused BOOLEAN DEFAULT FALSE,
    pause_reason TEXT,
    summary TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des Messages WhatsApp
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID,
    role TEXT CHECK (role IN ('user', 'assistant', 'human_agent', 'system')),
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    body TEXT,
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table des Commandes & Encaissements
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL DEFAULT 120000, -- 1 200 F CFA
    currency TEXT DEFAULT 'XOF',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'delivered', 'cancelled')),
    payment_method TEXT DEFAULT 'Wave',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table des Règles d'Automatisation Studio
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    trigger_type TEXT DEFAULT 'reaction',
    trigger_value TEXT NOT NULL,
    text_body TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cooldown_hours INTEGER DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Table des Sessions WhatsApp WAHA
CREATE TABLE IF NOT EXISTS public.wa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_name TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    status TEXT DEFAULT 'scanning',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Table du Solde d'Ouverture Comptable
CREATE TABLE IF NOT EXISTS public.revenue_opening_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    amount_cents BIGINT NOT NULL,
    currency TEXT DEFAULT 'XOF',
    as_of_date DATE DEFAULT '2026-09-26',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- SÉCURITÉ & RLS (Row Level Security) - Idempotent
-- =========================================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_opening_balances ENABLE ROW LEVEL SECURITY;

-- Suppression préalable des politiques si elles existent pour éviter toute erreur de ré-exécution
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

-- Politiques de lecture publique
CREATE POLICY "contacts_select_policy" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT USING (true);
CREATE POLICY "orders_select_policy" ON public.orders FOR SELECT USING (true);
CREATE POLICY "automation_rules_select_policy" ON public.automation_rules FOR SELECT USING (true);
CREATE POLICY "wa_sessions_select_policy" ON public.wa_sessions FOR SELECT USING (true);
CREATE POLICY "revenue_opening_balances_select_policy" ON public.revenue_opening_balances FOR SELECT USING (true);

-- Politiques d'écriture / modification
CREATE POLICY "contacts_all_auth" ON public.contacts FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "conversations_all_auth" ON public.conversations FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "messages_all_auth" ON public.messages FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "orders_all_auth" ON public.orders FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "automation_rules_all_auth" ON public.automation_rules FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "wa_sessions_all_auth" ON public.wa_sessions FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- =========================================================================
-- INSERTION DES DONNÉES CERTIFIÉES DE PRODUCTION
-- =========================================================================

-- Solde de départ certifié : 2 749 400 F CFA
INSERT INTO public.revenue_opening_balances (id, amount_cents, currency, as_of_date)
VALUES ('c0000001-0000-0000-0000-000000000001', 274940000, 'XOF', '2026-09-26')
ON CONFLICT (id) DO NOTHING;

-- Les 3 règles d'automatisation réelles
INSERT INTO public.automation_rules (id, name, trigger_type, trigger_value, text_body, enabled)
VALUES 
('163e1c54-c080-4d10-bad9-23569cb18ce9', 'texte', 'reaction', '🖖🏻', 'nous faisons la chanson a 1000 f', true),
('29dd7277-2612-443c-bc6b-4cfd9c109b04', 'Vocal', 'reaction', '😊', 'Nous faisons la chanson à 1200 f . On a aussi un autre modèle vidéo avec photos à 3000 f. Tout dépend de vous 😊', true),
('587dc5c0-a81e-4b16-9ce5-a6a83c0e3d41', 'Test', 'reaction', '🙏', 'Prévision de mon chiffre d''affaires à la fin du mois ?', true)
ON CONFLICT (id) DO NOTHING;

-- Sessions WhatsApp
INSERT INTO public.wa_sessions (session_name, phone_number, status)
VALUES 
('Test', '+22656240533', 'scanning'),
('anicet2', '+22658357772', 'connected')
ON CONFLICT (session_name) DO UPDATE SET phone_number = EXCLUDED.phone_number, status = EXCLUDED.status;

-- Contacts clés réels
INSERT INTO public.contacts (id, name, phone, occasion)
VALUES 
('a0000001-0000-0000-0000-000000000001', 'Safiatou TRAORE', '+226 79 29 64 99', 'Anniversaire Orokiatou Tientrebéogo'),
('a0000002-0000-0000-0000-000000000002', 'Prunelle De Dieu', '+226 58 58 34 71', 'Hommage Gaudens & Prisca'),
('a0000003-0000-0000-0000-000000000003', 'sere inoussa', '+226 71 12 43 40', 'Publicité SERE ET FILS Nouna')
ON CONFLICT (id) DO NOTHING;

-- Conversations clés réelles
INSERT INTO public.conversations (id, contact_id, funnel_stage, summary, ai_paused, pause_reason)
VALUES 
('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'paid', 'Destinataire Orokiatou Tientrebéogo. Version vidéo photos en duo. 3000 F payé et confirmé, montage final en cours.', true, 'merchant_reply'),
('b0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', 'delivered', 'Frère Gaudens, Défunte Prisca. Chanson espérance chrétienne (1 200 FCFA). Morceau livré et validé avec émotion.', true, 'merchant_reply'),
('b0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', 'presenting', 'Entreprise SERE ET FILS à Nouna. Chanson publicitaire 1 200 F. En attente numéro Moov.', true, 'merchant_reply')
ON CONFLICT (id) DO NOTHING;

-- Messages clés
INSERT INTO public.messages (id, conversation_id, role, direction, body)
VALUES 
('d0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'user', 'inbound', 'Bonsoir ! C''est l''anniversaire de ma bestie Orokiatou Tientrebéogo ce samedi. Je veux lui faire une chanson surprise magnifique.'),
('d0000002-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 'human_agent', 'outbound', 'Bonjour Safiatou ! Quel plaisir. Donnez-nous vos souvenirs forts avec Orokiatou et nous lançons la composition tout de suite.'),
('d0000003-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', 'user', 'inbound', 'Bonjour Velaris Studio. Je viens pour un hommage à mon frère Gaudens et sa défunte épouse Prisca.'),
('d0000004-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', 'human_agent', 'outbound', 'Toutes nos condoléances Prunelle. Nous allons composer un chant d''espérance et de paix pour lui donner du courage.')
ON CONFLICT (id) DO NOTHING;
