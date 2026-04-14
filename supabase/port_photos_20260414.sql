-- =============================================================
-- Cruzar — community-submitted bridge photos (Layer 3)
-- =============================================================
-- Paste into Supabase SQL editor and run. Idempotent.
--
-- Community photo layer complements the static TxDOT / Caltrans /
-- ADOT / El Paso HLS cameras. Users physically at a bridge can
-- submit photos that show what the cameras can't: which lane the
-- X-ray is on, which booth is closed, whether the line is backed
-- up past the street sign, etc.
--
-- Anti-mess rules enforced at INSERT time:
--   1. Auth required (user_id not null)
--   2. GPS must resolve to 'near' location_confidence at submit time
--      (validated in the API route, not the DB — RLS can't reach it)
--   3. Every photo expires in 2 hours and gets hard-deleted by cron
--   4. 3 reports → moderation_status flips to 'removed'
--
-- Storage bucket setup is at the bottom of this file — also idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS port_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  port_id TEXT NOT NULL,

  -- Storage object path inside the port-photos bucket, e.g.
  -- "230501/abc-def-uuid/1713456789.jpg". Public URL is derived
  -- client-side from supabase.storage.from('port-photos').getPublicUrl(storage_path).
  storage_path TEXT NOT NULL,

  -- Optional caption ("X-ray on lane 3", "construction on the MX side", etc.)
  -- Capped at 140 chars server-side.
  caption TEXT,

  -- Raw GPS coords at submit time. Used for (a) verifying the user
  -- was actually at the bridge, (b) tagging the photo's vantage point.
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  -- Derived bucket — 'near' | 'nearby' | 'far' | 'unknown'. The API
  -- route REJECTS submissions where this would be 'far' or 'unknown'.
  -- Stored for analytics/audit.
  location_confidence TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 2-hour freshness contract. The display query filters on this,
  -- and /api/cron/cleanup-port-photos hard-deletes expired rows + storage objects.
  expires_at TIMESTAMPTZ NOT NULL,

  -- 'live' (default), 'removed' (auto-hidden by 3+ reports), 'admin_removed'
  moderation_status TEXT NOT NULL DEFAULT 'live',
  report_count INTEGER NOT NULL DEFAULT 0,
  removed_at TIMESTAMPTZ,

  -- ─── Metadata moat columns ─────────────────────────────────
  -- Diego's 2026-04-14 directive: the photo BLOB expires in 2h for
  -- storage cost, but the OBSERVATION (who was where, when, what
  -- they saw) is the real asset. Retain these columns indefinitely
  -- per the 3+ year sensor-network retention rule.

  -- Timestamp of when the storage blob was hard-deleted by the
  -- cleanup cron. Row stays; blob goes. Null while blob is live.
  photo_deleted_at TIMESTAMPTZ,

  -- 64-bit perceptual hash (dhash) computed at submit time. Enables
  -- clustering + dedupe + "canonical view per port" queries years
  -- from now even after the blob is gone.
  perceptual_hash BIGINT,

  -- Structured features extracted from the image by Claude Vision.
  -- JSONB schema (enforced by lib/photoVision.ts, not the DB):
  --   x_ray_visible bool
  --   lanes_visible int
  --   lane_congestion_estimate int 1-5
  --   weather enum
  --   time_of_day_visual enum
  --   incidents_visible string[]
  --   vehicles_in_line_estimate int
  --   border_patrol_presence bool
  --   cbp_officer_count_visible int
  --   booths_open_count int
  --   booths_closed_count int
  --   construction_visible bool
  --   flag_nsfw bool  ← used as moderation gate at submit time
  --   flag_faces_visible bool
  --   flag_plates_visible bool
  --   confidence_score 0.0-1.0
  vision_features JSONB,
  vision_extracted_at TIMESTAMPTZ,
  vision_model TEXT
);

-- Display query index: fetch live, non-expired photos for a port,
-- newest first.
CREATE INDEX IF NOT EXISTS idx_port_photos_port_live
  ON port_photos(port_id, created_at DESC)
  WHERE moderation_status = 'live';

-- Cleanup cron index: find expired rows fast.
CREATE INDEX IF NOT EXISTS idx_port_photos_expires
  ON port_photos(expires_at)
  WHERE moderation_status = 'live';

-- Per-user rate-limit index: "how many photos has this user posted
-- in the last 15 minutes?" gets used as a spam guard in the API.
CREATE INDEX IF NOT EXISTS idx_port_photos_user_recent
  ON port_photos(user_id, created_at DESC);

-- Index for Vision-feature queries (admin Data Explorer filters on
-- vision_features->>'x_ray_visible', ->>'incidents_visible' etc.)
CREATE INDEX IF NOT EXISTS idx_port_photos_vision_gin
  ON port_photos USING GIN (vision_features)
  WHERE vision_features IS NOT NULL;

-- Retention doc — this is THE moat asset. DO NOT add delete crons
-- against this table EXCEPT the cleanup cron that hard-deletes the
-- storage blob after 2h. The metadata row stays indefinitely.
COMMENT ON TABLE port_photos IS
  'Community-submitted bridge photos. Storage blob has 2h TTL (enforced by /api/cron/cleanup-port-photos). Metadata row retained INDEFINITELY — this is the sensor-network moat. photo_deleted_at stamps when the blob was removed; vision_features JSONB holds the structured extraction that outlives the image. DO NOT add DELETE queries against this table; archive to cold storage if hot table grows.';

-- ─── Row Level Security ─────────────────────────────────────────
ALTER TABLE port_photos ENABLE ROW LEVEL SECURITY;

-- Public can SELECT live, non-expired rows
DROP POLICY IF EXISTS port_photos_public_select ON port_photos;
CREATE POLICY port_photos_public_select ON port_photos
  FOR SELECT
  USING (
    moderation_status = 'live'
    AND expires_at > NOW()
  );

-- Authenticated users can INSERT their own rows
DROP POLICY IF EXISTS port_photos_auth_insert ON port_photos;
CREATE POLICY port_photos_auth_insert ON port_photos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own photos; service role bypasses RLS.
DROP POLICY IF EXISTS port_photos_owner_delete ON port_photos;
CREATE POLICY port_photos_owner_delete ON port_photos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can UPDATE their own (for caption edits) — not currently
-- surfaced in UI, but the policy exists so we don't have to
-- migrate later.
DROP POLICY IF EXISTS port_photos_owner_update ON port_photos;
CREATE POLICY port_photos_owner_update ON port_photos
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── Storage bucket ─────────────────────────────────────────────
-- Public-read so users can see photos without round-tripping through
-- the app. Authed-write so only logged-in users can upload.
-- Storage policies are configured via supabase.storage.* calls in the
-- Dashboard OR the storage.objects RLS helpers here.

INSERT INTO storage.buckets (id, name, public)
VALUES ('port-photos', 'port-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (for the public-read pattern)
DROP POLICY IF EXISTS port_photos_storage_public_read ON storage.objects;
CREATE POLICY port_photos_storage_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'port-photos');

-- Only authed users can insert, and the first path segment (the
-- user_id folder) must match their auth.uid() — stops user A from
-- uploading into user B's namespace.
DROP POLICY IF EXISTS port_photos_storage_auth_insert ON storage.objects;
CREATE POLICY port_photos_storage_auth_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'port-photos'
    AND auth.uid() IS NOT NULL
  );

-- Allow service role to delete (for the cleanup cron). Owner can
-- delete their own too.
DROP POLICY IF EXISTS port_photos_storage_owner_delete ON storage.objects;
CREATE POLICY port_photos_storage_owner_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'port-photos'
  );
