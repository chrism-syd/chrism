-- Archive and restore organization assignments; supporting member records are optional.
-- Existing public wrappers keep their signatures for older clients.
create or replace function app.archive_local_unit_member_record(
  p_local_unit_id uuid, p_person_id uuid, p_actor_user_id uuid, p_reason text default null
) returns uuid language plpgsql security definer
set search_path = public, app, pg_temp
as $function$
declare
  v_person public.people%rowtype;
  v_local_unit public.local_units%rowtype;
  v_link_id uuid;
  v_member_id uuid;
begin
  if p_actor_user_id is null then raise exception 'Not authenticated'; end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is distinct from p_actor_user_id or
       not coalesce(public.auth_has_area_access(p_local_unit_id, 'members', 'edit_manage'), false) then
      raise exception 'Not authorized to manage people in this local organization';
    end if;
  end if;

  select * into v_local_unit from public.local_units where id=p_local_unit_id;
  if not found then raise exception 'Local unit not found'; end if;
  -- Serialize transitions, including multiple supporting records, for this person.
  select * into v_person from public.people where id=p_person_id for update;
  if not found then raise exception 'Person not found'; end if;
  if v_person.merged_into_person_id is not null then raise exception 'Person has been merged'; end if;

  select id into v_link_id from public.local_unit_people
    where local_unit_id=p_local_unit_id and person_id=p_person_id order by ended_at desc nulls first, created_at desc, id limit 1;
  select id into v_member_id from public.member_records
    where local_unit_id=p_local_unit_id and legacy_people_id=p_person_id order by archived_at desc nulls first, created_at desc, id limit 1;
  if v_link_id is null and v_member_id is null then
    raise exception 'Person does not belong to this local organization';
  end if;

  -- Older records may predate organization assignments. Repair only a proven link.
  if v_link_id is null then
    insert into public.local_unit_people(local_unit_id, person_id, source_code,
      linked_by_auth_user_id, created_by_auth_user_id, updated_by_auth_user_id)
    values(p_local_unit_id, p_person_id, 'member_record_backfill',
      p_actor_user_id, p_actor_user_id, p_actor_user_id) returning id into v_link_id;
  end if;

  update public.member_records set
    lifecycle_state='archived'::public.member_record_lifecycle_state,
    archived_at=coalesce(archived_at, now()),
    updated_at=now(), updated_by_auth_user_id=p_actor_user_id
    where local_unit_id=p_local_unit_id and legacy_people_id=p_person_id;
  update public.local_unit_people set
    ended_at=coalesce(ended_at, now()),
    updated_at=now(), updated_by_auth_user_id=p_actor_user_id
    where local_unit_id=p_local_unit_id and person_id=p_person_id;
  perform app.write_audit_log(coalesce(v_local_unit.legacy_council_id,v_person.council_id),
    'local_unit_people',v_link_id,'archive_local_unit_member_record',
    jsonb_build_object('person_id',p_person_id,'local_unit_id',p_local_unit_id,
      'actor_user_id',p_actor_user_id,'reason',p_reason));
  return coalesce(v_member_id,v_link_id);
end;
$function$;

create or replace function app.restore_local_unit_member_record(
  p_local_unit_id uuid, p_person_id uuid, p_actor_user_id uuid
) returns uuid language plpgsql security definer
set search_path = public, app, pg_temp
as $function$
declare
  v_person public.people%rowtype;
  v_local_unit public.local_units%rowtype;
  v_link_id uuid;
  v_member_id uuid;
begin
  if p_actor_user_id is null then raise exception 'Not authenticated'; end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is distinct from p_actor_user_id or
       not coalesce(public.auth_has_area_access(p_local_unit_id, 'members', 'edit_manage'), false) then
      raise exception 'Not authorized to manage people in this local organization';
    end if;
  end if;

  select * into v_local_unit from public.local_units where id=p_local_unit_id;
  if not found then raise exception 'Local unit not found'; end if;
  -- Serialize transitions, including multiple supporting records, for this person.
  select * into v_person from public.people where id=p_person_id for update;
  if not found then raise exception 'Person not found'; end if;
  if v_person.merged_into_person_id is not null then raise exception 'Person has been merged'; end if;

  select id into v_link_id from public.local_unit_people
    where local_unit_id=p_local_unit_id and person_id=p_person_id order by ended_at desc nulls first, created_at desc, id limit 1;
  select id into v_member_id from public.member_records
    where local_unit_id=p_local_unit_id and legacy_people_id=p_person_id order by archived_at desc nulls first, created_at desc, id limit 1;
  if v_link_id is null and v_member_id is null then
    raise exception 'Person does not belong to this local organization';
  end if;

  -- Older records may predate organization assignments. Repair only a proven link.
  if v_link_id is null then
    insert into public.local_unit_people(local_unit_id, person_id, source_code,
      linked_by_auth_user_id, created_by_auth_user_id, updated_by_auth_user_id)
    values(p_local_unit_id, p_person_id, 'member_record_backfill',
      p_actor_user_id, p_actor_user_id, p_actor_user_id) returning id into v_link_id;
  end if;

  update public.member_records set
    lifecycle_state='active'::public.member_record_lifecycle_state,
    archived_at=null,
    updated_at=now(), updated_by_auth_user_id=p_actor_user_id
    where id=v_member_id;
  update public.local_unit_people set
    ended_at=null,
    updated_at=now(), updated_by_auth_user_id=p_actor_user_id
    where id=v_link_id;
  -- Compatibility with older globally archived profiles.
  update public.people set archived_at=null, updated_at=now(),
    updated_by_auth_user_id=p_actor_user_id where id=p_person_id and archived_at is not null;
  perform app.write_audit_log(coalesce(v_local_unit.legacy_council_id,v_person.council_id),
    'local_unit_people',v_link_id,'restore_local_unit_member_record',
    jsonb_build_object('person_id',p_person_id,'local_unit_id',p_local_unit_id,
      'actor_user_id',p_actor_user_id));
  return coalesce(v_member_id,v_link_id);
end;
$function$;
