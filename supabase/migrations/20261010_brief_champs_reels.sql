-- ============================================================================
-- Brief aligné sur la vraie procédure : occasion → destinataire → expéditeur
-- → message/âme. Avant, seuls occasion + prénom étaient exigés : le brief ne
-- demandait jamais « de la part de qui ? » ni « quel message transmettre ? ».
-- ============================================================================

-- 1. Catalogues existants : ajoute sender_name + memories SANS écraser les
--    champs déjà personnalisés (ex. un studio qui exige aussi 'style').
UPDATE public.studio_catalogues
SET required_fields = (
      SELECT ARRAY_AGG(f ORDER BY ord)
      FROM (
        SELECT DISTINCT u.f AS f,
          CASE u.f
            WHEN 'occasion' THEN 1
            WHEN 'recipient_name' THEN 2
            WHEN 'recipient_relation' THEN 3
            WHEN 'sender_name' THEN 4
            WHEN 'style' THEN 5
            WHEN 'voice' THEN 6
            WHEN 'language' THEN 7
            WHEN 'memories' THEN 8
            WHEN 'photos' THEN 9
            ELSE 10
          END AS ord
        FROM unnest(required_fields || ARRAY['sender_name','memories']) AS u(f)
      ) s
    ),
    updated_at = now()
WHERE NOT ('sender_name' = ANY (required_fields))
   OR NOT ('memories' = ANY (required_fields));

-- 2. Défaut de la colonne pour les futurs catalogues.
ALTER TABLE public.studio_catalogues
  ALTER COLUMN required_fields SET DEFAULT ARRAY['occasion','recipient_name','sender_name','memories'];

-- 3. Ordre des questions du brief : expéditeur + message avant le choix d'offre.
UPDATE public.studio_personas
SET brief_field_order = ARRAY['occasion','recipient_name','sender_name','memories','offer'],
    updated_at = now()
WHERE brief_field_order = ARRAY['occasion','recipient_name','offer'];

-- 4. Défaut de la colonne pour les futurs studios.
ALTER TABLE public.studio_personas
  ALTER COLUMN brief_field_order SET DEFAULT ARRAY['occasion','recipient_name','sender_name','memories','offer'];
