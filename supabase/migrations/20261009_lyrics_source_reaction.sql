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
