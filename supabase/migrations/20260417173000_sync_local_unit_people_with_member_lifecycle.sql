begin;

create or replace function public.ensure_member_record_for_person_local_unit(
  p_local_unit_id uuid,
  p_person_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_member_record_id uuid;
  v_person public.people%rowtype;
begin
  select mr.id
    into v_member_record_id
  from public.member_records mr
  where mr.local_unit_id = p_local_unit_id
    and mr.legacy_people_id = p_person_id
  limit 1;

  if v_member_record_id is null then
    select *
      into v_person
    from public.people
    where id = p_person_id;

    if not found then
      return null;
    end if;

    insert into public.member_records (
      local_unit_id,
      member_number,
      first_name,
      middle_name,
      last_name,
      suffix,
      preferred_display_name,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      province_state,
      postal_code,
      country_code,
      lifecycle_state,
      archived_at,
      legacy_people_id,
      legacy_council_id,
      created_at,
      updated_at,
      created_by_auth_user_id,
      updated_by_auth_user_id
    )
    values (
      p_local_unit_id,
      null,
      v_person.first_name,
      v_person.middle_name,
      v_person.last_name,
      v_person.suffix,
      coalesce(nullif(btrim(v_person.directory_display_name_override), ''), nullif(btrim(v_person.nickname), '')),
      v_person.email,
      coalesce(nullif(btrim(v_person.cell_phone), ''), nullif(btrim(v_person.home_phone), ''), nullif(btrim(v_person.other_phone), '')),
      v_person.address_line_1,
      v_person.address_line_2,
      v_person.city,
      v_person.state_province,
      v_person.postal_code,
      v_person.country_code,
      case
        when v_person.archived_at is not null then 'archived'::public.member_record_lifecycle_state
        else 'active'::public.member_record_lifecycle_state
      end,
      v_person.archived_at,
      v_person.id,
      v_person.council_id,
      coalesce(v_person.created_at, now()),
      coalesce(v_person.updated_at, now()),
      v_person.created_by_auth_user_id,
      v_person.updated_by_auth_user_id
    )
    returning id into v_member_record_id;
  end if;

  insert into public.local_unit_people (
    local_unit_id,
    person_id,
    created_at,
    updated_at
  )
  values (
    p_local_unit_id,
    p_person_id,
    now(),
    now()
  )
  on conflict (local_unit_id, person_id)
  do update
     set ended_at = null,
         updated_at = now();

  return v_member_record_id;
end;
$$;

create or replace function app.archive_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_member_record public.member_records%rowtype;
  v_person public.people%rowtype;
  v_local_unit public.local_units%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_person
  from public.people
  where id = p_person_id;

  if not found then
    raise exception 'Person not found';
  end if;

  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    raise exception 'Local unit not found';
  end if;

  select *
    into v_member_record
  from public.member_records
  where local_unit_id = p_local_unit_id
    and legacy_people_id = p_person_id
  limit 1;

  if not found then
    raise exception 'Local-unit member record not found';
  end if;

  update public.member_records
     set lifecycle_state = 'archived'::public.member_record_lifecycle_state,
         archived_at = coalesce(archived_at, now()),
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where id = v_member_record.id;

  update public.local_unit_people
     set ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where local_unit_id = p_local_unit_id
     and person_id = p_person_id
     and ended_at is null;

  perform app.write_audit_log(
    coalesce(v_local_unit.legacy_council_id, v_person.council_id),
    'member_records',
    v_member_record.id,
    'archive_local_unit_member_record',
    jsonb_build_object(
      'person_id', p_person_id,
      'local_unit_id', p_local_unit_id,
      'actor_user_id', p_actor_user_id,
      'reason', p_reason
    )
  );

  return v_member_record.id;
end;
$$;

create or replace function app.restore_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_member_record public.member_records%rowtype;
  v_person public.people%rowtype;
  v_local_unit public.local_units%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_person
  from public.people
  where id = p_person_id;

  if not found then
    raise exception 'Person not found';
  end if;

  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    raise exception 'Local unit not found';
  end if;

  select *
    into v_member_record
  from public.member_records
  where local_unit_id = p_local_unit_id
    and legacy_people_id = p_person_id
  limit 1;

  if not found then
    raise exception 'Local-unit member record not found';
  end if;

  update public.member_records
     set lifecycle_state = 'active'::public.member_record_lifecycle_state,
         archived_at = null,
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where id = v_member_record.id;

  update public.people
     set archived_at = null,
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where id = p_person_id
     and archived_at is not null;

  insert into public.local_unit_people (
    local_unit_id,
    person_id,
    created_at,
    updated_at
  )
  values (
    p_local_unit_id,
    p_person_id,
    now(),
    now()
  )
  on conflict (local_unit_id, person_id)
  do update
     set ended_at = null,
         updated_at = now();

  perform app.write_audit_log(
    coalesce(v_local_unit.legacy_council_id, v_person.council_id),
    'member_records',
    v_member_record.id,
    'restore_local_unit_member_record',
    jsonb_build_object(
      'person_id', p_person_id,
      'local_unit_id', p_local_unit_id,
      'actor_user_id', p_actor_user_id
    )
  );

  return v_member_record.id;
end;
$$;

commit;
