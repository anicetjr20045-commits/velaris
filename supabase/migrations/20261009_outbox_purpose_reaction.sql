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
