create table if not exists public.ccic_store_inventory (
  catalog_id text primary key,
  sku text not null,
  title text not null,
  stock_on_hand integer null check (stock_on_hand is null or stock_on_hand >= 0),
  is_store_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.ccic_order_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ccic_orders(id) on delete cascade,
  catalog_id text not null,
  quantity_boxes integer not null check (quantity_boxes > 0),
  created_at timestamptz not null default now(),
  unique (order_id, catalog_id)
);

create index if not exists ccic_order_inventory_allocations_catalog_id_idx
  on public.ccic_order_inventory_allocations(catalog_id);

create index if not exists ccic_order_inventory_allocations_order_id_idx
  on public.ccic_order_inventory_allocations(order_id);

alter table public.ccic_store_inventory enable row level security;
alter table public.ccic_order_inventory_allocations enable row level security;

create or replace function public.ccic_allocate_order_inventory(
  p_order_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allocation jsonb;
  requested_catalog_id text;
  requested_quantity integer;
  inventory_row public.ccic_store_inventory%rowtype;
  committed_quantity integer;
begin
  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Inventory allocations must be an array.';
  end if;

  if exists (
    select 1
    from public.ccic_order_inventory_allocations
    where order_id = p_order_id
  ) then
    raise exception 'Inventory has already been allocated for this order.';
  end if;

  for allocation in
    select value
    from jsonb_array_elements(p_allocations)
    order by value ->> 'catalogId'
  loop
    requested_catalog_id := trim(allocation ->> 'catalogId');
    requested_quantity := (allocation ->> 'quantityBoxes')::integer;

    if requested_catalog_id = '' or requested_quantity <= 0 then
      raise exception 'Invalid inventory allocation.';
    end if;

    select *
      into inventory_row
      from public.ccic_store_inventory
      where catalog_id = requested_catalog_id
      for update;

    if not found then
      continue;
    end if;

    if not inventory_row.is_store_enabled then
      raise exception 'A selected card is no longer available.';
    end if;

    if inventory_row.stock_on_hand is not null then
      select coalesce(sum(allocation_row.quantity_boxes), 0)
        into committed_quantity
        from public.ccic_order_inventory_allocations allocation_row
        join public.ccic_orders order_row on order_row.id = allocation_row.order_id
        where allocation_row.catalog_id = requested_catalog_id
          and order_row.status_code <> 'cancelled';

      if committed_quantity + requested_quantity > inventory_row.stock_on_hand then
        raise exception 'A selected card does not have enough inventory remaining.';
      end if;
    end if;
  end loop;

  insert into public.ccic_order_inventory_allocations (order_id, catalog_id, quantity_boxes)
  select
    p_order_id,
    trim(value ->> 'catalogId'),
    sum((value ->> 'quantityBoxes')::integer)
  from jsonb_array_elements(p_allocations)
  where trim(value ->> 'catalogId') <> ''
    and (value ->> 'quantityBoxes')::integer > 0
  group by trim(value ->> 'catalogId');
end;
$$;

revoke all on function public.ccic_allocate_order_inventory(uuid, jsonb) from public;
grant execute on function public.ccic_allocate_order_inventory(uuid, jsonb) to service_role;

revoke all on table public.ccic_store_inventory from anon, authenticated;
revoke all on table public.ccic_order_inventory_allocations from anon, authenticated;
grant all on table public.ccic_store_inventory to service_role;
grant all on table public.ccic_order_inventory_allocations to service_role;
