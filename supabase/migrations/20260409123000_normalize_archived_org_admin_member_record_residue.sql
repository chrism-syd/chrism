begin;

with org_admin_member_records as (
  select distinct
    mr.id as member_record_id
  from public.organization_admin_assignments oaa
  join public.local_units lu
    on lu.legacy_organization_id = oaa.organization_id
  join public.member_records mr
    on mr.local_unit_id = lu.id
   and (oaa.person_id is null or mr.legacy_people_id = oaa.person_id)
)
update public.member_records mr
set
  lifecycle_state = 'archived'::public.member_record_lifecycle_state,
  updated_at = now()
from org_admin_member_records oamr
where mr.id = oamr.member_record_id
  and mr.archived_at is not null
  and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state;

with org_admin_archived_member_records as (
  select distinct
    mr.id as member_record_id
  from public.organization_admin_assignments oaa
  join public.local_units lu
    on lu.legacy_organization_id = oaa.organization_id
  join public.member_records mr
    on mr.local_unit_id = lu.id
   and (oaa.person_id is null or mr.legacy_people_id = oaa.person_id)
  where mr.archived_at is not null
),
stale_relationships as (
  select distinct
    uur.id as relationship_id
  from public.user_unit_relationships uur
  join org_admin_archived_member_records oamr
    on oamr.member_record_id = uur.member_record_id
  where uur.status <> 'inactive'::public.relationship_status
)
update public.user_unit_relationships uur
set
  status = 'inactive'::public.relationship_status,
  ended_at = coalesce(uur.ended_at, now()),
  updated_at = now()
from stale_relationships sr
where uur.id = sr.relationship_id;

commit;
