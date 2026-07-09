begin;

alter table public.organization_families
  add column if not exists annual_term_mode text not null default 'calendar',
  add column if not exists annual_term_label text not null default 'Calendar Year',
  add column if not exists annual_term_start_month integer not null default 1,
  add column if not exists annual_term_start_day integer not null default 1;

alter table public.organization_families
  drop constraint if exists organization_families_annual_term_mode_check;

alter table public.organization_families
  add constraint organization_families_annual_term_mode_check
  check (annual_term_mode in ('calendar', 'custom'));

alter table public.organization_families
  drop constraint if exists organization_families_annual_term_start_month_check;

alter table public.organization_families
  add constraint organization_families_annual_term_start_month_check
  check (annual_term_start_month between 1 and 12);

alter table public.organization_families
  drop constraint if exists organization_families_annual_term_start_day_check;

alter table public.organization_families
  add constraint organization_families_annual_term_start_day_check
  check (annual_term_start_day between 1 and 31);

update public.organization_families family
set
  annual_term_mode = org.annual_term_mode,
  annual_term_label = org.annual_term_label,
  annual_term_start_month = org.annual_term_start_month,
  annual_term_start_day = org.annual_term_start_day
from public.organizations org
where family.legacy_organization_id = org.id
  and (
    family.annual_term_mode = 'calendar'
    and family.annual_term_label = 'Calendar Year'
    and family.annual_term_start_month = 1
    and family.annual_term_start_day = 1
  );

update public.organization_families
set
  annual_term_mode = 'custom',
  annual_term_label = 'Fraternal Year',
  annual_term_start_month = 7,
  annual_term_start_day = 1
where lower(display_name) like '%knights of columbus%'
  and annual_term_mode = 'calendar'
  and annual_term_label = 'Calendar Year'
  and annual_term_start_month = 1
  and annual_term_start_day = 1;

create or replace function public.sync_local_unit_reporting_year_settings_for_family(p_organization_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  family_term record;
begin
  select
    coalesce(nullif(btrim(annual_term_label), ''), 'Calendar Year') as year_label,
    coalesce(annual_term_start_month, 1) as year_start_month,
    coalesce(annual_term_start_day, 1) as year_start_day
  into family_term
  from public.organization_families
  where id = p_organization_family_id;

  if not found then
    return;
  end if;

  insert into public.local_unit_reporting_year_settings (
    local_unit_id,
    year_label,
    year_start_month,
    year_start_day,
    is_local_override,
    updated_at
  )
  select
    unit.id,
    family_term.year_label,
    family_term.year_start_month,
    family_term.year_start_day,
    false,
    now()
  from public.local_units unit
  where unit.organization_family_id = p_organization_family_id
  on conflict (local_unit_id)
  do update set
    year_label = excluded.year_label,
    year_start_month = excluded.year_start_month,
    year_start_day = excluded.year_start_day,
    updated_at = now()
  where public.local_unit_reporting_year_settings.is_local_override = false;
end;
$$;

create or replace function public.sync_local_unit_reporting_year_settings_after_family_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_local_unit_reporting_year_settings_for_family(new.id);
  return new;
end;
$$;

drop trigger if exists organization_families_sync_local_reporting_year_settings on public.organization_families;

create trigger organization_families_sync_local_reporting_year_settings
after insert or update of annual_term_label, annual_term_start_month, annual_term_start_day
on public.organization_families
for each row
execute function public.sync_local_unit_reporting_year_settings_after_family_change();

create or replace function public.sync_local_unit_reporting_year_settings_after_local_unit_family_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_family_id is not null then
    perform public.sync_local_unit_reporting_year_settings_for_family(new.organization_family_id);
  end if;
  return new;
end;
$$;

drop trigger if exists local_units_sync_reporting_year_settings_from_family on public.local_units;

create trigger local_units_sync_reporting_year_settings_from_family
after insert or update of organization_family_id
on public.local_units
for each row
execute function public.sync_local_unit_reporting_year_settings_after_local_unit_family_change();

select public.sync_local_unit_reporting_year_settings_for_family(id)
from public.organization_families;

comment on column public.organization_families.annual_term_label is
  'Umbrella organization annual term label inherited by local units unless locally overridden.';

commit;
