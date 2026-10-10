-- Migration 20261009 — Ajoute la commande 🎉 → mark_delivered aux studios existants.
--
-- Le mapping par défaut de reaction_commands contient désormais :
--   ✨ → resume_ai (rendre la main à l'IA)
--   🎵 → confirm_and_produce (ce texte part en chanson, voix/style extraits)
--   🎉 → mark_delivered (la livraison de la chanson est effectuée)
--   📝 → mark_as_lyrics (enregistrer comme paroles)
-- Cette migration ajoute 🎉 aux lignes existantes qui ne l'ont pas encore.

UPDATE public.studio_personas
   SET reaction_commands = reaction_commands || '{"🎉":"mark_delivered"}'::jsonb
 WHERE NOT (reaction_commands ? '🎉');
