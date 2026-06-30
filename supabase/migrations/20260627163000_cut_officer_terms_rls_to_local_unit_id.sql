begin;

drop policy if exists person_officer_terms_select_accessible_local_unit on public.person_officer_terms;
drop policy if exists person_officer_terms_insert_manageable_local_unit on public.person_officer_terms;
drop policy if exists person_officer_terms_update_manageable_local_unit on public.person_officer_terms;
drop policy if exists person_officer_terms_delete_manageable_local_unit on public.person_officer_terms;

create policy person_officer_terms_select_accessible_local_unit
on public.person_officer_terms
for select
to authenticated
using (
  exists (
    select 1
    from public.v_effective_area_access access
    where access.local_unit_id = person_officer_terms.local_unit_id
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
    from public.v_effective_area_access access
    where access.local_unit_id = person_officer_terms.local_unit_id
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
    from public.v_effective_area_access access
    where access.local_unit_id = person_officer_terms.local_unit_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.v_effective_area_access access
    where access.local_unit_id = person_officer_terms.local_unit_id
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
    from public.v_effective_area_access access
    where access.local_unit_id = person_officer_terms.local_unit_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

commit;
