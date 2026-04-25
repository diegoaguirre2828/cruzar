-- v53 — Add profile.favorite_port_id (2026-04-25)
--
-- Phase A of the home-page personalization redesign. Logged-in users
-- pick the bridge they cross most often; the home page then leads
-- with their bridge's wait time + a "faster right now" alternative
-- when another in their region is significantly faster.
--
-- Anonymous users keep the existing unfiltered list view — no
-- onboarding friction for the first-time "just check Pharr real
-- quick" visitor that drives most of the funnel.

BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS favorite_port_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_favorite_port
  ON profiles (favorite_port_id) WHERE favorite_port_id IS NOT NULL;

COMMIT;
