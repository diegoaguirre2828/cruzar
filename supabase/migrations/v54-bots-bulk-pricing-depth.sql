-- v54 — Free-channel depth (2026-04-25 evening, all-in #2)
--
-- Diego's directive: ship everything possible BEFORE first paid
-- customer, then layer in paid infra (Twilio/WhatsApp/SMS) once
-- there's revenue to fund it.
--
-- This migration adds:
--   1. intel_subscribers.telegram_chat_id (free Telegram bot relay)
--   2. intel_subscribers.slack_webhook_url (Slack alert delivery)
--   3. intel_subscribers.preferred_channels (which channels to fan out to)
--   4. operator_bot_bindings (links external bot identity →
--      cruzar profile so Telegram/email-in/etc. can attribute the
--      validation to a paying user)
--   5. sales_inquiries (Enterprise "Talk to sales" capture)
--   6. operator_validations.batch_id (group bulk uploads)

BEGIN;

ALTER TABLE intel_subscribers
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS preferred_channels TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[];

CREATE INDEX IF NOT EXISTS idx_intel_subs_telegram
  ON intel_subscribers (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- Bot identity bindings: a single user may link multiple bot
-- identities (telegram + email + future whatsapp). Lookup by
-- (channel, external_id) → user_id at message-receipt time.
CREATE TABLE IF NOT EXISTS operator_bot_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('telegram','email','whatsapp','sms')),
  external_id TEXT NOT NULL,
  bind_token TEXT,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_operator_bot_bindings_user
  ON operator_bot_bindings (user_id, channel);

ALTER TABLE operator_bot_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bot_bindings_owner_read ON operator_bot_bindings;
CREATE POLICY bot_bindings_owner_read
  ON operator_bot_bindings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Enterprise lead-capture for "Talk to sales" form on /pricing
CREATE TABLE IF NOT EXISTS sales_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  company TEXT,
  fleet_size TEXT,
  use_case TEXT,
  tier_interest TEXT NOT NULL DEFAULT 'intelligence_enterprise',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_inquiries_status
  ON sales_inquiries (status, created_at DESC);

-- Bulk upload grouping
ALTER TABLE operator_validations
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_operator_validations_batch
  ON operator_validations (batch_id) WHERE batch_id IS NOT NULL;

COMMIT;
