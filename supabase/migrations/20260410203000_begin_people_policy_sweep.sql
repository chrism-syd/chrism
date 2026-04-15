begin;

-- People
drop policy if exists "people_insert_allowed" on public.people;
drop policy if exists "people_select_accessible" on public.people;
drop policy if exists "people_update_admin_only" on public.people;

create policy "people_insert_allowed"
on public.people
for insert
to authenticated
with check (
  app.user_is_council_admin(council_id)
);

create policy "people_select_accessible"
on public.people
for select
to authenticated
using (
  merged_into_person_id is null
  and app.user_can_access_person(id)
);

create policy "people_update_admin_only"
on public.people
for update
to authenticated
using (
  app.user_is_council_admin(council_id)
)
with check (
  app.user_is_council_admin(council_id)
);

-- Person assignments
drop policy if exists "person_assignments_select_accessible" on public.person_assignments;
drop policy if exists "person_assignments_write_admin_only" on public.person_assignments;

create policy "person_assignments_select_accessible"
on public.person_assignments
for select
to authenticated
using (
  app.user_can_access_person(person_id)
);

create policy "person_assignments_write_admin_only"
on public.person_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.people p
    where p.id = person_assignments.person_id
      and app.user_is_council_admin(p.council_id)
  )
)
with check (
  exists (
    select 1
    from public.people p
    where p.id = person_assignments.person_id
      and app.user_is_council_admin(p.council_id)
  )
);

-- Person notes
drop policy if exists "person_notes_delete_admin_only" on public.person_notes;
drop policy if exists "person_notes_insert_accessible" on public.person_notes;
drop policy if exists "person_notes_select_accessible" on public.person_notes;
drop policy if exists "person_notes_update_creator_or_admin" on public.person_notes;

create policy "person_notes_delete_admin_only"
on public.person_notes
for delete
to authenticated
using (
  exists (
    select 1
    from public.people p
    where p.id = person_notes.person_id
      and app.user_is_council_admin(p.council_id)
  )
);

create policy "person_notes_insert_accessible"
on public.person_notes
for insert
to authenticated
with check (
  created_by_auth_user_id = auth.uid()
  and app.user_can_access_person(person_id)
  and exists (
    select 1
    from public.people p
    where p.id = person_notes.person_id
      and p.council_id = person_notes.council_id
  )
);

create policy "person_notes_select_accessible"
on public.person_notes
for select
to authenticated
using (
  app.user_can_access_person(person_id)
);

create policy "person_notes_update_creator_or_admin"
on public.person_notes
for update
to authenticated
using (
  (
    created_by_auth_user_id = auth.uid()
    and app.user_can_access_person(person_id)
  )
  or exists (
    select 1
    from public.people p
    where p.id = person_notes.person_id
      and app.user_is_council_admin(p.council_id)
  )
)
with check (
  (
    created_by_auth_user_id = auth.uid()
    and app.user_can_access_person(person_id)
  )
  or exists (
    select 1
    from public.people p
    where p.id = person_notes.person_id
      and app.user_is_council_admin(p.council_id)
  )
);

commit;