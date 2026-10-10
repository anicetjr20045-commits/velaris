-- Migration 20261009 — Nettoyage : supprime la transition morte
-- 'brief_complete --procedure_voice_sent--> lyrics_in_progress'.
-- Aucun code ne l'émettait ; elle n'apparaissait jamais dans le cycle de vie des commandes.
-- Supprimée aussi de engine/src/domain/orders.ts, types.ts et 20261004_agent_core.sql
-- (le test de parité exige l'identité stricte TS ≡ SQL).

DELETE FROM public.order_transitions
 WHERE track = 'creative'
   AND from_state = 'brief_complete'
   AND event = 'procedure_voice_sent';
