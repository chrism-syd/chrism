-- Secure remaining public views after MVP stabilization.
--
-- Owl plan:
--   1. Retire dead audit/auth wrapper views.
--   2. Guard against hidden policy/function dependencies before dropping wrappers.
--   3. Harden operational views by making them security_invoker.
--   4. Remove direct browser-role access; server-side service_role can still read them.
--
-- Notes:
--   - v_auth_* views are wrappers around effective access views and should not be
--     a public browser API surface.
--   - v_parallel_*_audit views were transition diagnostics and are retired with
--     the data-hygiene scaffolding.
--   - Event RSVP summary/rollup/host views are still used server-side by Next.js
--     routes through the admin/service-role client.

begin;

do $$
declare
  v_policy_refs integer := 0;
  v_function_refs integer := 0;
begin
  select count(*)
    into v_policy_refs
  from pg_policies
  where coalesce(qual, '') ilike any (array[
      '%v_auth_effective_area_access%',
      '%v_auth_effective_resource_access%',
      '%v_auth_effective_admin_package_access%',
      '%v_parallel_admin_package_audit%',
      '%v_parallel_event_assignment_audit%',
      '%v_parallel_custom_list_access_audit%'
    ])
     or coalesce(with_check, '') ilike any (array[
      '%v_auth_effective_area_access%',
      '%v_auth_effective_resource_access%',
      '%v_auth_effective_admin_package_access%',
      '%v_parallel_admin_package_audit%',
      '%v_parallel_event_assignment_audit%',
      '%v_parallel_custom_list_access_audit%'
    ]);

  if v_policy_refs > 0 then
    raise exception 'Refusing to drop view wrappers/audit views: % RLS policies still reference them', v_policy_refs;
  end if;

  select count(*)
    into v_function_refs
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
    and p.prokind in ('f', 'p')
    and (
      pg_get_functiondef(p.oid) ilike '%v_auth_effective_area_access%'
      or pg_get_functiondef(p.oid) ilike '%v_auth_effective_resource_access%'
      or pg_get_functiondef(p.oid) ilike '%v_auth_effective_admin_package_access%'
      or pg_get_functiondef(p.oid) ilike '%v_parallel_admin_package_audit%'
      or pg_get_functiondef(p.oid) ilike '%v_parallel_event_assignment_audit%'
      or pg_get_functiondef(p.oid) ilike '%v_parallel_custom_list_access_audit%'
    );

  if v_function_refs > 0 then
    raise exception 'Refusing to drop view wrappers/audit views: % app/public functions still reference them', v_function_refs;
  end if;
end $$;

-- Retire auth wrapper views first. They depend on the effective access views.
drop view if exists public.v_auth_effective_admin_package_access;
drop view if exists public.v_auth_effective_area_access;
drop view if exists public.v_auth_effective_resource_access;

-- Retire transition audit views.
drop view if exists public.v_parallel_admin_package_audit;
drop view if exists public.v_parallel_event_assignment_audit;
drop view if exists public.v_parallel_custom_list_access_audit;

-- Harden operational access views.
alter view if exists public.v_effective_area_access
  set (security_invoker = true);

alter view if exists public.v_effective_resource_access
  set (security_invoker = true);

alter view if exists public.v_effective_admin_package_access
  set (security_invoker = true);

alter view if exists public.v_effective_event_management_access
  set (security_invoker = true);

-- Harden server-side RSVP/event summary views.
alter view if exists public.event_person_rsvp_summary
  set (security_invoker = true);

alter view if exists public.event_council_rsvp_rollups
  set (security_invoker = true);

alter view if exists public.event_host_summary
  set (security_invoker = true);

-- These views are consumed by server-side code through the service-role admin
-- client. They should not be directly readable by anon/authenticated browser
-- clients.
revoke all on public.v_effective_area_access from anon, authenticated;
revoke all on public.v_effective_resource_access from anon, authenticated;
revoke all on public.v_effective_admin_package_access from anon, authenticated;
revoke all on public.v_effective_event_management_access from anon, authenticated;
revoke all on public.event_person_rsvp_summary from anon, authenticated;
revoke all on public.event_council_rsvp_rollups from anon, authenticated;
revoke all on public.event_host_summary from anon, authenticated;

grant select on public.v_effective_area_access to service_role;
grant select on public.v_effective_resource_access to service_role;
grant select on public.v_effective_admin_package_access to service_role;
grant select on public.v_effective_event_management_access to service_role;
grant select on public.event_person_rsvp_summary to service_role;
grant select on public.event_council_rsvp_rollups to service_role;
grant select on public.event_host_summary to service_role;

comment on view public.v_effective_area_access is
  'Server-side effective area access view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.v_effective_resource_access is
  'Server-side effective resource access view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.v_effective_admin_package_access is
  'Server-side effective admin package access view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.v_effective_event_management_access is
  'Server-side effective event management access view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.event_person_rsvp_summary is
  'Server-side RSVP summary view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.event_council_rsvp_rollups is
  'Server-side council RSVP rollup view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.event_host_summary is
  'Server-side event host summary view. security_invoker enabled; direct browser-role access revoked.';

commit;
