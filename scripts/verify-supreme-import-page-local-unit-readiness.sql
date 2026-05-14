-- Read-only readiness check for moving /imports/supreme candidate loading
-- away from people.council_id and onto explicit local_unit_id-linked people.
--
-- Why this exists:
-- The Supreme importer currently loads candidate people by people.council_id.
-- The apply RPC now uses explicit p_local_unit_id, but page loading still needs
-- extra care because existing prospects/volunteers may be converted to members
-- during import and may not yet have member_records.
--
-- Clean page cutover means the current council-shaped candidate set is fully
-- represented in local_unit_people for each council local unit, or any missing
-- rows are understood and intentionally excluded.
--
-- This script does not mutate data.

with council_local_units as (
  select
    lu.id as local_unit_id,
    lu.display_name,
    lu.legacy_council_id,
    c.organization_id,
    c.council_number
  from public.local_units lu
  join public.councils c
    on c.id = lu.legacy_council_id
  where lu.local_unit_kind = 'council'::public.local_unit_kind
), council_people_candidates as (
  select
    clu.local_unit_id,
    clu.display_name,
    clu.legacy_council_id,
    p.id as person_id,
    p.primary_relationship_code,
    p.archived_at,
    p.merged_into_person_id
  from council_local_units clu
  join public.people p
    on p.council_id = clu.legacy_council_id
  where p.archived_at is null
    and p.merged_into_person_id is null
), active_local_unit_people as (
  select
    lup.local_unit_id,
    lup.person_id
  from public.local_unit_people lup
  where lup.ended_at is null
), active_member_records as (
  select
    mr.local_unit_id,
    mr.legacy_people_id as person_id
  from public.member_records mr
  where mr.legacy_people_id is not null
    and mr.archived_at is null
    and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
), missing_from_local_unit_people as (
  select cpc.*
  from council_people_candidates cpc
  where not exists (
    select 1
    from active_local_unit_people lup
    where lup.local_unit_id = cpc.local_unit_id
      and lup.person_id = cpc.person_id
  )
), missing_from_member_records as (
  select cpc.*
  from council_people_candidates cpc
  where not exists (
    select 1
    from active_member_records mr
    where mr.local_unit_id = cpc.local_unit_id
      and mr.person_id = cpc.person_id
  )
)
select
  (select count(*) from council_local_units) as council_local_unit_count,
  (select count(*) from council_people_candidates) as current_people_council_candidate_count,
  (select count(*) from missing_from_local_unit_people) as missing_from_local_unit_people_count,
  (select count(*) from missing_from_member_records) as missing_from_member_records_count,
  (select count(*) from missing_from_local_unit_people where primary_relationship_code <> 'member') as missing_nonmember_from_local_unit_people_count,
  (select count(*) from missing_from_member_records where primary_relationship_code <> 'member') as missing_nonmember_from_member_records_count;

-- Detail rows. Review before changing /imports/supreme/page.tsx.
-- No names, emails, phone numbers, or other PII are returned.

select
  'missing_from_local_unit_people' as failure_kind,
  local_unit_id,
  display_name,
  legacy_council_id,
  person_id,
  primary_relationship_code
from missing_from_local_unit_people

union all

select
  'missing_from_member_records' as failure_kind,
  local_unit_id,
  display_name,
  legacy_council_id,
  person_id,
  primary_relationship_code
from missing_from_member_records
order by failure_kind, display_name, primary_relationship_code, person_id;
