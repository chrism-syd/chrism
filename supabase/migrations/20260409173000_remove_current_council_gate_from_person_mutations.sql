begin;

create or replace function app.add_person_note(p_person_id uuid, p_note_type_code text, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to add note to this person';
  end if;

  if p_note_type_code = 'admin' and not app.user_is_council_admin(v_person.council_id) then
    raise exception 'Only admins can create admin notes';
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
$$;

create or replace function app.archive_person(p_person_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if v_person.primary_relationship_code = 'member' and not app.user_is_council_admin(v_person.council_id) then
    raise exception 'Only admins can archive members';
  end if;

  if v_person.primary_relationship_code in ('prospect', 'volunteer_only')
     and not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to archive this person';
  end if;

  update public.people
  set archived_at = now(),
      archived_by_auth_user_id = auth.uid(),
      archive_reason = p_reason,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(
    v_person.council_id,
    'people',
    p_person_id,
    'archive_person',
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

create or replace function app.end_person_assignment(p_assignment_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
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
$$;

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
as $$
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

  if v_person.primary_relationship_code <> 'member' then
    raise exception 'This function only updates member local fields';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to update this member';
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
$$;

create or replace function app.update_nonmember_contact_fields(
  p_person_id uuid,
  p_email text default null,
  p_cell_phone text default null,
  p_home_phone text default null,
  p_other_phone text default null,
  p_address_line_1 text default null,
  p_address_line_2 text default null,
  p_city text default null,
  p_state_province text default null,
  p_postal_code text default null,
  p_country_code text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if v_person.primary_relationship_code not in ('prospect', 'volunteer_only') then
    raise exception 'This function is only for prospects and volunteer-only records';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
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
$$;

commit;
