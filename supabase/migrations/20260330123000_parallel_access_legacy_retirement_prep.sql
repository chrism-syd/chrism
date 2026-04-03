-- 20260330123000_parallel_access_legacy_retirement_prep.sql
-- Purpose:
--   Add observability around legacy writes and prepare the database for
--   eventual legacy-read retirement without dropping old tables yet.

begin;

create or replace function public.log_parallel_legacy_write()
returns trigger
language plpgsql
as $$
begin
  insert into public.migration_review_queue (
    source_table,
    source_row_id,
    review_type,
    notes,
    payload
  )
  values (
    tg_table_schema || '.' || tg_table_name,
    coalesce(new.id, old.id, gen_random_uuid()),
    'legacy_write_observed',
    format('Observed %s on legacy compatibility table %s.%s', tg_op, tg_table_schema, tg_table_name),
    jsonb_build_object(
      'operation', tg_op,
      'table', tg_table_schema || '.' || tg_table_name,
      'new_id', case when tg_op in ('INSERT','UPDATE') then new.id else null end,
      'old_id', case when tg_op in ('UPDATE','DELETE') then old.id else null end
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists observe_legacy_write_council_admin_assignments on public.council_admin_assignments;
create trigger observe_legacy_write_council_admin_assignments
after insert or update or delete on public.council_admin_assignments
for each row execute function public.log_parallel_legacy_write();

drop trigger if exists observe_legacy_write_organization_admin_assignments on public.organization_admin_assignments;
create trigger observe_legacy_write_organization_admin_assignments
after insert or update or delete on public.organization_admin_assignments
for each row execute function public.log_parallel_legacy_write();

drop trigger if exists observe_legacy_write_custom_list_access on public.custom_list_access;
create trigger observe_legacy_write_custom_list_access
after insert or update or delete on public.custom_list_access
for each row execute function public.log_parallel_legacy_write();

create or replace view public.v_parallel_legacy_gap_report as
select
  'org_admin_without_parallel_package'::text as gap_type,
  oaa.id as source_row_id,
  lu.display_name as local_unit_name,
  oaa.user_id,
  oaa.person_id,
  oaa.organization_id as legacy_owner_id,
  null::uuid as event_id,
  null::uuid as custom_list_id
from public.organization_admin_assignments oaa
join public.local_units lu
  on lu.legacy_organization_id = oaa.organization_id
left join public.user_unit_relationships uur
  on uur.user_id = oaa.user_id
 and uur.local_unit_id = lu.id
 and uur.status = 'active'::public.relationship_status
left join public.area_access_grants aag
  on aag.local_unit_id = lu.id
 and aag.member_record_id = uur.member_record_id
 and aag.area_code = 'admins'::public.member_area_code
 and aag.access_level = 'manage'::public.area_access_level
 and aag.revoked_at is null
where aag.id is null

union all

select
  'custom_list_access_without_parallel_grant'::text as gap_type,
  cla.id as source_row_id,
  lu.display_name as local_unit_name,
  u.id as user_id,
  cla.person_id,
  cl.council_id as legacy_owner_id,
  null::uuid as event_id,
  cl.id as custom_list_id
from public.custom_list_access cla
join public.custom_lists cl
  on cl.id = cla.custom_list_id
join public.local_units lu
  on lu.id = cl.local_unit_id
left join public.users u
  on u.person_id = cla.person_id
left join public.user_unit_relationships uur
  on uur.user_id = u.id
 and uur.local_unit_id = cl.local_unit_id
 and uur.status = 'active'::public.relationship_status
left join public.resource_access_grants rag
  on rag.local_unit_id = cl.local_unit_id
 and rag.member_record_id = uur.member_record_id
 and rag.resource_type = 'custom_list'::public.resource_type_code
 and rag.resource_key = cl.id::text
 and rag.revoked_at is null
where rag.id is null

union all

select
  'event_without_parallel_manager'::text as gap_type,
  e.id as source_row_id,
  lu.display_name as local_unit_name,
  null::uuid as user_id,
  null::uuid as person_id,
  e.council_id as legacy_owner_id,
  e.id as event_id,
  null::uuid as custom_list_id
from public.events e
join public.local_units lu
  on lu.id = e.local_unit_id
left join public.v_effective_event_management_access v
  on v.event_id = e.id
where v.event_id is null;

commit;