begin;

-- Neuter legacy council-admin and scope helpers so remaining callers resolve through
-- local-unit effective access rather than council-era access tables/scopes.

create or replace function app.user_is_council_admin(p_council_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access v
      on v.local_unit_id = lu.id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where lu.legacy_council_id = p_council_id
      and v.user_id = auth.uid()
      and v.access_level in ('edit_manage', 'manage')
  );
$function$;

create or replace function app.user_is_council_admin_for_user(p_user_id uuid, p_council_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access v
      on v.local_unit_id = lu.id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where lu.legacy_council_id = p_council_id
      and v.user_id = p_user_id
      and v.access_level in ('edit_manage', 'manage')
  );
$function$;

create or replace function app.user_has_scope(p_council_id uuid, p_scope_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_scope_code in ('all_people', 'prospects', 'volunteer_only', 'members_all',
                          'members_official_active', 'members_official_associate',
                          'members_activity_active', 'members_activity_occasional',
                          'members_activity_inactive', 'members_reengagement_monitoring',
                          'members_reengagement_hardship_support',
                          'members_reengagement_in_progress',
                          'members_reengagement_disengaged_no_response')
      then app.user_is_council_admin(p_council_id)
    else false
  end;
$function$;

create or replace function app.user_has_scope_for_user(p_user_id uuid, p_council_id uuid, p_scope_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_scope_code in ('all_people', 'prospects', 'volunteer_only', 'members_all',
                          'members_official_active', 'members_official_associate',
                          'members_activity_active', 'members_activity_occasional',
                          'members_activity_inactive', 'members_reengagement_monitoring',
                          'members_reengagement_hardship_support',
                          'members_reengagement_in_progress',
                          'members_reengagement_disengaged_no_response')
      then app.user_is_council_admin_for_user(p_user_id, p_council_id)
    else false
  end;
$function$;

commit;
