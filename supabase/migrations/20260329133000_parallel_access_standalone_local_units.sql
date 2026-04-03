begin;

insert into public.local_units (
  organization_family_id,
  official_name,
  display_name,
  local_unit_kind,
  status,
  visibility,
  legacy_council_id,
  legacy_organization_id,
  created_at,
  updated_at,
  created_by_auth_user_id,
  updated_by_auth_user_id
)
select
  f.id as organization_family_id,
  coalesce(nullif(btrim(o.preferred_name), ''), nullif(btrim(o.display_name), ''), 'Organization ' || left(o.id::text, 8)) as official_name,
  coalesce(nullif(btrim(o.preferred_name), ''), nullif(btrim(o.display_name), ''), 'Organization ' || left(o.id::text, 8)) as display_name,
  case
    when o.organization_type_code = 'parish' then 'parish'::public.local_unit_kind
    when o.organization_type_code in ('kofc_council', 'council') then 'council'::public.local_unit_kind
    when o.organization_type_code in ('ssvp_conference', 'conference') then 'conference'::public.local_unit_kind
    when o.organization_type_code in ('ministry', 'parish_ministry') then 'ministry'::public.local_unit_kind
    else 'other'::public.local_unit_kind
  end as local_unit_kind,
  'active'::public.local_unit_status as status,
  'private' as visibility,
  null::uuid as legacy_council_id,
  o.id as legacy_organization_id,
  now(),
  now(),
  null::uuid,
  null::uuid
from public.organizations o
join public.organization_families f
  on f.legacy_organization_id = o.id
where not exists (
  select 1
  from public.local_units lu
  where lu.legacy_organization_id = o.id
)
and (
  exists (
    select 1
    from public.organization_admin_assignments oaa
    where oaa.organization_id = o.id
      and oaa.is_active = true
  )
  or exists (
    select 1
    from public.organization_claim_requests ocr
    where ocr.organization_id = o.id
  )
);

commit;
