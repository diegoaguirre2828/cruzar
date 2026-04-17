-- v35 — moderation columns for reports + users (idempotent)
-- ============================================================
-- Diego 2026-04-16 late: "make sure user reports manager/verifier is
-- up and running and that we are filtering any trolls/spam/or points
-- farming."
--
-- Existing protection at write-time (already in /api/reports POST):
--   - 3-layer rate limit: hourly cap, per-port cooldown, 5-min burst
--   - Content validation: reject 'clear' with 60+ min wait,
--     reject >5 extra tags, description HTML-strip + 500 char cap
--   - Location-confidence weighting in /api/ports blending
--   - Self-upvote + toggle-farm blocked in /api/reports/upvote
--
-- This migration adds the AFTER-THE-FACT moderation layer: admin can
-- hide specific reports post-submission, and can ban users who keep
-- submitting trash. Neither capability existed before — the only
-- option was raw SQL in the Supabase editor.
--
-- Columns on crossing_reports:
--   hidden_at      timestamptz (null = visible, non-null = hidden)
--   hidden_by      uuid → auth.users.id (who hid it)
--   hidden_reason  text (spam | troll | farm | inaccurate | other_reason)
--
-- Columns on profiles:
--   banned_until   timestamptz (null = not banned, future = banned until)
--   ban_reason     text (spam | farm | abuse | other_reason)

-- ─── crossing_reports: hidden flags ────────────────────────────────
alter table public.crossing_reports
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text;

create index if not exists crossing_reports_hidden_at_idx
  on public.crossing_reports(hidden_at)
  where hidden_at is not null;

-- Feed readers (public /api/reports/recent, /api/ports community blend)
-- should filter `where hidden_at is null`. Updating route code
-- separately so the filter is enforced in one place per query type.

-- ─── profiles: banned_until ────────────────────────────────────────
alter table public.profiles
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_banned_until_idx
  on public.profiles(banned_until)
  where banned_until is not null;

-- No RLS changes required — service-role client in admin routes
-- bypasses RLS. Direct-client updates to these columns would be
-- rejected by existing profile RLS policies (user can only update
-- their own row, and we're not going to allow users to set their
-- own banned_until).
