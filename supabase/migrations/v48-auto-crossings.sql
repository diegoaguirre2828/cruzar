-- v48 — Auto-crossing detection (2026-04-25)
--
-- Phase 1 of the Cruzar Insights flywheel: opt-in auto-detection of
-- bridge crossings (and inland checkpoint dwells past the POE) using
-- the user's phone GPS via the existing WaitingMode geofence.
--
-- Privacy posture (load-bearing — see thinker session 2026-04-25):
--   - opt-in only, defaults OFF on every profile
--   - no GPS trace persisted; only the start ts + end ts + entry/exit
--     side land in the DB
--   - rows are anonymized at write time: no user_id column on
--     wait_time_readings / inland_checkpoint_readings
--   - the user_id stays client-side just long enough to award points
--
-- Three changes:
--
-- 1. wait_time_readings.source + lane_guess
--    Existing data is CBP-scraped (~230k rows). Tag those as
--    'cbp' so the new 'auto_geofence' rows are filterable. lane_guess
--    is for future use — auto-detected can't reliably tell SENTRI vs
--    general at the GPS level, so default 'general' until we add a
--    confirm-toast lane-picker (out of scope for Phase 1).
--
-- 2. inland_checkpoint_readings (new table)
--    Northbound + southbound dwell-time observations at the secondary
--    inspection layer that nobody publishes (Falfurrias, Sarita,
--    Hebbronville on US-281/77/359; Garita 21KM Reynosa / Matamoros
--    on the MX side). Same privacy contract as wait_time_readings.
--
-- 3. profiles.auto_geofence_opt_in
--    The opt-in toggle backed by a real DB column (not just
--    localStorage) so the preference follows the user across devices.

BEGIN;

-- 1) Tag existing CBP-scraped rows + add lane bucket
ALTER TABLE wait_time_readings
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'cbp';

ALTER TABLE wait_time_readings
  ADD COLUMN IF NOT EXISTS lane_guess TEXT;

CREATE INDEX IF NOT EXISTS idx_wait_time_readings_source_recorded
  ON wait_time_readings (source, recorded_at DESC);

-- 2) Inland checkpoint dwell observations
CREATE TABLE IF NOT EXISTS inland_checkpoint_readings (
  id BIGSERIAL PRIMARY KEY,
  checkpoint_zone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('northbound', 'southbound')),
  dt_minutes INT NOT NULL CHECK (dt_minutes >= 0 AND dt_minutes <= 720),
  source TEXT NOT NULL DEFAULT 'auto_geofence',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inland_checkpoint_zone_recorded
  ON inland_checkpoint_readings (checkpoint_zone, recorded_at DESC);

-- Public read, service-role write — same posture as wait_time_readings
ALTER TABLE inland_checkpoint_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inland_checkpoint_public_read ON inland_checkpoint_readings;
CREATE POLICY inland_checkpoint_public_read
  ON inland_checkpoint_readings FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3) Profile opt-in flag
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_geofence_opt_in BOOLEAN NOT NULL DEFAULT false;

COMMIT;
