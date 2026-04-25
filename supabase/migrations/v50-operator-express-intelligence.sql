-- v50 — Phase 2 (Operator + Express Cert) + Phase 3 (Intelligence)
-- 2026-04-25 evening, all-in build session.
--
-- Five new tables + a profiles tier extension to back the Cruzar
-- 3-tier flywheel locked in the thinker session. Privacy posture
-- inherited from v48 — tables that hold user-submitted content
-- (operator docs, Express Cert applications) are user-scoped and
-- under RLS; aggregate intelligence-layer artifacts are public-read,
-- service-write.
--
-- Tables:
--
-- 1. operator_validations
--    Each AI paperwork-validation run for a Cruzar Operator
--    subscriber. Stores the source doc URL (Vercel Blob), the
--    extracted fields, and the AI-flagged issues. Powers the
--    Operator dashboard.
--
-- 2. express_cert_applications
--    Each in-progress or completed C-TPAT / OEA application a user
--    is filling out via the AI assistant. Stores the questionnaire
--    answers + the generated PDF URL.
--
-- 3. intel_subscribers
--    Email + tier for Cruzar Intelligence subscribers (separate
--    list from the consumer Cruzar Pro/Business tier so we don't
--    spam consumers with B2B briefs).
--
-- 4. intel_events
--    Ingested raw events from the configured sources (MX news, US
--    trade-policy alerts, cartel reports, VUCEM uptime). Each row
--    is a deduped event with source, headline, body, and impact tag.
--
-- 5. intel_briefs
--    Daily/weekly synthesized briefs produced by the AI synthesis
--    cron from intel_events. Public-read so the marketing site can
--    show the most recent one as proof.
--
-- profiles.tier extension: 'operator' tier value (already free/pro/
-- business). Express Cert is one-time, not a tier — tracked via
-- express_cert_applications.status only.

BEGIN;

-- 1) Operator paperwork validations
CREATE TABLE IF NOT EXISTS operator_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_kind TEXT NOT NULL CHECK (doc_kind IN ('pedimento','commercial_invoice','usmca_cert','packing_list','bill_of_lading','other')),
  source_url TEXT NOT NULL,
  source_filename TEXT,
  extracted_fields JSONB,
  issues JSONB,
  severity TEXT CHECK (severity IN ('clean','minor','blocker')),
  ai_summary TEXT,
  ai_model TEXT,
  ms_to_complete INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_validations_user_created
  ON operator_validations (user_id, created_at DESC);

ALTER TABLE operator_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operator_validations_owner_read ON operator_validations;
CREATE POLICY operator_validations_owner_read
  ON operator_validations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2) Express Cert (C-TPAT / OEA) applications
CREATE TABLE IF NOT EXISTS express_cert_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program TEXT NOT NULL CHECK (program IN ('ctpat','oea')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','paid','generated','submitted')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_pdf_url TEXT,
  stripe_session_id TEXT,
  paid_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_express_cert_user_status
  ON express_cert_applications (user_id, status);

ALTER TABLE express_cert_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS express_cert_owner_read ON express_cert_applications;
CREATE POLICY express_cert_owner_read
  ON express_cert_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3) Intelligence subscribers
CREATE TABLE IF NOT EXISTS intel_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','enterprise')),
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  unsubscribe_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intel_subscribers_active_tier
  ON intel_subscribers (active, tier);

-- 4) Ingested raw events
CREATE TABLE IF NOT EXISTS intel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_url TEXT,
  headline TEXT NOT NULL,
  body TEXT,
  language TEXT DEFAULT 'es',
  impact_tag TEXT CHECK (impact_tag IN ('cartel','protest','vucem','tariff','weather','infra','policy','other')),
  corridor TEXT,
  occurred_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_intel_events_ingested
  ON intel_events (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_events_impact_corridor
  ON intel_events (impact_tag, corridor, ingested_at DESC);

ALTER TABLE intel_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intel_events_public_read ON intel_events;
CREATE POLICY intel_events_public_read
  ON intel_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5) Synthesized briefs
CREATE TABLE IF NOT EXISTS intel_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly','event')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_md TEXT NOT NULL,
  events_used JSONB,
  ai_model TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intel_briefs_published
  ON intel_briefs (published_at DESC);

ALTER TABLE intel_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intel_briefs_public_read ON intel_briefs;
CREATE POLICY intel_briefs_public_read
  ON intel_briefs FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6) Profiles tier check — allow 'operator' as a valid tier value.
-- The existing tier column already exists; just ensure the check
-- constraint allows the new value if one is present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'profiles' AND column_name = 'tier'
  ) THEN
    -- Drop any existing tier check that might reject 'operator'
    BEGIN
      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_tier_check
      CHECK (tier IN ('guest','free','pro','business','operator'));
  END IF;
END$$;

COMMIT;
