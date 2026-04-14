begin;

-- Bridge helper: local-unit scoped person management via active member_records
create or replace function public.auth_can_manage_person(p_person_id uuid)
returns boolean
language sql
stable
as $function$
  select coalesce(auth.uid() is not null, false)
    and exists (
      select 1
      from public.member_records mr
      where mr.legacy_people_id = p_person_id
        and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
        and public.has_area_access(
          auth.uid(),
          mr.local_unit_id,
          'members'::public.member_area_code,
          'edit_manage'::public.area_access_level
        )
    );
$function$;

create or replace function public.auth_can_manage_person_notes(p_person_id uuid)
returns boolean
language sql
stable
as $function$
  select public.auth_can_manage_person(p_person_id);
$function$;

create or replace function public.auth_can_manage_person_assignments(p_person_id uuid)
returns boolean
language sql
stable
as $function$
  select public.auth_can_manage_person(p_person_id);
$function$;

-- Collapse legacy overloaded archive/restore variants onto the explicit-actor versions
create or replace function app.archive_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path = public, app
as $function$
  select app.archive_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid(),
    p_reason
  );
$function$;

create or replace function public.archive_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path = public, app
as $function$
  select public.archive_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid(),
    p_reason
  );
$function$;

create or replace function app.restore_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid
)
returns uuid
language sql
security definer
set search_path = public, app
as $function$
  select app.restore_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid()
  );
$function$;

create or replace function public.restore_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid
)
returns uuid
language sql
security definer
set search_path = public, app
as $function$
  select public.restore_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid()
  );
$function$;

-- People policies: stop relying on council-admin ambient authority
drop policy if exists "people_insert_allowed" on public.people;
drop policy if exists "people_update_admin_only" on public.people;

create policy "people_insert_allowed"
on public.people
for insert
to authenticated
with check (
  exists (
    select 1
    from public.local_units lu
    where lu.legacy_council_id = people.council_id
      and public.auth_has_area_access(
        lu.id,
        'members'::public.member_area_code,
        'edit_manage'::public.area_access_level
      )
  )
);

create policy "people_update_admin_only"
on public.people
for update
to authenticated
using (
  public.auth_can_manage_person(id)
)
with check (
  public.auth_can_manage_person(id)
);

-- Person assignments policies
drop policy if exists "person_assignments_write_admin_only" on public.person_assignments;

create policy "person_assignments_write_admin_only"
on public.person_assignments
for all
to authenticated
using (
  public.auth_can_manage_person_assignments(person_id)
)
with check (
  public.auth_can_manage_person_assignments(person_id)
);

-- Person notes policies
drop policy if exists "person_notes_delete_admin_only" on public.person_notes;
drop policy if exists "person_notes_update_creator_or_admin" on public.person_notes;

create policy "person_notes_delete_admin_only"
on public.person_notes
for delete
to authenticated
using (
  public.auth_can_manage_person_notes(person_id)
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
  or public.auth_can_manage_person_notes(person_id)
)
with check (
  (
    created_by_auth_user_id = auth.uid()
    and app.user_can_access_person(person_id)
  )
  or public.auth_can_manage_person_notes(person_id)
);

commit;
