-- v49 — Richer auto-crossing fields (2026-04-25)
--
-- After Phase 1 of auto-crossing detection shipped (v48), the rows
-- were too thin: lane_guess defaulted to 'general' with no user
-- input, no slowdown reason was captured, and we had no way to
-- distinguish iOS-native vs web contributions for data-quality
-- filtering. This migration adds the columns. The confirm toast UI
-- + endpoints are updated to populate them.
--
-- Privacy stance unchanged: still no user_id on any auto_geofence
-- row, still no GPS trace persisted. Adding context tags improves
-- data quality without weakening anonymization.
--
-- 1. wait_time_readings.reason_tag
--    User-picked tag on confirm toast: 'docs', 'inspection',
--    'construction', 'protest', 'other', or NULL when not chosen.
--    Foundation for the Phase 3 intelligence layer.
--
-- 2. wait_time_readings.platform
--    'ios_native' / 'web_mobile' / 'web_desktop'. Lets analysis
--    weight the higher-fidelity native sample stream against the
--    foreground-only web sample.
--
-- 3. inland_checkpoint_readings.platform
--    Same field on the inland table.
--
-- 4. profiles.auto_geofence_opt_in_at
--    Timestamp of the most recent opt-in toggle (NULL if never opted
--    in or currently opted out). Audit trail for the privacy
--    posture: lets us prove "user explicitly accepted on date X" if
--    asked by a regulator or in a data-deletion request.

BEGIN;

ALTER TABLE wait_time_readings
  ADD COLUMN IF NOT EXISTS reason_tag TEXT;

ALTER TABLE wait_time_readings
  ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE inland_checkpoint_readings
  ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_geofence_opt_in_at TIMESTAMPTZ;

COMMIT;
