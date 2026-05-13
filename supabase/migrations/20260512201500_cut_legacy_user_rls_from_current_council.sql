-- Cut legacy user/admin access RLS off app.current_council_id().
--
-- These legacy council-scoped tables do not carry local_unit_id yet, so they
-- bridge through local_units.legacy_council_id. Self-read access is preserved
-- for users and user_access_scopes.
--
-- council_id remains legacy/public/routing compatibility only.

begin;

drop policy if exists users_select_self_or_admin on public.users;
drop policy if exists users_write_admin_only on public.users;
drop policy if exists user_access_scopes_select_self_or_admin on public.user_access_scopes;
drop policy if exists user_access_scopes_write_admin_only on public.user_access_scopes;
drop policy if exists user_admin_grants_admin_only on public.user_admin_grants;

create policy users_select_self_or_manageable_local_unit
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = users.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy users_write_manageable_local_unit
on public.users
for all
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = users.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = users.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy user_access_scopes_select_self_or_manageable_local_unit
on public.user_access_scopes
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = user_access_scopes.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy user_access_scopes_write_manageable_local_unit
on public.user_access_scopes
for all
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = user_access_scopes.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = user_access_scopes.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy user_admin_grants_manageable_local_unit
on public.user_admin_grants
for all
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = user_admin_grants.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
)
with check (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = user_admin_grants.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

commit;
