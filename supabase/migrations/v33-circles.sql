-- v33 — Circles feature (CREATE TABLE IF NOT EXISTS — idempotent)
-- ============================================================
-- Reverse-engineered from the route code that has been shipping without
-- a committed schema for an unknown period. If the tables already exist
-- in prod via manual SQL (possible — the routes compile and the UI
-- renders a CircleTab), this migration is a no-op. If they don't exist,
-- this creates them + wires RLS so the feature actually works.
--
-- Tables:
--   circles             — a trusted group of users ("My People")
--   circle_members      — membership link with role
--   circle_invites      — single-use token links for join flows
--
-- Schema sourced from:
--   app/api/circles/route.ts                (GET + POST: circles.id/name/owner_id/created_at; circle_members.circle_id/user_id/role/joined_at)
--   app/api/circles/accept/route.ts         (circle_invites.token/circle_id/accepted_at/accepted_by)
--   app/api/circles/[id]/invite/route.ts    (circle_invites.token/circle_id/invited_by/invited_email)
--   app/api/circles/ping/route.ts           (circle_members select)
--   app/dashboard/page.tsx CircleTab        (UI shape)

-- ─── circles ───────────────────────────────────────────────────────
create table if not exists public.circles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists circles_owner_id_idx on public.circles(owner_id);

-- ─── circle_members ────────────────────────────────────────────────
create table if not exists public.circle_members (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member',       -- 'owner' | 'member'
  joined_at   timestamptz not null default now(),
  unique (circle_id, user_id)
);

create index if not exists circle_members_circle_id_idx on public.circle_members(circle_id);
create index if not exists circle_members_user_id_idx on public.circle_members(user_id);

-- ─── circle_invites ────────────────────────────────────────────────
create table if not exists public.circle_invites (
  token           text primary key,             -- 22-char base64url from the route
  circle_id       uuid not null references public.circles(id) on delete cascade,
  invited_by      uuid not null references auth.users(id) on delete cascade,
  invited_email   text,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists circle_invites_circle_id_idx on public.circle_invites(circle_id);

-- ─── RLS ───────────────────────────────────────────────────────────
-- All writes go through the service-role client (routes use getServiceClient),
-- so the table-level RLS is intentionally restrictive for direct-client
-- access: only owners can read their circles directly from the browser,
-- members can read memberships they are part of. No direct inserts from
-- the browser — the service-role routes are the authoritative writers.

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;

-- Owners can SELECT their own circles (useful if any future UI bypasses the route)
drop policy if exists "circles: owner can select own" on public.circles;
create policy "circles: owner can select own"
  on public.circles for select
  using (auth.uid() = owner_id);

-- Members can SELECT the circles they belong to (the UI's primary read shape)
drop policy if exists "circles: members can select own circles" on public.circles;
create policy "circles: members can select own circles"
  on public.circles for select
  using (
    id in (
      select circle_id from public.circle_members where user_id = auth.uid()
    )
  );

-- circle_members: users see their own memberships + co-members in same circles
drop policy if exists "circle_members: self + co-members" on public.circle_members;
create policy "circle_members: self + co-members"
  on public.circle_members for select
  using (
    user_id = auth.uid()
    or circle_id in (
      select circle_id from public.circle_members where user_id = auth.uid()
    )
  );

-- circle_invites: invitee (by email) or inviter or circle members can select
drop policy if exists "circle_invites: inviter + members can select" on public.circle_invites;
create policy "circle_invites: inviter + members can select"
  on public.circle_invites for select
  using (
    invited_by = auth.uid()
    or circle_id in (
      select circle_id from public.circle_members where user_id = auth.uid()
    )
  );

-- No insert/update/delete policies defined — service-role client bypasses RLS.
-- Direct-client writes are intentionally impossible for these tables.
