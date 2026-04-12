-- ============================================================
-- Schema v13 — Referral events tracking
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists referral_events (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_user_id uuid references auth.users on delete set null,
  event_type varchar(20) not null, -- 'report' | 'signup'
  port_id varchar(20),
  points_awarded integer not null default 0,
  created_at timestamptz default now(),
  unique(referrer_id, referred_user_id, event_type)
);

alter table referral_events enable row level security;

-- Service role only — no user-facing reads needed
create policy "Service role manages referral events"
  on referral_events for all using (auth.role() = 'service_role');
