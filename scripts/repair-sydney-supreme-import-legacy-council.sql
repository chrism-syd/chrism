-- Guarded one-off data repair for the Sydney Supreme-import legacy council mismatch.
--
-- This script is intentionally NOT a general merge/cleanup routine.
-- It only corrects the legacy people.council_id pointer for one known
-- Supreme-import row when the live data still proves that its active
-- local-unit/member-record surfaces are St. Patrick's Council.
--
-- Product boundary:
-- Do not use this as precedent for automatically merging people across local
-- units. A human may have separate local-org records, and contact/profile data
-- must not bleed across local organizations.
--
-- Expected effect:
-- - 7171d2f6... stops appearing as an active St. Mary's council candidate.
-- - Its people.council_id becomes aligned with its active St. Patrick's
--   local_unit_people/member_records surfaces.
-- - No local_unit_people rows are added.
-- - No member_records are moved.
-- - No organization_admin_assignments are changed.
-- - No person_kofc_profiles or organization_memberships are changed.

begin;

do $$
declare
  v_person_id constant uuid := '7171d2f6-8067-40bf-9d09-987d3b80fced'::uuid;
  v_expected_current_council_id constant uuid := 'cb336504-f5e2-4179-8a9d-5c34e86684d6'::uuid; -- St. Mary's legacy council
  v_expected_target_council_id constant uuid := '0c85b312-0bc2-4557-9b9f-61e6826de45b'::uuid; -- St. Patrick's legacy council
  v_expected_local_unit_id constant uuid := '6d09f535-3769-453e-a041-4b79dc777f59'::uuid; -- St. Patrick's local unit
  v_active_lup_count integer;
  v_active_member_record_count integer;
  v_st_marys_active_lup_count integer;
  v_updated_count integer;
begin
  select count(*)
    into v_active_lup_count
  from public.local_unit_people lup
  where lup.person_id = v_person_id
    and lup.local_unit_id = v_expected_local_unit_id
    and lup.ended_at is null;

  if v_active_lup_count <> 1 then
    raise exception 'Expected exactly one active St. Patrick local_unit_people row for %, found %.', v_person_id, v_active_lup_count;
  end if;

  select count(*)
    into v_active_member_record_count
  from public.member_records mr
  where mr.legacy_people_id = v_person_id
    and mr.local_unit_id = v_expected_local_unit_id
    and mr.archived_at is null
    and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state;

  if v_active_member_record_count <> 1 then
    raise exception 'Expected exactly one active St. Patrick member_record row for %, found %.', v_person_id, v_active_member_record_count;
  end if;

  select count(*)
    into v_st_marys_active_lup_count
  from public.local_unit_people lup
  where lup.person_id = v_person_id
    and lup.local_unit_id = '4a59e6d2-8376-4c64-b278-b2fa42ea96db'::uuid
    and lup.ended_at is null;

  if v_st_marys_active_lup_count <> 0 then
    raise exception 'Expected no active St. Mary local_unit_people row for %, found %.', v_person_id, v_st_marys_active_lup_count;
  end if;

  update public.people p
     set council_id = v_expected_target_council_id,
         updated_at = now()
   where p.id = v_person_id
     and p.council_id = v_expected_current_council_id
     and p.primary_relationship_code = 'member'
     and p.archived_at is null
     and p.merged_into_person_id is null
     and p.created_source_code = 'supreme_import';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception 'Expected to update exactly one guarded people row for %, updated %.', v_person_id, v_updated_count;
  end if;
end $$;

commit;

-- Post-check. Should show actual and expected as St. Patrick's for this row.
select
  p.id,
  p.first_name,
  p.last_name,
  p.primary_relationship_code,
  p.council_id as actual_council_id,
  c.name as actual_legacy_council_name,
  c.council_number as actual_council_number,
  p.created_source_code,
  p.archived_at,
  p.merged_into_person_id
from public.people p
left join public.councils c
  on c.id = p.council_id
where p.id = '7171d2f6-8067-40bf-9d09-987d3b80fced'::uuid;
