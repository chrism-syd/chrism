create table if not exists public.ccic_admin_login_codes (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ccic_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ccic_admin_login_codes_email_created_idx
  on public.ccic_admin_login_codes (email_hash, created_at desc);

create index if not exists ccic_admin_sessions_token_active_idx
  on public.ccic_admin_sessions (token_hash, expires_at)
  where revoked_at is null;

alter table public.ccic_admin_login_codes enable row level security;
alter table public.ccic_admin_sessions enable row level security;

revoke all on table public.ccic_admin_login_codes from anon, authenticated;
revoke all on table public.ccic_admin_sessions from anon, authenticated;

grant all on table public.ccic_admin_login_codes to service_role;
grant all on table public.ccic_admin_sessions to service_role;

comment on table public.ccic_admin_login_codes is
  'Short-lived one-time codes for the isolated CCIC order administration login.';

comment on table public.ccic_admin_sessions is
  'HTTP-only sessions scoped by cookie path to the CCIC order administration area.';
