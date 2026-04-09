begin;

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

  -- External organization admins must not synthesize member_records or
  -- user_unit_relationships. Only reuse a true local-member mapping if one
  -- already exists inside the organization.
  select lu.id, mr.id
    into v_local_unit_id, v_member_record_id
  from public.local_units lu
  join public.member_records mr
    on mr.legacy_people_id = v_row.person_id
   and mr.local_unit_id = lu.id
  where lu.legacy_organization_id = v_row.organization_id
  order by case when lu.local_unit_kind = 'council'::public.local_unit_kind then 1 else 2 end,
           lu.created_at
  limit 1;

  if v_local_unit_id is null or v_member_record_id is null then
    return;
  end if;

  perform public.upsert_parallel_admin_package_for_member(
    v_local_unit_id,
    v_member_record_id,
    'system'::public.grant_source_code,
    coalesce(v_row.is_active, false),
    coalesce(v_row.created_at, now()),
    coalesce(v_row.updated_at, v_row.created_at, now())
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
after insert or update
on public.organization_admin_assignments
for each row
execute function public.trg_sync_parallel_admin_package_from_org_admin_assignment();

with seed_assignments as (
  select id
  from public.organization_admin_assignments
)
select public.sync_parallel_admin_package_from_org_admin_assignment(id)
from seed_assignments;

commit;
