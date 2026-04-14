begin;

-- Strengthen legacy council admin assignment surfaces so they resolve through
-- effective local-unit admin area access instead of old council-era helper semantics.

drop policy if exists "council_admin_assignments_select_same_council" on public.council_admin_assignments;
create policy "council_admin_assignments_select_same_council"
on public.council_admin_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    where lu.legacy_council_id = council_admin_assignments.council_id
      and public.auth_has_area_access(
        lu.id,
        'admins'::public.member_area_code,
        'manage'::public.area_access_level
      )
  )
);

drop policy if exists "council_admin_assignments_insert_admin_only" on public.council_admin_assignments;
create policy "council_admin_assignments_insert_admin_only"
on public.council_admin_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.local_units lu
    where lu.legacy_council_id = council_admin_assignments.council_id
      and public.auth_has_area_access(
        lu.id,
        'admins'::public.member_area_code,
        'manage'::public.area_access_level
      )
  )
);

drop policy if exists "council_admin_assignments_update_admin_only" on public.council_admin_assignments;
create policy "council_admin_assignments_update_admin_only"
on public.council_admin_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    where lu.legacy_council_id = council_admin_assignments.council_id
      and public.auth_has_area_access(
        lu.id,
        'admins'::public.member_area_code,
        'manage'::public.area_access_level
      )
  )
)
with check (
  exists (
    select 1
    from public.local_units lu
    where lu.legacy_council_id = council_admin_assignments.council_id
      and public.auth_has_area_access(
        lu.id,
        'admins'::public.member_area_code,
        'manage'::public.area_access_level
      )
  )
);

drop policy if exists "council_admin_assignments_delete_admin_only" on public.council_admin_assignments;
create policy "council_admin_assignments_delete_admin_only"
on public.council_admin_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    where lu.legacy_council_id = council_admin_assignments.council_id
      and public.auth_has_area_access(
        lu.id,
        'admins'::public.member_area_code,
        'manage'::public.area_access_level
      )
  )
);

commit;
