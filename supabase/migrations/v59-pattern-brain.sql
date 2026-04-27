-- v59: Pattern Brain (Pillar 1 — wake-up + routine)
--
-- Detects each user's commute pattern from their own crossing_reports
-- (where they reported a wait time over the last 90 days). When the
-- pattern is consistent enough (>= 3 reports at the same port × dow ×
-- hour bucket), schedule a push notification 1 hour before their
-- typical report time tomorrow.
--
-- Privacy posture (load-bearing):
--   - opt-in only, defaults OFF
--   - user can wipe their detected routine at any time (handled in /api/pattern-brain/clear)
--   - we never share the pattern with anyone else
--
-- Idempotent. Safe to re-run.

BEGIN;

-- 1) Opt-in flag + send dedupe
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pattern_brain_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pattern_brain_opt_in_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pattern_brain_last_sent_at TIMESTAMPTZ;

-- 2) Cached detected routines (computed nightly from crossing_reports)
--    Composite key (user_id, port_id, dow, hour) with sample count.
--    The hour stored is the user's *typical report hour* — wake-up push
--    fires at hour-1 in the user's local timezone (assumed America/Chicago).
CREATE TABLE IF NOT EXISTS pattern_brain_routines (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  port_id TEXT NOT NULL,
  dow INT NOT NULL CHECK (dow BETWEEN 0 AND 6),
  hour INT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  sample_count INT NOT NULL CHECK (sample_count >= 3),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, port_id, dow, hour)
);

CREATE INDEX IF NOT EXISTS idx_pattern_brain_dow_hour
  ON pattern_brain_routines (dow, hour);

CREATE INDEX IF NOT EXISTS idx_pattern_brain_user
  ON pattern_brain_routines (user_id, last_seen_at DESC);

-- RLS: user can read their own routines; service role manages all.
ALTER TABLE pattern_brain_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pattern_brain_routines_self_read ON pattern_brain_routines;
CREATE POLICY pattern_brain_routines_self_read
  ON pattern_brain_routines FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pattern_brain_routines_self_delete ON pattern_brain_routines;
CREATE POLICY pattern_brain_routines_self_delete
  ON pattern_brain_routines FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 3) Send-event ledger (rate-limit + audit)
CREATE TABLE IF NOT EXISTS pattern_brain_sends (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  port_id TEXT NOT NULL,
  dow INT NOT NULL,
  hour INT NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered BOOLEAN NOT NULL DEFAULT false,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_pattern_brain_sends_user
  ON pattern_brain_sends (user_id, fired_at DESC);

ALTER TABLE pattern_brain_sends ENABLE ROW LEVEL SECURITY;
-- service-role only on this table, no public read

COMMIT;
