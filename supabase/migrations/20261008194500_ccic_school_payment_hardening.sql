alter table public.ccic_school_orders
  add column if not exists checkout_key text,
  add column if not exists inventory_committed_at timestamptz,
  add column if not exists confirmation_email_claimed_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_error text;

create unique index if not exists ccic_school_orders_checkout_key_uidx
  on public.ccic_school_orders (checkout_key)
  where checkout_key is not null;

create unique index if not exists ccic_school_orders_square_payment_uidx
  on public.ccic_school_orders (square_payment_id)
  where square_payment_id is not null;

-- The first sandbox order was already committed by the application before
-- inventory_committed_at existed. Mark existing paid rows as already committed
-- so the new idempotent finalizer does not count them twice.
update public.ccic_school_orders
set inventory_committed_at = coalesce(paid_at, updated_at, now())
where status_code = 'paid'
  and inventory_committed_at is null;

create table if not exists public.ccic_square_webhook_events (
  event_id text primary key,
  event_type text not null,
  square_payment_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

alter table public.ccic_square_webhook_events enable row level security;
revoke all on table public.ccic_square_webhook_events from anon, authenticated;
grant all on table public.ccic_square_webhook_events to service_role;

create or replace function public.ccic_finalize_school_payment(
  p_order_id uuid,
  p_payment_id text,
  p_payment_status text,
  p_receipt_url text,
  p_paid_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.ccic_school_orders%rowtype;
  v_line record;
  v_committed boolean := false;
begin
  select *
  into v_order
  from public.ccic_school_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'School order not found';
  end if;

  update public.ccic_school_orders
  set status_code = 'paid',
      square_payment_id = coalesce(nullif(p_payment_id, ''), square_payment_id),
      square_payment_status = coalesce(nullif(p_payment_status, ''), square_payment_status, 'COMPLETED'),
      square_receipt_url = coalesce(nullif(p_receipt_url, ''), square_receipt_url),
      paid_at = coalesce(p_paid_at, paid_at, now()),
      square_error = null,
      updated_at = now()
  where id = p_order_id;

  if v_order.inventory_committed_at is null then
    for v_line in
      select catalog_id, quantity
      from public.ccic_school_order_lines
      where order_id = p_order_id
      order by sort_order, id
    loop
      insert into public.ccic_mixed_box_commitments (mixed_catalog_id, committed_mixed_boxes, updated_at)
      values (v_line.catalog_id, greatest(v_line.quantity, 0), now())
      on conflict (mixed_catalog_id)
      do update set
        committed_mixed_boxes = public.ccic_mixed_box_commitments.committed_mixed_boxes + greatest(excluded.committed_mixed_boxes, 0),
        updated_at = now();
    end loop;

    update public.ccic_school_orders
    set inventory_committed_at = now(),
        updated_at = now()
    where id = p_order_id;

    v_committed := true;
  end if;

  return v_committed;
end;
$$;

revoke all on function public.ccic_finalize_school_payment(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.ccic_finalize_school_payment(uuid, text, text, text, timestamptz) to service_role;
