-- Read-only live database verifier for the access matrix.
--
-- Run in Supabase SQL Editor after DB/access changes:
--   scripts/verify-db-access-matrix.sql
--
-- This intentionally is not part of npm run verify because it needs a live
-- linked database and production-like data. It checks the org-admin branch of
-- v_effective_area_access plus the canonical access RPCs.

with active_org_admin_samples as (
  select
    oaa.id as assignment_id,
    oaa.organization_id,
    oaa.user_id,
    oaa.person_id,
    lu.id as local_unit_id,
    lu.display_name as local_unit_name
  from public.organization_admin_assignments oaa
  join public.local_units lu
    on lu.legacy_organization_id = oaa.organization_id
  where oaa.is_active is true
    and oaa.revoked_at is null
    and oaa.user_id is not null
  order by oaa.created_at desc nulls last, oaa.id
  limit 10
), expected_org_admin_area_rows as (
  select
    sample.assignment_id,
    sample.user_id,
    sample.local_unit_id,
    expected.area_code::public.member_area_code as area_code
  from active_org_admin_samples sample
  cross join (
    values
      ('members'),
      ('events'),
      ('custom_lists'),
      ('admins'),
      ('local_unit_settings')
  ) as expected(area_code)
), missing_effective_area_rows as (
  select expected.*
  from expected_org_admin_area_rows expected
  where not exists (
    select 1
    from public.v_effective_area_access access
    where access.user_id = expected.user_id
      and access.local_unit_id = expected.local_unit_id
      and access.area_code = expected.area_code
      and access.access_level = 'manage'::public.area_access_level
      and access.member_record_id is null
      and access.is_effective is true
  )
), unexpected_claim_rows as (
  select
    access.area_access_grant_id,
    access.user_id,
    access.local_unit_id,
    access.area_code,
    access.access_level
  from active_org_admin_samples sample
  join public.v_effective_area_access access
    on access.user_id = sample.user_id
   and access.local_unit_id = sample.local_unit_id
  where access.member_record_id is null
    and access.is_effective is true
    and access.area_code = 'claims'::public.member_area_code
), failing_has_area_access as (
  select expected.*
  from expected_org_admin_area_rows expected
  where public.has_area_access(
    expected.user_id,
    expected.local_unit_id,
    expected.area_code,
    'manage'::public.area_access_level
  ) is not true
), failing_list_accessible_units as (
  select expected.*
  from expected_org_admin_area_rows expected
  where not exists (
    select 1
    from public.list_accessible_local_units_for_area(
      expected.user_id,
      expected.area_code,
      'manage'::public.area_access_level
    ) listed
    where listed.local_unit_id = expected.local_unit_id
  )
), check_results as (
  select
    (select count(*) from active_org_admin_samples) as sample_count,
    (select count(*) from missing_effective_area_rows) as missing_effective_area_row_count,
    (select count(*) from unexpected_claim_rows) as unexpected_claim_row_count,
    (select count(*) from failing_has_area_access) as failing_has_area_access_count,
    (select count(*) from failing_list_accessible_units) as failing_list_accessible_units_count
)
select * from check_results;

-- Failure details. All should return 0 rows when the summary above is clean.

with active_org_admin_samples as (
  select
    oaa.id as assignment_id,
    oaa.organization_id,
    oaa.user_id,
    oaa.person_id,
    lu.id as local_unit_id,
    lu.display_name as local_unit_name
  from public.organization_admin_assignments oaa
  join public.local_units lu
    on lu.legacy_organization_id = oaa.organization_id
  where oaa.is_active is true
    and oaa.revoked_at is null
    and oaa.user_id is not null
  order by oaa.created_at desc nulls last, oaa.id
  limit 10
), expected_org_admin_area_rows as (
  select
    sample.assignment_id,
    sample.user_id,
    sample.local_unit_id,
    expected.area_code::public.member_area_code as area_code
  from active_org_admin_samples sample
  cross join (
    values
      ('members'),
      ('events'),
      ('custom_lists'),
      ('admins'),
      ('local_unit_settings')
  ) as expected(area_code)
)
select
  'missing_effective_area_row' as failure_kind,
  expected.*
from expected_org_admin_area_rows expected
where not exists (
  select 1
  from public.v_effective_area_access access
  where access.user_id = expected.user_id
    and access.local_unit_id = expected.local_unit_id
    and access.area_code = expected.area_code
    and access.access_level = 'manage'::public.area_access_level
    and access.member_record_id is null
    and access.is_effective is true
)

union all

select
  'failing_has_area_access' as failure_kind,
  expected.*
from expected_org_admin_area_rows expected
where public.has_area_access(
  expected.user_id,
  expected.local_unit_id,
  expected.area_code,
  'manage'::public.area_access_level
) is not true

union all

select
  'failing_list_accessible_units' as failure_kind,
  expected.*
from expected_org_admin_area_rows expected
where not exists (
  select 1
  from public.list_accessible_local_units_for_area(
    expected.user_id,
    expected.area_code,
    'manage'::public.area_access_level
  ) listed
  where listed.local_unit_id = expected.local_unit_id
)
order by failure_kind, assignment_id, area_code;

with active_org_admin_samples as (
  select
    oaa.id as assignment_id,
    oaa.organization_id,
    oaa.user_id,
    oaa.person_id,
    lu.id as local_unit_id,
    lu.display_name as local_unit_name
  from public.organization_admin_assignments oaa
  join public.local_units lu
    on lu.legacy_organization_id = oaa.organization_id
  where oaa.is_active is true
    and oaa.revoked_at is null
    and oaa.user_id is not null
  order by oaa.created_at desc nulls last, oaa.id
  limit 10
)
select
  'unexpected_claim_org_admin_branch_row' as failure_kind,
  access.area_access_grant_id,
  access.user_id,
  access.local_unit_id,
  access.area_code,
  access.access_level
from active_org_admin_samples sample
join public.v_effective_area_access access
  on access.user_id = sample.user_id
 and access.local_unit_id = sample.local_unit_id
where access.member_record_id is null
  and access.is_effective is true
  and access.area_code = 'claims'::public.member_area_code
order by access.user_id, access.local_unit_id;
