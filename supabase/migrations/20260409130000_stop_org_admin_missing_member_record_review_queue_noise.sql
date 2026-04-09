begin;

create or replace function public.sync_parallel_area_grants_from_org_admin_assignment(
  p_assignment_id uuid
)
returns void
language plpgsql
as $$
declare
  v_assignment public.organization_admin_assignments%rowtype;
  v_local_unit record;
  v_member_record_id uuid;
  v_area_code public.member_area_code;
  v_access_level public.area_access_level;
  v_area_codes public.member_area_code[] := array[
    'members'::public.member_area_code,
    'events'::public.member_area_code,
    'custom_lists'::public.member_area_code,
    'claims'::public.member_area_code,
    'admins'::public.member_area_code,
    'local_unit_settings'::public.member_area_code
  ];
begin
  select *
  into v_assignment
  from public.organization_admin_assignments
  where id = p_assignment_id;

  if not found then
    return;
  end if;

  for v_local_unit in
    select id
    from public.local_units
    where legacy_organization_id = v_assignment.organization_id
  loop
    v_member_record_id := null;

    if v_assignment.person_id is not null then
      select mr.id
      into v_member_record_id
      from public.member_records mr
      where mr.local_unit_id = v_local_unit.id
        and mr.legacy_people_id = v_assignment.person_id
      order by mr.created_at asc
      limit 1;
    elsif v_assignment.user_id is not null then
      select uur.member_record_id
      into v_member_record_id
      from public.user_unit_relationships uur
      where uur.user_id = v_assignment.user_id
        and uur.local_unit_id = v_local_unit.id
        and uur.member_record_id is not null
      order by case when uur.status = 'active' then 0 else 1 end, uur.created_at asc
      limit 1;
    end if;

    if v_member_record_id is null then
      continue;
    end if;

    foreach v_area_code in array v_area_codes
    loop
      v_access_level := case
        when v_area_code = 'members' then 'edit_manage'::public.area_access_level
        when v_area_code = 'custom_lists' then 'manage'::public.area_access_level
        else 'manage'::public.area_access_level
      end;

      if v_assignment.is_active then
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
        values (
          v_local_unit.id,
          v_member_record_id,
          v_area_code,
          v_access_level,
          'system'::public.grant_source_code,
          coalesce(v_assignment.created_at, now()),
          null,
          null,
          coalesce(v_assignment.created_at, now()),
          coalesce(v_assignment.updated_at, now()),
          v_assignment.created_by_user_id,
          v_assignment.updated_by_user_id
        )
        on conflict (local_unit_id, member_record_id, area_code, access_level, source_code)
        where revoked_at is null
        do update set
          revoked_at = null,
          updated_at = excluded.updated_at,
          updated_by_auth_user_id = excluded.updated_by_auth_user_id;
      else
        update public.area_access_grants
        set revoked_at = coalesce(v_assignment.revoked_at, v_assignment.updated_at, now()),
            updated_at = coalesce(v_assignment.updated_at, now()),
            updated_by_auth_user_id = v_assignment.updated_by_user_id
        where local_unit_id = v_local_unit.id
          and member_record_id = v_member_record_id
          and area_code = v_area_code
          and access_level = v_access_level
          and source_code = 'system'::public.grant_source_code
          and revoked_at is null;
      end if;
    end loop;
  end loop;
end;
$$;

update public.migration_review_queue q
set resolved_at = coalesce(q.resolved_at, now())
where q.source_table = 'public.organization_admin_assignments'
  and q.review_type = 'organization_admin_assignment_without_member_record'
  and q.resolved_at is null;

commit;