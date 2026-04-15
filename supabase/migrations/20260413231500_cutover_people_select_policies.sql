begin;

-- Cut legacy people/person-notes select paths away from app.user_can_access_person
-- and make them directly member-record/local-unit/effective-access based.

drop policy if exists "people_select_accessible" on public.people;
create policy "people_select_accessible"
on public.people
for select
to authenticated
using (
  merged_into_person_id is null
  and exists (
    select 1
    from public.member_records mr
    join public.v_effective_area_access v
      on v.local_unit_id = mr.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where mr.legacy_people_id = people.id
      and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
      and v.user_id = auth.uid()
  )
);

drop policy if exists "person_assignments_select_accessible" on public.person_assignments;
create policy "person_assignments_select_accessible"
on public.person_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.member_records mr
    join public.v_effective_area_access v
      on v.local_unit_id = mr.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where mr.legacy_people_id = person_assignments.person_id
      and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
      and v.user_id = auth.uid()
  )
);

drop policy if exists "person_notes_select_accessible" on public.person_notes;
create policy "person_notes_select_accessible"
on public.person_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.member_records mr
    join public.v_effective_area_access v
      on v.local_unit_id = mr.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where mr.legacy_people_id = person_notes.person_id
      and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
      and v.user_id = auth.uid()
  )
);

commit;
