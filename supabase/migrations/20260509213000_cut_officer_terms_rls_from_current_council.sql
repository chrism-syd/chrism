-- Cut person_officer_terms RLS off app.current_council_id().
--
-- people does not yet carry local_unit_id, so this bridges through the legacy
-- public/routing council id into local_units. Operational access is still checked
-- through effective local-unit access.
--
-- This keeps council_id as compatibility/routing data only and removes the
-- session-derived current council helper from officer-term policies.

begin;

drop policy if exists person_officer_terms_select_same_council on public.person_officer_terms;
drop policy if exists person_officer_terms_insert_admin_only on public.person_officer_terms;
drop policy if exists person_officer_terms_update_admin_only on public.person_officer_terms;
drop policy if exists person_officer_terms_delete_admin_only on public.person_officer_terms;

create policy person_officer_terms_select_accessible_local_unit
on public.person_officer_terms
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
    where p.id = person_officer_terms.person_id
      and p.council_id = person_officer_terms.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and (
        app.user_can_access_person(person_officer_terms.person_id)
        or (
          access.area_code = 'members'::public.member_area_code
          and access.access_level = 'manage'::public.area_access_level
        )
      )
  )
);

create policy person_officer_terms_insert_manageable_local_unit
on public.person_officer_terms
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
    where p.id = person_officer_terms.person_id
      and p.council_id = person_officer_terms.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy person_officer_terms_update_manageable_local_unit
on public.person_officer_terms
for update
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = person_officer_terms.person_id
      and p.council_id = person_officer_terms.council_id
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
    where p.id = person_officer_terms.person_id
      and p.council_id = person_officer_terms.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy person_officer_terms_delete_manageable_local_unit
on public.person_officer_terms
for delete
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.local_units lu
      on lu.legacy_council_id = p.council_id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where p.id = person_officer_terms.person_id
      and p.council_id = person_officer_terms.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

commit;
