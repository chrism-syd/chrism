-- 20260330130000_parallel_access_rls_lockdown_phase1.sql
-- Phase 1 RLS lockdown to new-model auth helpers.
-- This does NOT drop legacy tables. It hardens read access around the new helpers.

begin;

-- MEMBER RECORDS
alter table public.member_records enable row level security;

drop policy if exists member_records_parallel_select on public.member_records;
create policy member_records_parallel_select
on public.member_records
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'members', 'edit_manage')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = member_records.id
      and uur.local_unit_id = member_records.local_unit_id
      and uur.status = 'active'::public.relationship_status
  )
);

-- USER UNIT RELATIONSHIPS
alter table public.user_unit_relationships enable row level security;

drop policy if exists user_unit_relationships_parallel_select on public.user_unit_relationships;
create policy user_unit_relationships_parallel_select
on public.user_unit_relationships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.auth_has_area_access(local_unit_id, 'members', 'edit_manage')
  or public.auth_has_area_access(local_unit_id, 'admins', 'manage')
);

-- AREA ACCESS GRANTS
alter table public.area_access_grants enable row level security;

drop policy if exists area_access_grants_parallel_select on public.area_access_grants;
create policy area_access_grants_parallel_select
on public.area_access_grants
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'admins', 'manage')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = area_access_grants.member_record_id
      and uur.local_unit_id = area_access_grants.local_unit_id
      and uur.status = 'active'::public.relationship_status
  )
);

-- RESOURCE ACCESS GRANTS
alter table public.resource_access_grants enable row level security;

drop policy if exists resource_access_grants_parallel_select on public.resource_access_grants;
create policy resource_access_grants_parallel_select
on public.resource_access_grants
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
  or public.auth_has_area_access(local_unit_id, 'admins', 'manage')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = resource_access_grants.member_record_id
      and uur.local_unit_id = resource_access_grants.local_unit_id
      and uur.status = 'active'::public.relationship_status
  )
);

-- EVENT ASSIGNMENTS
alter table public.event_assignments enable row level security;

drop policy if exists event_assignments_parallel_select on public.event_assignments;
create policy event_assignments_parallel_select
on public.event_assignments
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'events', 'manage')
  or public.auth_has_event_management_access(coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid))
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = event_assignments.member_record_id
      and uur.local_unit_id = event_assignments.local_unit_id
      and uur.status = 'active'::public.relationship_status
  )
);

-- CUSTOM LISTS
alter table public.custom_lists enable row level security;

drop policy if exists custom_lists_parallel_select on public.custom_lists;
create policy custom_lists_parallel_select
on public.custom_lists
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'custom_lists', 'manage')
  or exists (
    select 1
    from public.auth_accessible_custom_lists() acl
    where acl.custom_list_id = custom_lists.id
  )
);

-- EVENTS
alter table public.events enable row level security;

drop policy if exists events_parallel_select on public.events;
create policy events_parallel_select
on public.events
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'events', 'manage')
  or public.auth_has_event_management_access(id)
);

commit;