-- Migration 20261009 — CORRECTIF C5 : ajoute le trigger 'retry' à conversation_turns.
--
-- Quand le fournisseur LLM (DeepSeek/Kie.ai) est en panne, le moteur retient le tour
-- et planifie une reprise avec backoff exponentiel au lieu d'envoyer une réponse incohérente.
-- La reprise utilise trigger='retry', status='scheduled', prête à être réclamée par agent_claim_turn.

DO $$
BEGIN
  -- La contrainte inline est auto-nommée conversation_turns_trigger_check ; on la remplace proprement.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_turns_trigger_check'
  ) THEN
    ALTER TABLE public.conversation_turns DROP CONSTRAINT conversation_turns_trigger_check;
  END IF;
END $$;

ALTER TABLE public.conversation_turns ADD CONSTRAINT conversation_turns_trigger_check
  CHECK (trigger IN ('client_message','merchant_message','merchant_reaction','merchant_command',
                     'followup','payment_event','production_event','relay_check','sla_check','retry'));
