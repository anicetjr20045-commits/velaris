-- Migration 20261009 — CORRECTIF M17 : métriques studio réelles pour le copilot.
--
-- Avant, le copilot injectait des chiffres codés en dur dans son prompt
-- (633 conversations, 637 contacts, 623 commandes, 40340 messages) présentés
-- comme "DONNÉES TEMPS RÉEL DU STUDIO". Désormais, les vrais compteurs sont lus en base.

CREATE OR REPLACE FUNCTION public.copilot_studio_metrics()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_contacts', (SELECT count(*) FROM public.contacts),
    'total_conversations', (SELECT count(*) FROM public.conversations),
    'active_conversations', (SELECT count(*) FROM public.conversations
                              WHERE last_message_at > now() - interval '30 days'
                                AND COALESCE(funnel_stage, '') NOT IN ('delivered', 'closed', 'cancelled')),
    'total_orders', (SELECT count(*) FROM public.orders),
    'total_inbound_messages', (SELECT count(*) FROM public.messages),
    'total_outbound_messages', (SELECT count(*) FROM public.outbound_messages)
  );
$$;

REVOKE ALL ON FUNCTION public.copilot_studio_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_studio_metrics() TO service_role;
