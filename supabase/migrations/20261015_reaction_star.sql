-- Migration 20261015 — Ajoute la commande ⭐ → mark_returning aux personas studio.
--
-- Le mapping par défaut de reaction_commands contient désormais :
--   ✨ → resume_ai (rendre la main à l'IA)
--   🎵 → confirm_and_produce (ce texte part en chanson, voix/style extraits)
--   🎉 → mark_delivered (la livraison de la chanson est effectuée)
--   ⭐ → mark_returning (le contact est marqué ancien client : pas de vocal, accueil returning)

UPDATE public.studio_personas
   SET reaction_commands = reaction_commands || '{"⭐":"mark_returning"}'::jsonb
 WHERE NOT (reaction_commands ? '⭐');
