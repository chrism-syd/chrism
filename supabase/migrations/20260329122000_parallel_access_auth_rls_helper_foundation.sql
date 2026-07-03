begin;

-- Replays helper objects that the auth/RLS prep migration assumes already
-- exist. This keeps the migration chain replayable from zero.

create or replace function public.list_accessible_local_units_for_area(
  p_user_id uuid,
  p_area_code public.member_area_code,
  p_min_access_level public.area_access_level
)
returns table (
  local_unit_id uuid,
  local_unit_name text,
  area_code public.member_area_code,
  access_level public.area_access_level
)
language sql
stable
set search_path to public, app, pg_temp
as $$
  select distinct
    v.local_unit_id,
    v.local_unit_name,
    v.area_code,
    v.access_level
  from public.v_effective_area_access v
  where v.user_id = p_user_id
    and v.area_code = p_area_code
    and v.is_effective = true
    and (
      v.access_level = p_min_access_level
      or p_min_access_level = 'read_only'
      or (
        p_min_access_level = 'edit_manage'
        and v.access_level in ('edit_manage', 'manage')
      )
      or (
        p_min_access_level = 'manage'
        and v.access_level = 'manage'
      )
      or (
        p_min_access_level = 'interact'
        and v.access_level in ('interact', 'edit_manage', 'manage')
      )
    )
  order by v.local_unit_name;
$$;

create or replace function public.list_accessible_custom_lists_for_user(
  p_user_id uuid
)
returns table (
  custom_list_id uuid,
  local_unit_id uuid
)
language sql
stable
set search_path to public, app, pg_temp
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
set search_path to public, app, pg_temp
as $$
  select distinct
    e.id as event_id,
    e.local_unit_id
  from public.events e
  where e.local_unit_id is not null
    and (p_local_unit_id is null or e.local_unit_id = p_local_unit_id)
    and (
      public.has_area_access(
        p_user_id,
        e.local_unit_id,
        'events'::public.member_area_code,
        'manage'::public.area_access_level
      )
      or public.has_event_management_access(
        p_user_id,
        e.local_unit_id,
        e.id
      )
    )
  order by e.local_unit_id, e.id;
$$;

create or replace view public.v_effective_admin_package_access as
select
  user_id,
  person_id,
  local_unit_id,
  local_unit_name,
  bool_or(
    area_code = 'members'::public.member_area_code
    and access_level in ('edit_manage'::public.area_access_level, 'manage'::public.area_access_level)
    and is_effective
  ) as can_manage_members,
  bool_or(
    area_code = 'events'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  ) as can_manage_events,
  bool_or(
    area_code = 'custom_lists'::public.member_area_code
    and access_level in ('interact'::public.area_access_level, 'manage'::public.area_access_level)
    and is_effective
  ) as can_manage_custom_lists,
  bool_or(
    area_code = 'claims'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  ) as can_manage_claims,
  bool_or(
    area_code = 'admins'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  ) as can_manage_admins,
  bool_or(
    area_code = 'local_unit_settings'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  ) as can_manage_local_unit_settings
from public.v_effective_area_access
where user_id is not null
group by user_id, person_id, local_unit_id, local_unit_name
having
  bool_or(
    area_code = 'members'::public.member_area_code
    and access_level in ('edit_manage'::public.area_access_level, 'manage'::public.area_access_level)
    and is_effective
  )
  or bool_or(
    area_code = 'events'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  )
  or bool_or(
    area_code = 'custom_lists'::public.member_area_code
    and access_level in ('interact'::public.area_access_level, 'manage'::public.area_access_level)
    and is_effective
  )
  or bool_or(
    area_code = 'claims'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  )
  or bool_or(
    area_code = 'admins'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  )
  or bool_or(
    area_code = 'local_unit_settings'::public.member_area_code
    and access_level = 'manage'::public.area_access_level
    and is_effective
  );

commit;
