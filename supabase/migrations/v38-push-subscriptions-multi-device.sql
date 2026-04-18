-- v38 — push_subscriptions multi-device
--
-- Why: the original v7 schema declared `user_id uuid ... unique`, which
-- capped every user at exactly one push subscription. A user who enabled
-- push on their iPhone and then on their laptop would silently overwrite
-- the phone row, and bridge alerts would stop delivering where they
-- actually need them (the phone).
--
-- Fix: drop the user_id unique constraint and add a unique index on
-- endpoint instead. Endpoint is globally unique per browser/device, so
-- this lets a single user have multiple rows (one per device) while
-- still preventing duplicate rows for the same device.
--
-- Paired with:
--   - app/api/push/subscribe/route.ts: upsert onConflict changed from
--     'user_id' to 'endpoint'
--   - app/api/cron/send-alerts/route.ts: sendPush() fetches all rows for
--     the user and iterates, instead of .single()
--
-- Apply via Supabase Management API or SQL Editor.

alter table push_subscriptions
  drop constraint if exists push_subscriptions_user_id_key;

create unique index if not exists push_subscriptions_endpoint_key
  on push_subscriptions(endpoint);
