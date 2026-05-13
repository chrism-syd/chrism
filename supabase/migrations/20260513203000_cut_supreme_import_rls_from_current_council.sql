-- Cut Supreme import / official-member RLS off app.current_council_id().
--
-- These legacy import tables still scope by council_id, so they bridge through
-- local_units.legacy_council_id. Operational authorization is checked through
-- effective local-unit members/manage access.
--
-- This does not redesign the import UX or official-member model. That remains
-- parked as a separate cleanup project.

begin;

drop policy if exists official_import_batches_admin_only on public.official_import_batches;
drop policy if exists official_import_rows_admin_only on public.official_import_rows;
drop policy if exists official_member_records_select_admin_only on public.official_member_records;
drop policy if exists official_member_records_write_admin_only on public.official_member_records;
drop policy if exists supreme_update_queue_admin_only on public.supreme_update_queue;

-- These tables should not be anonymously exposed through the Data API.
revoke all on table public.official_import_batches from anon;
revoke all on table public.official_import_rows from anon;
revoke all on table public.official_member_records from anon;
revoke all on table public.supreme_update_queue from anon;

create policy official_import_batches_manageable_local_unit
on public.official_import_batches
for all
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = official_import_batches.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = official_import_batches.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy official_import_rows_manageable_local_unit
on public.official_import_rows
for all
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = official_import_rows.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = official_import_rows.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy official_member_records_select_manageable_local_unit
on public.official_member_records
for select
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = official_member_records.person_id
      and p.council_id = official_member_records.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy official_member_records_write_manageable_local_unit
on public.official_member_records
for all
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = official_member_records.person_id
      and p.council_id = official_member_records.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = official_member_records.person_id
      and p.council_id = official_member_records.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy supreme_update_queue_manageable_local_unit
on public.supreme_update_queue
for all
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = supreme_update_queue.person_id
      and p.council_id = supreme_update_queue.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = supreme_update_queue.person_id
      and p.council_id = supreme_update_queue.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

commit;
