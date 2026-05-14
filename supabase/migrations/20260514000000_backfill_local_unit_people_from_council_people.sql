begin;

-- Backfill local_unit_people from the legacy council bridge before moving
-- /imports/supreme candidate loading away from people.council_id.
--
-- This intentionally includes active members, prospects, and volunteer-only
-- people because Supreme import matching can convert existing nonmembers into
-- members. member_records remain member-only; local_unit_people is the broader
-- local-unit person association seam.

insert into public.local_unit_people (
  local_unit_id,
  person_id,
  source_code,
  linked_at,
  created_at,
  updated_at
)
select distinct
  lu.id as local_unit_id,
  p.id as person_id,
  'legacy_council_people_backfill' as source_code,
  coalesce(p.created_at, now()) as linked_at,
  now() as created_at,
  now() as updated_at
from public.local_units lu
join public.people p
  on p.council_id = lu.legacy_council_id
where lu.local_unit_kind = 'council'::public.local_unit_kind
  and lu.legacy_council_id is not null
  and p.archived_at is null
  and p.merged_into_person_id is null
on conflict do nothing;

update public.local_unit_people lup
   set ended_at = null,
       updated_at = now()
from public.local_units lu
join public.people p
  on p.council_id = lu.legacy_council_id
where lup.local_unit_id = lu.id
  and lup.person_id = p.id
  and lu.local_unit_kind = 'council'::public.local_unit_kind
  and lu.legacy_council_id is not null
  and p.archived_at is null
  and p.merged_into_person_id is null
  and lup.ended_at is not null;

commit;
