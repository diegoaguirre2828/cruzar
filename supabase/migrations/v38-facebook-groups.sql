-- v38 — facebook_groups table
--
-- Backs the promoter dashboard's user-added Facebook group list.
-- Queried by:
--   app/api/promoter/groups/route.ts        (GET list, POST bulk add)
--   app/api/promoter/groups/[id]/route.ts   (DELETE)
--
-- This table has been queried in production without error, so it was
-- likely created manually via the Supabase SQL editor. This migration
-- is fully idempotent — safe to re-apply.

CREATE TABLE IF NOT EXISTS facebook_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_facebook_groups_region
  ON facebook_groups (region);

CREATE INDEX IF NOT EXISTS idx_facebook_groups_created_at
  ON facebook_groups (created_at DESC);

ALTER TABLE facebook_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promoters can read facebook_groups" ON facebook_groups;
CREATE POLICY "promoters can read facebook_groups" ON facebook_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_promoter = true
    )
  );
