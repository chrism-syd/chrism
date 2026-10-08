create table if not exists public.ccic_school_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  school_slug text not null,
  school_code text not null,
  school_name text not null,
  status_code text not null default 'pending_payment'
    check (status_code in ('pending_payment','payment_failed','paid','cancelled','refunded')),
  parent_name text not null,
  email text not null,
  email_hash text,
  cell_phone text,
  cell_phone_hash text,
  student_name text not null,
  grade text not null,
  room_number text not null,
  teacher_name text not null,
  pii_key_version text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  school_contribution_cents integer not null check (school_contribution_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency_code text not null default 'CAD',
  square_environment text,
  square_location_id text,
  square_payment_id text,
  square_payment_status text,
  square_receipt_url text,
  square_error text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ccic_school_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ccic_school_orders(id) on delete cascade,
  catalog_id text not null,
  sku text not null,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ccic_school_orders_school_created_idx
  on public.ccic_school_orders (school_code, created_at desc);
create index if not exists ccic_school_orders_status_created_idx
  on public.ccic_school_orders (status_code, created_at desc);
create index if not exists ccic_school_order_lines_order_idx
  on public.ccic_school_order_lines (order_id, sort_order);

alter table public.ccic_school_orders enable row level security;
alter table public.ccic_school_order_lines enable row level security;
revoke all on table public.ccic_school_orders from anon, authenticated;
revoke all on table public.ccic_school_order_lines from anon, authenticated;
grant all on table public.ccic_school_orders to service_role;
grant all on table public.ccic_school_order_lines to service_role;

comment on table public.ccic_school_orders is
  'Paid and attempted CCIC school fundraiser orders. Contact and student distribution fields are encrypted by the application.';
comment on table public.ccic_school_order_lines is
  'Mixed-box selections belonging to a school fundraiser order.';


create or replace function public.ccic_commit_mixed_boxes(p_catalog_id text, p_quantity integer)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.ccic_mixed_box_commitments (mixed_catalog_id, committed_mixed_boxes, updated_at)
  values (p_catalog_id, greatest(p_quantity, 0), now())
  on conflict (mixed_catalog_id)
  do update set
    committed_mixed_boxes = public.ccic_mixed_box_commitments.committed_mixed_boxes + greatest(excluded.committed_mixed_boxes, 0),
    updated_at = now();
$$;

revoke all on function public.ccic_commit_mixed_boxes(text, integer) from public, anon, authenticated;
grant execute on function public.ccic_commit_mixed_boxes(text, integer) to service_role;
