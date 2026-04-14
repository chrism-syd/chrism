begin;

-- Make people insert and note insert rules local-unit/member-record aware instead of council-id driven.

drop policy if exists "people_insert_allowed" on public.people;
create policy "people_insert_allowed"
on public.people
for insert
to authenticated
with check (
  exists (
    select 1
    from public.v_effective_area_access v
    where v.user_id = auth.uid()
      and v.area_code = 'members'::public.member_area_code
      and v.is_effective = true
      and v.access_level in ('edit_manage', 'manage')
  )
);

drop policy if exists "person_notes_insert_accessible" on public.person_notes;
create policy "person_notes_insert_accessible"
on public.person_notes
for insert
to authenticated
with check (
  created_by_auth_user_id = auth.uid()
  and app.user_can_access_person(person_id)
);

commit;
