-- v69 — WhatsApp Business API opt-in + phone storage
--
-- Replaces the Twilio 10DLC SMS path that was originally listed for L2 W2.
-- For the cross-border MX/US audience, WhatsApp is universal — SMS adds
-- no reach over WhatsApp + push and is more expensive + more regulatory
-- hassle. See project_cruzar_whatsapp_replaces_twilio_20260428.md.
--
-- Columns:
--   whatsapp_phone_e164    — E.164-format number ('+5218990001234'). Stored
--                            once user explicitly opts in via /account or
--                            /copilot. NULL until then.
--   whatsapp_optin         — explicit consent flag. Required because Meta's
--                            policy + Mexico's LFPDPPP both demand opt-in
--                            before business-initiated messaging. Utility
--                            templates within the 24h reply window from a
--                            user-initiated message don't need this gate
--                            (the user's message IS consent), but our
--                            cross-detected auto-broadcast IS business-
--                            initiated → opt-in required.
--   whatsapp_optin_at      — timestamp of the opt-in for audit trail.
--   whatsapp_template_lang — preferred template language ('es' | 'en').
--                            Defaults to 'es' since cruzar.app primary
--                            audience speaks Spanish.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_phone_e164 text,
  ADD COLUMN IF NOT EXISTS whatsapp_optin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_optin_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_template_lang text NOT NULL DEFAULT 'es';

-- E.164 sanity check: starts with +, then 7-15 digits.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_whatsapp_phone_e164_format
    CHECK (whatsapp_phone_e164 IS NULL OR whatsapp_phone_e164 ~ '^\+[1-9][0-9]{6,14}$');

-- Two-state guard: if you have a phone, you must have opted in. Avoids the
-- "I left a number but never confirmed" footgun where business-initiated
-- messaging would technically have a target but no consent.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_whatsapp_consent_pair
    CHECK (
      whatsapp_phone_e164 IS NULL
      OR (whatsapp_optin = true AND whatsapp_optin_at IS NOT NULL)
    );

-- Audit table for outbound WhatsApp messages. Mirrors family_eta_pings
-- shape — every send is logged so we can prove consent/timing if Meta or
-- a regulator asks. Service-role write only.
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_phone_e164 text NOT NULL,
  template_name text,                     -- NULL for free-form 24h-window replies
  template_lang text,
  payload       jsonb NOT NULL,           -- full body sent to Meta
  meta_msg_id   text,                     -- Meta's wamid.* identifier from response
  status        text NOT NULL DEFAULT 'queued', -- queued | sent | delivered | read | failed
  status_detail jsonb,                    -- Meta error + status webhook bodies append here
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_user_idx
  ON public.whatsapp_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_meta_msg_idx
  ON public.whatsapp_messages (meta_msg_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- No user can read raw rows. Service role bypasses RLS as usual.
DROP POLICY IF EXISTS "whatsapp_messages_no_user_read" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_no_user_read"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (false);

COMMIT;
