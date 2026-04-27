create or replace view public.v_effective_area_access as
with ranked as (
  select
    aag.id as area_access_grant_id,
    aag.local_unit_id,
    lu.display_name as local_unit_name,
    aag.member_record_id,
    mr.legacy_people_id as person_id,
    uur.user_id,
    aag.area_code,
    aag.access_level,
    aag.source_code,
    aag.granted_at,
    aag.expires_at,
    aag.revoked_at,
    case
      when aag.source_code = 'manual'::grant_source_code then 500
      when aag.source_code = 'system'::grant_source_code then 400
      when aag.source_code = 'invite_package'::grant_source_code then 300
      when aag.source_code = 'title_default'::grant_source_code then 200
      when aag.source_code = 'legacy_backfill'::grant_source_code then 100
      else 0
    end as precedence_score,
    case
      when aag.revoked_at is not null then false
      when aag.expires_at is not null and aag.expires_at < now() then false
      when mr.lifecycle_state = 'archived'::member_record_lifecycle_state then false
      else true
    end as is_effective
  from public.area_access_grants aag
  join public.local_units lu on lu.id = aag.local_unit_id
  join public.member_records mr on mr.id = aag.member_record_id
  join public.user_unit_relationships uur
    on uur.member_record_id = mr.id
   and uur.local_unit_id = aag.local_unit_id
   and uur.status = 'active'::relationship_status
  where uur.user_id is not null

  union all

  select
    oaa.id as area_access_grant_id,
    lu.id as local_unit_id,
    lu.display_name as local_unit_name,
    null::uuid as member_record_id,
    oaa.person_id,
    oaa.user_id,
    area_codes.area_code,
    'manage'::area_access_level as access_level,
    'manual'::grant_source_code as source_code,
    coalesce(oaa.created_at, oaa.updated_at, now()) as granted_at,
    null::timestamp with time zone as expires_at,
    oaa.revoked_at,
    500 as precedence_score,
    case
      when oaa.is_active is not true then false
      when oaa.revoked_at is not null then false
      when oaa.user_id is null then false
      else true
    end as is_effective
  from public.organization_admin_assignments oaa
  join public.local_units lu on lu.legacy_organization_id = oaa.organization_id
  cross join (
    values
      ('members'::member_area_code),
      ('events'::member_area_code),
      ('custom_lists'::member_area_code),
      ('admins'::member_area_code),
      ('local_unit_settings'::member_area_code)
  ) as area_codes(area_code)
  where oaa.user_id is not null
)
select distinct on (user_id, local_unit_id, area_code, access_level)
  area_access_grant_id,
  local_unit_id,
  local_unit_name,
  member_record_id,
  person_id,
  user_id,
  area_code,
  access_level,
  source_code,
  granted_at,
  expires_at,
  revoked_at,
  is_effective
from ranked
order by
  user_id,
  local_unit_id,
  area_code,
  access_level,
  precedence_score desc,
  granted_at desc,
  area_access_grant_id desc;
