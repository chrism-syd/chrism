begin;

-- Compatibility overload for older RLS policies that authorize by event id only.
-- Newer helpers also support local-unit scoped event authorization.

create or replace function public.auth_has_event_management_access(
  p_event_id uuid
)
returns boolean
language sql
stable
set search_path to public, app, pg_temp
as $$
  select coalesce(auth.uid() is not null, false)
    and exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and e.local_unit_id is not null
        and public.has_event_management_access(
          auth.uid(),
          e.local_unit_id,
          e.id
        )
    );
$$;

comment on function public.auth_has_event_management_access(uuid)
  is 'Compatibility wrapper for event-id-only event management access checks.';

commit;
