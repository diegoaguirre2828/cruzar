-- v38 — alert_preferences RLS policies
--
-- Promotes the policies that previously lived only in legacy
-- supabase-schema-v2.sql into the versioned migrations folder so
-- they're re-appliable and tracked with the rest of the schema.
--
-- Splits the legacy "FOR ALL" policy into explicit SELECT / INSERT /
-- UPDATE / DELETE policies so future audits read cleanly.
--
-- Fully idempotent — safe to re-apply.

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own alerts" ON alert_preferences;
DROP POLICY IF EXISTS "Users can read own alerts" ON alert_preferences;
DROP POLICY IF EXISTS "Users can insert own alerts" ON alert_preferences;
DROP POLICY IF EXISTS "Users can update own alerts" ON alert_preferences;
DROP POLICY IF EXISTS "Users can delete own alerts" ON alert_preferences;

CREATE POLICY "Users can read own alerts"
  ON alert_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON alert_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON alert_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON alert_preferences FOR DELETE
  USING (auth.uid() = user_id);
