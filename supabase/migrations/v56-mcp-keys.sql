-- v56 — MCP API key issuance for Cruzar Insights
--
-- Self-serve flow at /insights/get-key: prospect submits email + use-case,
-- we generate a key, hash it (SHA-256), store the hash, email them the
-- plaintext. The MCP route at /mcp validates the bearer against this table
-- (or falls back to the legacy CRUZAR_MCP_KEY env var for backwards compat).
--
-- We never store the plaintext key — only its hash. If the user loses it,
-- they have to request a new one (and we revoke the old).

create table if not exists mcp_keys (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('cruzar-insights', 'jetstream')),
  key_hash text not null,                 -- SHA-256 hex of the bearer token
  key_prefix text not null,               -- last 4 chars of the bearer for "your key ending in ABCD" UX
  owner_email text not null,
  use_case text,
  source text not null default 'self_serve',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);

create unique index if not exists idx_mcp_keys_hash on mcp_keys(key_hash);
create index if not exists idx_mcp_keys_email on mcp_keys(owner_email) where revoked_at is null;
create index if not exists idx_mcp_keys_service on mcp_keys(service) where revoked_at is null;

-- RLS: service-role-only. Public-facing endpoints always go through the
-- service-role client. No anon access.
alter table mcp_keys enable row level security;

-- Lightweight rate-limit table to prevent flood from /api/mcp-key/request.
-- We rate-limit by email AND by IP, so an attacker can't bury a victim's
-- email under our reply. Self-cleaning: we just delete old rows on insert.
create table if not exists mcp_key_request_log (
  id bigserial primary key,
  ip text,
  email text,
  requested_at timestamptz not null default now()
);
create index if not exists idx_mcp_key_request_log_recent on mcp_key_request_log(email, requested_at desc);
create index if not exists idx_mcp_key_request_log_ip_recent on mcp_key_request_log(ip, requested_at desc);
alter table mcp_key_request_log enable row level security;
