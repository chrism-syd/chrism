begin;

with org_admin_residue_candidates as (
  select distinct
    uur.id as relationship_id
  from public.organization_admin_assignments oaa
  join public.local_units lu
    on lu.legacy_organization_id = oaa.organization_id
  join public.users u
    on (
      (oaa.user_id is not null and u.id = oaa.user_id)
      or
      (oaa.user_id is null and oaa.person_id is not null and u.person_id = oaa.person_id)
    )
  join public.user_unit_relationships uur
    on uur.user_id = u.id
   and uur.local_unit_id = lu.id
   and uur.status = 'active'::public.relationship_status
   and uur.member_record_id is not null
  join public.member_records mr
    on mr.id = uur.member_record_id
   and mr.local_unit_id = lu.id
   and (oaa.person_id is null or mr.legacy_people_id = oaa.person_id)
  where oaa.is_active = true
    and (
      mr.lifecycle_state = 'archived'::public.member_record_lifecycle_state
      or mr.archived_at is not null
    )
)
update public.user_unit_relationships uur
set
  status = 'inactive'::public.relationship_status,
  ended_at = coalesce(uur.ended_at, now()),
  updated_at = now()
from org_admin_residue_candidates c
where uur.id = c.relationship_id;

comment on table public.user_unit_relationships is
  'Includes legacy linked-member relationships. Active links to archived member_records should be treated as stale residue and cleaned up for org-admin-only subjects.';

commit;
