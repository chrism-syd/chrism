begin;

create or replace function app.user_can_access_person(p_person_id uuid)
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
        app.user_is_council_admin(t.council_id)
        or app.user_has_scope(t.council_id, 'all_people')
        or (t.primary_relationship_code = 'prospect' and app.user_has_scope(t.council_id, 'prospects'))
        or (t.primary_relationship_code = 'volunteer_only' and app.user_has_scope(t.council_id, 'volunteer_only'))
        or (t.primary_relationship_code = 'member' and app.user_has_scope(t.council_id, 'members_all'))
        or (t.primary_relationship_code = 'member' and t.official_membership_status_code = 'active' and app.user_has_scope(t.council_id, 'members_official_active'))
        or (t.primary_relationship_code = 'member' and t.official_membership_status_code = 'associate' and app.user_has_scope(t.council_id, 'members_official_associate'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'active' and app.user_has_scope(t.council_id, 'members_activity_active'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'occasional' and app.user_has_scope(t.council_id, 'members_activity_occasional'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'inactive' and app.user_has_scope(t.council_id, 'members_activity_inactive'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'monitoring' and app.user_has_scope(t.council_id, 'members_reengagement_monitoring'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'hardship_support' and app.user_has_scope(t.council_id, 'members_reengagement_hardship_support'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'reengagement_in_progress' and app.user_has_scope(t.council_id, 'members_reengagement_in_progress'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'disengaged_no_response' and app.user_has_scope(t.council_id, 'members_reengagement_disengaged_no_response'))
      )
  );
$$;

create or replace function app.list_accessible_member_statuses()
returns table(person_id uuid, official_membership_status_code text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select omr.person_id, omr.official_membership_status_code
  from public.official_member_records omr
  join public.people p
    on p.id = omr.person_id
  where app.user_can_access_person(p.id)
$$;

commit;
