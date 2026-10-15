-- CCIC parent-level school order returns: partial or full.
-- Intentionally no Square refunds or physical stock-on-hand adjustments.
-- Apply ONLY to an explicitly approved database after reviewing this migration.

alter table public.ccic_school_order_lines
  add column if not exists returned_quantity integer not null default 0;

alter table public.ccic_school_order_lines
  add constraint ccic_school_line_return_bounds
  check (returned_quantity >= 0 and returned_quantity <= quantity);

alter table public.ccic_school_orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text,
  add column if not exists inventory_released_at timestamptz,
  add column if not exists last_inventory_return_at timestamptz;

-- Append-only audit trail of individual parent-order return actions.
create table if not exists public.ccic_school_order_returns (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  order_id uuid not null references public.ccic_school_orders(id),
  reason text not null,
  processed_by text not null,
  returned_boxes integer not null check (returned_boxes > 0),
  manual_refund_due_cents integer not null check (manual_refund_due_cents >= 0),
  school_contribution_reversed_cents integer not null check (school_contribution_reversed_cents >= 0),
  order_fully_returned boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ccic_school_order_return_lines (
  return_id uuid not null references public.ccic_school_order_returns(id),
  line_id uuid not null references public.ccic_school_order_lines(id),
  catalog_id text not null,
  returned_quantity integer not null check (returned_quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  manual_refund_due_cents integer not null check (manual_refund_due_cents >= 0),
  primary key (return_id, line_id)
);

create index if not exists ccic_school_order_returns_order_idx
  on public.ccic_school_order_returns (order_id, created_at desc);

alter table public.ccic_school_order_returns enable row level security;
alter table public.ccic_school_order_return_lines enable row level security;
revoke all on table public.ccic_school_order_returns from public, anon, authenticated;
revoke all on table public.ccic_school_order_return_lines from public, anon, authenticated;
grant all on table public.ccic_school_order_returns to service_role;
grant all on table public.ccic_school_order_return_lines to service_role;

-- Keep delayed/duplicate Square COMPLETED webhooks from reactivating full returns.
-- Partial returns keep the order 'paid' and inventory_committed_at remains nonnull,
-- so duplicate finalization doesn't add the inventory again.
create or replace function public.ccic_finalize_school_payment(
  p_order_id uuid, p_payment_id text, p_payment_status text,
  p_receipt_url text, p_paid_at timestamptz
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
  select * into v_order from public.ccic_school_orders
  where id = p_order_id for update;
  if not found then
    raise exception 'School order not found';
  end if;
  if v_order.status_code in ('cancelled', 'refunded') then
    return false;
  end if;
  update public.ccic_school_orders
  set status_code = 'paid',
      square_payment_id = coalesce(nullif(p_payment_id, ''), square_payment_id),
      square_payment_status = coalesce(nullif(p_payment_status, ''), square_payment_status, 'COMPLETED'),
      square_receipt_url = coalesce(nullif(p_receipt_url, ''), square_receipt_url),
      paid_at = coalesce(p_paid_at, paid_at, now()),
      square_error = null, updated_at = now()
  where id = p_order_id;
  if v_order.inventory_committed_at is null then
    for v_line in
      select catalog_id, quantity from public.ccic_school_order_lines
      where order_id = p_order_id order by sort_order, id
    loop
      insert into public.ccic_mixed_box_commitments
        (mixed_catalog_id, committed_mixed_boxes, updated_at)
      values (v_line.catalog_id, greatest(v_line.quantity, 0), now())
      on conflict (mixed_catalog_id) do update
      set committed_mixed_boxes = public.ccic_mixed_box_commitments.committed_mixed_boxes
          + greatest(excluded.committed_mixed_boxes, 0), updated_at = now();
    end loop;
    update public.ccic_school_orders
    set inventory_committed_at = now(), updated_at = now()
    where id = p_order_id;
    v_committed := true;
  end if;
  return v_committed;
end;
$$;

revoke all on function public.ccic_finalize_school_payment(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.ccic_finalize_school_payment(uuid, text, text, text, timestamptz)
  to service_role;

-- Exactly one parent's order is locked. Multiple collection/line returns happen
-- atomically, so any inconsistency rolls the entire adjustment back.
-- p_items example: [{"line_id":"<uuid>", "quantity":1}].
-- A stable p_request_key makes form retries idempotent.
create or replace function public.ccic_return_school_order_items(
  p_order_id uuid,
  p_request_key uuid,
  p_items jsonb,
  p_reason text,
  p_processed_by text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.ccic_school_orders%rowtype;
  v_line public.ccic_school_order_lines%rowtype;
  v_item jsonb;
  v_line_id uuid;
  v_qty integer;
  v_seen uuid[] := array[]::uuid[];
  v_previous public.ccic_school_order_returns%rowtype;
  v_return_id uuid;
  v_updated_count integer;
  v_total_original integer;
  v_share_per_box integer;
  v_total_returned integer := 0;
  v_refund_cents integer := 0;
  v_share_cents integer := 0;
  v_remaining integer;
  v_fully_returned boolean;
begin
  if p_request_key is null then
    raise exception 'Return request key is required';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 or length(p_reason) > 500 then
    raise exception 'Return reason must be 5 to 500 characters';
  end if;
  if length(btrim(coalesce(p_processed_by, ''))) < 3 or length(p_processed_by) > 254 then
    raise exception 'Authenticated CCIC administrator is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Return items must be an array';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Return must contain 1 to 50 line items';
  end if;

  select * into v_order from public.ccic_school_orders
  where id = p_order_id for update;
  if not found then
    raise exception 'Parent order not found';
  end if;

  -- A repeated submission (same request key) cannot release inventory twice.
  select * into v_previous from public.ccic_school_order_returns
  where request_key = p_request_key;
  if found then
    if v_previous.order_id <> p_order_id then
      raise exception 'Return request key belongs to a different order';
    end if;
    return jsonb_build_object('return_id', v_previous.id,
      'already_processed', true, 'fully_returned', v_previous.order_fully_returned,
      'returned_boxes', v_previous.returned_boxes,
      'manual_refund_due_cents', v_previous.manual_refund_due_cents);
  end if;

  if v_order.status_code <> 'paid' then
    raise exception 'Only paid parent orders can be returned through this workflow';
  end if;
  if v_order.inventory_committed_at is null or v_order.inventory_released_at is not null then
    raise exception 'Parent order inventory is not in a releasable state';
  end if;
  select sum(quantity)::integer into v_total_original
  from public.ccic_school_order_lines where order_id = p_order_id;
  if coalesce(v_total_original, 0) = 0 then
    raise exception 'Parent order has no order lines';
  end if;
  if v_order.school_contribution_cents % v_total_original <> 0 then
    raise exception 'Cannot calculate a consistent original school contribution per box';
  end if;
  v_share_per_box := v_order.school_contribution_cents / v_total_original;

  insert into public.ccic_school_order_returns
    (request_key, order_id, reason, processed_by, returned_boxes,
     manual_refund_due_cents, school_contribution_reversed_cents, order_fully_returned)
  values (p_request_key, p_order_id, btrim(p_reason), btrim(p_processed_by),
          1, 0, 0, false)
  returning id into v_return_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid return line item';
    end if;
    if coalesce(v_item->>'line_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'Return line ID is invalid';
    end if;
    if coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]{0,5}$' then
      raise exception 'Return quantity must be a positive integer';
    end if;
    v_line_id := (v_item->>'line_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_line_id = any(v_seen) then
      raise exception 'Duplicate return line in the same request';
    end if;
    v_seen := array_append(v_seen, v_line_id);

    select * into v_line from public.ccic_school_order_lines
    where id = v_line_id and order_id = p_order_id for update;
    if not found then
      raise exception 'Return line does not belong to the selected parent order';
    end if;
    if v_qty > v_line.quantity - v_line.returned_quantity then
      raise exception 'Cannot return more than unreturned boxes for %', v_line.catalog_id;
    end if;

    -- No physical stock_on_hand change. Source boxes are derived from
    -- mixed commitments using ceil(total_committed_mixed_boxes/4).
    update public.ccic_mixed_box_commitments
    set committed_mixed_boxes = committed_mixed_boxes - v_qty,
        updated_at = now()
    where mixed_catalog_id = v_line.catalog_id
      and committed_mixed_boxes >= v_qty;
    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception 'Mixed-box commitment mismatch for %', v_line.catalog_id;
    end if;

    update public.ccic_school_order_lines
    set returned_quantity = returned_quantity + v_qty
    where id = v_line.id and returned_quantity + v_qty <= quantity;
    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception 'Parent-order line return quantity changed concurrently';
    end if;

    insert into public.ccic_school_order_return_lines
      (return_id, line_id, catalog_id, returned_quantity,
       unit_price_cents, manual_refund_due_cents)
    values (v_return_id, v_line.id, v_line.catalog_id, v_qty,
            v_line.unit_price_cents, v_qty * v_line.unit_price_cents);

    v_total_returned := v_total_returned + v_qty;
    v_refund_cents := v_refund_cents + v_qty * v_line.unit_price_cents;
    v_share_cents := v_share_cents + v_qty * v_share_per_box;
  end loop;

  select coalesce(sum(quantity - returned_quantity), 0)::integer
  into v_remaining from public.ccic_school_order_lines
  where order_id = p_order_id;
  v_fully_returned := (v_remaining = 0);

  update public.ccic_school_order_returns
  set returned_boxes = v_total_returned,
      manual_refund_due_cents = v_refund_cents,
      school_contribution_reversed_cents = v_share_cents,
      order_fully_returned = v_fully_returned
  where id = v_return_id;

  if v_fully_returned then
    update public.ccic_school_orders
    set status_code = 'cancelled',
        cancelled_at = now(), cancelled_by = btrim(p_processed_by),
        cancellation_reason = btrim(p_reason),
        inventory_released_at = now(), last_inventory_return_at = now(),
        updated_at = now()
    where id = p_order_id;
  else
    update public.ccic_school_orders
    set last_inventory_return_at = now(), updated_at = now()
    where id = p_order_id;
  end if;

  return jsonb_build_object('return_id', v_return_id,
    'already_processed', false, 'fully_returned', v_fully_returned,
    'returned_boxes', v_total_returned, 'remaining_boxes', v_remaining,
    'manual_refund_due_cents', v_refund_cents);
end;
$$;

revoke all on function public.ccic_return_school_order_items(uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.ccic_return_school_order_items(uuid, uuid, jsonb, text, text)
  to service_role;
