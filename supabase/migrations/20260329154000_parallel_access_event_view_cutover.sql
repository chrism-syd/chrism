-- 20260329154000_parallel_access_event_view_cutover.sql
-- Goal:
--   Make signed-in event authority derive from the new model only, and stop surfacing
--   person-only / null-user artifacts in the effective view.

begin;

create or replace view public.v_effective_event_management_access as
select distinct
  ea.local_unit_id,
  lu.display_name as local_unit_name,
  e.id as event_id,
  ea.member_record_id,
  mr.legacy_people_id as person_id,
  uur.user_id,
  coalesce(ea.role_code, 'manager') as role_code,
  true as is_effective
from public.event_assignments ea
join public.local_units lu
  on lu.id = ea.local_unit_id
join public.member_records mr
  on mr.id = ea.member_record_id
join public.user_unit_relationships uur
  on uur.member_record_id = ea.member_record_id
 and uur.local_unit_id = ea.local_unit_id
 and uur.status = 'active'::public.relationship_status
join public.events e
  on e.local_unit_id = ea.local_unit_id
 and (
   ea.assignment_scope = 'all_events'::public.event_assignment_scope_code
   or (
     ea.assignment_scope = 'event'::public.event_assignment_scope_code
     and ea.event_id = e.id
   )
 )
where mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
  and uur.user_id is not null

union

select
  v.local_unit_id,
  v.local_unit_name,
  e.id as event_id,
  v.member_record_id,
  v.person_id,
  v.user_id,
  'manager'::text as role_code,
  true as is_effective
from public.v_effective_area_access v
join public.events e
  on e.local_unit_id = v.local_unit_id
where v.area_code = 'events'::public.member_area_code
  and v.access_level = 'manage'::public.area_access_level
  and v.is_effective = true
  and v.user_id is not null;

create or replace function public.has_event_management_access(
  p_user_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.v_effective_event_management_access v
    where v.user_id = p_user_id
      and v.event_id = p_event_id
      and v.is_effective = true
  );
$$;

create or replace function public.list_manageable_event_ids_for_user(
  p_user_id uuid
)
returns table (event_id uuid)
language sql
stable
as $$
  select distinct v.event_id
  from public.v_effective_event_management_access v
  where v.user_id = p_user_id
    and v.is_effective = true
  order by v.event_id;
$$;

commit;