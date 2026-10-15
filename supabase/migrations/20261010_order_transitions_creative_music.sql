-- Migration 20261010 — Transitions créatives pour production et livraison musicale automatique
-- Permet la progression fluide vers in_production et delivered lors des déclenchements
-- automatiques ou système (ex: finalisation Suno / Kie.ai).

INSERT INTO public.order_transitions (track, from_state, event, to_state, allowed_actors)
VALUES
  ('creative', 'lyrics_sent', 'production_started', 'in_production', ARRAY['agent','merchant','system']),
  ('creative', 'lyrics_sent', 'delivery_sent', 'delivered', ARRAY['merchant','system']),
  ('creative', 'in_production', 'delivery_sent', 'delivered', ARRAY['merchant','system'])
ON CONFLICT (track, from_state, event) DO UPDATE
SET to_state = EXCLUDED.to_state, allowed_actors = EXCLUDED.allowed_actors;
