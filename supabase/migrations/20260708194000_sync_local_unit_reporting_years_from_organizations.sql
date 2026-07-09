begin;

create or replace function public.sync_local_unit_reporting_year_settings_for_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_term record;
begin
  select
    coalesce(nullif(btrim(annual_term_label), ''), 'Calendar Year') as year_label,
    coalesce(annual_term_start_month, 1) as year_start_month,
    coalesce(annual_term_start_day, 1) as year_start_day
  into parent_term
  from public.organizations
  where id = p_organization_id;

  if not found then
    return;
  end if;

  insert into public.local_unit_reporting_year_settings (
    local_unit_id,
    year_label,
    year_start_month,
    year_start_day,
    updated_at
  )
  select
    unit.id,
    parent_term.year_label,
    parent_term.year_start_month,
    parent_term.year_start_day,
    now()
  from public.local_units unit
  where unit.legacy_organization_id = p_organization_id
  on conflict (local_unit_id)
  do update set
    year_label = excluded.year_label,
    year_start_month = excluded.year_start_month,
    year_start_day = excluded.year_start_day,
    updated_at = now();
end;
$$;

create or replace function public.sync_local_unit_reporting_year_settings_after_organization_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_local_unit_reporting_year_settings_for_organization(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_sync_local_reporting_year_settings on public.organizations;

create trigger organizations_sync_local_reporting_year_settings
after insert or update of annual_term_label, annual_term_start_month, annual_term_start_day
on public.organizations
for each row
execute function public.sync_local_unit_reporting_year_settings_after_organization_change();

create or replace function public.sync_local_unit_reporting_year_settings_after_local_unit_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.legacy_organization_id is not null then
    perform public.sync_local_unit_reporting_year_settings_for_organization(new.legacy_organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists local_units_sync_reporting_year_settings_from_organization on public.local_units;

create trigger local_units_sync_reporting_year_settings_from_organization
after insert or update of legacy_organization_id
on public.local_units
for each row
execute function public.sync_local_unit_reporting_year_settings_after_local_unit_insert();

select public.sync_local_unit_reporting_year_settings_for_organization(id)
from public.organizations;

comment on function public.sync_local_unit_reporting_year_settings_for_organization(uuid) is
  'Synchronizes inherited local-unit reporting year rows from the parent organization annual term setting.';

commit;
