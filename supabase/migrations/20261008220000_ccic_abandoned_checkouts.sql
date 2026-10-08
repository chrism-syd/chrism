create table if not exists public.ccic_abandoned_checkouts (
  id uuid primary key,
  contact_name text not null,
  organization_name text not null default '',
  email text not null,
  email_hash text,
  cell_phone text,
  cell_phone_hash text,
  pii_key_version text,
  cart_lines jsonb not null default '[]'::jsonb,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer,
  shipping_status text not null default 'waiting',
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'active' check (status in ('active', 'completed')),
  order_number text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists ccic_abandoned_checkouts_status_activity_idx
  on public.ccic_abandoned_checkouts (status, last_activity_at desc);
alter table public.ccic_abandoned_checkouts enable row level security;
revoke all on public.ccic_abandoned_checkouts from anon, authenticated;
grant all on public.ccic_abandoned_checkouts to service_role;
