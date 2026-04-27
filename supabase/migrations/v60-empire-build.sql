-- v60: empire build — Layer 2 W2/W3-4 + Pillars 2/3/4/6 + Vision Tier 2 + Layer 3
--
-- One migration covers seven feature surfaces because each adds one or two
-- tables and the empire ships as a coherent unit. Each section is idempotent
-- and isolated — re-running is safe.
--
-- Sections:
--   1. operator_alert_rules + operator_alert_dispatches    (Layer 2 W2)
--   2. customs_declarations                                 (Layer 2 W3-4)
--   3. wallet_documents                                     (Pillar 4)
--   4. emergency_events + emergency_contacts                (Pillar 6)
--   5. family_eta_pings                                     (Pillar 3, extends circles)
--   6. anomaly_camera_events                                (Vision Tier 2)
--   7. operator_drivers + operator_load_assignments         (Layer 3 dispatcher)
--   8. profiles.copilot_voice_opt_in + auto_text_contact    (Pillar 2)

BEGIN;

-- ─── 1. Layer 2 W2: alert rules + dispatches ──────────────────────────
-- Operator-defined thresholds against tracked_loads. When a rule fires
-- (cron poll or anomaly trigger), a dispatch row records the event +
-- delivery channel + payload. Channels: 'push' (web push), 'sms' (Twilio,
-- gated on 10DLC), 'email' (Resend), 'mcp_log' (no-op for AI workflows).
create table if not exists public.operator_alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  load_id uuid references public.tracked_loads(id) on delete cascade,
  -- when load_id is null, the rule applies to ALL loads owned by user_id
  trigger_kind text not null check (trigger_kind in (
    'wait_threshold',         -- predicted_wait_at_arrival > X minutes
    'p_make_appt_below',      -- p_make_appointment < X (0..1)
    'detention_dollars_above',-- detention_risk_dollars > X
    'anomaly_at_recommended', -- recommended_port_id flagged anomaly_high
    'eta_slip_minutes'        -- predicted_arrival drifts > X minutes vs prior compute
  )),
  threshold_value numeric not null,
  channel text not null check (channel in ('push','sms','email','mcp_log')),
  active boolean not null default true,
  cooldown_minutes int not null default 30,
  last_fired_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists operator_alert_rules_user_idx
  on public.operator_alert_rules (user_id, active);
create index if not exists operator_alert_rules_load_idx
  on public.operator_alert_rules (load_id);

create table if not exists public.operator_alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.operator_alert_rules(id) on delete cascade,
  user_id uuid not null,
  load_id uuid,
  fired_at timestamptz not null default now(),
  channel text not null,
  payload jsonb not null,
  delivered boolean not null default false,
  delivery_error text
);

create index if not exists operator_alert_dispatches_user_idx
  on public.operator_alert_dispatches (user_id, fired_at desc);
create index if not exists operator_alert_dispatches_rule_idx
  on public.operator_alert_dispatches (rule_id, fired_at desc);

alter table public.operator_alert_rules enable row level security;
alter table public.operator_alert_dispatches enable row level security;

drop policy if exists "alert_rules_owner_all" on public.operator_alert_rules;
create policy "alert_rules_owner_all" on public.operator_alert_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "alert_dispatches_owner_select" on public.operator_alert_dispatches;
create policy "alert_dispatches_owner_select" on public.operator_alert_dispatches
  for select using (auth.uid() = user_id);

-- ─── 2. Layer 2 W3-4: customs declarations (CBP 7501 + others) ────────
-- Generator output stored as structured JSONB + an optional rendered PDF
-- in Vercel Blob. "we generate / you verify" UX disclaimer is enforced
-- in code, not at the table level.
create table if not exists public.customs_declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  load_id uuid references public.tracked_loads(id) on delete set null,
  form_type text not null check (form_type in ('cbp_7501','pace','padv','immex_manifest','generic_invoice')),
  lane text not null,                          -- e.g. 'laredo_wtb_northbound'
  importer_name text,
  importer_ein text,
  exporter_name text,
  origin_country text not null default 'MX',
  destination_country text not null default 'US',
  hs_codes jsonb not null default '[]'::jsonb,  -- array of {code, description, qty, value, duty_rate}
  invoice_total_usd numeric(12,2),
  fta_claimed text,                            -- e.g. 'USMCA' (formerly NAFTA)
  payload jsonb not null,                      -- full form data
  rendered_pdf_blob_url text,                  -- Vercel Blob URL when generated
  status text not null default 'draft' check (status in ('draft','generated','signed','filed','rejected')),
  generator_version text not null default 'v1',
  generator_disclaimer_acked boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists customs_declarations_user_idx
  on public.customs_declarations (user_id, created_at desc);
create index if not exists customs_declarations_load_idx
  on public.customs_declarations (load_id);

alter table public.customs_declarations enable row level security;
drop policy if exists "customs_declarations_owner_all" on public.customs_declarations;
create policy "customs_declarations_owner_all" on public.customs_declarations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_customs_declarations_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists customs_declarations_touch_updated_at on public.customs_declarations;
create trigger customs_declarations_touch_updated_at
  before update on public.customs_declarations
  for each row execute function public.touch_customs_declarations_updated_at();

-- ─── 3. Pillar 4: Wallet — encrypted-at-rest doc storage ──────────────
-- We store metadata + a Vercel Blob URL. The blob itself is encrypted
-- client-side (AES-GCM with a user-derived key). Server never sees the
-- plaintext key — `encryption_iv` and `encryption_kdf_salt` are stored
-- per-doc so the client can decrypt on retrieval. expires_at drives the
-- "passport expires in X days" reminder.
create table if not exists public.wallet_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'passport','passport_card','sentri','nexus','global_entry',
    'mx_id','mx_ine','mx_passport','vehicle_registration','insurance','fmm','tip_permit','other'
  )),
  label text,                                  -- user-named ("Mom's passport", etc.)
  blob_url text,                               -- ciphertext blob (Vercel Blob), null = metadata-only
  encryption_iv text,                          -- base64 12-byte IV for AES-GCM
  encryption_kdf_salt text,                    -- base64 16-byte salt for PBKDF2
  expires_at date,
  reminded_30d_at timestamptz,
  reminded_7d_at timestamptz,
  shared_with_circle_id uuid references public.circles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists wallet_documents_user_idx
  on public.wallet_documents (user_id, created_at desc);
create index if not exists wallet_documents_expiry_idx
  on public.wallet_documents (expires_at)
  where expires_at is not null;

alter table public.wallet_documents enable row level security;
drop policy if exists "wallet_documents_owner_all" on public.wallet_documents;
create policy "wallet_documents_owner_all" on public.wallet_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Members of a shared circle can SELECT (no insert/update/delete).
drop policy if exists "wallet_documents_circle_read" on public.wallet_documents;
create policy "wallet_documents_circle_read" on public.wallet_documents
  for select using (
    shared_with_circle_id is not null
    and shared_with_circle_id in (
      select circle_id from public.circle_members where user_id = auth.uid()
    )
  );

-- ─── 4. Pillar 6: Safety Net — emergency events + contacts ────────────
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  email text,
  relation text,                               -- 'spouse','parent','attorney','consulate', etc.
  priority int not null default 100,           -- lower = called first
  notify_on_emergency boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists emergency_contacts_user_idx
  on public.emergency_contacts (user_id, priority);

create table if not exists public.emergency_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'secondary_inspection','vehicle_breakdown','accident',
    'lost_sentri','document_seizure','medical','other'
  )),
  port_id text,
  lat double precision,
  lng double precision,
  notes text,
  status text not null default 'open' check (status in ('open','resolved','false_alarm')),
  notified_contact_ids uuid[] not null default array[]::uuid[],
  notified_circle_ids uuid[] not null default array[]::uuid[],
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists emergency_events_user_idx
  on public.emergency_events (user_id, started_at desc);
create index if not exists emergency_events_open_idx
  on public.emergency_events (status, started_at desc)
  where status = 'open';

alter table public.emergency_contacts enable row level security;
alter table public.emergency_events enable row level security;

drop policy if exists "emergency_contacts_owner_all" on public.emergency_contacts;
create policy "emergency_contacts_owner_all" on public.emergency_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "emergency_events_owner_all" on public.emergency_events;
create policy "emergency_events_owner_all" on public.emergency_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Circle co-members can SELECT open events (so family sees the SOS).
drop policy if exists "emergency_events_circle_read" on public.emergency_events;
create policy "emergency_events_circle_read" on public.emergency_events
  for select using (
    array_length(notified_circle_ids, 1) > 0
    and exists (
      select 1 from public.circle_members cm
      where cm.user_id = auth.uid() and cm.circle_id = ANY(notified_circle_ids)
    )
  );

-- ─── 5. Pillar 3: Family Layer — ETA broadcasts (extends circles) ─────
-- A user can broadcast their predicted arrival time to one of their
-- circles. Circle co-members see the live ETA on /circle. The auto-text
-- spouse hook (Pillar 2) writes one of these on cross-detection.
create table if not exists public.family_eta_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  port_id text,
  predicted_arrival_at timestamptz not null,
  actual_arrival_at timestamptz,
  origin_lat double precision,
  origin_lng double precision,
  dest_label text,
  status text not null default 'in_transit' check (status in ('in_transit','arrived','canceled','timed_out')),
  message_es text,
  message_en text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists family_eta_pings_circle_idx
  on public.family_eta_pings (circle_id, created_at desc);
create index if not exists family_eta_pings_user_idx
  on public.family_eta_pings (user_id, created_at desc);

alter table public.family_eta_pings enable row level security;
drop policy if exists "family_eta_pings_owner_all" on public.family_eta_pings;
create policy "family_eta_pings_owner_all" on public.family_eta_pings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "family_eta_pings_circle_read" on public.family_eta_pings;
create policy "family_eta_pings_circle_read" on public.family_eta_pings
  for select using (
    circle_id in (
      select circle_id from public.circle_members where user_id = auth.uid()
    )
  );

-- ─── 6. Vision Tier 2: anomaly-triggered camera frames ────────────────
-- When cruzar_anomaly_now flags a port, the cron snapshots the bridge
-- webcam and stores the frame URL here for the /admin/intel dashboard.
create table if not exists public.anomaly_camera_events (
  id uuid primary key default gen_random_uuid(),
  port_id text not null,
  triggered_at timestamptz not null default now(),
  anomaly_kind text not null check (anomaly_kind in ('high','low')),
  ratio numeric(6,3),
  live_wait_min int,
  baseline_min int,
  frame_blob_url text,
  camera_source text,                          -- 'txdot','cbp','custom_hls'
  notes text
);

create index if not exists anomaly_camera_events_port_idx
  on public.anomaly_camera_events (port_id, triggered_at desc);
create index if not exists anomaly_camera_events_recent_idx
  on public.anomaly_camera_events (triggered_at desc);

-- service-role only (admin reads through API)
alter table public.anomaly_camera_events enable row level security;

-- ─── 7. Layer 3: dispatcher console — operator_drivers + assignments ──
-- Operator dashboard tracks multiple drivers. Each driver gets a
-- token-based status link (no login required, like /driver checkin).
-- operator_load_assignments wires a driver to a tracked_load.
create table if not exists public.operator_drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,    -- the operator/dispatcher
  display_name text not null,
  phone text,
  truck_number text,
  active boolean not null default true,
  checkin_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  last_seen_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  status text not null default 'available' check (status in (
    'available','en_route','in_line','at_agent','crossed','delivered','off_duty'
  )),
  created_at timestamptz default now()
);

create index if not exists operator_drivers_user_idx
  on public.operator_drivers (user_id, active);

create table if not exists public.operator_load_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references public.operator_drivers(id) on delete cascade,
  load_id uuid not null references public.tracked_loads(id) on delete cascade,
  assigned_at timestamptz default now(),
  unassigned_at timestamptz
);

create index if not exists operator_load_assignments_user_idx
  on public.operator_load_assignments (user_id, assigned_at desc);
create unique index if not exists operator_load_assignments_active_unique
  on public.operator_load_assignments (driver_id, load_id)
  where unassigned_at is null;

alter table public.operator_drivers enable row level security;
alter table public.operator_load_assignments enable row level security;

drop policy if exists "operator_drivers_owner_all" on public.operator_drivers;
create policy "operator_drivers_owner_all" on public.operator_drivers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operator_load_assignments_owner_all" on public.operator_load_assignments;
create policy "operator_load_assignments_owner_all" on public.operator_load_assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 8. Pillar 2: Co-Pilot prefs on profiles ──────────────────────────
alter table public.profiles
  add column if not exists copilot_voice_opt_in boolean not null default false;
alter table public.profiles
  add column if not exists copilot_auto_text_contact_id uuid references public.emergency_contacts(id) on delete set null;
alter table public.profiles
  add column if not exists copilot_auto_text_circle_id uuid references public.circles(id) on delete set null;

COMMIT;
