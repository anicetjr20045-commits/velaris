-- Migration 20261009 — 🎉 (mark_delivered) depuis l'étape audio_delivered.
--
-- Cas réel : le gérant envoie la chanson audio lui-même, puis réagit 🎉 sur le message
-- pour signaler que la livraison est effectuée. Sans cette transition,
-- agent_transition_order('creative', 'delivery_sent') renvoyait 'transition_forbidden'
-- et la commande restait bloquée en audio_delivered, sans aucun retour au gérant.
--
-- La commande explicite du gérant prime (actor = 'merchant' : les portes croisées
-- de paiement ne s'appliquent pas — c'est son studio).
-- Rejouable : ON CONFLICT DO NOTHING (clé primaire track, from_state, event).

INSERT INTO public.order_transitions (track, from_state, event, to_state, allowed_actors)
VALUES ('creative', 'audio_delivered', 'delivery_sent', 'delivered', ARRAY['merchant','system'])
ON CONFLICT (track, from_state, event) DO NOTHING;
