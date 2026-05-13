-- Cut person-adjacent RLS policies off app.current_council_id().
--
-- people does not yet carry local_unit_id, so these policies bridge through
-- people.council_id -> local_units.legacy_council_id. Operational access is
-- checked through effective local-unit access.
--
-- council_id remains legacy/public/routing compatibility only.

begin;

drop policy if exists person_designations_select_accessible on public.person_designations;
drop policy if exists person_designations_write_admin_only on public.person_designations;
drop policy if exists person_distinctions_select_accessible on public.person_distinctions;
drop policy if exists person_distinctions_write_admin_only on public.person_distinctions;
drop policy if exists person_contact_change_log_admin_only on public.person_contact_change_log;
drop policy if exists person_contact_change_log_insert_same_council on public.person_contact_change_log;

create policy person_designations_select_accessible_local_unit
on public.person_designations
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
    where p.id = person_designations.person_id
      and p.council_id = person_designations.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and (
        app.user_can_access_person(person_designations.person_id)
        or (
          access.area_code = 'members'::public.member_area_code
          and access.access_level in ('read_only'::public.area_access_level, 'edit_manage'::public.area_access_level, 'manage'::public.area_access_level)
        )
      )
  )
);

create policy person_designations_write_manageable_local_unit
on public.person_designations
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
    where p.id = person_designations.person_id
      and p.council_id = person_designations.council_id
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
    where p.id = person_designations.person_id
      and p.council_id = person_designations.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy person_distinctions_select_accessible_local_unit
on public.person_distinctions
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
    where p.id = person_distinctions.person_id
      and p.council_id = person_distinctions.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and (
        app.user_can_access_person(person_distinctions.person_id)
        or (
          access.area_code = 'members'::public.member_area_code
          and access.access_level in ('read_only'::public.area_access_level, 'edit_manage'::public.area_access_level, 'manage'::public.area_access_level)
        )
      )
  )
);

create policy person_distinctions_write_manageable_local_unit
on public.person_distinctions
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
    where p.id = person_distinctions.person_id
      and p.council_id = person_distinctions.council_id
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
    where p.id = person_distinctions.person_id
      and p.council_id = person_distinctions.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy person_contact_change_log_select_manageable_local_unit
on public.person_contact_change_log
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
    where p.id = person_contact_change_log.person_id
      and p.council_id = person_contact_change_log.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy person_contact_change_log_insert_accessible_local_unit
on public.person_contact_change_log
for insert
to authenticated
with check (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = person_contact_change_log.person_id
      and p.council_id = person_contact_change_log.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and (
        app.user_can_access_person(person_contact_change_log.person_id)
        or (
          access.area_code = 'members'::public.member_area_code
          and access.access_level in ('edit_manage'::public.area_access_level, 'manage'::public.area_access_level)
        )
      )
  )
);

commit;
