create table if not exists public.ccic_case_reserve_settings (
  case_catalog_id text primary key,
  reserved_cases integer not null default 0 check (reserved_cases >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.ccic_case_reserve_components (
  case_catalog_id text not null references public.ccic_case_reserve_settings(case_catalog_id) on delete cascade,
  catalog_id text not null,
  quantity_per_case integer not null check (quantity_per_case > 0),
  primary key (case_catalog_id, catalog_id)
);

insert into public.ccic_case_reserve_settings (case_catalog_id, reserved_cases)
values ('classic-sacred-case', 75)
on conflict (case_catalog_id) do nothing;

insert into public.ccic_case_reserve_components (case_catalog_id, catalog_id, quantity_per_case)
values
  ('classic-sacred-case', 'ccic-26-01-amv', 2),
  ('classic-sacred-case', 'ccic-26-01-asa', 2),
  ('classic-sacred-case', 'ccic-26-01-ase', 2),
  ('classic-sacred-case', 'ccic-26-01-asg', 2),
  ('classic-sacred-case', 'ccic-26-02-ahf', 2),
  ('classic-sacred-case', 'ccic-26-02-soa', 2),
  ('classic-sacred-case', 'ccic-26-02-vac', 2),
  ('classic-sacred-case', 'ccic-26-02-vwa', 2),
  ('classic-sacred-case', 'ccic-26-03-wch', 2),
  ('classic-sacred-case', 'ccic-26-03-wcn', 2),
  ('classic-sacred-case', 'ccic-26-03-wcs', 2),
  ('classic-sacred-case', 'ccic-26-03-wcw', 2),
  ('classic-sacred-case', 'ccic-26-04-scs', 2),
  ('classic-sacred-case', 'ccic-26-04-sct', 2),
  ('classic-sacred-case', 'ccic-26-04-sor', 2),
  ('classic-sacred-case', 'ccic-26-04-sst', 2)
on conflict (case_catalog_id, catalog_id) do update
set quantity_per_case = excluded.quantity_per_case;

alter table public.ccic_case_reserve_settings enable row level security;
alter table public.ccic_case_reserve_components enable row level security;

revoke all on table public.ccic_case_reserve_settings from anon, authenticated;
revoke all on table public.ccic_case_reserve_components from anon, authenticated;
grant all on table public.ccic_case_reserve_settings to service_role;
grant all on table public.ccic_case_reserve_components to service_role;

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
  classic_case_catalog_id text := 'classic-sacred-case';
  reserved_cases integer := 0;
  active_classic_cases integer := 0;
  current_order_classic_cases integer := 0;
  component_quantity_per_case integer;
  current_order_case_component_boxes integer;
  held_case_boxes integer;
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

  select coalesce(setting.reserved_cases, 0)
    into reserved_cases
    from public.ccic_case_reserve_settings setting
    where setting.case_catalog_id = classic_case_catalog_id;

  select coalesce(sum(line.quantity), 0)
    into current_order_classic_cases
    from public.ccic_order_lines line
    where line.order_id = p_order_id
      and line.line_type = 'classic_case'
      and line.catalog_id = classic_case_catalog_id;

  select coalesce(sum(line.quantity), 0)
    into active_classic_cases
    from public.ccic_order_lines line
    join public.ccic_orders order_row on order_row.id = line.order_id
    where line.line_type = 'classic_case'
      and line.catalog_id = classic_case_catalog_id
      and order_row.status_code <> 'cancelled';

  if active_classic_cases > reserved_cases then
    raise exception 'There are not enough Classic Cases remaining.';
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

    select component.quantity_per_case
      into component_quantity_per_case
      from public.ccic_case_reserve_components component
      where component.case_catalog_id = classic_case_catalog_id
        and component.catalog_id = requested_catalog_id;

    current_order_case_component_boxes := coalesce(component_quantity_per_case, 0) * current_order_classic_cases;

    if not inventory_row.is_store_enabled
      and requested_quantity > current_order_case_component_boxes then
      raise exception 'A selected card is no longer available.';
    end if;

    if inventory_row.stock_on_hand is not null then
      select coalesce(sum(allocation_row.quantity_boxes), 0)
        into committed_quantity
        from public.ccic_order_inventory_allocations allocation_row
        join public.ccic_orders order_row on order_row.id = allocation_row.order_id
        where allocation_row.catalog_id = requested_catalog_id
          and order_row.status_code <> 'cancelled';

      held_case_boxes := case
        when component_quantity_per_case is null then 0
        else greatest(0, reserved_cases - active_classic_cases) * component_quantity_per_case
      end;

      if committed_quantity + requested_quantity + held_case_boxes > inventory_row.stock_on_hand then
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
