-- v16: Port local-name overrides
--
-- Run this in Supabase SQL Editor. Creates a small table where Diego can
-- override the localName shown in PortCards without redeploying the app.
-- The static defaults still live in lib/portMeta.ts — this table is a
-- runtime overlay that wins when present.

create table if not exists port_overrides (
  port_id    varchar primary key,
  local_name varchar,
  notes      text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users on delete set null
);

-- Admins read/write everything via service role. RLS is on but permissive
-- for public SELECT so /api/ports can merge overrides without auth.
alter table port_overrides enable row level security;

drop policy if exists "Public read port overrides" on port_overrides;
create policy "Public read port overrides"
  on port_overrides for select
  using (true);
