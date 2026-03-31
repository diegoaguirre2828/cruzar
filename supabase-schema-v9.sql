-- Business portal: shipments + team management

-- Shipments table for tracking individual shipments
create table if not exists shipments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  reference_id varchar(100) not null,         -- internal shipment number
  description varchar(500),
  origin varchar(200),
  destination varchar(200),
  port_id varchar(100),                        -- planned crossing port
  carrier varchar(200),
  driver_name varchar(200),
  driver_phone varchar(50),
  expected_crossing_at timestamptz,           -- planned crossing time
  actual_crossing_at timestamptz,             -- actual crossing time (filled after)
  status varchar(50) default 'scheduled',      -- scheduled, crossing, cleared, delivered, delayed
  delay_minutes integer default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table shipments enable row level security;
create policy "Users manage own shipments"
  on shipments for all using (auth.uid() = user_id);

-- Index for common queries
create index if not exists shipments_user_id_idx on shipments(user_id);
create index if not exists shipments_status_idx on shipments(status);
create index if not exists shipments_expected_crossing_idx on shipments(expected_crossing_at);

-- Team seats: allow a business account to invite team members
create table if not exists team_members (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users on delete cascade not null,  -- business account owner
  member_email varchar(255) not null,
  member_id uuid references auth.users on delete set null,         -- filled once they accept
  role varchar(50) default 'dispatcher',                           -- dispatcher, viewer
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  unique(owner_id, member_email)
);

alter table team_members enable row level security;
create policy "Owner manages team"
  on team_members for all using (auth.uid() = owner_id);
create policy "Member can view their invite"
  on team_members for select using (auth.uid() = member_id);
