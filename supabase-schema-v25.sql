-- Cruzar schema v25: share_events table for per-share timeline + channel
-- attribution. Previously we stored only a share_count integer on
-- profiles, which meant "total shares ever" but not "when", "where",
-- or "through what channel."
--
-- With this table we can show Diego a per-user viral-loop detail view
-- — who shared, when, through which channel (WhatsApp / Facebook /
-- Copy / Native), and (via referral_events) who they actually brought
-- back into the app.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists share_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  channel     text,    -- 'whatsapp' | 'facebook' | 'copy' | 'native' | null
  context     text,    -- 'hero_live_delta' | 'report_form' | 'port_card' | etc.
  created_at  timestamptz not null default now()
);

create index if not exists idx_share_events_user_created
  on share_events (user_id, created_at desc);

create index if not exists idx_share_events_created
  on share_events (created_at desc);

-- Row-level security — admin service key can read all; users can
-- only see their own events. Client code never reads from this
-- table directly (admin endpoint uses service role), so this is
-- mainly a defense-in-depth posture.
alter table share_events enable row level security;

drop policy if exists "share_events_self_select" on share_events;
create policy "share_events_self_select" on share_events
  for select using (auth.uid() = user_id);

drop policy if exists "share_events_self_insert" on share_events;
create policy "share_events_self_insert" on share_events
  for insert with check (auth.uid() = user_id);
