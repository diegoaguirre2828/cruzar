-- v51: auto-grant first-1000 promo on signup + backfill existing free users.
--
-- Background: as of 2026-04-25 the page has 246 users / 47 Pro / 199 free,
-- with 49 PWA installs of which almost none are Pro. Two structural causes:
--   1. /api/promo/claim-first-1000 is only called from /welcome:289 after a
--      successful alert setup. Most users sign up but never finish that
--      flow → no promo grant.
--   2. The PWA-grant path (/api/user/claim-pwa-pro) has a 24h verification
--      gate that the client was treating as a permanent dedupe (separate
--      ClaimProInPwa.tsx fix shipped in same commit).
--
-- This migration takes the existing handle_new_user trigger (which creates
-- the profile row with tier='free') and extends it to ALSO claim the
-- first-1000 promo when a fresh user signs up, so long as the global
-- claimant count is still under 1000. Then it backfills every existing
-- free-tier user without a promo, capped at the same 1000 ceiling.
--
-- Idempotent. Safe to re-run. The cap check inside the trigger means we
-- never breach 1000 even under concurrent signups (one or two extra under
-- racing inserts is acceptable for a launch promo, same posture as the
-- API-side claim route at app/api/promo/claim-first-1000/route.ts:50).

-- 1. Replace handle_new_user to auto-grant the promo on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count int;
begin
  insert into public.profiles (id, display_name, tier)
  values (
    new.id,
    split_part(new.email, '@', 1),
    'free'
  )
  on conflict (id) do nothing;

  -- First-1000 founding-member promo. Permanent grant (100 years) to
  -- match the v37 / claim-first-1000 route convention. Only fires under
  -- the cap; once 1000 claimants exist, new signups skip silently.
  select count(*) into current_count
  from public.profiles
  where promo_first_1000_until is not null;

  if current_count < 1000 then
    update public.profiles
    set promo_first_1000_until = now() + interval '100 years'
    where id = new.id
      and promo_first_1000_until is null;
  end if;

  return new;
end;
$$;

-- 2. Backfill all existing free-tier profiles that never got the promo,
--    up to the remaining slots under the 1000 cap.
--
-- Order by id (always present) — created_at exists on most schemas but
-- isn't guaranteed in older profile rows. The cap math is what matters,
-- not the exact ordering of who gets the last slots.
with claimed as (
  select count(*)::int as n
  from public.profiles
  where promo_first_1000_until is not null
), to_grant as (
  select id
  from public.profiles
  where promo_first_1000_until is null
  order by id
  limit greatest(0, 1000 - (select n from claimed))
)
update public.profiles
set promo_first_1000_until = now() + interval '100 years'
where id in (select id from to_grant);

-- 3. Report — how many got backfilled this run
do $$
declare
  total_now int;
begin
  select count(*) into total_now from public.profiles where promo_first_1000_until is not null;
  raise notice 'v51 applied — % profiles now hold the first-1000 promo', total_now;
end;
$$;
