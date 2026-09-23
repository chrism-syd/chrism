-- U.S. CCIC quote/confirmation lifecycle.
-- Deliberately additive so the existing Canadian order workflow is unchanged.

alter table public.ccic_orders
  add column if not exists market_code text not null default 'CA'
    check (market_code in ('CA', 'US')),
  add column if not exists us_confirmation_status text
    check (us_confirmation_status is null or us_confirmation_status in ('awaiting_shipping_quote', 'awaiting_customer_confirmation', 'confirmed', 'expired', 'cancelled')),
  add column if not exists us_confirmation_token_hash text,
  add column if not exists us_quote_sent_at timestamptz,
  add column if not exists us_confirmation_expires_at timestamptz,
  add column if not exists us_confirmed_at timestamptz,
  add column if not exists us_expired_at timestamptz,
  add column if not exists us_import_cents integer not null default 0
    check (us_import_cents >= 0),
  add column if not exists us_handling_cents integer not null default 0
    check (us_handling_cents >= 0),
  add column if not exists us_processing_fee_cents integer not null default 0
    check (us_processing_fee_cents >= 0);

create unique index if not exists ccic_orders_us_confirmation_token_hash_idx
  on public.ccic_orders (us_confirmation_token_hash)
  where us_confirmation_token_hash is not null;

comment on column public.ccic_orders.us_confirmation_status is
  'U.S.-only pre-confirmation lifecycle. Null for Canadian orders.';
comment on column public.ccic_orders.us_confirmation_expires_at is
  'U.S.-only 48-hour customer confirmation deadline, set when the final quote is sent.';
