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
