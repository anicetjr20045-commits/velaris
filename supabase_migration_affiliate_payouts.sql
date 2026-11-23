-- ==============================================================================
-- Djelia Academy - Migration : Table des Demandes de Retrait d'Affiliation
-- ==============================================================================
-- Permet aux partenaires de demander le virement de leurs commissions d'affiliation
-- (25% sur chaque commande Chariow de 1 200 F CFA = 300 F CFA / vente).
-- Seuil de retrait minimum : 1 500 F CFA (5 ventes).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount >= 1500),
    operator TEXT NOT NULL CHECK (operator IN ('Wave', 'Orange Money', 'MTN MoMo', 'Moov Money')),
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    transaction_ref TEXT,
    notes TEXT
);

-- Index pour requêtes rapides par utilisateur et par statut
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_user_id ON public.affiliate_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON public.affiliate_payouts(status);

-- Activer Row Level Security (RLS)
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Politiques RLS :
-- 1. Lecture : Chaque membre authentifié peut consulter l'historique de ses propres demandes
CREATE POLICY "affiliate_payouts_user_select" ON public.affiliate_payouts
    FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Insertion : Chaque membre authentifié peut soumettre une demande pour son propre compte
CREATE POLICY "affiliate_payouts_user_insert" ON public.affiliate_payouts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
