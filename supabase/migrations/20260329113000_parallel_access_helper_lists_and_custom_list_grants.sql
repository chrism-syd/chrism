-- Parallel access helper RPCs and custom-list admin grant backfill
-- Safe follow-up after 20260329100000_parallel_access_resource_and_event_rails.sql

begin;

insert into public.area_access_grants (
  local_unit_id,
  member_record_id,
  area_code,
  access_level,
  source_code,
  granted_at,
  expires_at,
  revoked_at,
  created_at,
  updated_at,
  created_by_auth_user_id,
  updated_by_auth_user_id
)
select
  lu.id as local_unit_id,
  mr.id as member_record_id,
  'custom_lists'::public.member_area_code as area_code,
  'manage'::public.area_access_level as access_level,
  'legacy_backfill'::public.grant_source_code as source_code,
  ca.created_at as granted_at,
  null::timestamptz as expires_at,
  case when ca.is_active = true then null::timestamptz else ca.updated_at end as revoked_at,
  ca.created_at,
  ca.updated_at,
  null::uuid,
  null::uuid
from public.council_admin_assignments ca
join public.local_units lu
  on lu.legacy_council_id = ca.council_id
join public.member_records mr
  on mr.legacy_people_id = ca.person_id
 and mr.local_unit_id = lu.id
where ca.person_id is not null
  and ca.user_id is not null
  and not exists (
    select 1
    from public.area_access_grants aag
    where aag.local_unit_id = lu.id
      and aag.member_record_id = mr.id
      and aag.area_code = 'custom_lists'::public.member_area_code
      and aag.source_code = 'legacy_backfill'::public.grant_source_code
  );

create or replace function public.list_accessible_custom_lists_for_user(
  p_user_id uuid
)
returns table (
  custom_list_id uuid,
  local_unit_id uuid
)
language sql
stable
as $$
  with area_scoped_lists as (
    select
      cl.id as custom_list_id,
      cl.local_unit_id
    from public.custom_lists cl
    where cl.local_unit_id is not null
      and cl.archived_at is null
      and public.has_area_access(
        p_user_id,
        cl.local_unit_id,
        'custom_lists'::public.member_area_code,
        'interact'::public.area_access_level
      )
  ),
  direct_resource_lists as (
    select
      vera.resource_key::uuid as custom_list_id,
      vera.local_unit_id
    from public.v_effective_resource_access vera
    where vera.user_id = p_user_id
      and vera.resource_type = 'custom_list'::public.resource_type_code
      and vera.is_effective = true
      and vera.resource_key ~* '^[0-9a-f-]{36}$'
  )
  select distinct
    combined.custom_list_id,
    combined.local_unit_id
  from (
    select * from area_scoped_lists
    union all
    select * from direct_resource_lists
  ) as combined;
$$;

create or replace function public.list_manageable_event_ids_for_user(
  p_user_id uuid,
  p_local_unit_id uuid default null
)
returns table (
  event_id uuid,
  local_unit_id uuid
)
language sql
stable
as $$
  with area_scoped_events as (
    select
      e.id as event_id,
      e.local_unit_id
    from public.events e
    where e.local_unit_id is not null
      and (p_local_unit_id is null or e.local_unit_id = p_local_unit_id)
      and public.has_area_access(
        p_user_id,
        e.local_unit_id,
        'events'::public.member_area_code,
        'manage'::public.area_access_level
      )
  ),
  delegated_events as (
    select
      e.id as event_id,
      e.local_unit_id
    from public.events e
    where e.local_unit_id is not null
      and (p_local_unit_id is null or e.local_unit_id = p_local_unit_id)
      and public.has_event_management_access(
        p_user_id,
        e.local_unit_id,
        e.id
      )
  )
  select distinct
    combined.event_id,
    combined.local_unit_id
  from (
    select * from area_scoped_events
    union all
    select * from delegated_events
  ) as combined;
$$;

commit;
