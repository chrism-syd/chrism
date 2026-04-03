-- 20260331140000_batch2_lifecycle_delete_policies.sql
-- Batch 2 lifecycle controls for archived events and custom lists.

begin;

drop policy if exists custom_lists_parallel_delete on public.custom_lists;
create policy custom_lists_parallel_delete
on public.custom_lists
for delete
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
  or public.auth_has_resource_access(local_unit_id, 'custom_list'::public.resource_type_code, id::text, 'manage')
);

drop policy if exists event_archives_delete_event_managers on public.event_archives;
create policy event_archives_delete_event_managers
on public.event_archives
for delete
to authenticated
using (
  local_unit_id is not null
  and public.auth_has_area_access(local_unit_id, 'events', 'manage')
);

commit;
