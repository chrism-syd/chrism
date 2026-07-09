begin;

alter table public.local_unit_reporting_year_settings
  add column if not exists is_local_override boolean not null default false;

comment on column public.local_unit_reporting_year_settings.is_local_override is
  'When true, this local unit intentionally overrides the parent organization annual term. Parent sync only updates non-overrides.';

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
    is_local_override,
    updated_at
  )
  select
    unit.id,
    parent_term.year_label,
    parent_term.year_start_month,
    parent_term.year_start_day,
    false,
    now()
  from public.local_units unit
  where unit.legacy_organization_id = p_organization_id
  on conflict (local_unit_id)
  do update set
    year_label = excluded.year_label,
    year_start_month = excluded.year_start_month,
    year_start_day = excluded.year_start_day,
    updated_at = now()
  where public.local_unit_reporting_year_settings.is_local_override = false;
end;
$$;

commit;
