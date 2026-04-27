-- v58: tracked_loads + crossing_events
--
-- Cruzar Insights B2B feature: load-tagged ETA-to-dock + detention risk.
-- Operators (freight brokers, dispatchers, fleet ops) tag a load with
-- origin/dock/appointment, we compute predicted-arrival + P(make appointment)
-- + $ detention exposure using the v0.5 forecast model + HERE routing.
--
-- crossing_events records the retrospective ledger: which bridge was actually
-- used vs which we recommended, so the weekly email can quantify $ saved.
--
-- Idempotent. Safe to re-run.

create table if not exists public.tracked_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- operator's reference (TMS load #, BOL, whatever they recognize)
  load_ref text not null,

  -- truck origin (Mexican side or wherever the truck starts)
  origin_lat double precision not null,
  origin_lng double precision not null,
  origin_label text,                                  -- optional human-readable

  -- destination dock
  dest_address text not null,
  dest_lat double precision,                          -- populated after geocode
  dest_lng double precision,

  -- delivery commitment
  appointment_at timestamptz not null,

  -- economics (per-load override; defaults reasonable for SMB)
  detention_rate_per_hour numeric(6,2) default 75.00,
  detention_grace_hours numeric(4,2) default 2.00,
  loaded_value_dollars numeric(10,2),                 -- optional, for risk weighting

  -- operator's bridge preference (null = let us pick)
  preferred_port_id text,

  -- live ETA snapshot (refreshed on demand by /api/insights/loads/:id/eta)
  recommended_port_id text,
  predicted_arrival_at timestamptz,
  predicted_eta_minutes int,
  predicted_wait_minutes int,
  predicted_drive_minutes int,
  rmse_minutes numeric(6,2),                          -- model uncertainty σ
  p_make_appointment numeric(4,3),                    -- 0.000 to 1.000
  detention_risk_dollars numeric(8,2),
  eta_refreshed_at timestamptz,

  -- lifecycle
  status text not null default 'tracking'             -- tracking | crossed | completed | canceled
    check (status in ('tracking','crossed','completed','canceled')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tracked_loads_user_status_idx
  on public.tracked_loads (user_id, status, appointment_at desc);

create index if not exists tracked_loads_appointment_idx
  on public.tracked_loads (appointment_at)
  where status in ('tracking','crossed');

-- crossing_events: the retrospective ledger.
-- Populated when status flips to 'crossed' (operator marks done OR auto-detect via geofence later).
create table if not exists public.crossing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  load_id uuid references public.tracked_loads(id) on delete set null,
  load_ref text,                                      -- denormalized for retro emails

  port_id_used text not null,
  port_id_recommended text,

  actual_wait_minutes int,
  recommended_wait_minutes int,                       -- our predicted wait at dispatch time

  savings_minutes int,                                -- (actual_used_total - recommended_total)
  savings_dollars numeric(8,2),                       -- savings_min × detention_rate / 60

  appointment_at timestamptz,
  arrived_at timestamptz,
  on_time boolean,
  detention_minutes int,                              -- max(0, arrived - (appointment + grace))
  detention_dollars numeric(8,2),

  crossed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists crossing_events_user_crossed_idx
  on public.crossing_events (user_id, crossed_at desc);

-- RLS: users see/manage own only. Service role for cron + admin paths.
alter table public.tracked_loads enable row level security;
alter table public.crossing_events enable row level security;

drop policy if exists "tracked_loads_owner_select" on public.tracked_loads;
drop policy if exists "tracked_loads_owner_insert" on public.tracked_loads;
drop policy if exists "tracked_loads_owner_update" on public.tracked_loads;
drop policy if exists "tracked_loads_owner_delete" on public.tracked_loads;

create policy "tracked_loads_owner_select" on public.tracked_loads
  for select using (auth.uid() = user_id);
create policy "tracked_loads_owner_insert" on public.tracked_loads
  for insert with check (auth.uid() = user_id);
create policy "tracked_loads_owner_update" on public.tracked_loads
  for update using (auth.uid() = user_id);
create policy "tracked_loads_owner_delete" on public.tracked_loads
  for delete using (auth.uid() = user_id);

drop policy if exists "crossing_events_owner_select" on public.crossing_events;
drop policy if exists "crossing_events_owner_insert" on public.crossing_events;

create policy "crossing_events_owner_select" on public.crossing_events
  for select using (auth.uid() = user_id);
create policy "crossing_events_owner_insert" on public.crossing_events
  for insert with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_tracked_loads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracked_loads_touch_updated_at on public.tracked_loads;
create trigger tracked_loads_touch_updated_at
  before update on public.tracked_loads
  for each row execute function public.touch_tracked_loads_updated_at();
