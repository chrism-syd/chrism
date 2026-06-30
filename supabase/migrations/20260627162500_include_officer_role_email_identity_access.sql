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

  union all

  select
    pot.id as area_access_grant_id,
    pot.local_unit_id,
    lu.display_name as local_unit_name,
    mr.id as member_record_id,
    pot.person_id,
    uur.user_id,
    area_codes.area_code,
    'manage'::area_access_level as access_level,
    'title_default'::grant_source_code as source_code,
    coalesce(pot.created_at, now()) as granted_at,
    null::timestamp with time zone as expires_at,
    null::timestamp with time zone as revoked_at,
    200 as precedence_score,
    case
      when mr.lifecycle_state = 'archived'::member_record_lifecycle_state then false
      when pot.office_scope_code <> 'council' then false
      when pot.office_code not in ('grand_knight', 'financial_secretary') then false
      when pot.service_end_year is not null and pot.service_end_year < extract(year from current_date)::int then false
      else true
    end as is_effective
  from public.person_officer_terms pot
  join public.local_units lu on lu.id = pot.local_unit_id
  join public.member_records mr
    on mr.local_unit_id = pot.local_unit_id
   and mr.legacy_people_id = pot.person_id
   and mr.archived_at is null
  join public.user_unit_relationships uur
    on uur.member_record_id = mr.id
   and uur.local_unit_id = pot.local_unit_id
   and uur.status = 'active'::relationship_status
  cross join (
    values
      ('members'::member_area_code),
      ('events'::member_area_code),
      ('custom_lists'::member_area_code),
      ('admins'::member_area_code),
      ('local_unit_settings'::member_area_code)
  ) as area_codes(area_code)
  where uur.user_id is not null

  union all

  select
    ore.id as area_access_grant_id,
    pot.local_unit_id,
    lu.display_name as local_unit_name,
    mr.id as member_record_id,
    pot.person_id,
    au.id as user_id,
    area_codes.area_code,
    'manage'::area_access_level as access_level,
    'title_default'::grant_source_code as source_code,
    coalesce(ore.created_at, pot.created_at, now()) as granted_at,
    null::timestamp with time zone as expires_at,
    null::timestamp with time zone as revoked_at,
    200 as precedence_score,
    case
      when ore.is_active is not true then false
      when ore.login_enabled is not true then false
      when mr.lifecycle_state = 'archived'::member_record_lifecycle_state then false
      when pot.office_scope_code <> 'council' then false
      when pot.office_code not in ('grand_knight', 'financial_secretary') then false
      when pot.service_end_year is not null and pot.service_end_year < extract(year from current_date)::int then false
      else true
    end as is_effective
  from public.officer_role_emails ore
  join auth.users au
    on lower(au.email) = lower(ore.email)
  join public.person_officer_terms pot
    on pot.local_unit_id = ore.local_unit_id
   and pot.office_scope_code = ore.office_scope_code
   and pot.office_code = ore.office_code
   and coalesce(pot.office_rank, -1) = coalesce(ore.office_rank, -1)
  join public.local_units lu on lu.id = pot.local_unit_id
  join public.member_records mr
    on mr.local_unit_id = pot.local_unit_id
   and mr.legacy_people_id = pot.person_id
   and mr.archived_at is null
  cross join (
    values
      ('members'::member_area_code),
      ('events'::member_area_code),
      ('custom_lists'::member_area_code),
      ('admins'::member_area_code),
      ('local_unit_settings'::member_area_code)
  ) as area_codes(area_code)
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
