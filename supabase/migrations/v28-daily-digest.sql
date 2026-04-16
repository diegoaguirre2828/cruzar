/*
 * v28: Daily digest system - proactive personalized crossing intelligence.
 * Learns when each user typically crosses, sends a personalized push
 * 45 min before their window with current waits + best option.
 */

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_window_hour int;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_window_days text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_last_sent_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_digest_window_idx
  ON profiles (digest_window_hour)
  WHERE digest_window_hour IS NOT NULL AND digest_enabled = true;
