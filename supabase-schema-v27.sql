-- v27 — Session / device tracking columns on profiles
-- Diego 2026-04-15: admin panel needs to slice users by device, OS,
-- install state, last seen. Plausible tracks visitors anonymously;
-- this captures the same dimensions on the logged-in user side so
-- the admin panel can run queries like "PWA users on Android who
-- are free tier" without guessing.
--
-- Safe to run multiple times — every column uses ADD COLUMN IF NOT
-- EXISTS and every index uses CREATE INDEX IF NOT EXISTS.

-- Device / OS / browser detected client-side on every app boot.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_device text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_os text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_browser text;

-- Install state — how the user is actually running Cruzar right now.
--   'web'       : normal browser tab
--   'pwa'       : display-mode standalone (added to home screen via PWA)
--   'twa'       : Trusted Web Activity on Android (installed from Play Store)
--   'capacitor' : iOS native shell wrapping the web app (future App Store)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS install_state text;

-- Session timing — last_seen powers activity filters, first_seen powers cohort analysis.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

-- Indexes for the filters that will actually be used in the admin panel.
CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx ON profiles (last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS profiles_install_state_idx ON profiles (install_state) WHERE install_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_last_seen_os_idx ON profiles (last_seen_os) WHERE last_seen_os IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_tier_install_state_idx ON profiles (tier, install_state);

-- One-time backfill for existing rows so they show up in "last seen ever" queries.
-- Users who never run the new touch endpoint will have last_seen_at = NULL and
-- show up as "unknown" in the admin panel, which is correct.
UPDATE profiles SET first_seen_at = COALESCE(first_seen_at, created_at) WHERE first_seen_at IS NULL;

-- First 1000 promo: users who sign up before the cap get 90 days of
-- effective Pro access. No tier flip happens — useTier computes the
-- effective tier by checking promo_first_1000_until > NOW. This avoids
-- needing a downgrade cron.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS promo_first_1000_until timestamptz;
CREATE INDEX IF NOT EXISTS profiles_promo_first_1000_idx ON profiles (promo_first_1000_until) WHERE promo_first_1000_until IS NOT NULL;

-- Backfill: every existing profile created before v27 is retroactively
-- eligible. Gives existing free-tier users the same 3-month window
-- starting from when they signed up. Respects the 1000 cap — earliest
-- 1000 profiles by created_at get it, anyone beyond that stays free.
WITH ranked AS (
  SELECT id, created_at, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rank FROM profiles
)
UPDATE profiles p
SET promo_first_1000_until = (r.created_at + interval '90 days')
FROM ranked r
WHERE p.id = r.id
  AND r.rank <= 1000
  AND p.promo_first_1000_until IS NULL
  AND p.tier = 'free';
