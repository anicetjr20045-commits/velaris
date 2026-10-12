-- ============================================================================
-- Migration : 20261012_reconcile_studio_accounts.sql
-- Réconciliation du compte principal (anicetjr20045@gmail.com)
-- Rattachement de la session WhatsApp "Test" et consolidation sans perte
-- ============================================================================

BEGIN;

-- 1. Réassigner la session WhatsApp Test au compte principal
UPDATE wa_sessions
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE session_name = 'Test';

-- 2. Fusionner les 5 doublons récents vers leurs contacts et conversations historiques d'origine
DO $$
DECLARE
  r RECORD;
  v_old_conv UUID;
  v_recent_conv UUID;
BEGIN
  FOR r IN (
    SELECT c_recent.id AS recent_id, c_old.id AS old_id, c_recent.phone, c_recent.wa_jid
    FROM contacts c_recent
    JOIN contacts c_old ON (
      (c_recent.phone IS NOT NULL AND c_recent.phone <> '' AND c_recent.phone = c_old.phone)
      OR
      (c_recent.wa_jid IS NOT NULL AND c_recent.wa_jid <> '' AND c_recent.wa_jid = c_old.wa_jid)
    ) AND c_old.user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
    WHERE c_recent.user_id = '043a33b4-429c-4056-b333-ee61d4c0a515'
  ) LOOP
    -- Trouver la conversation historique existante
    SELECT id INTO v_old_conv
      FROM conversations
     WHERE contact_id = r.old_id AND user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
     ORDER BY created_at ASC
     LIMIT 1;

    -- Trouver la conversation récente sous le compte temporaire
    SELECT id INTO v_recent_conv
      FROM conversations
     WHERE contact_id = r.recent_id AND user_id = '043a33b4-429c-4056-b333-ee61d4c0a515'
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_old_conv IS NOT NULL AND v_recent_conv IS NOT NULL THEN
      -- Transférer tous les messages vers la conversation historique
      UPDATE messages
         SET conversation_id = v_old_conv,
             user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
       WHERE conversation_id = v_recent_conv;

      -- Transférer toutes les commandes récentes
      UPDATE orders
         SET conversation_id = v_old_conv,
             contact_id = r.old_id,
             user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
       WHERE conversation_id = v_recent_conv;

      -- Transférer les messages sortants outbox
      UPDATE outbound_messages
         SET conversation_id = v_old_conv,
             user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
       WHERE conversation_id = v_recent_conv;

      -- Transférer les tours
      UPDATE conversation_turns
         SET conversation_id = v_old_conv,
             user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
       WHERE conversation_id = v_recent_conv;

      -- Transférer les logs d'agent
      UPDATE agent_turn_logs
         SET conversation_id = v_old_conv,
             user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
       WHERE conversation_id = v_recent_conv;

      -- Transférer les handoffs
      UPDATE handoffs
         SET conversation_id = v_old_conv,
             user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
       WHERE conversation_id = v_recent_conv;

      -- Purger les verrous d'automatisation
      DELETE FROM automation_locks WHERE conversation_id = v_recent_conv;

      -- Mettre à jour l'horodatage et le stage de la conversation historique
      UPDATE conversations c_old
         SET last_message_at = GREATEST(c_old.last_message_at, c_rec.last_message_at),
             funnel_stage = COALESCE(c_rec.funnel_stage, c_old.funnel_stage)
        FROM conversations c_rec
       WHERE c_old.id = v_old_conv AND c_rec.id = v_recent_conv;

      -- Supprimer la conversation doublon
      DELETE FROM conversations WHERE id = v_recent_conv;
    END IF;

    -- Raccrocher toute commande orpheline restante liée au recent_id
    UPDATE orders
       SET contact_id = r.old_id,
           user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
     WHERE contact_id = r.recent_id;

    -- Supprimer le contact temporaire doublon
    DELETE FROM contacts WHERE id = r.recent_id;

    RAISE NOTICE 'Fusionné contact % vers historique % (tel: %)', r.recent_id, r.old_id, r.phone;
  END LOOP;
END $$;

-- 3. Transférer tous les contacts récents restants (les 20 nouveaux numéros) vers le compte principal
UPDATE contacts
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

-- 4. Transférer toutes les conversations, messages, commandes, tours et logs restants
UPDATE conversations
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE messages
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE orders
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE outbound_messages
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE conversation_turns
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE agent_turn_logs
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE handoffs
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE inbound_events
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

UPDATE automation_rules
SET user_id = '149fb40a-3500-4c3c-b935-194ead0b2e46'
WHERE user_id = '043a33b4-429c-4056-b333-ee61d4c0a515';

COMMIT;
