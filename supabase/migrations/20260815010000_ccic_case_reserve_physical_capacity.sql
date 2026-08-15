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
  component_row record;
  requested_catalog_id text;
  requested_quantity integer;
  inventory_row public.ccic_store_inventory%rowtype;
  committed_quantity integer;
  classic_case_catalog_id text := 'classic-sacred-case';
  reserve_target integer := 0;
  existing_classic_cases integer := 0;
  current_order_classic_cases integer := 0;
  target_available_cases integer := 0;
  physical_available_cases integer := 999999;
  backed_available_cases integer := 0;
  protected_cases_after_order integer := 0;
  has_tracked_component boolean := false;
  component_committed integer;
  component_capacity integer;
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
    into reserve_target
    from public.ccic_case_reserve_settings setting
    where setting.case_catalog_id = classic_case_catalog_id;

  select coalesce(sum(line.quantity), 0)
    into current_order_classic_cases
    from public.ccic_order_lines line
    where line.order_id = p_order_id
      and line.line_type = 'classic_case'
      and line.catalog_id = classic_case_catalog_id;

  select coalesce(sum(line.quantity), 0)
    into existing_classic_cases
    from public.ccic_order_lines line
    join public.ccic_orders order_row on order_row.id = line.order_id
    where line.order_id <> p_order_id
      and line.line_type = 'classic_case'
      and line.catalog_id = classic_case_catalog_id
      and order_row.status_code <> 'cancelled';

  target_available_cases := greatest(0, reserve_target - existing_classic_cases);

  for component_row in
    select component.catalog_id, component.quantity_per_case
    from public.ccic_case_reserve_components component
    where component.case_catalog_id = classic_case_catalog_id
  loop
    select *
      into inventory_row
      from public.ccic_store_inventory
      where catalog_id = component_row.catalog_id;

    if not found or inventory_row.stock_on_hand is null then
      continue;
    end if;

    has_tracked_component := true;

    select coalesce(sum(allocation_row.quantity_boxes), 0)
      into component_committed
      from public.ccic_order_inventory_allocations allocation_row
      join public.ccic_orders order_row on order_row.id = allocation_row.order_id
      where allocation_row.catalog_id = component_row.catalog_id
        and allocation_row.order_id <> p_order_id
        and order_row.status_code <> 'cancelled';

    component_capacity := floor(
      greatest(0, inventory_row.stock_on_hand - component_committed)::numeric
      / component_row.quantity_per_case
    )::integer;

    physical_available_cases := least(physical_available_cases, component_capacity);
  end loop;

  backed_available_cases := least(
    target_available_cases,
    case when has_tracked_component then physical_available_cases else target_available_cases end
  );

  if current_order_classic_cases > backed_available_cases then
    raise exception 'There are not enough Classic Cases remaining.';
  end if;

  protected_cases_after_order := greatest(0, backed_available_cases - current_order_classic_cases);

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
          and allocation_row.order_id <> p_order_id
          and order_row.status_code <> 'cancelled';

      held_case_boxes := case
        when component_quantity_per_case is null then 0
        else protected_cases_after_order * component_quantity_per_case
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
