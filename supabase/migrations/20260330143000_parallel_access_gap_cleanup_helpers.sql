-- 20260330143000_parallel_access_gap_cleanup_helpers.sql
begin;

create or replace function public.backfill_missing_parallel_admin_packages(
  p_actor_user_id uuid,
  p_source_code public.grant_source_code default 'legacy_backfill'
)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      u.id as target_user_id,
      lu.id as local_unit_id
    from public.organization_admin_assignments oaa
    join public.local_units lu
      on lu.legacy_organization_id = oaa.organization_id
    join public.users u
      on u.person_id = oaa.person_id
    left join public.user_unit_relationships uur
      on uur.user_id = u.id
     and uur.local_unit_id = lu.id
     and uur.status = 'active'::public.relationship_status
    left join public.area_access_grants aag
      on aag.local_unit_id = lu.id
     and aag.member_record_id = uur.member_record_id
     and aag.area_code = 'admins'::public.member_area_code
     and aag.access_level = 'manage'::public.area_access_level
     and aag.revoked_at is null
    where aag.id is null
  loop
    perform public.grant_parallel_admin_package_to_user(
      p_actor_user_id,
      r.target_user_id,
      r.local_unit_id,
      p_source_code,
      'Backfilled from legacy org admin gap helper'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.backfill_missing_parallel_custom_list_grants(
  p_actor_user_id uuid,
  p_source_code public.grant_source_code default 'legacy_backfill'
)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      u.id as target_user_id,
      cla.custom_list_id
    from public.custom_list_access cla
    join public.users u
      on u.person_id = cla.person_id
    left join public.custom_lists cl
      on cl.id = cla.custom_list_id
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
  loop
    perform public.grant_parallel_custom_list_access_to_user(
      p_actor_user_id,
      r.target_user_id,
      r.custom_list_id,
      'interact'::public.area_access_level,
      p_source_code
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.backfill_missing_parallel_event_managers(
  p_actor_user_id uuid
)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select e.id as event_id
    from public.events e
    left join public.v_effective_event_management_access v
      on v.event_id = e.id
    where v.event_id is null
      and e.local_unit_id is not null
  loop
    perform public.upsert_parallel_event_assignment_for_user(
      p_actor_user_id,
      p_actor_user_id,
      r.event_id,
      'manager',
      'Backfilled from missing parallel event manager helper'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

commit;