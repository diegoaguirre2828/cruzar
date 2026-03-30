-- Safe version: skips already-existing policies

-- Add tier column to profiles (safe)
alter table profiles add column if not exists tier varchar default 'free';

-- Advertisers table
create table if not exists advertisers (
  id uuid default gen_random_uuid() primary key,
  business_name varchar not null,
  contact_email varchar not null,
  contact_phone varchar,
  website varchar,
  description text,
  status varchar default 'pending',
  created_at timestamptz default now()
);
alter table advertisers enable row level security;
do $$ begin
  create policy "Anyone can submit advertiser application"
    on advertisers for insert with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Admins can manage advertisers"
    on advertisers for all using (true);
exception when duplicate_object then null;
end $$;

-- Ads table
create table if not exists ads (
  id uuid default gen_random_uuid() primary key,
  advertiser_id uuid references advertisers on delete cascade,
  title varchar not null,
  description varchar,
  cta_text varchar default 'Learn More',
  cta_url varchar,
  image_url varchar,
  ad_type varchar default 'sponsored_card',
  target_regions varchar[],
  target_ports varchar[],
  min_wait_trigger integer,
  active boolean default true,
  starts_at timestamptz default now(),
  ends_at timestamptz,
  monthly_rate integer,
  stripe_subscription_id varchar,
  impressions integer default 0,
  clicks integer default 0,
  created_at timestamptz default now()
);
alter table ads enable row level security;
do $$ begin
  create policy "Anyone can read active ads"
    on ads for select using (active = true);
exception when duplicate_object then null;
end $$;

-- Ad events table
create table if not exists ad_events (
  id uuid default gen_random_uuid() primary key,
  ad_id uuid references ads on delete cascade,
  event_type varchar not null,
  port_id varchar,
  created_at timestamptz default now()
);
alter table ad_events enable row level security;
do $$ begin
  create policy "Anyone can log ad events"
    on ad_events for insert with check (true);
exception when duplicate_object then null;
end $$;

-- Subscriptions table
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  stripe_customer_id varchar,
  stripe_subscription_id varchar,
  tier varchar not null,
  status varchar not null,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table subscriptions enable row level security;
do $$ begin
  create policy "Users can read own subscription"
    on subscriptions for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
