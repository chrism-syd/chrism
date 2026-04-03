-- 20260329143000_parallel_access_write_path_cutover.sql
-- Purpose:
--   Make the new parallel-access tables the primary sync target for legacy admin writes.
--   This does not remove legacy tables yet. It reduces "ghost" divergence by ensuring
--   council/org admin writes always project into area_access_grants in one consistent shape.

begin;

create or replace function public.upsert_parallel_admin_package_for_member(
  p_local_unit_id uuid,
  p_member_record_id uuid,
  p_source_code public.grant_source_code,
  p_is_active boolean,
  p_created_at timestamptz default now(),
  p_updated_at timestamptz default now()
)
returns void
language plpgsql
as $$
declare
  v_revoked_at timestamptz;
begin
  v_revoked_at := case when p_is_active then null else coalesce(p_updated_at, now()) end;

  insert into public.area_access_grants (
    local_unit_id,
    member_record_id,
    area_code,
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
  select
    p_local_unit_id,
    p_member_record_id,
    x.area_code,
    x.access_level,
    p_source_code,
    coalesce(p_created_at, now()),
    null,
    v_revoked_at,
    coalesce(p_created_at, now()),
    coalesce(p_updated_at, now()),
    null,
    null
  from (
    values
      ('members'::public.member_area_code, 'edit_manage'::public.area_access_level),
      ('events'::public.member_area_code, 'manage'::public.area_access_level),
      ('custom_lists'::public.member_area_code, 'manage'::public.area_access_level),
      ('claims'::public.member_area_code, 'manage'::public.area_access_level),
      ('admins'::public.member_area_code, 'manage'::public.area_access_level),
      ('local_unit_settings'::public.member_area_code, 'manage'::public.area_access_level)
  ) as x(area_code, access_level)
  on conflict (local_unit_id, member_record_id, area_code, access_level, source_code)
    where revoked_at is null
  do update
    set revoked_at = excluded.revoked_at,
        updated_at = excluded.updated_at;
end;
$$;

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

  if not found then
    return;
  end if;

  if v_row.person_id is null then
    return;
  end if;

  select lu.id, mr.id
    into v_local_unit_id, v_member_record_id
  from public.local_units lu
  join public.member_records mr
    on mr.legacy_people_id = v_row.person_id
   and mr.local_unit_id = lu.id
  where lu.legacy_council_id = v_row.council_id
  limit 1;

  if v_local_unit_id is null or v_member_record_id is null then
    return;
  end if;

  perform public.upsert_parallel_admin_package_for_member(
    v_local_unit_id,
    v_member_record_id,
    'system'::public.grant_source_code,
    coalesce(v_row.is_active, false),
    v_row.created_at,
    v_row.updated_at
  );
end;
$$;

create or replace function public.trg_sync_parallel_admin_package_from_council_admin_assignment()
returns trigger
language plpgsql
as $$
begin
  perform public.sync_parallel_admin_package_from_council_admin_assignment(new.id);
  return new;
end;
$$;

drop trigger if exists council_admin_assignments_sync_parallel_admin_package
  on public.council_admin_assignments;

create trigger council_admin_assignments_sync_parallel_admin_package
after insert or update
on public.council_admin_assignments
for each row
execute function public.trg_sync_parallel_admin_package_from_council_admin_assignment();

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

  if not found then
    return;
  end if;

  if v_row.person_id is null then
    return;
  end if;

  select lu.id, mr.id
    into v_local_unit_id, v_member_record_id
  from public.local_units lu
  join public.member_records mr
    on mr.legacy_people_id = v_row.person_id
   and mr.local_unit_id = lu.id
  where lu.legacy_organization_id = v_row.organization_id
  order by case when lu.local_unit_kind = 'council' then 1 else 2 end, lu.created_at
  limit 1;

  if v_local_unit_id is null or v_member_record_id is null then
    return;
  end if;

  perform public.upsert_parallel_admin_package_for_member(
    v_local_unit_id,
    v_member_record_id,
    'system'::public.grant_source_code,
    true,
    coalesce(v_row.created_at, now()),
    coalesce(v_row.created_at, now())
  );
end;
$$;

create or replace function public.trg_sync_parallel_admin_package_from_org_admin_assignment()
returns trigger
language plpgsql
as $$
begin
  perform public.sync_parallel_admin_package_from_org_admin_assignment(new.id);
  return new;
end;
$$;

drop trigger if exists organization_admin_assignments_sync_parallel_admin_package
  on public.organization_admin_assignments;

create trigger organization_admin_assignments_sync_parallel_admin_package
after insert
on public.organization_admin_assignments
for each row
execute function public.trg_sync_parallel_admin_package_from_org_admin_assignment();

-- backfill existing rows through the new canonical sync functions
do $$
declare
  r record;
begin
  for r in
    select id from public.council_admin_assignments
  loop
    perform public.sync_parallel_admin_package_from_council_admin_assignment(r.id);
  end loop;

  for r in
    select id from public.organization_admin_assignments
  loop
    perform public.sync_parallel_admin_package_from_org_admin_assignment(r.id);
  end loop;
end
$$;

commit;