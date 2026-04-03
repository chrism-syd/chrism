-- 20260330120000_parallel_access_claim_and_audit_helpers.sql
-- Purpose:
--   Add canonical helpers and audit views so claim/admin flows can finish
--   moving to the new model and we can measure remaining legacy/new drift.

begin;

create or replace function public.approve_membership_claim_request_to_admin_package(
  p_actor_user_id uuid,
  p_claim_request_id uuid,
  p_target_user_id uuid,
  p_source_code public.grant_source_code default 'manual'
)
returns uuid
language plpgsql
as $$
declare
  v_claim public.membership_claim_requests%rowtype;
  v_member_record_id uuid;
begin
  select *
    into v_claim
  from public.membership_claim_requests
  where id = p_claim_request_id;

  if not found then
    raise exception 'Membership claim request % not found', p_claim_request_id;
  end if;

  if v_claim.local_unit_id is null then
    raise exception 'Membership claim request % is missing local_unit_id', p_claim_request_id;
  end if;

  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, v_claim.local_unit_id) x;

  perform public.upsert_parallel_admin_package_for_member(
    v_claim.local_unit_id,
    v_member_record_id,
    p_source_code,
    true,
    coalesce(v_claim.created_at, now()),
    now()
  );

  update public.membership_claim_requests
     set status_code = 'approved'::public.membership_claim_status_code,
         reviewed_by_auth_user_id = p_actor_user_id,
         reviewed_at = now(),
         reviewer_notes = coalesce(reviewer_notes, 'Approved into parallel admin package')
   where id = p_claim_request_id;

  return v_member_record_id;
end;
$$;

create or replace function public.reject_membership_claim_request_in_parallel(
  p_actor_user_id uuid,
  p_claim_request_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  v_claim public.membership_claim_requests%rowtype;
begin
  select *
    into v_claim
  from public.membership_claim_requests
  where id = p_claim_request_id;

  if not found then
    raise exception 'Membership claim request % not found', p_claim_request_id;
  end if;

  update public.membership_claim_requests
     set status_code = 'denied'::public.membership_claim_status_code,
         reviewed_by_auth_user_id = p_actor_user_id,
         reviewed_at = now(),
         reviewer_notes = coalesce(p_note, reviewer_notes, 'Rejected')
   where id = p_claim_request_id;

  return p_claim_request_id;
end;
$$;

create or replace view public.v_parallel_admin_package_audit as
select
  lu.id as local_unit_id,
  lu.display_name as local_unit_name,
  uur.user_id,
  mr.legacy_people_id as person_id,
  count(*) filter (where aag.area_code = 'members' and aag.access_level = 'edit_manage' and aag.revoked_at is null) > 0 as has_members_package,
  count(*) filter (where aag.area_code = 'events' and aag.access_level = 'manage' and aag.revoked_at is null) > 0 as has_events_package,
  count(*) filter (where aag.area_code = 'custom_lists' and aag.access_level = 'manage' and aag.revoked_at is null) > 0 as has_custom_lists_package,
  count(*) filter (where aag.area_code = 'claims' and aag.access_level = 'manage' and aag.revoked_at is null) > 0 as has_claims_package,
  count(*) filter (where aag.area_code = 'admins' and aag.access_level = 'manage' and aag.revoked_at is null) > 0 as has_admins_package,
  count(*) filter (where aag.area_code = 'local_unit_settings' and aag.access_level = 'manage' and aag.revoked_at is null) > 0 as has_local_unit_settings_package
from public.user_unit_relationships uur
join public.member_records mr
  on mr.id = uur.member_record_id
join public.local_units lu
  on lu.id = uur.local_unit_id
left join public.area_access_grants aag
  on aag.local_unit_id = uur.local_unit_id
 and aag.member_record_id = uur.member_record_id
 and aag.revoked_at is null
where uur.status = 'active'::public.relationship_status
group by lu.id, lu.display_name, uur.user_id, mr.legacy_people_id;

create or replace view public.v_parallel_custom_list_access_audit as
select
  cl.id as custom_list_id,
  cl.name as custom_list_name,
  cl.local_unit_id,
  lu.display_name as local_unit_name,
  uur.user_id,
  mr.legacy_people_id as person_id,
  max(case when rag.id is not null then 1 else 0 end) > 0 as has_parallel_resource_access
from public.custom_lists cl
join public.local_units lu
  on lu.id = cl.local_unit_id
left join public.resource_access_grants rag
  on rag.resource_type = 'custom_list'::public.resource_type_code
 and rag.resource_key = cl.id::text
 and rag.local_unit_id = cl.local_unit_id
 and rag.revoked_at is null
left join public.member_records mr
  on mr.id = rag.member_record_id
left join public.user_unit_relationships uur
  on uur.member_record_id = mr.id
 and uur.local_unit_id = cl.local_unit_id
 and uur.status = 'active'::public.relationship_status
group by cl.id, cl.name, cl.local_unit_id, lu.display_name, uur.user_id, mr.legacy_people_id;

create or replace view public.v_parallel_event_assignment_audit as
select
  e.id as event_id,
  e.title,
  e.local_unit_id,
  lu.display_name as local_unit_name,
  uur.user_id,
  mr.legacy_people_id as person_id,
  coalesce(ea.role_code, 'manager') as role_code,
  ea.assignment_scope
from public.events e
join public.local_units lu
  on lu.id = e.local_unit_id
left join public.event_assignments ea
  on ea.local_unit_id = e.local_unit_id
 and (
   (ea.assignment_scope = 'all_events'::public.event_assignment_scope_code)
   or
   (ea.assignment_scope = 'event'::public.event_assignment_scope_code and ea.event_id = e.id)
 )
left join public.member_records mr
  on mr.id = ea.member_record_id
left join public.user_unit_relationships uur
  on uur.member_record_id = mr.id
 and uur.local_unit_id = e.local_unit_id
 and uur.status = 'active'::public.relationship_status;

commit;