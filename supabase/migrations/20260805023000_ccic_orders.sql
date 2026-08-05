create table if not exists public.ccic_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status_code text not null default 'new'
    check (status_code in ('new', 'reviewing', 'confirmed', 'fulfilled', 'cancelled')),
  contact_name text not null,
  organization_name text not null,
  email text not null,
  email_hash text,
  cell_phone text not null,
  cell_phone_hash text,
  address_line_1 text,
  address_line_1_hash text,
  address_line_2 text,
  address_line_2_hash text,
  city text,
  city_hash text,
  state_province text,
  state_province_hash text,
  postal_code text,
  postal_code_hash text,
  country_code text,
  country_code_hash text,
  pii_key_version text,
  fulfillment_method text not null
    check (fulfillment_method in ('pickup', 'shipping')),
  regular_subtotal_cents integer not null check (regular_subtotal_cents >= 0),
  custom_case_count integer not null default 0 check (custom_case_count >= 0),
  custom_case_discount_cents integer not null default 0 check (custom_case_discount_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency_code text not null default 'CAD',
  confirmation_email_sent_at timestamptz,
  admin_email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ccic_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ccic_orders(id) on delete cascade,
  line_type text not null
    check (line_type in ('classic_case', 'individual_box')),
  catalog_id text not null,
  sku text not null,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  boxes_per_unit integer not null default 1 check (boxes_per_unit > 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ccic_orders_created_at_idx
  on public.ccic_orders (created_at desc);

create index if not exists ccic_orders_status_created_at_idx
  on public.ccic_orders (status_code, created_at desc);

create index if not exists ccic_order_lines_order_id_idx
  on public.ccic_order_lines (order_id, sort_order);

alter table public.ccic_orders enable row level security;
alter table public.ccic_order_lines enable row level security;

revoke all on table public.ccic_orders from anon, authenticated;
revoke all on table public.ccic_order_lines from anon, authenticated;

grant all on table public.ccic_orders to service_role;
grant all on table public.ccic_order_lines to service_role;

comment on table public.ccic_orders is
  'Public CCIC preorder submissions. Contact fields are encrypted by the application before storage.';

comment on table public.ccic_order_lines is
  'Catalogue selections belonging to a CCIC preorder submission.';
