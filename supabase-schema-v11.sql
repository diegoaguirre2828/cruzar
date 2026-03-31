-- Business rewards portal

create table if not exists rewards_businesses (
  id uuid default gen_random_uuid() primary key,
  name varchar(200) not null,
  description varchar(500),
  address varchar(300),
  port_ids text[] default '{}',    -- crossings this business is near
  category varchar(100) default 'other',
  -- restaurant, cafe, gas, pharmacy, tire, exchange, other
  logo_emoji varchar(10) default '🏪',
  phone varchar(50),
  website varchar(300),
  approved boolean default false,  -- admin approves before showing
  submitted_by_email varchar(255),
  created_at timestamptz default now()
);

create table if not exists rewards_deals (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references rewards_businesses on delete cascade not null,
  title varchar(200) not null,
  description varchar(500),
  points_required integer not null default 50,
  deal_code varchar(50),           -- code customer shows at business
  active boolean default true,
  expires_at timestamptz,
  redemptions_count integer default 0,
  max_redemptions integer,         -- null = unlimited
  created_at timestamptz default now()
);

create table if not exists rewards_redemptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  deal_id uuid references rewards_deals on delete cascade not null,
  points_spent integer not null,
  redeemed_at timestamptz default now(),
  unique(user_id, deal_id)         -- one redemption per deal per user
);

-- RLS
alter table rewards_businesses enable row level security;
alter table rewards_deals enable row level security;
alter table rewards_redemptions enable row level security;

create policy "Anyone can read approved businesses"
  on rewards_businesses for select using (approved = true);
create policy "Anyone can read active deals"
  on rewards_deals for select using (active = true);
create policy "Users manage own redemptions"
  on rewards_redemptions for all using (auth.uid() = user_id);
create policy "Anyone can read redemption counts"
  on rewards_redemptions for select using (true);

-- Seed a few example businesses (approved=false so admin must approve)
-- These serve as examples for what a real entry looks like
insert into rewards_businesses (name, description, address, port_ids, category, logo_emoji, approved)
values
  ('El Rancho Restaurant', 'Authentic Mexican food, 5 min from the bridge', '1201 S 10th St, McAllen, TX', array['230501','230502'], 'restaurant', '🌮', false),
  ('Quick Lube & Tire', 'Oil change & tires while you wait', '423 W Military Hwy, Pharr, TX', array['230502'], 'tire', '🔧', false),
  ('Money Exchange Plus', 'Best USD/MXN rates near the bridge', '800 N International Blvd, Hidalgo, TX', array['230501'], 'exchange', '💱', false)
on conflict do nothing;
