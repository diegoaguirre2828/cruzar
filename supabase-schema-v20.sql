-- v20: PWA install → 3 months free Pro
--
-- Reward users who commit by installing Cruzar as a PWA (Add to Home Screen)
-- with 90 days of free Pro tier. This is a commitment/install-bond hook:
-- PWA installers return 3-5x more often than web-only users, so granting
-- Pro to them is rewarding an action they've already taken.

alter table profiles
  add column if not exists pro_via_pwa_until timestamptz;
alter table profiles
  add column if not exists pwa_installed_at timestamptz;

create index if not exists idx_profiles_pwa_until
  on profiles (pro_via_pwa_until)
  where pro_via_pwa_until is not null;
