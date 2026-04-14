begin;

-- Rewire remaining person/app routines to use local-unit/member-record based authorization
-- while keeping writes compatible with existing tables.

create or replace function app.add_person_note(p_person_id uuid, p_note_type_code text, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_person public.people%rowtype;
  v_note_id uuid;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not app.user_can_access_person(v_person.id) then
    raise exception 'Not allowed to add note to this person';
  end if;

  if p_note_type_code = 'admin' and not public.auth_can_manage_person(v_person.id) then
    raise exception 'Only managers can create admin notes';
  end if;

  insert into public.person_notes (
    council_id,
    person_id,
    note_type_code,
    body,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_person.council_id,
    v_person.id,
    p_note_type_code,
    p_body,
    auth.uid(),
    auth.uid()
  )
  returning id into v_note_id;

  perform app.write_audit_log(
    v_person.council_id,
    'person_notes',
    v_note_id,
    'add_person_note',
    jsonb_build_object('person_id', p_person_id)
  );

  return v_note_id;
end;
$function$;

create or replace function app.assign_person(p_person_id uuid, p_user_id uuid, p_notes text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_person public.people%rowtype;
  v_assignment_id uuid;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not public.auth_can_manage_person_assignments(v_person.id) then
    raise exception 'Not allowed to assign this person';
  end if;

  if not app.user_can_access_person_as_user(p_user_id, v_person.id) then
    raise exception 'Assignment target user cannot access this person';
  end if;

  insert into public.person_assignments (
    council_id,
    person_id,
    user_id,
    assigned_by_auth_user_id,
    notes
  )
  values (
    v_person.council_id,
    v_person.id,
    p_user_id,
    auth.uid(),
    p_notes
  )
  returning id into v_assignment_id;

  perform app.write_audit_log(
    v_person.council_id,
    'person_assignments',
    v_assignment_id,
    'assign_person',
    jsonb_build_object('person_id', p_person_id, 'user_id', p_user_id)
  );

  return v_assignment_id;
end;
$function$;

create or replace function app.end_person_assignment(p_assignment_id uuid, p_notes text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_assignment public.person_assignments%rowtype;
  v_person public.people%rowtype;
begin
  select *
    into v_assignment
  from public.person_assignments
  where id = p_assignment_id;

  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;

  select *
    into v_person
  from public.people
  where id = v_assignment.person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Assignment person not found';
  end if;

  if not public.auth_can_manage_person_assignments(v_person.id) then
    raise exception 'Not allowed to end this assignment';
  end if;

  update public.person_assignments
  set ended_at = now(),
      ended_by_auth_user_id = auth.uid(),
      notes = coalesce(p_notes, notes)
  where id = p_assignment_id
    and ended_at is null;

  perform app.write_audit_log(
    v_person.council_id,
    'person_assignments',
    p_assignment_id,
    'end_person_assignment'
  );
end;
$function$;

create or replace function app.update_member_local_fields(
  p_person_id uuid,
  p_council_activity_level_code text,
  p_council_activity_context_code text,
  p_council_reengagement_status_code text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_person public.people%rowtype;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not public.auth_can_manage_person(v_person.id) then
    raise exception 'Not allowed to update this person';
  end if;

  update public.people
  set council_activity_level_code = p_council_activity_level_code,
      council_activity_context_code = p_council_activity_context_code,
      council_reengagement_status_code = p_council_reengagement_status_code,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(
    v_person.council_id,
    'people',
    p_person_id,
    'update_member_local_fields'
  );
end;
$function$;

create or replace function app.update_nonmember_contact_fields(
  p_person_id uuid,
  p_email text default null::text,
  p_cell_phone text default null::text,
  p_home_phone text default null::text,
  p_other_phone text default null::text,
  p_address_line_1 text default null::text,
  p_address_line_2 text default null::text,
  p_city text default null::text,
  p_state_province text default null::text,
  p_postal_code text default null::text,
  p_country_code text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_person public.people%rowtype;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not public.auth_can_manage_person(v_person.id) then
    raise exception 'Not allowed to update this person';
  end if;

  update public.people
  set email = p_email,
      cell_phone = p_cell_phone,
      home_phone = p_home_phone,
      other_phone = p_other_phone,
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      city = p_city,
      state_province = p_state_province,
      postal_code = p_postal_code,
      country_code = p_country_code,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(
    v_person.council_id,
    'people',
    p_person_id,
    'update_nonmember_contact_fields'
  );
end;
$function$;

commit;
