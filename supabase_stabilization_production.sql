-- =========================================================================
-- VELARIS STUDIO OS — SCRIPT DE STABILISATION & HAUTE PERFORMANCE SUPABASE
-- Projet : Velaris (dnwlqgsftauqsyjwhoza)
-- Objectif : Zéro saturation de quota, requêtes optimisées à l'échelle,
--            index B-Tree indispensables, et RLS avec (select auth.uid())
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. INDEX B-TREE DE PERFORMANCE (Élimination des Sequential Scans)
-- Empêche Postgres d'analyser toute la table pour chaque requête client
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts (phone);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON public.conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_funnel ON public.conversations (funnel_stage);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_contact_id ON public.orders (contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON public.automation_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON public.automation_rules (enabled);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_user_id ON public.wa_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_name ON public.wa_sessions (session_name);

-- 3. TABLES DE FACTURATION & PROFILS (SASPAY & KIE.AI)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_name TEXT,
    credits NUMERIC(10, 2) DEFAULT 0.00,
    subscription_status TEXT DEFAULT 'INACTIVE' CHECK (subscription_status IN ('ACTIVE', 'INACTIVE', 'CANCELED', 'EXPIRED')),
    subscription_plan TEXT DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_sub_status ON public.profiles (subscription_status);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_cfa NUMERIC(10, 2) NOT NULL,
    credits_added NUMERIC(10, 2) NOT NULL,
    transaction_ref TEXT,
    payment_provider TEXT DEFAULT 'SASPAY',
    status TEXT DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions (user_id);

-- 4. POLITIQUES RLS HAUTE PERFORMANCE : (SELECT auth.uid())
-- Évite à Postgres de réévaluer auth.uid() pour chaque ligne scannée (gain x100 à x1000)

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Contacts
DROP POLICY IF EXISTS "contacts_select_auth" ON public.contacts;
CREATE POLICY "contacts_select_auth" ON public.contacts
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "contacts_insert_auth" ON public.contacts;
CREATE POLICY "contacts_insert_auth" ON public.contacts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "contacts_update_auth" ON public.contacts;
CREATE POLICY "contacts_update_auth" ON public.contacts
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Conversations
DROP POLICY IF EXISTS "conversations_select_auth" ON public.conversations;
CREATE POLICY "conversations_select_auth" ON public.conversations
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "conversations_insert_auth" ON public.conversations;
CREATE POLICY "conversations_insert_auth" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Messages
DROP POLICY IF EXISTS "messages_select_auth" ON public.messages;
CREATE POLICY "messages_select_auth" ON public.messages
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "messages_insert_auth" ON public.messages;
CREATE POLICY "messages_insert_auth" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = (SELECT auth.uid()))
    );

-- Orders
DROP POLICY IF EXISTS "orders_select_auth" ON public.orders;
CREATE POLICY "orders_select_auth" ON public.orders
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "orders_insert_auth" ON public.orders;
CREATE POLICY "orders_insert_auth" ON public.orders
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Profiles & Transactions
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "credit_transactions_select_auth" ON public.credit_transactions;
CREATE POLICY "credit_transactions_select_auth" ON public.credit_transactions
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 5. STOCKAGE STORAGE : Limite stricte de taille 16 Mo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-files',
    'product-files',
    false,
    16777216, -- 16 Mo max par fichier pour éviter tout dépassement de quota
    ARRAY['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET 
    file_size_limit = 16777216;
