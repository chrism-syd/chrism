begin;

create or replace function app.user_has_scope_for_user(
  p_user_id uuid,
  p_council_id uuid,
  p_scope_code text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_access_scopes s
    join public.users u
      on u.id = s.user_id
    where u.id = p_user_id
      and u.is_active = true
      and s.council_id = p_council_id
      and s.scope_code = p_scope_code
      and s.ends_at is null
      and s.starts_at <= now()
  )
$$;

create or replace function app.user_is_council_admin_for_user(
  p_user_id uuid,
  p_council_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  with active_app_user as (
    select
      u.id,
      u.person_id,
      coalesce(u.is_super_admin, false) as is_super_admin,
      au.email
    from public.users u
    left join auth.users au
      on au.id = u.id
    where u.id = p_user_id
      and u.is_active = true
    limit 1
  ),
  target_council as (
    select c.id, c.organization_id
    from public.councils c
    where c.id = p_council_id
    limit 1
  )
  select exists (
    select 1
    from active_app_user u
    where u.is_super_admin = true
  )
  or exists (
    select 1
    from active_app_user u
    join target_council tc
      on true
    join public.organization_admin_assignments oaa
      on oaa.organization_id = tc.organization_id
    where oaa.is_active = true
      and (
        oaa.user_id = u.id
        or (u.person_id is not null and oaa.person_id = u.person_id)
        or (
          u.email is not null
          and nullif(btrim(coalesce(oaa.grantee_email, '')), '') is not null
          and lower(oaa.grantee_email) = lower(u.email)
        )
      )
  )
  or exists (
    select 1
    from active_app_user u
    join public.council_admin_assignments ca
      on ca.council_id = p_council_id
    where ca.is_active = true
      and (
        ca.user_id = u.id
        or (u.person_id is not null and ca.person_id = u.person_id)
        or (
          u.email is not null
          and nullif(btrim(coalesce(ca.grantee_email, '')), '') is not null
          and lower(ca.grantee_email) = lower(u.email)
        )
      )
  )
  or exists (
    select 1
    from active_app_user u
    join public.person_officer_terms pot
      on pot.person_id = u.person_id
    where pot.council_id = p_council_id
      and pot.office_scope_code = 'council'
      and pot.office_code in ('grand_knight', 'financial_secretary')
      and (
        pot.service_end_year is null
        or pot.service_end_year >= extract(year from current_date)::int
      )
  );
$$;

create or replace function app.user_can_access_person_as_user(
  p_user_id uuid,
  p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  with target as (
    select
      p.id,
      p.council_id,
      p.primary_relationship_code,
      p.council_activity_level_code,
      p.council_reengagement_status_code,
      omr.official_membership_status_code
    from public.people p
    left join public.official_member_records omr
      on omr.person_id = p.id
    where p.id = p_person_id
      and p.merged_into_person_id is null
  )
  select exists (
    select 1
    from target t
    where t.council_id is not null
      and (
        app.user_is_council_admin_for_user(p_user_id, t.council_id)
        or app.user_has_scope_for_user(p_user_id, t.council_id, 'all_people')
        or (t.primary_relationship_code = 'prospect' and app.user_has_scope_for_user(p_user_id, t.council_id, 'prospects'))
        or (t.primary_relationship_code = 'volunteer_only' and app.user_has_scope_for_user(p_user_id, t.council_id, 'volunteer_only'))
        or (t.primary_relationship_code = 'member' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_all'))
        or (t.primary_relationship_code = 'member' and t.official_membership_status_code = 'active' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_official_active'))
        or (t.primary_relationship_code = 'member' and t.official_membership_status_code = 'associate' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_official_associate'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'active' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_activity_active'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'occasional' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_activity_occasional'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'inactive' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_activity_inactive'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'monitoring' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_reengagement_monitoring'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'hardship_support' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_reengagement_hardship_support'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'reengagement_in_progress' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_reengagement_in_progress'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'disengaged_no_response' and app.user_has_scope_for_user(p_user_id, t.council_id, 'members_reengagement_disengaged_no_response'))
      )
  );
$$;

create or replace function app.assign_person(
  p_person_id uuid,
  p_user_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_person public.people%rowtype;
  v_assignment_id uuid;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if v_person.primary_relationship_code <> 'member' then
    raise exception 'Assignments are limited to members in v1';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to assign this person';
  end if;

  if not app.user_can_access_person_as_user(p_user_id, v_person.id) then
    raise exception 'Assignment target user cannot access this member';
  end if;

  insert into public.person_assignments (
    council_id,
    person_id,
    user_id,
    assigned_by_auth_user_id,
    notes
  )
  values (
    v_person.council_id,
    v_person.id,
    p_user_id,
    auth.uid(),
    p_notes
  )
  returning id into v_assignment_id;

  perform app.write_audit_log(
    v_person.council_id,
    'person_assignments',
    v_assignment_id,
    'assign_person',
    jsonb_build_object('person_id', p_person_id, 'user_id', p_user_id)
  );

  return v_assignment_id;
end;
$$;

commit;
