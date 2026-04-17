-- v34 — port_overrides + app_events (CREATE TABLE IF NOT EXISTS — idempotent)
-- ============================================================
-- Reverse-engineered from route code references:
--
-- port_overrides: used by /api/admin/port-overrides (admin CRUD) and
--   /api/ports route.ts:69 (reads into overrideMap for card labeling).
--   The /api/ports path already defensively uses `overridesRes.data || []`
--   so missing table = feature silently off, not a crash. After this
--   migration lands, admin overrides become functional.
--
-- app_events: used by /api/admin/growth-events (tile on admin dashboard),
--   /api/admin/stats (event counts), /api/promoter/stats (promoter share
--   attribution), /api/user/share-event (logs share fires). Stores
--   event_name + jsonb props + session_id. Core telemetry table.
--
-- Schema sourced from:
--   app/api/admin/port-overrides/route.ts (port_id, local_name, notes, updated_at, updated_by)
--   app/api/admin/growth-events/route.ts (event_name, created_at)
--   app/api/admin/stats/route.ts (app_events counts)
--   app/api/promoter/stats/route.ts (props.promoter_id jsonb access, event_name='promoter_share')
--   app/api/user/share-event/route.ts (event_name, props, session_id, user_id, created_at insert)

-- ─── port_overrides ───────────────────────────────────────────────
create table if not exists public.port_overrides (
  port_id     text primary key,
  local_name  text,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

create index if not exists port_overrides_updated_at_idx on public.port_overrides(updated_at desc);

-- ─── app_events ───────────────────────────────────────────────────
create table if not exists public.app_events (
  id          bigint generated always as identity primary key,
  event_name  text not null,
  user_id     uuid references auth.users(id) on delete set null,
  session_id  text,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists app_events_event_name_created_idx on public.app_events(event_name, created_at desc);
create index if not exists app_events_user_id_created_idx on public.app_events(user_id, created_at desc) where user_id is not null;
create index if not exists app_events_session_id_idx on public.app_events(session_id) where session_id is not null;
create index if not exists app_events_created_at_idx on public.app_events(created_at desc);
-- Promoter attribution uses props->>'promoter_id' — GIN index so that's cheap
create index if not exists app_events_props_promoter_idx on public.app_events ((props->>'promoter_id')) where event_name = 'promoter_share';

-- ─── RLS ───────────────────────────────────────────────────────────
-- Both tables are administrative/telemetry. Service role writes; direct
-- client reads disabled for privacy (app_events contains session + user
-- signal that should not be publicly queryable even with RLS predicates).

alter table public.port_overrides enable row level security;
alter table public.app_events enable row level security;

-- No SELECT policies on either table = direct client cannot read.
-- The admin routes use getServiceClient() which bypasses RLS.
-- Event insertion via /api/user/share-event also uses the service client.
-- If you ever need a browser-side SELECT on app_events (e.g. "my own events"),
-- add a self-scoped policy then: `using (user_id = auth.uid())`.
