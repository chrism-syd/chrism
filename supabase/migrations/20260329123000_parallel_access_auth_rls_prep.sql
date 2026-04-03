-- Auth-aware helper views/functions for future RLS cutover.
-- These do not change existing policies yet. They provide a stable bridge for
-- domain-by-domain replacement away from legacy council-bound checks.

begin;

create or replace function public.auth_has_area_access(
  p_local_unit_id uuid,
  p_area_code public.member_area_code,
  p_min_access_level public.area_access_level
)
returns boolean
language sql
stable
as $$
  select coalesce(auth.uid() is not null, false)
    and public.has_area_access(
      auth.uid(),
      p_local_unit_id,
      p_area_code,
      p_min_access_level
    );
$$;

create or replace function public.auth_has_resource_access(
  p_local_unit_id uuid,
  p_resource_type public.resource_type_code,
  p_resource_key text,
  p_min_access_level public.area_access_level
)
returns boolean
language sql
stable
as $$
  select coalesce(auth.uid() is not null, false)
    and public.has_resource_access(
      auth.uid(),
      p_local_unit_id,
      p_resource_type,
      p_resource_key,
      p_min_access_level
    );
$$;

create or replace function public.auth_has_event_management_access(
  p_local_unit_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
as $$
  select coalesce(auth.uid() is not null, false)
    and public.has_event_management_access(
      auth.uid(),
      p_local_unit_id,
      p_event_id
    );
$$;

create or replace function public.auth_accessible_local_units_for_area(
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
as $$
  select *
  from public.list_accessible_local_units_for_area(
    auth.uid(),
    p_area_code,
    p_min_access_level
  )
  where auth.uid() is not null;
$$;

create or replace function public.auth_accessible_custom_lists()
returns table (
  custom_list_id uuid,
  local_unit_id uuid
)
language sql
stable
as $$
  select *
  from public.list_accessible_custom_lists_for_user(auth.uid())
  where auth.uid() is not null;
$$;

create or replace function public.auth_manageable_event_ids(
  p_local_unit_id uuid default null
)
returns table (
  event_id uuid,
  local_unit_id uuid
)
language sql
stable
as $$
  select *
  from public.list_manageable_event_ids_for_user(auth.uid(), p_local_unit_id)
  where auth.uid() is not null;
$$;

create or replace view public.v_auth_effective_area_access as
select *
from public.v_effective_area_access
where user_id = auth.uid();

create or replace view public.v_auth_effective_resource_access as
select *
from public.v_effective_resource_access
where user_id = auth.uid();

create or replace view public.v_auth_effective_admin_package_access as
select *
from public.v_effective_admin_package_access
where user_id = auth.uid();

comment on function public.auth_has_area_access(uuid, public.member_area_code, public.area_access_level)
  is 'Auth-aware wrapper around has_area_access for future RLS and server-side checks.';
comment on function public.auth_has_resource_access(uuid, public.resource_type_code, text, public.area_access_level)
  is 'Auth-aware wrapper around has_resource_access for future RLS and server-side checks.';
comment on function public.auth_has_event_management_access(uuid, uuid)
  is 'Auth-aware wrapper around has_event_management_access for future RLS and server-side checks.';
comment on function public.auth_accessible_local_units_for_area(public.member_area_code, public.area_access_level)
  is 'Auth-aware wrapper for listing accessible local units by area.';
comment on function public.auth_accessible_custom_lists()
  is 'Auth-aware wrapper for listing custom lists available to the signed-in user.';
comment on function public.auth_manageable_event_ids(uuid)
  is 'Auth-aware wrapper for listing manageable events for the signed-in user.';

commit;
