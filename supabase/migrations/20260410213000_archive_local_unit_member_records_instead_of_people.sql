begin;

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

create or replace function public.archive_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path = public, app
as $$
  select app.archive_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    p_actor_user_id,
    p_reason
  );
$$;

create or replace function public.restore_local_unit_member_record(
  p_local_unit_id uuid,
  p_person_id uuid,
  p_actor_user_id uuid
)
returns uuid
language sql
security definer
set search_path = public, app
as $$
  select app.restore_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    p_actor_user_id
  );
$$;

commit;
