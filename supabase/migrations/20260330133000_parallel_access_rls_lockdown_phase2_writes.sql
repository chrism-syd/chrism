-- 20260330133000_parallel_access_rls_lockdown_phase2_writes.sql
-- Phase 2 RLS write policies for new-model-first operations.
-- Restrictive by default. Admin/service-role bypass still applies.

begin;

-- CUSTOM LISTS writes
drop policy if exists custom_lists_parallel_insert on public.custom_lists;
create policy custom_lists_parallel_insert
on public.custom_lists
for insert
to authenticated
with check (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
);

drop policy if exists custom_lists_parallel_update on public.custom_lists;
create policy custom_lists_parallel_update
on public.custom_lists
for update
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
)
with check (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
);

-- EVENTS writes
drop policy if exists events_parallel_insert on public.events;
create policy events_parallel_insert
on public.events
for insert
to authenticated
with check (
  public.auth_has_area_access(local_unit_id, 'events', 'manage')
);

drop policy if exists events_parallel_update on public.events;
create policy events_parallel_update
on public.events
for update
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'events', 'manage')
  or public.auth_has_event_management_access(id)
)
with check (
  public.auth_has_area_access(local_unit_id, 'events', 'manage')
  or public.auth_has_event_management_access(id)
);

-- AREA ACCESS GRANTS writes
drop policy if exists area_access_grants_parallel_insert on public.area_access_grants;
create policy area_access_grants_parallel_insert
on public.area_access_grants
for insert
to authenticated
with check (
  public.auth_has_area_access(local_unit_id, 'admins', 'manage')
);

drop policy if exists area_access_grants_parallel_update on public.area_access_grants;
create policy area_access_grants_parallel_update
on public.area_access_grants
for update
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'admins', 'manage')
)
with check (
  public.auth_has_area_access(local_unit_id, 'admins', 'manage')
);

-- RESOURCE ACCESS GRANTS writes
drop policy if exists resource_access_grants_parallel_insert on public.resource_access_grants;
create policy resource_access_grants_parallel_insert
on public.resource_access_grants
for insert
to authenticated
with check (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
  or public.auth_has_area_access(local_unit_id, 'admins', 'manage')
);

drop policy if exists resource_access_grants_parallel_update on public.resource_access_grants;
create policy resource_access_grants_parallel_update
on public.resource_access_grants
for update
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
  or public.auth_has_area_access(local_unit_id, 'admins', 'manage')
)
with check (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
  or public.auth_has_area_access(local_unit_id, 'admins', 'manage')
);

commit;