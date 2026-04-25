-- v52 — Intelligence depth: real-time alerts + preferences (2026-04-25)
--
-- Adds the missing $49-tier features that make Intelligence worth
-- subscribing to (vs the daily-newsletter-only $0 tier). Three new
-- objects:
--
-- 1. intel_alert_preferences
--    Per-subscriber filters: which impact_tags trigger a real-time
--    alert (cartel, protest, vucem, tariff, weather, infra, policy),
--    which corridors they care about, plus a quiet-hours window so
--    we don't fire push-email at 3am. Defaults are sensible — paid
--    subscribers get all impacts on, all corridors on, no quiet
--    hours, until they tweak.
--
-- 2. intel_alerts
--    Audit log of every alert sent: which subscriber, which event,
--    when. Used to (a) prevent duplicate sends and (b) power the
--    subscriber dashboard's "recent alerts" view.
--
-- 3. intel_events.alert_score + alert_fired_at
--    Per-event metadata so the alert cron knows which events have
--    already fanned out.

BEGIN;

CREATE TABLE IF NOT EXISTS intel_alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES intel_subscribers(id) ON DELETE CASCADE,
  impacts TEXT[] NOT NULL DEFAULT ARRAY['cartel','protest','vucem','tariff','infra','policy'],
  corridors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  min_score INT NOT NULL DEFAULT 60 CHECK (min_score >= 0 AND min_score <= 100),
  quiet_hour_start INT CHECK (quiet_hour_start IS NULL OR (quiet_hour_start >= 0 AND quiet_hour_start <= 23)),
  quiet_hour_end INT CHECK (quiet_hour_end IS NULL OR (quiet_hour_end >= 0 AND quiet_hour_end <= 23)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_prefs_subscriber
  ON intel_alert_preferences (subscriber_id);

ALTER TABLE intel_alert_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alert_prefs_owner_read ON intel_alert_preferences;
CREATE POLICY alert_prefs_owner_read
  ON intel_alert_preferences FOR SELECT
  TO authenticated
  USING (
    subscriber_id IN (SELECT id FROM intel_subscribers WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS intel_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES intel_subscribers(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES intel_events(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'email',
  UNIQUE (subscriber_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_intel_alerts_subscriber_sent
  ON intel_alerts (subscriber_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_alerts_event
  ON intel_alerts (event_id);

ALTER TABLE intel_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intel_alerts_owner_read ON intel_alerts;
CREATE POLICY intel_alerts_owner_read
  ON intel_alerts FOR SELECT
  TO authenticated
  USING (
    subscriber_id IN (SELECT id FROM intel_subscribers WHERE user_id = auth.uid())
  );

-- Per-event scoring + dedupe flag
ALTER TABLE intel_events
  ADD COLUMN IF NOT EXISTS alert_score INT,
  ADD COLUMN IF NOT EXISTS alert_processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_intel_events_alert_pending
  ON intel_events (alert_processed_at, ingested_at DESC)
  WHERE alert_processed_at IS NULL;

COMMIT;
