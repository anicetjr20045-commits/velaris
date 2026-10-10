-- ============================================================================
-- VELARIS — CŒUR DE L'AGENT WHATSAPP
-- Migration : 20261004_agent_core.sql
-- Référence : ARCHITECTURE_AGENT_DEFINITIVE.md (version 2), § 6
--
-- Idempotente : peut être rejouée sans erreur.
-- NE PAS APPLIQUER EN PRODUCTION avant l'étape 0.3 du plan (relevé du schéma réel
-- de messages / conversations / orders / funnel_stage écrit par waha-bridge).
-- Ordre d'application : supabase_schema_init.sql → supabase_auth_multitenant.sql
--   → 20261002_billing_admin_hardening.sql → cette migration.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. STUDIO : FICHE, CATALOGUE, POLITIQUES D'ÉTAPE, GABARITS, MÉDIAS, DRAPEAUX
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_personas (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  studio_name           TEXT NOT NULL CHECK (char_length(studio_name) BETWEEN 2 AND 60),
  agent_name            TEXT NOT NULL DEFAULT 'Alex' CHECK (char_length(agent_name) BETWEEN 2 AND 30),
  manager_first_name    TEXT NOT NULL CHECK (char_length(manager_first_name) BETWEEN 2 AND 30),
  tone                  TEXT NOT NULL DEFAULT 'chaleureux' CHECK (tone IN ('chaleureux','sobre','enjoue')),
  formal_address        BOOLEAN NOT NULL DEFAULT TRUE,
  emoji_policy          TEXT NOT NULL DEFAULT 'none' CHECK (emoji_policy IN ('none','sparing')),
  timezone              TEXT NOT NULL DEFAULT 'Africa/Ouagadougou',
  agent_hours           JSONB NOT NULL DEFAULT '{"all":["00:00","24:00"]}',
  manager_hours         JSONB NOT NULL DEFAULT '{"mon":["07:30","22:00"],"tue":["07:30","22:00"],"wed":["07:30","22:00"],"thu":["07:30","22:00"],"fri":["07:30","22:00"],"sat":["08:00","22:00"],"sun":["09:00","21:00"]}',
  followup_hours        JSONB NOT NULL DEFAULT '{"all":["08:00","20:30"]}',
  payment_window_hours  JSONB NOT NULL DEFAULT '{"all":["07:00","21:00"]}',
  alert_phone           TEXT CHECK (alert_phone ~ '^[0-9]{8,15}$'),
  agent_session_name    TEXT,
  cap_reception         BOOLEAN NOT NULL DEFAULT FALSE,
  cap_procedure_voice   BOOLEAN NOT NULL DEFAULT FALSE,
  cap_lyrics_followup   BOOLEAN NOT NULL DEFAULT FALSE,
  cap_payment           BOOLEAN NOT NULL DEFAULT FALSE,
  cap_lyrics_draft      BOOLEAN NOT NULL DEFAULT FALSE,
  cap_auto_production   BOOLEAN NOT NULL DEFAULT FALSE,
  cap_video             BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_mode         TEXT NOT NULL DEFAULT 'shadow' CHECK (delivery_mode IN ('shadow','live')),
  relay_mode            TEXT NOT NULL DEFAULT 'safe_templates' CHECK (relay_mode IN ('off','safe_templates')),
  quiet_window_ms       INT NOT NULL DEFAULT 4000  CHECK (quiet_window_ms BETWEEN 1500 AND 15000),
  max_batch_wait_ms     INT NOT NULL DEFAULT 12000 CHECK (max_batch_wait_ms BETWEEN 3000 AND 30000),
  handoff_sla_minutes   SMALLINT NOT NULL DEFAULT 15 CHECK (handoff_sla_minutes BETWEEN 5 AND 240),
  max_agent_msgs_per_hour SMALLINT NOT NULL DEFAULT 6 CHECK (max_agent_msgs_per_hour BETWEEN 2 AND 20),
  max_open_orders       SMALLINT NOT NULL DEFAULT 3 CHECK (max_open_orders BETWEEN 1 AND 5),
  max_followups         SMALLINT NOT NULL DEFAULT 2 CHECK (max_followups BETWEEN 0 AND 3),
  followup_delay_hours  SMALLINT NOT NULL DEFAULT 24 CHECK (followup_delay_hours BETWEEN 6 AND 72),
  max_free_revisions    SMALLINT NOT NULL DEFAULT 2 CHECK (max_free_revisions BETWEEN 0 AND 5),
  agent_handoff_expiry_minutes INT CHECK (agent_handoff_expiry_minutes IS NULL OR agent_handoff_expiry_minutes BETWEEN 30 AND 2880),
  procedure_voice_validity_days INT CHECK (procedure_voice_validity_days IS NULL OR procedure_voice_validity_days BETWEEN 30 AND 3650),
  brief_field_order     TEXT[] NOT NULL DEFAULT ARRAY['occasion','recipient_name','offer'],
  lyrics_author         TEXT NOT NULL DEFAULT 'manager' CHECK (lyrics_author IN ('manager','ai_draft_approved')),
  payment_methods       JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(payment_methods) = 'array'),
  reaction_commands     JSONB NOT NULL DEFAULT '{"🎵":"confirm_and_produce","✨":"resume_ai","📝":"mark_as_lyrics"}',
  daily_llm_budget_xof  INT NOT NULL DEFAULT 1500 CHECK (daily_llm_budget_xof BETWEEN 0 AND 100000),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.studio_catalogues (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code               TEXT NOT NULL CHECK (code ~ '^[a-z0-9_]{2,32}$'),
  label              TEXT NOT NULL CHECK (char_length(label) BETWEEN 2 AND 60),
  description        TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 280),
  price_xof          INT  NOT NULL CHECK (price_xof BETWEEN 100 AND 1000000),
  deliverable        TEXT NOT NULL CHECK (deliverable IN ('lyrics','audio','audio_video')),
  lyrics_lead_minutes     INT NOT NULL DEFAULT 8  CHECK (lyrics_lead_minutes BETWEEN 1 AND 2880),
  production_lead_minutes INT NOT NULL DEFAULT 18 CHECK (production_lead_minutes BETWEEN 1 AND 2880),
  video_lead_minutes      INT CHECK (video_lead_minutes IS NULL OR video_lead_minutes BETWEEN 10 AND 10080),
  payment_policy     TEXT NOT NULL DEFAULT 'after_lyrics_validation'
                     CHECK (payment_policy IN ('after_lyrics_validation','before_lyrics')),
  required_fields    TEXT[] NOT NULL DEFAULT ARRAY['occasion','recipient_name'],
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         SMALLINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code),
  CONSTRAINT chk_required_fields CHECK (required_fields <@ ARRAY[
    'occasion','recipient_name','recipient_relation','sender_name','style','voice','language','memories','photos'])
);
CREATE INDEX IF NOT EXISTS idx_catalogue_user_active ON public.studio_catalogues (user_id) WHERE is_active;

-- Canal par étape : texte IA, gabarit, vocal du gérant, vocal puis gabarit, silence
CREATE TABLE IF NOT EXISTS public.studio_step_policies (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step         TEXT NOT NULL CHECK (step IN (
                 'welcome','offers','procedure','brief_question','story_ack','lyrics_wait',
                 'lyrics_delivery','lyrics_feedback','payment','payment_ack','payment_deferral',
                 'production','delivery','video_photos','after_sales','trust','sample','identity',
                 'handoff_ack','stop_ack')),
  channel      TEXT NOT NULL CHECK (channel IN ('ai_text','template','voice','voice_then_template','silent')),
  asset_id     UUID,
  template_key TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step),
  -- Les coordonnées de paiement sont toujours écrites (un numéro dicté se recopie mal)
  CONSTRAINT chk_payment_written CHECK (step <> 'payment' OR channel IN ('template','voice_then_template')),
  -- Les messages de protection du client ne peuvent pas être rendus silencieux
  CONSTRAINT chk_protective_not_silent CHECK (step NOT IN ('handoff_ack','stop_ack','identity') OR channel <> 'silent'),
  -- Un canal vocal exige un vocal
  CONSTRAINT chk_voice_asset CHECK (channel NOT IN ('voice','voice_then_template') OR asset_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.studio_templates (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key          TEXT NOT NULL CHECK (key ~ '^[a-z0-9_.]{2,64}$'),
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 1000),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS public.studio_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('voice','sample_audio','sample_video','image')),
  purpose      TEXT NOT NULL CHECK (char_length(purpose) BETWEEN 2 AND 40),
  occasion     TEXT,
  storage_path TEXT NOT NULL,
  duration_s   INT CHECK (duration_s IS NULL OR duration_s BETWEEN 1 AND 600),
  caption      TEXT CHECK (caption IS NULL OR char_length(caption) <= 200),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_user_purpose ON public.studio_assets (user_id, purpose) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.engine_flags (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.engine_flags (key, value) VALUES ('agent_global_enabled', 'true') ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. SESSIONS, CONVERSATIONS, MESSAGES
-- ============================================================================

ALTER TABLE public.wa_sessions ADD COLUMN IF NOT EXISTS engine_owner TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.wa_sessions DROP CONSTRAINT IF EXISTS chk_engine_owner;
ALTER TABLE public.wa_sessions ADD CONSTRAINT chk_engine_owner
  CHECK (engine_owner IN ('none','velaris_engine','legacy_agent'));

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS control_mode          TEXT NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS control_reason        TEXT,
  ADD COLUMN IF NOT EXISTS control_actor         TEXT,
  ADD COLUMN IF NOT EXISTS control_set_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS control_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS focus_order_id        UUID,
  ADD COLUMN IF NOT EXISTS pending_question      JSONB,
  ADD COLUMN IF NOT EXISTS ack_log               JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS low_conf_streak       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_question_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_requests     SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followups_sent        SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supersede_streak      SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_inbound_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_merchant_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_agent_outbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_name          TEXT,
  ADD COLUMN IF NOT EXISTS chat_id               TEXT;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS chk_control_mode;
ALTER TABLE public.conversations ADD CONSTRAINT chk_control_mode CHECK (control_mode IN ('ai','human','closed'));
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS chk_control_actor;
ALTER TABLE public.conversations ADD CONSTRAINT chk_control_actor
  CHECK (control_actor IS NULL OR control_actor IN ('merchant','agent','system'));

-- Reprise des pauses existantes : toute conversation en pause passe sous contrôle du gérant
UPDATE public.conversations
   SET control_mode = 'human',
       control_reason = COALESCE(pause_reason, 'legacy_pause'),
       control_actor = 'merchant',
       control_set_at = now()
 WHERE ai_paused IS TRUE AND control_mode = 'ai';

-- Une conversation par (studio, client). Doublons existants : avis, index non créé.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_user_contact ON public.conversations (user_id, contact_id);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'uq_conversations_user_contact non créé : conversations en double à fusionner avant de rejouer.';
END $$;

CREATE OR REPLACE FUNCTION public.agent_sync_legacy_pause() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.ai_paused    := (NEW.control_mode <> 'ai');
  NEW.pause_reason := CASE WHEN NEW.control_mode = 'ai' THEN NULL ELSE NEW.control_reason END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_agent_sync_legacy_pause ON public.conversations;
CREATE TRIGGER trg_agent_sync_legacy_pause
  BEFORE INSERT OR UPDATE OF control_mode, control_reason ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.agent_sync_legacy_pause();

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_message_id     TEXT,
  ADD COLUMN IF NOT EXISTS wa_message_key    TEXT,
  ADD COLUMN IF NOT EXISTS wa_timestamp      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_kind        TEXT,
  ADD COLUMN IF NOT EXISTS media_path        TEXT,
  ADD COLUMN IF NOT EXISTS transcript        TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status TEXT,
  ADD COLUMN IF NOT EXISTS merchant_kind     TEXT,
  ADD COLUMN IF NOT EXISTS outbox_id         UUID,
  ADD COLUMN IF NOT EXISTS turn_id           UUID,
  ADD COLUMN IF NOT EXISTS metadata          JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS chk_media_kind;
ALTER TABLE public.messages ADD CONSTRAINT chk_media_kind
  CHECK (media_kind IS NULL OR media_kind IN ('audio','image','video','document','sticker'));
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS chk_transcript_status;
ALTER TABLE public.messages ADD CONSTRAINT chk_transcript_status
  CHECK (transcript_status IS NULL OR transcript_status IN ('pending','done','failed'));
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS chk_merchant_kind;
ALTER TABLE public.messages ADD CONSTRAINT chk_merchant_kind
  CHECK (merchant_kind IS NULL OR merchant_kind IN ('lyrics','price_quote','payment_details',
         'payment_received_statement','delivery_note','question_to_client','chat'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_user_wakey
  ON public.messages (user_id, wa_message_key) WHERE wa_message_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at);

-- ============================================================================
-- 3. JOURNAL D'INGESTION, FILE DE TOURS, VERROU PAR CONVERSATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inbound_events (
  id            BIGSERIAL PRIMARY KEY,
  session_name  TEXT NOT NULL,
  user_id       UUID,
  event_type    TEXT NOT NULL,
  dedup_key     TEXT NOT NULL,
  payload       JSONB NOT NULL,
  source        TEXT NOT NULL DEFAULT 'webhook' CHECK (source IN ('webhook','catch_up','spool_replay')),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','ignored','failed')),
  reason        TEXT,
  processed_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbound_events_dedup
  ON public.inbound_events (session_name, event_type, dedup_key);
CREATE INDEX IF NOT EXISTS idx_inbound_events_pending
  ON public.inbound_events (received_at) WHERE status = 'received';

CREATE TABLE IF NOT EXISTS public.conversation_turns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  conversation_id     UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  trigger             TEXT NOT NULL CHECK (trigger IN ('client_message','merchant_message','merchant_reaction',
                        'merchant_command','followup','payment_event','production_event','relay_check','sla_check')),
  status              TEXT NOT NULL CHECK (status IN ('collecting','scheduled','running','done','superseded','failed','cancelled')),
  inbound_message_ids UUID[] NOT NULL DEFAULT '{}',
  trigger_data        JSONB NOT NULL DEFAULT '{}',
  first_event_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at            TIMESTAMPTZ NOT NULL,
  lock_token          BIGINT,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  attempts            SMALLINT NOT NULL DEFAULT 0,
  outcome             TEXT,
  error               TEXT
);
-- Le tampon de regroupement des rafales : un seul tour en collecte par conversation
CREATE UNIQUE INDEX IF NOT EXISTS uq_turn_collecting
  ON public.conversation_turns (conversation_id) WHERE status = 'collecting';
CREATE INDEX IF NOT EXISTS idx_turns_ready
  ON public.conversation_turns (ready_at) WHERE status IN ('collecting','scheduled');
CREATE INDEX IF NOT EXISTS idx_turns_running
  ON public.conversation_turns (conversation_id) WHERE status = 'running';

CREATE SEQUENCE IF NOT EXISTS public.agent_lock_token_seq;
CREATE TABLE IF NOT EXISTS public.automation_locks (
  conversation_id  UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,
  holder           TEXT NOT NULL,
  token            BIGINT NOT NULL,
  turn_id          UUID,
  lease_until      TIMESTAMPTZ NOT NULL,
  acquired_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. BOÎTE D'ENVOI
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  conversation_id  UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  order_id         UUID,
  turn_id          UUID,
  origin           TEXT NOT NULL CHECK (origin IN ('agent','merchant_ui','automation','system_alert','delivery')),
  kind             TEXT NOT NULL CHECK (kind IN ('text','voice','file','image','video')),
  purpose          TEXT NOT NULL CHECK (purpose IN ('reply','handoff_ack','stop_ack','identity','payment_instructions',
                     'payment_claim_ack','procedure_voice','offers_voice','sample','lyrics','song','video','status_eta',
                     'owner_alert','followup','merchant')),
  is_relay         BOOLEAN NOT NULL DEFAULT FALSE,
  session_name     TEXT NOT NULL,
  chat_id          TEXT NOT NULL,
  body             TEXT,
  media_path       TEXT,
  caption          TEXT,
  body_hash        TEXT,
  idempotency_key  TEXT NOT NULL UNIQUE,
  lock_token       BIGINT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('proposed','pending','sending','sent','unknown','failed','cancelled','rejected','expired')),
  not_before       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  wa_message_id    TEXT,
  wa_message_key   TEXT,
  attempts         SMALLINT NOT NULL DEFAULT 0,
  error            TEXT,
  decided_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sending_at       TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  -- Un envoi de l'agent porte toujours le jeton du verrou qui l'a produit
  CONSTRAINT chk_agent_token CHECK (origin <> 'agent' OR lock_token IS NOT NULL),
  CONSTRAINT chk_content CHECK (body IS NOT NULL OR media_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbound_messages (not_before) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_echo ON public.outbound_messages (session_name, chat_id, created_at DESC)
  WHERE status IN ('sending','sent','unknown');
CREATE INDEX IF NOT EXISTS idx_outbox_rate ON public.outbound_messages (conversation_id, sending_at)
  WHERE origin = 'agent';
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_wakey
  ON public.outbound_messages (user_id, wa_message_key) WHERE wa_message_key IS NOT NULL;

-- ============================================================================
-- 5. COMMANDES : DEUX PISTES (CRÉATION / PAIEMENT), PLUSIEURS COMMANDES, VIDÉO
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stage                      TEXT NOT NULL DEFAULT 'collecting_brief',
  ADD COLUMN IF NOT EXISTS payment_status             TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS version                    INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catalogue_code             TEXT,
  ADD COLUMN IF NOT EXISTS price_xof                  INT,
  ADD COLUMN IF NOT EXISTS price_source               TEXT,
  ADD COLUMN IF NOT EXISTS deliverable                TEXT,
  ADD COLUMN IF NOT EXISTS payment_policy             TEXT,
  ADD COLUMN IF NOT EXISTS occasion                   TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name             TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recipient_relation         TEXT,
  ADD COLUMN IF NOT EXISTS sender_name                TEXT,
  ADD COLUMN IF NOT EXISTS style                      TEXT,
  ADD COLUMN IF NOT EXISTS voice                      TEXT,
  ADD COLUMN IF NOT EXISTS language                   TEXT,
  ADD COLUMN IF NOT EXISTS memories                   JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sensitive_topic            TEXT,
  ADD COLUMN IF NOT EXISTS field_evidence             JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_own_lyrics          TEXT,
  ADD COLUMN IF NOT EXISTS lyrics                     TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_source              TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_version             SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_count             SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lyrics_message_id          UUID,
  ADD COLUMN IF NOT EXISTS lyrics_sent_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lyrics_validated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_requests            JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS payment_instructions_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_instructions_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deferral           JSONB,
  ADD COLUMN IF NOT EXISTS payment_claimed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_claim_message_id   UUID,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by       TEXT,
  ADD COLUMN IF NOT EXISTS song_generation_id         UUID,
  ADD COLUMN IF NOT EXISTS audio_delivered_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_message_id       UUID,
  ADD COLUMN IF NOT EXISTS inferred_fields            JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage_changed_at           TIMESTAMPTZ NOT NULL DEFAULT now();

-- Reprise des commandes existantes (avant les déclencheurs) : sans cela, une commande
-- livrée prendrait l'étape par défaut 'collecting_brief'. Rejouable : ne touche que les
-- lignes encore à l'état par défaut et dont le statut historique dit autre chose.
UPDATE public.orders SET
  stage = CASE status
            WHEN 'delivered' THEN 'delivered'
            WHEN 'cancelled' THEN 'cancelled'
            WHEN 'validated' THEN 'lyrics_validated'
            ELSE stage END,
  payment_status = CASE WHEN status IN ('validated','delivered') THEN 'confirmed' ELSE payment_status END,
  payment_confirmed_by = CASE WHEN status IN ('validated','delivered') THEN 'merchant' ELSE payment_confirmed_by END,
  payment_confirmed_at = CASE WHEN status IN ('validated','delivered') THEN COALESCE(validated_at, created_at) ELSE payment_confirmed_at END,
  price_xof = CASE WHEN price_xof IS NULL AND amount_cents > 0 THEN amount_cents / 100 ELSE price_xof END,
  price_source = CASE WHEN price_source IS NULL AND amount_cents > 0 THEN 'merchant' ELSE price_source END
WHERE stage = 'collecting_brief' AND payment_status = 'unpaid' AND status IN ('delivered','cancelled','validated');

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_order_stage;
ALTER TABLE public.orders ADD CONSTRAINT chk_order_stage CHECK (stage IN (
  'collecting_brief','brief_complete','lyrics_in_progress','lyrics_sent','lyrics_validated',
  'in_production','audio_delivered','video_in_progress','delivered','closed','cancelled'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT chk_payment_status CHECK (payment_status IN (
  'unpaid','instructions_sent','claimed','confirmed','refunded'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_order_price;
ALTER TABLE public.orders ADD CONSTRAINT chk_order_price CHECK (price_xof IS NULL OR price_xof > 0);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_order_voice;
ALTER TABLE public.orders ADD CONSTRAINT chk_order_voice CHECK (voice IS NULL OR voice IN ('male','female','duo'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_price_source;
ALTER TABLE public.orders ADD CONSTRAINT chk_price_source CHECK (price_source IS NULL OR price_source IN ('catalogue','merchant'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_deliverable;
ALTER TABLE public.orders ADD CONSTRAINT chk_deliverable CHECK (deliverable IS NULL OR deliverable IN ('lyrics','audio','audio_video'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_payment_policy;
ALTER TABLE public.orders ADD CONSTRAINT chk_payment_policy
  CHECK (payment_policy IS NULL OR payment_policy IN ('after_lyrics_validation','before_lyrics'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_payment_confirmed_by;
ALTER TABLE public.orders ADD CONSTRAINT chk_payment_confirmed_by
  CHECK (payment_confirmed_by IS NULL OR payment_confirmed_by IN ('merchant','saspay'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_lyrics_source;
ALTER TABLE public.orders ADD CONSTRAINT chk_lyrics_source CHECK (lyrics_source IS NULL OR lyrics_source IN
  ('merchant_whatsapp','merchant_studio','ai_draft_approved'));
CREATE INDEX IF NOT EXISTS idx_orders_conversation_open ON public.orders (conversation_id)
  WHERE stage NOT IN ('delivered','closed','cancelled');
CREATE INDEX IF NOT EXISTS idx_orders_contact ON public.orders (contact_id, stage);

CREATE TABLE IF NOT EXISTS public.order_assets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL,
  order_id              UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  conversation_id       UUID NOT NULL,
  message_id            UUID NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('photo','payment_proof','unclassified')),
  classifier_confidence NUMERIC(3,2),
  storage_path          TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, order_id)
);

-- Compatibilité interface : status / amount_cents / dates dérivés des deux pistes
CREATE OR REPLACE FUNCTION public.agent_sync_order_legacy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.stage = 'cancelled'             THEN 'cancelled'
    WHEN NEW.stage IN ('delivered','closed') THEN 'delivered'
    WHEN NEW.payment_status = 'confirmed'    THEN 'validated'
    ELSE 'pending' END;
  IF NEW.price_xof IS NOT NULL THEN NEW.amount_cents := NEW.price_xof * 100; END IF;
  IF NEW.payment_status = 'confirmed' AND NEW.validated_at IS NULL THEN NEW.validated_at := now(); END IF;
  IF NEW.stage = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_agent_sync_order_legacy ON public.orders;
CREATE TRIGGER trg_agent_sync_order_legacy
  BEFORE INSERT OR UPDATE OF stage, payment_status, price_xof ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.agent_sync_order_legacy();

-- Entonnoir de la conversation : la commande ouverte la plus avancée l'emporte
CREATE OR REPLACE FUNCTION public.agent_sync_funnel_stage() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v TEXT;
BEGIN
  IF NEW.conversation_id IS NULL THEN RETURN NULL; END IF;
  SELECT CASE
    WHEN bool_or(stage NOT IN ('delivered','closed','cancelled') AND payment_status = 'confirmed')                     THEN 'paid'
    WHEN bool_or(stage IN ('in_production','audio_delivered','video_in_progress'))                                     THEN 'paid'
    WHEN bool_or(stage NOT IN ('delivered','closed','cancelled') AND payment_status IN ('instructions_sent','claimed')) THEN 'payment_pending'
    WHEN bool_or(stage IN ('brief_complete','lyrics_in_progress','lyrics_sent','lyrics_validated'))                    THEN 'presenting'
    WHEN bool_or(stage = 'collecting_brief')                                                                           THEN 'qualifying'
    WHEN bool_or(stage IN ('delivered','closed'))                                                                      THEN 'delivered'
    ELSE 'lost' END
    INTO v
    FROM public.orders
   WHERE conversation_id = NEW.conversation_id;
  UPDATE public.conversations SET funnel_stage = COALESCE(v, funnel_stage) WHERE id = NEW.conversation_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_agent_sync_funnel_stage ON public.orders;
CREATE TRIGGER trg_agent_sync_funnel_stage
  AFTER INSERT OR UPDATE OF stage, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.agent_sync_funnel_stage();

-- ============================================================================
-- 6. TRANSITIONS AUTORISÉES (miroir exact de engine/src/domain/orders.ts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_transitions (
  track           TEXT NOT NULL CHECK (track IN ('creative','payment')),
  from_state      TEXT NOT NULL,
  event           TEXT NOT NULL,
  to_state        TEXT NOT NULL,
  allowed_actors  TEXT[] NOT NULL,
  PRIMARY KEY (track, from_state, event)
);

-- Rejouable : la table est réécrite intégralement à chaque application
DELETE FROM public.order_transitions;
INSERT INTO public.order_transitions (track, from_state, event, to_state, allowed_actors) VALUES
  -- Piste créative
  ('creative','collecting_brief',  'brief_completed',      'brief_complete',     ARRAY['agent','merchant']),
  ('creative','brief_complete',    'lyrics_work_started',  'lyrics_in_progress', ARRAY['agent','merchant','system']),
  ('creative','collecting_brief',  'lyrics_sent',          'lyrics_sent',        ARRAY['merchant']),
  ('creative','brief_complete',    'lyrics_sent',          'lyrics_sent',        ARRAY['merchant']),
  ('creative','lyrics_in_progress','lyrics_sent',          'lyrics_sent',        ARRAY['agent','merchant']),
  ('creative','lyrics_sent',       'lyrics_sent',          'lyrics_sent',        ARRAY['merchant']),
  ('creative','lyrics_sent',       'change_requested',     'lyrics_in_progress', ARRAY['agent','merchant']),
  ('creative','lyrics_sent',       'lyrics_validated',     'lyrics_validated',   ARRAY['agent','merchant']),
  ('creative','lyrics_validated',  'production_started',   'in_production',      ARRAY['agent','merchant','system']),
  ('creative','lyrics_validated',  'delivery_sent',        'delivered',          ARRAY['merchant','system']),
  ('creative','in_production',     'delivery_sent',        'delivered',          ARRAY['merchant','system']),
  ('creative','in_production',     'audio_delivered',      'audio_delivered',    ARRAY['merchant','system']),
  ('creative','in_production',     'production_failed',    'lyrics_validated',   ARRAY['system']),
  ('creative','audio_delivered',   'video_started',        'video_in_progress',  ARRAY['merchant','system']),
  ('creative','video_in_progress', 'delivery_sent',        'delivered',          ARRAY['merchant','system']),
  ('creative','delivered',         'after_sales_closed',   'closed',             ARRAY['agent','merchant','system']),
  ('creative','collecting_brief',  'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','brief_complete',    'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','lyrics_in_progress','order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','lyrics_sent',       'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','lyrics_validated',  'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','in_production',     'order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','audio_delivered',   'order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','video_in_progress', 'order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','collecting_brief',  'abandoned',            'cancelled',          ARRAY['system']),
  -- Piste paiement
  ('payment','unpaid',             'instructions_sent',    'instructions_sent',  ARRAY['agent','merchant','system']),
  ('payment','instructions_sent',  'instructions_sent',    'instructions_sent',  ARRAY['agent','merchant','system']),
  ('payment','unpaid',             'payment_claimed',      'claimed',            ARRAY['agent','merchant']),
  ('payment','instructions_sent',  'payment_claimed',      'claimed',            ARRAY['agent','merchant']),
  ('payment','claimed',            'payment_claimed',      'claimed',            ARRAY['agent','merchant']),
  ('payment','unpaid',             'payment_confirmed',    'confirmed',          ARRAY['merchant','saspay']),
  ('payment','instructions_sent',  'payment_confirmed',    'confirmed',          ARRAY['merchant','saspay']),
  ('payment','claimed',            'payment_confirmed',    'confirmed',          ARRAY['merchant','saspay']),
  ('payment','claimed',            'payment_rejected',     'instructions_sent',  ARRAY['merchant']),
  ('payment','confirmed',          'payment_refunded',     'refunded',           ARRAY['merchant']);

CREATE TABLE IF NOT EXISTS public.order_events (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  track       TEXT NOT NULL,
  from_state  TEXT NOT NULL,
  to_state    TEXT NOT NULL,
  event       TEXT NOT NULL,
  actor       TEXT NOT NULL,
  inferred    BOOLEAN NOT NULL DEFAULT FALSE,
  turn_id     UUID,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.order_events (order_id, created_at);

-- ============================================================================
-- 7. PASSATIONS ET JOURNAL DES TOURS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.handoffs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  order_id          UUID,
  origin            TEXT NOT NULL CHECK (origin IN ('merchant','agent')),
  reason            TEXT NOT NULL,
  detail            TEXT,
  summary           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','returned','expired')),
  ack_sent_at       TIMESTAMPTZ,
  alert_sent_at     TIMESTAMPTZ,
  sla_alerts        SMALLINT NOT NULL DEFAULT 0,
  last_sla_alert_at TIMESTAMPTZ,
  relay_log         JSONB NOT NULL DEFAULT '{}',
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  closed_by         TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_handoff_open ON public.handoffs (conversation_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.agent_turn_logs (
  id                BIGSERIAL PRIMARY KEY,
  turn_id           UUID NOT NULL,
  user_id           UUID NOT NULL,
  conversation_id   UUID NOT NULL,
  policy_version    TEXT NOT NULL,
  orders_before     JSONB,
  orders_after      JSONB,
  understanding     JSONB,
  target_resolution JSONB,
  decision          JSONB,
  actions           JSONB,
  draft             JSONB,
  guard_results     JSONB,
  final_outbox_ids  UUID[],
  outcome           TEXT NOT NULL,
  models            JSONB,
  tokens            JSONB,
  cost_xof          NUMERIC(8,2),
  latency_ms        INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_turn_logs_user ON public.agent_turn_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_turn_logs_turn ON public.agent_turn_logs (turn_id);

-- ============================================================================
-- 8. FONCTIONS ATOMIQUES
-- ============================================================================

-- 8.1 Tampon de regroupement des rafales ---------------------------------------
CREATE OR REPLACE FUNCTION public.agent_buffer_inbound(
  p_user UUID, p_conversation UUID, p_message UUID,
  p_quiet_ms INT, p_max_wait_ms INT, p_hold BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_turn UUID;
BEGIN
  -- Toute relance programmée tombe dès que le client écrit
  UPDATE conversation_turns SET status = 'cancelled', outcome = 'client_wrote', finished_at = now()
   WHERE conversation_id = p_conversation AND status = 'scheduled' AND trigger = 'followup';

  INSERT INTO conversation_turns AS t
    (user_id, conversation_id, trigger, status, inbound_message_ids, first_event_at, last_event_at, ready_at)
  VALUES (p_user, p_conversation, 'client_message', 'collecting', ARRAY[p_message], now(), now(),
          now() + make_interval(secs => (CASE WHEN p_hold THEN p_max_wait_ms ELSE p_quiet_ms END) / 1000.0))
  ON CONFLICT (conversation_id) WHERE status = 'collecting'
  DO UPDATE SET
    inbound_message_ids = CASE WHEN p_message = ANY (t.inbound_message_ids) THEN t.inbound_message_ids
                               ELSE t.inbound_message_ids || EXCLUDED.inbound_message_ids END,
    last_event_at = now(),
    ready_at = LEAST(now() + make_interval(secs => p_quiet_ms / 1000.0),
                     t.first_event_at + make_interval(secs => p_max_wait_ms / 1000.0))
  RETURNING t.id INTO v_turn;

  UPDATE conversations SET last_inbound_at = now() WHERE id = p_conversation;
  RETURN v_turn;
END $$;

-- 8.2 Réservation d'un tour prêt + prise du verrou ------------------------------
CREATE OR REPLACE FUNCTION public.agent_claim_turn(p_worker TEXT, p_lease_seconds INT DEFAULT 90)
RETURNS TABLE (turn_id UUID, conversation_id UUID, user_id UUID, lock_token BIGINT, trigger TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_token BIGINT; v_got BIGINT;
BEGIN
  FOR r IN
    SELECT t.id, t.conversation_id, t.user_id, t.trigger
      FROM conversation_turns t
     WHERE t.status IN ('collecting','scheduled')
       AND t.ready_at <= now()
       AND NOT EXISTS (SELECT 1 FROM messages m
                        WHERE m.id = ANY (t.inbound_message_ids) AND m.transcript_status = 'pending'
                          AND t.first_event_at > now() - interval '45 seconds')
     ORDER BY t.ready_at
     LIMIT 20
     FOR UPDATE OF t SKIP LOCKED
  LOOP
    v_token := nextval('agent_lock_token_seq');
    v_got := NULL;
    INSERT INTO automation_locks AS l (conversation_id, user_id, holder, token, turn_id, lease_until, acquired_at)
    VALUES (r.conversation_id, r.user_id, p_worker, v_token, r.id, now() + make_interval(secs => p_lease_seconds), now())
    ON CONFLICT ON CONSTRAINT automation_locks_pkey DO UPDATE
       SET holder = EXCLUDED.holder, token = EXCLUDED.token, turn_id = EXCLUDED.turn_id,
           lease_until = EXCLUDED.lease_until, acquired_at = EXCLUDED.acquired_at
     WHERE l.lease_until <= now()
    RETURNING l.token INTO v_got;

    IF v_got IS NOT NULL THEN
      UPDATE conversation_turns c
         SET status = 'running', lock_token = v_got, started_at = now(), attempts = c.attempts + 1
       WHERE c.id = r.id;
      turn_id := r.id; conversation_id := r.conversation_id; user_id := r.user_id;
      lock_token := v_got; trigger := r.trigger;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  RETURN;
END $$;

-- 8.3 Bail : prolongation et fin de tour ---------------------------------------
CREATE OR REPLACE FUNCTION public.agent_renew_lease(p_conversation UUID, p_token BIGINT, p_lease_seconds INT DEFAULT 90)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE automation_locks SET lease_until = now() + make_interval(secs => p_lease_seconds)
     WHERE conversation_id = p_conversation AND token = p_token AND lease_until > now()
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;

CREATE OR REPLACE FUNCTION public.agent_finish_turn(p_turn UUID, p_conversation UUID, p_token BIGINT,
  p_status TEXT, p_outcome TEXT, p_error TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('done','superseded','failed','cancelled') THEN
    RAISE EXCEPTION 'agent_finish_turn: statut final invalide %', p_status;
  END IF;
  UPDATE conversation_turns SET status = p_status, outcome = p_outcome, error = p_error, finished_at = now()
   WHERE id = p_turn AND lock_token = p_token AND status = 'running';
  DELETE FROM automation_locks WHERE conversation_id = p_conversation AND token = p_token;
END $$;

-- 8.4 Garde d'envoi : verrou, supersession, contrôle, relais, disjoncteur --------
CREATE OR REPLACE FUNCTION public.agent_begin_send(p_outbox UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; c RECORD; v_max SMALLINT; v_recent INT;
BEGIN
  SELECT * INTO o FROM outbound_messages WHERE id = p_outbox FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pending' THEN RETURN 'not_pending'; END IF;
  IF o.not_before > now() THEN RETURN 'too_early'; END IF;
  IF o.expires_at IS NOT NULL AND o.expires_at < now() THEN
    UPDATE outbound_messages SET status = 'expired' WHERE id = p_outbox;
    RETURN 'expired';
  END IF;

  IF o.origin = 'agent' THEN
    IF NOT (
      EXISTS (
        SELECT 1 FROM automation_locks
         WHERE conversation_id = o.conversation_id AND token = o.lock_token AND lease_until > now()
      )
      OR
      EXISTS (
        SELECT 1 FROM conversation_turns
         WHERE id = o.turn_id AND lock_token = o.lock_token AND status = 'done'
      )
    ) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'lost_lock' WHERE id = p_outbox;
      RETURN 'lost_lock';
    END IF;

    IF EXISTS (
      SELECT 1 FROM automation_locks
       WHERE conversation_id = o.conversation_id AND token > o.lock_token
    ) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'superseded' WHERE id = p_outbox;
      RETURN 'superseded';
    END IF;

    IF EXISTS (
      SELECT 1 FROM conversation_turns
       WHERE conversation_id = o.conversation_id AND lock_token > o.lock_token
    ) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'superseded' WHERE id = p_outbox;
      RETURN 'superseded';
    END IF;

    IF EXISTS (SELECT 1 FROM conversation_turns WHERE conversation_id = o.conversation_id AND status = 'collecting') THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'superseded' WHERE id = p_outbox;
      RETURN 'superseded';
    END IF;

    SELECT control_mode, control_reason INTO c FROM conversations WHERE id = o.conversation_id;
    IF c.control_mode = 'closed' AND o.purpose <> 'stop_ack' THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'control_closed' WHERE id = p_outbox;
      RETURN 'paused';
    END IF;
    IF c.control_mode = 'human' AND NOT (
         o.purpose IN ('handoff_ack','identity')
         OR (o.is_relay
             AND o.purpose IN ('payment_instructions','payment_claim_ack','status_eta')
             AND COALESCE(c.control_reason, '') NOT IN ('handoff:complaint','handoff:payment_dispute','handoff:very_negative'))
       ) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'control_human' WHERE id = p_outbox;
      RETURN 'paused';
    END IF;

    SELECT max_agent_msgs_per_hour INTO v_max FROM studio_personas WHERE user_id = o.user_id;
    SELECT count(*) INTO v_recent FROM outbound_messages
     WHERE conversation_id = o.conversation_id AND origin = 'agent'
       AND status IN ('sending','sent','unknown') AND sending_at > now() - interval '1 hour';
    IF v_recent >= COALESCE(v_max, 6) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'rate_limited' WHERE id = p_outbox;
      RETURN 'rate_limited';
    END IF;
  END IF;

  UPDATE outbound_messages SET status = 'sending', sending_at = now(), attempts = attempts + 1 WHERE id = p_outbox;
  RETURN 'ok';
END $$;

-- 8.5 Contrôle de la conversation --------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_set_control(
  p_conversation UUID, p_mode TEXT, p_reason TEXT, p_actor TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD;
BEGIN
  IF p_mode NOT IN ('ai','human','closed') THEN RETURN 'invalid_mode'; END IF;
  SELECT id, user_id, control_mode, control_actor INTO c FROM conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  -- Appel depuis l'interface : le studio n'agit que sur ses conversations, en tant que gérant
  IF auth.uid() IS NOT NULL THEN
    IF c.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
    p_actor := 'merchant';
  END IF;
  IF p_actor NOT IN ('merchant','agent','system') THEN RETURN 'invalid_actor'; END IF;
  -- Une prise de main du gérant ne se lève que par le gérant
  IF p_mode = 'ai' AND c.control_mode = 'human' AND c.control_actor = 'merchant' AND p_actor <> 'merchant' THEN
    RETURN 'merchant_lock';
  END IF;
  -- Un client qui a demandé l'arrêt ne peut être réactivé que par le gérant
  IF c.control_mode = 'closed' AND p_mode <> 'closed' AND p_actor <> 'merchant' THEN
    RETURN 'closed_lock';
  END IF;

  UPDATE conversations
     SET control_mode = p_mode, control_reason = p_reason, control_actor = p_actor,
         control_set_at = now(), control_expires_at = p_expires_at,
         low_conf_streak = CASE WHEN p_mode = 'ai' THEN 0 ELSE low_conf_streak END,
         pending_question = CASE WHEN p_mode = 'ai' THEN NULL ELSE pending_question END
   WHERE id = p_conversation;
  IF p_mode = 'ai' THEN
    UPDATE handoffs SET status = 'returned', closed_at = now(), closed_by = p_actor
     WHERE conversation_id = p_conversation AND status = 'open';
  END IF;
  RETURN 'ok';
END $$;

-- 8.6 Ouverture d'une commande (plusieurs possibles, plafond par studio) ----------
CREATE OR REPLACE FUNCTION public.agent_open_order(p_conversation UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; v_open INT; v_max SMALLINT; v_id UUID;
BEGIN
  SELECT id, user_id, contact_id INTO c FROM conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  SELECT max_open_orders INTO v_max FROM studio_personas WHERE user_id = c.user_id;
  SELECT count(*) INTO v_open FROM orders
   WHERE conversation_id = p_conversation AND stage NOT IN ('delivered','closed','cancelled');
  IF v_open >= COALESCE(v_max, 3) THEN RAISE EXCEPTION 'too_many_open_orders'; END IF;
  INSERT INTO orders (user_id, contact_id, conversation_id, stage, payment_status, amount_cents)
  VALUES (c.user_id, c.contact_id, p_conversation, 'collecting_brief', 'unpaid', 0)
  RETURNING id INTO v_id;
  UPDATE conversations SET focus_order_id = v_id WHERE id = p_conversation;
  RETURN v_id;
END $$;

-- 8.7 Transition d'une piste : table de vérité + portes croisées --------------------
CREATE OR REPLACE FUNCTION public.agent_transition_order(
  p_order UUID, p_expected_version INT, p_track TEXT, p_event TEXT, p_actor TEXT,
  p_turn UUID DEFAULT NULL, p_data JSONB DEFAULT '{}', p_inferred BOOLEAN DEFAULT FALSE
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; tr RECORD; v_from TEXT;
BEGIN
  SELECT id, user_id, stage, payment_status, deliverable, version INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF o.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
    p_actor := 'merchant';
  END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;

  v_from := CASE p_track WHEN 'creative' THEN o.stage WHEN 'payment' THEN o.payment_status END;
  IF v_from IS NULL THEN RETURN 'unknown_track'; END IF;
  SELECT * INTO tr FROM order_transitions WHERE track = p_track AND from_state = v_from AND event = p_event;
  IF NOT FOUND THEN RETURN 'transition_forbidden'; END IF;
  IF NOT (p_actor = ANY (tr.allowed_actors)) THEN RETURN 'actor_forbidden'; END IF;

  -- Portes croisées (le gérant peut passer outre : c'est son studio)
  IF p_track = 'creative' AND p_actor <> 'merchant' THEN
    IF p_event IN ('production_started','delivery_sent','audio_delivered','video_started')
       AND o.payment_status <> 'confirmed' THEN RETURN 'payment_not_confirmed'; END IF;
    IF p_event = 'delivery_sent' AND v_from = 'in_production' AND o.deliverable = 'audio_video' THEN
      RETURN 'video_pending';
    END IF;
    IF p_event = 'audio_delivered' AND o.deliverable IS DISTINCT FROM 'audio_video' THEN RETURN 'not_video_offer'; END IF;
    IF p_event = 'order_cancelled' AND o.payment_status IN ('claimed','confirmed') THEN RETURN 'payment_lock'; END IF;
  END IF;

  IF p_track = 'creative' THEN
    UPDATE orders SET stage = tr.to_state, version = version + 1, stage_changed_at = now(),
           lyrics_sent_at      = CASE WHEN p_event = 'lyrics_sent'      THEN now() ELSE lyrics_sent_at END,
           lyrics_validated_at = CASE WHEN p_event = 'lyrics_validated' THEN now() ELSE lyrics_validated_at END,
           audio_delivered_at  = CASE WHEN p_event = 'audio_delivered'  THEN now() ELSE audio_delivered_at END,
           revision_count      = revision_count + CASE WHEN p_event = 'change_requested' THEN 1 ELSE 0 END,
           lyrics_version      = lyrics_version + CASE WHEN p_event = 'lyrics_sent' THEN 1 ELSE 0 END
     WHERE id = p_order;
  ELSE
    UPDATE orders SET payment_status = tr.to_state, version = version + 1,
           payment_instructions_at    = CASE WHEN p_event = 'instructions_sent' THEN now() ELSE payment_instructions_at END,
           payment_instructions_count = payment_instructions_count + CASE WHEN p_event = 'instructions_sent' THEN 1 ELSE 0 END,
           payment_claimed_at         = CASE WHEN p_event = 'payment_claimed' THEN now() ELSE payment_claimed_at END,
           payment_confirmed_at       = CASE WHEN tr.to_state = 'confirmed' THEN now() ELSE payment_confirmed_at END,
           payment_confirmed_by       = CASE WHEN tr.to_state = 'confirmed' THEN p_actor ELSE payment_confirmed_by END
     WHERE id = p_order;
  END IF;

  INSERT INTO order_events (order_id, user_id, track, from_state, to_state, event, actor, inferred, turn_id, data)
  VALUES (p_order, o.user_id, p_track, v_from, tr.to_state, p_event, p_actor, p_inferred, p_turn, COALESCE(p_data, '{}'));
  RETURN 'ok';
END $$;

-- 8.8 Champs du brief : aucune suppression par inférence -----------------------------
CREATE OR REPLACE FUNCTION public._agent_pick(p JSONB, k TEXT, cur TEXT, allow_clear BOOLEAN)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN NOT (p ? k) THEN cur
              WHEN jsonb_typeof(p->k) = 'null' THEN CASE WHEN allow_clear THEN NULL ELSE cur END
              ELSE p->>k END
$$;

CREATE OR REPLACE FUNCTION public.agent_patch_order_fields(
  p_order UUID, p_expected_version INT, p_patch JSONB, p_allow_clear BOOLEAN DEFAULT FALSE
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD;
BEGIN
  SELECT id, user_id, stage, version INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL AND o.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  IF o.stage IN ('delivered','closed','cancelled') THEN RETURN 'order_closed'; END IF;
  IF p_patch ? 'voice' AND jsonb_typeof(p_patch->'voice') = 'string'
     AND (p_patch->>'voice') NOT IN ('male','female','duo') THEN RETURN 'invalid_voice'; END IF;
  IF p_patch ? 'memories' AND jsonb_typeof(p_patch->'memories') <> 'array' THEN RETURN 'invalid_memories'; END IF;

  UPDATE orders SET
    occasion           = public._agent_pick(p_patch, 'occasion',           occasion,           p_allow_clear),
    recipient_name     = public._agent_pick(p_patch, 'recipient_name',     recipient_name,     p_allow_clear),
    recipient_relation = public._agent_pick(p_patch, 'recipient_relation', recipient_relation, p_allow_clear),
    sender_name        = public._agent_pick(p_patch, 'sender_name',        sender_name,        p_allow_clear),
    style              = public._agent_pick(p_patch, 'style',              style,              p_allow_clear),
    voice              = public._agent_pick(p_patch, 'voice',              voice,              p_allow_clear),
    language           = public._agent_pick(p_patch, 'language',           language,           p_allow_clear),
    sensitive_topic    = public._agent_pick(p_patch, 'sensitive_topic',    sensitive_topic,    p_allow_clear),
    client_own_lyrics  = public._agent_pick(p_patch, 'client_own_lyrics',  client_own_lyrics,  p_allow_clear),
    recipient_name_confirmed = CASE
      WHEN p_patch ? 'recipient_name_confirmed' THEN COALESCE((p_patch->>'recipient_name_confirmed')::boolean, FALSE)
      WHEN public._agent_pick(p_patch, 'recipient_name', recipient_name, p_allow_clear) IS DISTINCT FROM recipient_name THEN FALSE
      ELSE recipient_name_confirmed END,
    memories       = CASE WHEN p_patch ? 'memories' THEN memories || (p_patch->'memories') ELSE memories END,
    field_evidence = field_evidence || COALESCE(p_patch->'field_evidence', '{}'::jsonb),
    version        = version + 1
  WHERE id = p_order;
  RETURN 'ok';
END $$;

-- 8.9 Prix : catalogue (agent) ou annoncé par le gérant ------------------------------
CREATE OR REPLACE FUNCTION public.agent_choose_offer(p_order UUID, p_expected_version INT, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; c RECORD;
BEGIN
  SELECT id, user_id, stage, payment_status, version INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  IF o.payment_status <> 'unpaid' THEN RETURN 'payment_started'; END IF;
  IF o.stage NOT IN ('collecting_brief','brief_complete','lyrics_in_progress','lyrics_sent') THEN RETURN 'offer_locked'; END IF;
  SELECT * INTO c FROM studio_catalogues WHERE user_id = o.user_id AND code = p_code AND is_active;
  IF NOT FOUND THEN RETURN 'unknown_offer'; END IF;
  UPDATE orders SET catalogue_code = c.code, price_xof = c.price_xof, price_source = 'catalogue',
                    deliverable = c.deliverable, payment_policy = c.payment_policy, version = version + 1
   WHERE id = p_order;
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.agent_set_merchant_price(p_order UUID, p_expected_version INT, p_price INT, p_inferred BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD;
BEGIN
  SELECT id, user_id, version, payment_status INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL AND o.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  IF p_price IS NULL OR p_price < 100 OR p_price > 1000000 THEN RETURN 'invalid_price'; END IF;
  IF o.payment_status = 'confirmed' THEN RETURN 'payment_confirmed'; END IF;
  UPDATE orders SET price_xof = p_price, price_source = 'merchant', version = version + 1,
         inferred_fields = CASE WHEN p_inferred THEN inferred_fields || jsonb_build_object('price_xof', p_price)
                                ELSE inferred_fields - 'price_xof' END
   WHERE id = p_order;
  RETURN 'ok';
END $$;

-- 8.10 Faits client : aucun calcul par date calendaire --------------------------------
CREATE OR REPLACE FUNCTION public.agent_contact_facts(p_contact UUID)
RETURNS TABLE (delivered_orders INT, open_orders INT, procedure_voice_received_at TIMESTAMPTZ,
               last_delivered_at TIMESTAMPTZ, known_sender_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM orders WHERE contact_id = p_contact AND stage IN ('delivered','closed')),
    (SELECT count(*)::int FROM orders WHERE contact_id = p_contact AND stage NOT IN ('delivered','closed','cancelled')),
    (SELECT max(COALESCE(o.sent_at, o.sending_at)) FROM outbound_messages o
       JOIN conversations c ON c.id = o.conversation_id
      WHERE c.contact_id = p_contact AND o.purpose = 'procedure_voice' AND o.status IN ('sent','unknown')),
    (SELECT max(delivered_at) FROM orders WHERE contact_id = p_contact),
    (SELECT sender_name FROM orders WHERE contact_id = p_contact AND sender_name IS NOT NULL
      ORDER BY created_at DESC LIMIT 1);
$$;

-- 8.11 Droits : moteur (service_role) seul, sauf les commandes du gérant --------------
REVOKE ALL ON FUNCTION public.agent_buffer_inbound(UUID,UUID,UUID,INT,INT,BOOLEAN)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_claim_turn(TEXT,INT)                                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_renew_lease(UUID,BIGINT,INT)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_finish_turn(UUID,UUID,BIGINT,TEXT,TEXT,TEXT)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_begin_send(UUID)                                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_open_order(UUID)                                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_choose_offer(UUID,INT,TEXT)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_contact_facts(UUID)                                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_set_control(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_transition_order(UUID,INT,TEXT,TEXT,TEXT,UUID,JSONB,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_patch_order_fields(UUID,INT,JSONB,BOOLEAN)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_set_merchant_price(UUID,INT,INT,BOOLEAN)                  FROM PUBLIC, anon;
-- Le moteur (service_role) garde explicitement l'exécution de toutes les fonctions
GRANT EXECUTE ON FUNCTION public.agent_buffer_inbound(UUID,UUID,UUID,INT,INT,BOOLEAN)            TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_claim_turn(TEXT,INT)                                      TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_renew_lease(UUID,BIGINT,INT)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_finish_turn(UUID,UUID,BIGINT,TEXT,TEXT,TEXT)              TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_begin_send(UUID)                                          TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_open_order(UUID)                                          TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_choose_offer(UUID,INT,TEXT)                               TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_contact_facts(UUID)                                       TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_set_control(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ)              TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_transition_order(UUID,INT,TEXT,TEXT,TEXT,UUID,JSONB,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_patch_order_fields(UUID,INT,JSONB,BOOLEAN)                TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_set_merchant_price(UUID,INT,INT,BOOLEAN)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_set_control(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_transition_order(UUID,INT,TEXT,TEXT,TEXT,UUID,JSONB,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_patch_order_fields(UUID,INT,JSONB,BOOLEAN)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_merchant_price(UUID,INT,INT,BOOLEAN)                  TO authenticated;

-- ============================================================================
-- 9. SÉCURITÉ AU NIVEAU DES LIGNES
-- ============================================================================

ALTER TABLE public.studio_personas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_catalogues    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_step_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_locks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_transitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoffs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_turn_logs      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  -- Configuration du studio : lecture et écriture par le propriétaire
  FOREACH t IN ARRAY ARRAY['studio_personas','studio_catalogues','studio_step_policies','studio_templates','studio_assets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
                   'USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))', t || '_own', t);
  END LOOP;
  -- File, envois, journaux : lecture seule pour le propriétaire
  FOREACH t IN ARRAY ARRAY['conversation_turns','outbound_messages','order_assets','order_events','handoffs','agent_turn_logs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
                   'USING (user_id = (SELECT auth.uid()))', t || '_read_own', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS order_transitions_read ON public.order_transitions;
CREATE POLICY order_transitions_read ON public.order_transitions FOR SELECT TO authenticated USING (TRUE);
-- inbound_events, automation_locks, engine_flags : aucune politique → service_role uniquement.

COMMIT;
