-- Run this in your Supabase SQL editor at supabase.com

-- Wait time readings (core data table)
create table if not exists wait_time_readings (
  id uuid default gen_random_uuid() primary key,
  port_id varchar not null,
  port_name varchar not null,
  crossing_name varchar,
  vehicle_wait integer,
  sentri_wait integer,
  pedestrian_wait integer,
  commercial_wait integer,
  recorded_at timestamptz not null default now(),
  day_of_week integer not null, -- 0=Sunday, 6=Saturday
  hour_of_day integer not null  -- 0-23
);

-- Index for fast queries by port + time
create index if not exists idx_wait_readings_port_time
  on wait_time_readings (port_id, recorded_at desc);

create index if not exists idx_wait_readings_port_day_hour
  on wait_time_readings (port_id, day_of_week, hour_of_day);

-- Auto-delete readings older than 90 days (keep table lean)
-- Run this as a scheduled job or Supabase Edge Function cron
-- delete from wait_time_readings where recorded_at < now() - interval '90 days';

-- Enable Row Level Security (read-only for anon users)
alter table wait_time_readings enable row level security;

create policy "Anyone can read wait times"
  on wait_time_readings for select
  using (true);
