-- Cruzar schema v26: app_events table for growth + funnel tracking
--
-- Generic events log. One row per event from anywhere in the app
-- (client or server). Purpose: start collecting now what we can't
-- yet display, so the moment we build the "alert conversion rate
-- over time" or "IAB rescue-rate growth curve" widgets they have
-- weeks of baseline data to render instead of a cold start.
--
-- Intentionally flat + generic: event_name is a free-form string
-- we control from the code, and props is a JSONB blob for arbitrary
-- dimensions (platform, tier, port_id, etc). No foreign-key joins,
-- no per-event tables. Query it with where event_name = 'x' and
-- props ->> 'key' = 'y'.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists app_events (
  id           uuid primary key default gen_random_uuid(),
  event_name   text not null,
  props        jsonb,
  session_id   text,
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_app_events_name_created
  on app_events (event_name, created_at desc);

create index if not exists idx_app_events_created
  on app_events (created_at desc);

create index if not exists idx_app_events_user
  on app_events (user_id, created_at desc)
  where user_id is not null;

-- RLS — admin service role can read/write all; authenticated
-- users can insert but never read back their own events. This is
-- a write-only path from the client perspective.
alter table app_events enable row level security;

drop policy if exists "app_events_insert_anon" on app_events;
create policy "app_events_insert_anon" on app_events
  for insert with check (true);
