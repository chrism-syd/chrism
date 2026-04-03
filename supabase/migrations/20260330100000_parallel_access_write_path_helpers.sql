-- 20260330100000_parallel_access_write_path_helpers.sql
-- Purpose:
--   Provide canonical write helpers so app-side admin/event/custom-list changes
--   write to the new model first. Legacy tables can continue to exist as
--   compatibility inputs, but authority state should now be expressed directly
--   in the parallel-access tables.

begin;

create or replace function public.ensure_parallel_member_for_user_and_local_unit(
  p_user_id uuid,
  p_local_unit_id uuid
)
returns table (
  member_record_id uuid,
  user_unit_relationship_id uuid
)
language plpgsql
as $$
declare
  v_user public.users%rowtype;
  v_local_unit public.local_units%rowtype;
  v_member_record_id uuid;
  v_user_unit_relationship_id uuid;
begin
  select *
    into v_user
  from public.users
  where id = p_user_id;

  if not found then
    raise exception 'User % not found in public.users', p_user_id;
  end if;

  if v_user.person_id is null then
    raise exception 'User % is not linked to a person record', p_user_id;
  end if;

  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    raise exception 'Local unit % not found', p_local_unit_id;
  end if;

  select mr.id
    into v_member_record_id
  from public.member_records mr
  where mr.local_unit_id = p_local_unit_id
    and mr.legacy_people_id = v_user.person_id
  limit 1;

  if v_member_record_id is null then
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
    select
      p_local_unit_id,
      null,
      p.first_name,
      p.middle_name,
      p.last_name,
      p.suffix,
      coalesce(nullif(btrim(p.directory_display_name_override), ''), nullif(btrim(p.nickname), '')),
      p.email,
      coalesce(nullif(btrim(p.cell_phone), ''), nullif(btrim(p.home_phone), ''), nullif(btrim(p.other_phone), '')),
      p.address_line_1,
      p.address_line_2,
      p.city,
      p.state_province,
      p.postal_code,
      p.country_code,
      case when p.archived_at is not null then 'archived'::public.member_record_lifecycle_state else 'active'::public.member_record_lifecycle_state end,
      p.archived_at,
      p.id,
      coalesce(p.council_id, v_local_unit.legacy_council_id),
      coalesce(p.created_at, now()),
      coalesce(p.updated_at, now()),
      p.created_by_auth_user_id,
      p.updated_by_auth_user_id
    from public.people p
    where p.id = v_user.person_id
    returning id into v_member_record_id;
  end if;

  select uur.id
    into v_user_unit_relationship_id
  from public.user_unit_relationships uur
  where uur.user_id = p_user_id
    and uur.local_unit_id = p_local_unit_id
  order by case when uur.status = 'active'::public.relationship_status then 0 else 1 end, uur.created_at
  limit 1;

  if v_user_unit_relationship_id is null then
    insert into public.user_unit_relationships (
      user_id,
      local_unit_id,
      relationship_kind,
      status,
      member_record_id,
      is_primary_parish,
      activated_at,
      ended_at,
      created_at,
      updated_at,
      created_by_auth_user_id,
      updated_by_auth_user_id
    )
    values (
      p_user_id,
      p_local_unit_id,
      'linked_member_record'::public.relationship_kind,
      'active'::public.relationship_status,
      v_member_record_id,
      false,
      now(),
      null,
      now(),
      now(),
      null,
      null
    )
    returning id into v_user_unit_relationship_id;
  else
    update public.user_unit_relationships
       set member_record_id = v_member_record_id,
           status = 'active'::public.relationship_status,
           ended_at = null,
           activated_at = coalesce(activated_at, now()),
           updated_at = now()
     where id = v_user_unit_relationship_id;
  end if;

  member_record_id := v_member_record_id;
  user_unit_relationship_id := v_user_unit_relationship_id;
  return next;
end;
$$;

create or replace function public.grant_parallel_admin_package_to_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_local_unit_id uuid,
  p_source_code public.grant_source_code default 'manual',
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  v_member_record_id uuid;
begin
  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, p_local_unit_id) x;

  perform public.upsert_parallel_admin_package_for_member(
    p_local_unit_id,
    v_member_record_id,
    p_source_code,
    true,
    now(),
    now()
  );

  insert into public.migration_review_queue (
    source_table,
    source_row_id,
    review_type,
    notes,
    payload
  )
  values (
    'parallel_access',
    gen_random_uuid(),
    'admin_package_write',
    coalesce(p_note, 'Parallel admin package granted directly.'),
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'target_user_id', p_target_user_id,
      'local_unit_id', p_local_unit_id,
      'member_record_id', v_member_record_id,
      'source_code', p_source_code
    )
  );

  return v_member_record_id;
end;
$$;

create or replace function public.revoke_parallel_admin_package_from_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_local_unit_id uuid,
  p_source_code public.grant_source_code default 'manual',
  p_note text default null
)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update public.area_access_grants aag
     set revoked_at = coalesce(aag.revoked_at, now()),
         updated_at = now()
   where aag.local_unit_id = p_local_unit_id
     and aag.source_code = p_source_code
     and aag.revoked_at is null
     and exists (
       select 1
       from public.user_unit_relationships uur
       where uur.user_id = p_target_user_id
         and uur.local_unit_id = p_local_unit_id
         and uur.member_record_id = aag.member_record_id
     );

  get diagnostics v_count = row_count;

  insert into public.migration_review_queue (
    source_table,
    source_row_id,
    review_type,
    notes,
    payload
  )
  values (
    'parallel_access',
    gen_random_uuid(),
    'admin_package_revoke',
    coalesce(p_note, 'Parallel admin package revoked directly.'),
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'target_user_id', p_target_user_id,
      'local_unit_id', p_local_unit_id,
      'source_code', p_source_code,
      'revoked_rows', v_count
    )
  );

  return v_count;
end;
$$;

create or replace function public.grant_parallel_custom_list_access_to_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_custom_list_id uuid,
  p_access_level public.area_access_level default 'interact',
  p_source_code public.grant_source_code default 'manual'
)
returns uuid
language plpgsql
as $$
declare
  v_local_unit_id uuid;
  v_member_record_id uuid;
begin
  select cl.local_unit_id into v_local_unit_id
  from public.custom_lists cl
  where cl.id = p_custom_list_id;

  if v_local_unit_id is null then
    raise exception 'Custom list % not found or missing local_unit_id', p_custom_list_id;
  end if;

  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, v_local_unit_id) x;

  insert into public.resource_access_grants (
    local_unit_id,
    member_record_id,
    resource_type,
    resource_key,
    access_level,
    source_code,
    granted_at,
    expires_at,
    revoked_at,
    created_at,
    updated_at,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_local_unit_id,
    v_member_record_id,
    'custom_list'::public.resource_type_code,
    p_custom_list_id::text,
    p_access_level,
    p_source_code,
    now(),
    null,
    null,
    now(),
    now(),
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (local_unit_id, member_record_id, resource_type, resource_key, access_level, source_code)
    where revoked_at is null
  do update
     set updated_at = now(),
         revoked_at = null;

  return v_member_record_id;
end;
$$;

create or replace function public.revoke_parallel_custom_list_access_from_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_custom_list_id uuid,
  p_source_code public.grant_source_code default 'manual'
)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update public.resource_access_grants rag
     set revoked_at = coalesce(rag.revoked_at, now()),
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where rag.resource_type = 'custom_list'::public.resource_type_code
     and rag.resource_key = p_custom_list_id::text
     and rag.source_code = p_source_code
     and rag.revoked_at is null
     and exists (
       select 1
       from public.user_unit_relationships uur
       where uur.user_id = p_target_user_id
         and uur.local_unit_id = rag.local_unit_id
         and uur.member_record_id = rag.member_record_id
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.upsert_parallel_event_assignment_for_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_event_id uuid,
  p_role_code text default 'manager',
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  v_event public.events%rowtype;
  v_member_record_id uuid;
begin
  select *
    into v_event
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event % not found', p_event_id;
  end if;

  if v_event.local_unit_id is null then
    raise exception 'Event % is missing local_unit_id', p_event_id;
  end if;

  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, v_event.local_unit_id) x;

  insert into public.event_assignments (
    local_unit_id,
    member_record_id,
    assignment_scope,
    event_id,
    legacy_event_kind_code,
    notes,
    created_at,
    updated_at,
    created_by_auth_user_id,
    updated_by_auth_user_id,
    role_code
  )
  values (
    v_event.local_unit_id,
    v_member_record_id,
    'event'::public.event_assignment_scope_code,
    p_event_id,
    null,
    p_note,
    now(),
    now(),
    p_actor_user_id,
    p_actor_user_id,
    p_role_code
  )
  on conflict do nothing;

  return v_member_record_id;
end;
$$;

create or replace function public.revoke_parallel_event_assignment_from_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_event_id uuid,
  p_role_code text default 'manager'
)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  delete from public.event_assignments ea
   where ea.event_id = p_event_id
     and coalesce(ea.role_code, 'manager') = p_role_code
     and exists (
       select 1
       from public.user_unit_relationships uur
       where uur.user_id = p_target_user_id
         and uur.local_unit_id = ea.local_unit_id
         and uur.member_record_id = ea.member_record_id
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

commit;