-- Read-only verifier for legacy people.council_id alignment with active
-- local-unit membership surfaces.
--
-- Purpose:
-- people.council_id is legacy/compatibility state. local_unit_id is the
-- operational ownership/scope truth. This verifier catches active people rows
-- whose legacy council pointer disagrees with active local_unit_people or
-- member_records links.
--
-- Important product boundary:
-- Do not use this output to automatically merge people across local units.
-- A human may be represented separately across local orgs because contact and
-- profile details can intentionally differ by local org.
--
-- This script does not mutate data and does not return contact PII.

with active_local_unit_people as (
  select
    lup.person_id,
    lup.local_unit_id,
    lu.display_name as local_unit_name,
    lu.legacy_council_id as expected_council_id,
    c.name as expected_legacy_council_name,
    c.council_number as expected_council_number
  from public.local_unit_people lup
  join public.local_units lu
    on lu.id = lup.local_unit_id
  left join public.councils c
    on c.id = lu.legacy_council_id
  where lup.ended_at is null
    and lu.legacy_council_id is not null
), active_member_records as (
  select
    mr.legacy_people_id as person_id,
    mr.local_unit_id,
    lu.display_name as local_unit_name,
    lu.legacy_council_id as expected_council_id,
    c.name as expected_legacy_council_name,
    c.council_number as expected_council_number,
    mr.id as member_record_id,
    mr.member_number,
    mr.lifecycle_state
  from public.member_records mr
  join public.local_units lu
    on lu.id = mr.local_unit_id
  left join public.councils c
    on c.id = lu.legacy_council_id
  where mr.legacy_people_id is not null
    and mr.archived_at is null
    and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
    and lu.legacy_council_id is not null
), local_unit_people_mismatches as (
  select
    'local_unit_people_legacy_council_mismatch' as mismatch_kind,
    p.id as person_id,
    p.primary_relationship_code,
    p.council_id as actual_council_id,
    actual_c.name as actual_legacy_council_name,
    actual_c.council_number as actual_council_number,
    lup.local_unit_id,
    lup.local_unit_name,
    lup.expected_council_id,
    lup.expected_legacy_council_name,
    lup.expected_council_number,
    null::uuid as member_record_id,
    null::text as member_number,
    null::text as lifecycle_state,
    p.created_source_code
  from public.people p
  join active_local_unit_people lup
    on lup.person_id = p.id
  left join public.councils actual_c
    on actual_c.id = p.council_id
  where p.archived_at is null
    and p.merged_into_person_id is null
    and p.council_id is distinct from lup.expected_council_id
), member_record_mismatches as (
  select
    'member_record_legacy_council_mismatch' as mismatch_kind,
    p.id as person_id,
    p.primary_relationship_code,
    p.council_id as actual_council_id,
    actual_c.name as actual_legacy_council_name,
    actual_c.council_number as actual_council_number,
    mr.local_unit_id,
    mr.local_unit_name,
    mr.expected_council_id,
    mr.expected_legacy_council_name,
    mr.expected_council_number,
    mr.member_record_id,
    mr.member_number,
    mr.lifecycle_state::text,
    p.created_source_code
  from public.people p
  join active_member_records mr
    on mr.person_id = p.id
  left join public.councils actual_c
    on actual_c.id = p.council_id
  where p.archived_at is null
    and p.merged_into_person_id is null
    and p.council_id is distinct from mr.expected_council_id
), combined_mismatches as (
  select * from local_unit_people_mismatches
  union all
  select * from member_record_mismatches
)
select
  count(*) as mismatch_row_count,
  count(distinct person_id) as mismatched_person_count,
  count(*) filter (where mismatch_kind = 'local_unit_people_legacy_council_mismatch') as local_unit_people_mismatch_count,
  count(*) filter (where mismatch_kind = 'member_record_legacy_council_mismatch') as member_record_mismatch_count
from combined_mismatches;

-- Detail rows. Review before any targeted cleanup. No contact PII returned.

with active_local_unit_people as (
  select
    lup.person_id,
    lup.local_unit_id,
    lu.display_name as local_unit_name,
    lu.legacy_council_id as expected_council_id,
    c.name as expected_legacy_council_name,
    c.council_number as expected_council_number
  from public.local_unit_people lup
  join public.local_units lu
    on lu.id = lup.local_unit_id
  left join public.councils c
    on c.id = lu.legacy_council_id
  where lup.ended_at is null
    and lu.legacy_council_id is not null
), active_member_records as (
  select
    mr.legacy_people_id as person_id,
    mr.local_unit_id,
    lu.display_name as local_unit_name,
    lu.legacy_council_id as expected_council_id,
    c.name as expected_legacy_council_name,
    c.council_number as expected_council_number,
    mr.id as member_record_id,
    mr.member_number,
    mr.lifecycle_state
  from public.member_records mr
  join public.local_units lu
    on lu.id = mr.local_unit_id
  left join public.councils c
    on c.id = lu.legacy_council_id
  where mr.legacy_people_id is not null
    and mr.archived_at is null
    and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
    and lu.legacy_council_id is not null
), local_unit_people_mismatches as (
  select
    'local_unit_people_legacy_council_mismatch' as mismatch_kind,
    p.id as person_id,
    p.primary_relationship_code,
    p.council_id as actual_council_id,
    actual_c.name as actual_legacy_council_name,
    actual_c.council_number as actual_council_number,
    lup.local_unit_id,
    lup.local_unit_name,
    lup.expected_council_id,
    lup.expected_legacy_council_name,
    lup.expected_council_number,
    null::uuid as member_record_id,
    null::text as member_number,
    null::text as lifecycle_state,
    p.created_source_code
  from public.people p
  join active_local_unit_people lup
    on lup.person_id = p.id
  left join public.councils actual_c
    on actual_c.id = p.council_id
  where p.archived_at is null
    and p.merged_into_person_id is null
    and p.council_id is distinct from lup.expected_council_id
), member_record_mismatches as (
  select
    'member_record_legacy_council_mismatch' as mismatch_kind,
    p.id as person_id,
    p.primary_relationship_code,
    p.council_id as actual_council_id,
    actual_c.name as actual_legacy_council_name,
    actual_c.council_number as actual_council_number,
    mr.local_unit_id,
    mr.local_unit_name,
    mr.expected_council_id,
    mr.expected_legacy_council_name,
    mr.expected_council_number,
    mr.member_record_id,
    mr.member_number,
    mr.lifecycle_state::text,
    p.created_source_code
  from public.people p
  join active_member_records mr
    on mr.person_id = p.id
  left join public.councils actual_c
    on actual_c.id = p.council_id
  where p.archived_at is null
    and p.merged_into_person_id is null
    and p.council_id is distinct from mr.expected_council_id
)
select *
from (
  select * from local_unit_people_mismatches
  union all
  select * from member_record_mismatches
) mismatches
order by person_id, mismatch_kind, local_unit_name, member_record_id nulls last;
