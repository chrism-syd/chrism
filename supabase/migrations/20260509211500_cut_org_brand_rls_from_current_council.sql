-- Cut council/org/brand read policies off app.current_council_id().
--
-- These are read-only routing/branding policies. local_units bridges legacy
-- public council/org identifiers to the local-unit operational access model.
--
-- council_id remains public/routing compatibility. Access is checked through
-- effective local-unit access instead of the legacy current-council helper.

begin;

drop policy if exists councils_select_own on public.councils;
drop policy if exists organizations_select_own_council on public.organizations;
drop policy if exists brand_profiles_select_linked_to_own_council on public.brand_profiles;

create policy councils_select_accessible_local_unit
on public.councils
for select
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = councils.id
      and access.user_id = auth.uid()
      and access.is_effective = true
  )
);

create policy organizations_select_accessible_local_unit
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_organization_id = organizations.id
      and access.user_id = auth.uid()
      and access.is_effective = true
  )
);

create policy brand_profiles_select_accessible_local_unit
on public.brand_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    join public.local_units lu
      on lu.legacy_organization_id = o.id
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where o.brand_profile_id = brand_profiles.id
      and access.user_id = auth.uid()
      and access.is_effective = true
  )
);

commit;
