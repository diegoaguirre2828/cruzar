-- v56 — staffing-drop alerts
--
-- New alert type: fires when CBP officer staffing at a user's tracked
-- port drops 2+ below the historical typical for this hour-of-week.
-- Documented leading indicator (Sharma 2021, Sakhare 2024) — wait spikes
-- follow staffing dips by 15-30 min, so a Pro user with this enabled
-- gets a "go now or skip this crossing" warning before the queue
-- forms.
--
-- Reuses the existing alert_preferences row (port_id, lane_type, user_id,
-- phone) + the existing send-alerts cron loop. The wait-drop alert and
-- staffing-drop alert are independent — a user can opt into either
-- or both.

ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS staffing_drop_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_staffing_alert_at timestamptz;

COMMENT ON COLUMN alert_preferences.staffing_drop_enabled IS
  'When true, the send-alerts cron also checks if officer staffing for the alerted lane has dropped 2+ below typical at this hour-of-week, and sends a push/SMS warning of an imminent wait spike. Independent of the wait-threshold alert.';
COMMENT ON COLUMN alert_preferences.last_staffing_alert_at IS
  'Last time a staffing-drop alert fired for this row. Debounce to once per hour to avoid spamming during sustained understaffing.';

-- Index supports the debounce filter in the cron (only consider rows
-- whose last_staffing_alert_at is null or older than 1h).
CREATE INDEX IF NOT EXISTS idx_alert_preferences_staffing_active
  ON alert_preferences (port_id, lane_type)
  WHERE staffing_drop_enabled = true AND active = true;
