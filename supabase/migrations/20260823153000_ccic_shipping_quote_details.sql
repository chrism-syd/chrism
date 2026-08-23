alter table public.ccic_orders
  add column if not exists shipping_status text not null default 'pickup'
    check (shipping_status in ('pickup', 'priced', 'pending')),
  add column if not exists shipping_provider text,
  add column if not exists shipping_service_code text,
  add column if not exists shipping_service_name text,
  add column if not exists shipping_transit_days integer
    check (shipping_transit_days is null or shipping_transit_days >= 0),
  add column if not exists shipping_quoted_at timestamptz;

comment on column public.ccic_orders.shipping_status is
  'Authoritative shipping state at order submission: pickup, priced, or pending.';

comment on column public.ccic_orders.shipping_provider is
  'Rating provider used for the stored shipping quote, currently shiptime when priced.';

comment on column public.ccic_orders.shipping_service_code is
  'Carrier service code returned by the shipping provider.';

comment on column public.ccic_orders.shipping_service_name is
  'Carrier service name returned by the shipping provider.';

comment on column public.ccic_orders.shipping_transit_days is
  'Estimated transit time in days returned with the authoritative quote.';
