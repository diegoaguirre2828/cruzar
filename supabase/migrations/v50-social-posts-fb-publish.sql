-- v50: extend social_posts to track Graph API publish state.
--
-- Background: until 2026-04-25, Make.com was the publisher — it polled
-- /api/social/next-post on a schedule and posted the caption to the
-- Cruzar FB Page. Two problems with that loop:
--   1. Posts surfaced as "Published by Make" → algo discount.
--   2. Posts were pure text → no image-post boost, 0 1-min views.
--
-- This migration adds the columns the new in-repo Graph API publisher
-- (/api/cron/fb-publish) writes back to once a post lands on FB. Lets
-- the admin panel show what posted vs. failed without scraping FB.
--
-- All idempotent — safe to re-run. RLS on social_posts is already
-- service-role-only (v32), so no policy changes needed.

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS fb_post_id    text,
  ADD COLUMN IF NOT EXISTS fb_posted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS fb_post_error text,
  ADD COLUMN IF NOT EXISTS image_kind    text;

CREATE INDEX IF NOT EXISTS idx_social_posts_fb_post_id
  ON social_posts (fb_post_id)
  WHERE fb_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_unpublished
  ON social_posts (platform, posted_at DESC)
  WHERE fb_post_id IS NULL AND fb_post_error IS NULL;
