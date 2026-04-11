-- 20260410190000_parameterize_nonmember_creation_from_local_unit.sql
-- Goal:
--   Stop prospect / volunteer-only creation from treating app.current_council_id()
--   as the canonical creation scope. The canonical creation context is the active
--   local unit. We still derive people.council_id from that local unit's linked
--   legacy council for compatibility with existing storage.

begin;

create or replace function app.create_prospect_for_local_unit(
  p_local_unit_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_cell_phone text default null,
  p_home_phone text default null,
  p_other_phone text default null,
  p_prospect_status_code text default 'new'
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_local_unit public.local_units%rowtype;
  v_person_id uuid;
  v_member_record_id uuid;
begin
  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if v_local_unit.id is null then
    raise exception 'Local unit not found';
  end if;

  if v_local_unit.legacy_council_id is null then
    raise exception 'Local unit is not linked to a legacy council';
  end if;

  if not public.auth_has_area_access(
    p_local_unit_id,
    'members'::public.member_area_code,
    'edit_manage'::public.area_access_level
  ) then
    raise exception 'Not allowed to create prospects';
  end if;

  insert into public.people (
    council_id,
    first_name,
    last_name,
    primary_relationship_code,
    created_source_code,
    prospect_status_code,
    email,
    cell_phone,
    home_phone,
    other_phone,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_local_unit.legacy_council_id,
    p_first_name,
    p_last_name,
    'prospect',
    'scoped_manual_prospect',
    p_prospect_status_code,
    p_email,
    p_cell_phone,
    p_home_phone,
    p_other_phone,
    auth.uid(),
    auth.uid()
  )
  returning id into v_person_id;

  begin
    v_member_record_id := public.ensure_member_record_for_person_local_unit(
      p_local_unit_id,
      v_person_id
    );

    if v_member_record_id is null then
      raise exception 'Could not link created prospect to local unit';
    end if;
  exception
    when others then
      delete from public.people
      where id = v_person_id
        and primary_relationship_code = 'prospect';
      raise;
  end;

  perform app.write_audit_log(
    v_local_unit.legacy_council_id,
    'people',
    v_person_id,
    'create_prospect',
    jsonb_build_object(
      'local_unit_id', p_local_unit_id,
      'member_record_id', v_member_record_id
    )
  );

  return v_person_id;
end;
$$;

create or replace function app.create_volunteer_only_for_local_unit(
  p_local_unit_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_cell_phone text default null,
  p_home_phone text default null,
  p_other_phone text default null,
  p_volunteer_context_code text default 'unknown'
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_local_unit public.local_units%rowtype;
  v_person_id uuid;
  v_member_record_id uuid;
begin
  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if v_local_unit.id is null then
    raise exception 'Local unit not found';
  end if;

  if v_local_unit.legacy_council_id is null then
    raise exception 'Local unit is not linked to a legacy council';
  end if;

  if not public.auth_has_area_access(
    p_local_unit_id,
    'members'::public.member_area_code,
    'edit_manage'::public.area_access_level
  ) then
    raise exception 'Not allowed to create volunteer-only records';
  end if;

  insert into public.people (
    council_id,
    first_name,
    last_name,
    primary_relationship_code,
    created_source_code,
    volunteer_context_code,
    email,
    cell_phone,
    home_phone,
    other_phone,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_local_unit.legacy_council_id,
    p_first_name,
    p_last_name,
    'volunteer_only',
    'scoped_manual_volunteer',
    p_volunteer_context_code,
    p_email,
    p_cell_phone,
    p_home_phone,
    p_other_phone,
    auth.uid(),
    auth.uid()
  )
  returning id into v_person_id;

  begin
    v_member_record_id := public.ensure_member_record_for_person_local_unit(
      p_local_unit_id,
      v_person_id
    );

    if v_member_record_id is null then
      raise exception 'Could not link created volunteer-only record to local unit';
    end if;
  exception
    when others then
      delete from public.people
      where id = v_person_id
        and primary_relationship_code = 'volunteer_only';
      raise;
  end;

  perform app.write_audit_log(
    v_local_unit.legacy_council_id,
    'people',
    v_person_id,
    'create_volunteer_only',
    jsonb_build_object(
      'local_unit_id', p_local_unit_id,
      'member_record_id', v_member_record_id
    )
  );

  return v_person_id;
end;
$$;

create or replace function app.create_prospect(
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_cell_phone text default null,
  p_home_phone text default null,
  p_other_phone text default null,
  p_prospect_status_code text default 'new'
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_council_id uuid := app.current_council_id();
  v_local_unit_id uuid;
begin
  if v_council_id is null then
    raise exception 'No active council context for current user';
  end if;

  select lu.id
    into v_local_unit_id
  from public.local_units lu
  where lu.legacy_council_id = v_council_id
  order by
    case when lu.local_unit_kind = 'council'::public.local_unit_kind then 1 else 2 end,
    lu.created_at,
    lu.id
  limit 1;

  if v_local_unit_id is null then
    raise exception 'No active local unit context for current user';
  end if;

  return app.create_prospect_for_local_unit(
    v_local_unit_id,
    p_first_name,
    p_last_name,
    p_email,
    p_cell_phone,
    p_home_phone,
    p_other_phone,
    p_prospect_status_code
  );
end;
$$;

create or replace function app.create_volunteer_only(
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_cell_phone text default null,
  p_home_phone text default null,
  p_other_phone text default null,
  p_volunteer_context_code text default 'unknown'
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_council_id uuid := app.current_council_id();
  v_local_unit_id uuid;
begin
  if v_council_id is null then
    raise exception 'No active council context for current user';
  end if;

  select lu.id
    into v_local_unit_id
  from public.local_units lu
  where lu.legacy_council_id = v_council_id
  order by
    case when lu.local_unit_kind = 'council'::public.local_unit_kind then 1 else 2 end,
    lu.created_at,
    lu.id
  limit 1;

  if v_local_unit_id is null then
    raise exception 'No active local unit context for current user';
  end if;

  return app.create_volunteer_only_for_local_unit(
    v_local_unit_id,
    p_first_name,
    p_last_name,
    p_email,
    p_cell_phone,
    p_home_phone,
    p_other_phone,
    p_volunteer_context_code
  );
end;
$$;

commit;
