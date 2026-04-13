-- v19: Trusted Circles + auto-crossing infrastructure
--
-- Life360-style private groups for people who cross together (family,
-- coworkers, trucking crews). When a circle member taps Just Crossed,
-- every other member gets a push notification. No public feeds, no
-- gamification, just a private utility that replaces the "did you
-- make it home safe?" text message.
--
-- Also adds the user_crossings log + verified_by_geofence flag for
-- future auto-detection (when the user grants location, we'll record
-- entry/exit events and auto-prompt reports).

-- ─── Circles ────────────────────────────────────────────────────────
create table if not exists circles (
  id uuid default gen_random_uuid() primary key,
  name varchar not null,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now()
);
create index if not exists idx_circles_owner on circles (owner_id);

create table if not exists circle_members (
  id uuid default gen_random_uuid() primary key,
  circle_id uuid references circles on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role varchar default 'member',  -- 'owner', 'member'
  joined_at timestamptz default now(),
  unique (circle_id, user_id)
);
create index if not exists idx_circle_members_user on circle_members (user_id);
create index if not exists idx_circle_members_circle on circle_members (circle_id);

create table if not exists circle_invites (
  token varchar primary key,
  circle_id uuid references circles on delete cascade not null,
  invited_by uuid references auth.users on delete set null,
  invited_email varchar,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users on delete set null
);
create index if not exists idx_circle_invites_pending
  on circle_invites (circle_id)
  where accepted_at is null;

alter table circles enable row level security;
alter table circle_members enable row level security;
alter table circle_invites enable row level security;

drop policy if exists "Members read their circles" on circles;
create policy "Members read their circles"
  on circles for select
  using (
    id in (select circle_id from circle_members where user_id = auth.uid())
  );

drop policy if exists "Members read their circle memberships" on circle_members;
create policy "Members read their circle memberships"
  on circle_members for select
  using (
    circle_id in (select circle_id from circle_members where user_id = auth.uid())
  );

-- Service role (server-side only) handles all writes — no direct client writes
-- against these tables. Policies stay read-only for the authed user.

-- ─── User crossings log ─────────────────────────────────────────────
-- Records both manual Just Crossed submissions and (future) auto-detected
-- geofence crossings. Used for historical patterns and circle notifications.
create table if not exists user_crossings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  port_id varchar not null,
  entered_at timestamptz,
  exited_at timestamptz,
  duration_min integer,
  condition varchar,          -- 'fast', 'normal', 'slow'
  lane_type varchar,          -- 'vehicle', 'sentri', 'pedestrian', 'commercial'
  detected_by varchar default 'manual',  -- 'manual', 'geofence'
  created_at timestamptz default now()
);
create index if not exists idx_user_crossings_user_time
  on user_crossings (user_id, created_at desc);

alter table user_crossings enable row level security;
drop policy if exists "Users read own crossings" on user_crossings;
create policy "Users read own crossings"
  on user_crossings for select
  using (auth.uid() = user_id);

-- ─── verified_by_geofence flag on crossing_reports ──────────────────
alter table crossing_reports
  add column if not exists verified_by_geofence boolean default false;
create index if not exists idx_reports_verified_geofence
  on crossing_reports (verified_by_geofence) where verified_by_geofence = true;
