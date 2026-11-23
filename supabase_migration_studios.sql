-- =========================================================================
-- DJELIA ACADEMY — MIGRATION TABLE STUDIOS MULTI-TENANT
-- Projet Supabase : Velaris / Djelia (dnwlqgsftauqsyjwhoza)
-- Exécutable dans Supabase SQL Editor ou via Lovable
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.studios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    bio TEXT,
    photo_url TEXT,
    accent_color TEXT DEFAULT '#D4A017',
    accepted_payments TEXT[] DEFAULT ARRAY['Wave', 'Orange Money'],
    music_styles TEXT[] DEFAULT ARRAY['Afrobeat', 'Zouk', 'Acoustique', 'Gospel'],
    social_links JSONB DEFAULT '{}'::jsonb,
    price_quoted_standard INTEGER DEFAULT 2000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par slug (mini-site) et user_id (engine)
CREATE INDEX IF NOT EXISTS idx_studios_slug ON public.studios (slug);
CREATE INDEX IF NOT EXISTS idx_studios_user_id ON public.studios (user_id);

-- Activation RLS
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

-- Suppression préalable des policies pour idempotence
DROP POLICY IF EXISTS "studios_public_select" ON public.studios;
DROP POLICY IF EXISTS "studios_owner_all" ON public.studios;

-- 1. Lecture publique (permet d'afficher le mini-site djelia.store/s/{slug} sans être connecté)
CREATE POLICY "studios_public_select" ON public.studios
    FOR SELECT USING (true);

-- 2. Modification et écriture réservées au propriétaire du studio
CREATE POLICY "studios_owner_all" ON public.studios
    FOR ALL USING (auth.uid() = user_id);
