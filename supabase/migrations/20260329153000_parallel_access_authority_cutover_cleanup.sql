-- 20260329153000_parallel_access_authority_cutover_cleanup.sql
-- Goal:
--   Make the new model the only trusted source for signed-in authority decisions.
--   Legacy tables remain as sync inputs only.

begin;

-- 1) Canonical helpers to ensure a real subject exists in the new model.
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

  if v_member_record_id is not null then
    return v_member_record_id;
  end if;

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

  return v_member_record_id;
end;
$$;

create or replace function public.ensure_user_unit_relationship_for_user_member(
  p_user_id uuid,
  p_local_unit_id uuid,
  p_member_record_id uuid,
  p_is_active boolean default true
)
returns uuid
language plpgsql
as $$
declare
  v_relationship_id uuid;
begin
  select uur.id
    into v_relationship_id
  from public.user_unit_relationships uur
  where uur.user_id = p_user_id
    and uur.local_unit_id = p_local_unit_id
  order by case when uur.status = 'active'::public.relationship_status then 1 else 2 end,
           uur.created_at
  limit 1;

  if v_relationship_id is not null then
    update public.user_unit_relationships
       set member_record_id = coalesce(member_record_id, p_member_record_id),
           relationship_kind = 'linked_member_record'::public.relationship_kind,
           status = case when p_is_active then 'active'::public.relationship_status else status end,
           activated_at = case when p_is_active and activated_at is null then now() else activated_at end,
           updated_at = now()
     where id = v_relationship_id;
    return v_relationship_id;
  end if;

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
    case when p_is_active then 'active'::public.relationship_status else 'inactive'::public.relationship_status end,
    p_member_record_id,
    false,
    case when p_is_active then now() else null end,
    case when p_is_active then null else now() end,
    now(),
    now(),
    null,
    null
  )
  returning id into v_relationship_id;

  return v_relationship_id;
end;
$$;

-- 2) Strengthen council-admin sync to provision member/relationship first.
create or replace function public.sync_parallel_admin_package_from_council_admin_assignment(
  p_assignment_id uuid
)
returns void
language plpgsql
as $$
declare
  v_row public.council_admin_assignments%rowtype;
  v_local_unit_id uuid;
  v_member_record_id uuid;
begin
  select * into v_row
  from public.council_admin_assignments
  where id = p_assignment_id;

  if not found or v_row.person_id is null then
    return;
  end if;

  select lu.id
    into v_local_unit_id
  from public.local_units lu
  where lu.legacy_council_id = v_row.council_id
  limit 1;

  if v_local_unit_id is null then
    return;
  end if;

  v_member_record_id := public.ensure_member_record_for_person_local_unit(v_local_unit_id, v_row.person_id);

  if v_row.user_id is not null and v_member_record_id is not null then
    perform public.ensure_user_unit_relationship_for_user_member(
      v_row.user_id,
      v_local_unit_id,
      v_member_record_id,
      coalesce(v_row.is_active, false)
    );
  end if;

  if v_member_record_id is not null then
    perform public.upsert_parallel_admin_package_for_member(
      v_local_unit_id,
      v_member_record_id,
      'system'::public.grant_source_code,
      coalesce(v_row.is_active, false),
      v_row.created_at,
      v_row.updated_at
    );
  end if;
end;
$$;

-- 3) Strengthen org-admin sync to provision member/relationship first.
create or replace function public.sync_parallel_admin_package_from_org_admin_assignment(
  p_assignment_id uuid
)
returns void
language plpgsql
as $$
declare
  v_row public.organization_admin_assignments%rowtype;
  v_local_unit_id uuid;
  v_member_record_id uuid;
begin
  select * into v_row
  from public.organization_admin_assignments
  where id = p_assignment_id;

  if not found or v_row.person_id is null then
    return;
  end if;

  select lu.id
    into v_local_unit_id
  from public.local_units lu
  where lu.legacy_organization_id = v_row.organization_id
  order by case when lu.local_unit_kind = 'council'::public.local_unit_kind then 1 else 2 end,
           lu.created_at
  limit 1;

  if v_local_unit_id is null then
    return;
  end if;

  v_member_record_id := public.ensure_member_record_for_person_local_unit(v_local_unit_id, v_row.person_id);

  if v_row.person_id is not null then
    -- Try to discover a matching auth/app user via users table if not directly represented here.
    perform public.ensure_user_unit_relationship_for_user_member(
      u.id,
      v_local_unit_id,
      v_member_record_id,
      true
    )
    from public.users u
    where u.person_id = v_row.person_id
    limit 1;
  end if;

  if v_member_record_id is not null then
    perform public.upsert_parallel_admin_package_for_member(
      v_local_unit_id,
      v_member_record_id,
      'system'::public.grant_source_code,
      true,
      coalesce(v_row.created_at, now()),
      coalesce(v_row.created_at, now())
    );
  end if;
end;
$$;

-- 4) Backfill through strengthened syncs.
do $$
declare
  r record;
begin
  for r in select id from public.council_admin_assignments loop
    perform public.sync_parallel_admin_package_from_council_admin_assignment(r.id);
  end loop;

  for r in select id from public.organization_admin_assignments loop
    perform public.sync_parallel_admin_package_from_org_admin_assignment(r.id);
  end loop;
end;
$$;

-- 5) Signed-in-only effective authority views.
create or replace view public.v_effective_area_access as
with ranked as (
  select
    aag.id as area_access_grant_id,
    aag.local_unit_id,
    lu.display_name as local_unit_name,
    aag.member_record_id,
    mr.legacy_people_id as person_id,
    uur.user_id,
    aag.area_code,
    aag.access_level,
    aag.source_code,
    aag.granted_at,
    aag.expires_at,
    aag.revoked_at,
    case
      when aag.source_code = 'manual'::public.grant_source_code then 500
      when aag.source_code = 'system'::public.grant_source_code then 400
      when aag.source_code = 'invite_package'::public.grant_source_code then 300
      when aag.source_code = 'title_default'::public.grant_source_code then 200
      when aag.source_code = 'legacy_backfill'::public.grant_source_code then 100
      else 0
    end as precedence_score,
    case
      when aag.revoked_at is not null then false
      when aag.expires_at is not null and aag.expires_at < now() then false
      when mr.lifecycle_state = 'archived'::public.member_record_lifecycle_state then false
      else true
    end as is_effective
  from public.area_access_grants aag
  join public.local_units lu on lu.id = aag.local_unit_id
  join public.member_records mr on mr.id = aag.member_record_id
  join public.user_unit_relationships uur
    on uur.member_record_id = mr.id
   and uur.local_unit_id = aag.local_unit_id
   and uur.status = 'active'::public.relationship_status
  where uur.user_id is not null
)
select distinct on (user_id, local_unit_id, area_code, access_level)
  area_access_grant_id,
  local_unit_id,
  local_unit_name,
  member_record_id,
  person_id,
  user_id,
  area_code,
  access_level,
  source_code,
  granted_at,
  expires_at,
  revoked_at,
  is_effective
from ranked
order by user_id, local_unit_id, area_code, access_level, precedence_score desc, granted_at desc, area_access_grant_id desc;

create or replace view public.v_effective_admin_package_access as
select
  user_id,
  person_id,
  local_unit_id,
  local_unit_name,
  bool_or(area_code = 'members'::public.member_area_code and access_level in ('edit_manage'::public.area_access_level, 'manage'::public.area_access_level) and is_effective) as can_manage_members,
  bool_or(area_code = 'events'::public.member_area_code and access_level = 'manage'::public.area_access_level and is_effective) as can_manage_events,
  bool_or(area_code = 'custom_lists'::public.member_area_code and access_level = 'manage'::public.area_access_level and is_effective) as can_manage_custom_lists,
  bool_or(area_code = 'claims'::public.member_area_code and access_level = 'manage'::public.area_access_level and is_effective) as can_manage_claims,
  bool_or(area_code = 'admins'::public.member_area_code and access_level = 'manage'::public.area_access_level and is_effective) as can_manage_admins,
  bool_or(area_code = 'local_unit_settings'::public.member_area_code and access_level = 'manage'::public.area_access_level and is_effective) as can_manage_local_unit_settings
from public.v_effective_area_access
group by user_id, person_id, local_unit_id, local_unit_name;

-- 6) Retire duplicate legacy_backfill grants when stronger system grant exists.
update public.area_access_grants lb
set revoked_at = coalesce(lb.revoked_at, now()),
    updated_at = now()
where lb.source_code = 'legacy_backfill'::public.grant_source_code
  and lb.revoked_at is null
  and exists (
    select 1
    from public.area_access_grants s
    where s.local_unit_id = lb.local_unit_id
      and s.member_record_id = lb.member_record_id
      and s.area_code = lb.area_code
      and s.access_level = lb.access_level
      and s.source_code = 'system'::public.grant_source_code
      and s.revoked_at is null
  );

commit;