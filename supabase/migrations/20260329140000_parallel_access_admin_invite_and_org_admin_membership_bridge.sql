begin;

create or replace function public.ensure_parallel_membership_for_org_admin_assignment(
  p_assignment_id uuid
)
returns void
language plpgsql
as $$
declare
  v_assignment public.organization_admin_assignments%rowtype;
  v_local_unit record;
  v_person public.people%rowtype;
  v_member_record_id uuid;
begin
  select *
  into v_assignment
  from public.organization_admin_assignments
  where id = p_assignment_id;

  if not found or v_assignment.organization_id is null then
    return;
  end if;

  if v_assignment.person_id is not null then
    select *
    into v_person
    from public.people
    where id = v_assignment.person_id;
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

      if v_member_record_id is null and found is false and v_person.id is not null then
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
          v_local_unit.id,
          null,
          coalesce(v_person.first_name, 'Admin'),
          v_person.middle_name,
          coalesce(v_person.last_name, 'User'),
          v_person.suffix,
          coalesce(nullif(btrim(v_person.directory_display_name_override), ''), nullif(btrim(v_person.nickname), '')),
          v_person.email,
          coalesce(
            nullif(btrim(v_person.cell_phone), ''),
            nullif(btrim(v_person.home_phone), ''),
            nullif(btrim(v_person.other_phone), '')
          ),
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
          coalesce(v_assignment.created_at, v_person.created_at, now()),
          coalesce(v_assignment.updated_at, v_person.updated_at, now()),
          v_assignment.created_by_user_id,
          v_assignment.updated_by_user_id
        )
        returning id into v_member_record_id;
      end if;
    end if;

    if v_assignment.user_id is not null and v_member_record_id is not null then
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
      select
        v_assignment.user_id,
        v_local_unit.id,
        'linked_member_record'::public.relationship_kind,
        case when v_assignment.is_active then 'active'::public.relationship_status else 'inactive'::public.relationship_status end,
        v_member_record_id,
        false,
        case when v_assignment.is_active then coalesce(v_assignment.created_at, now()) else null end,
        case when v_assignment.is_active then null else coalesce(v_assignment.updated_at, now()) end,
        coalesce(v_assignment.created_at, now()),
        coalesce(v_assignment.updated_at, now()),
        v_assignment.created_by_user_id,
        v_assignment.updated_by_user_id
      where not exists (
        select 1
        from public.user_unit_relationships uur
        where uur.user_id = v_assignment.user_id
          and uur.local_unit_id = v_local_unit.id
      );
    end if;
  end loop;
end;
$$;

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
  perform public.ensure_parallel_membership_for_org_admin_assignment(p_assignment_id);

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
      if v_assignment.is_active then
        insert into public.migration_review_queue (
          source_table,
          source_row_id,
          review_type,
          notes,
          payload
        )
        select
          'public.organization_admin_assignments',
          v_assignment.id,
          'organization_admin_assignment_without_member_record',
          'Active organization admin assignment could not be mapped to a member record in the same local unit.',
          jsonb_build_object(
            'organization_id', v_assignment.organization_id,
            'local_unit_id', v_local_unit.id,
            'person_id', v_assignment.person_id,
            'user_id', v_assignment.user_id,
            'grantee_email', v_assignment.grantee_email,
            'is_active', v_assignment.is_active
          )
        where not exists (
          select 1
          from public.migration_review_queue q
          where q.source_table = 'public.organization_admin_assignments'
            and q.source_row_id = v_assignment.id
            and q.review_type = 'organization_admin_assignment_without_member_record'
            and q.resolved_at is null
        );
      end if;

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
        set revoked_at = coalesce(v_assignment.updated_at, now()),
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

with seed_assignments as (
  select id
  from public.organization_admin_assignments
)
select public.sync_parallel_area_grants_from_org_admin_assignment(id)
from seed_assignments;

commit;
