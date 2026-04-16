-- v27: Session tracking, first-1000 launch promo, and public_assets table.
-- Safe to run multiple times. Every column, index, table, and policy is guarded.

-- Profiles: session and device tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_device text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_os text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_browser text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS install_state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON profiles (last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS profiles_install_state_idx
  ON profiles (install_state) WHERE install_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_last_seen_os_idx
  ON profiles (last_seen_os) WHERE last_seen_os IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_tier_install_state_idx
  ON profiles (tier, install_state);

-- Backfill first_seen_at from created_at so existing users show up
-- in cohort queries instead of NULL.
UPDATE profiles
SET first_seen_at = COALESCE(first_seen_at, created_at)
WHERE first_seen_at IS NULL;

-- Profiles: first-1000 launch promo.
-- Users who sign up before the cap get 90 days of effective Pro access.
-- No tier flip happens. useTier computes the effective tier by checking
-- promo_first_1000_until > NOW, so no downgrade cron is needed.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS promo_first_1000_until timestamptz;
CREATE INDEX IF NOT EXISTS profiles_promo_first_1000_idx
  ON profiles (promo_first_1000_until) WHERE promo_first_1000_until IS NOT NULL;

-- Retroactively grant 90 days of effective Pro to the first 1000 free
-- users in signup order. Existing users do not get punished for joining
-- before the promo launched; their clock starts from created_at, so
-- very early joiners may already be past the 90-day window.
WITH ranked AS (
  SELECT id, created_at,
         ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rank
  FROM profiles
)
UPDATE profiles p
SET promo_first_1000_until = (r.created_at + interval '90 days')
FROM ranked r
WHERE p.id = r.id
  AND r.rank <= 1000
  AND p.promo_first_1000_until IS NULL
  AND p.tier = 'free';

-- public_assets: key-value store for app-served artifacts.
-- First consumer is the video render manifest from /api/video/latest.
-- The GitHub Actions render workflow POSTs here, Make.com and the
-- admin preview page GET from here.
CREATE TABLE IF NOT EXISTS public_assets (
  name text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_assets_select ON public_assets;
CREATE POLICY public_assets_select
  ON public_assets FOR SELECT USING (true);

-- No public write policy. Service-role writes only, which bypasses RLS.
