begin;

create or replace function app.user_is_local_unit_admin(p_local_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with active_app_user as (
    select
      u.id,
      u.person_id,
      u.is_active,
      coalesce(u.is_super_admin, false) as is_super_admin,
      au.email
    from public.users u
    left join auth.users au
      on au.id = u.id
    where u.id = auth.uid()
      and u.is_active = true
    limit 1
  ),
  target_local_unit as (
    select
      lu.id,
      lu.legacy_organization_id,
      c.organization_id as legacy_council_organization_id
    from public.local_units lu
    left join public.councils c
      on c.id = lu.legacy_council_id
    where lu.id = p_local_unit_id
    limit 1
  ),
  target_organization as (
    select coalesce(legacy_organization_id, legacy_council_organization_id) as organization_id
    from target_local_unit
  )
  select exists (
    select 1
    from active_app_user u
    where u.is_super_admin = true
  )
  or exists (
    select 1
    from active_app_user u
    join target_organization org
      on org.organization_id is not null
    join public.organization_admin_assignments oaa
      on oaa.organization_id = org.organization_id
    where oaa.is_active = true
      and (
        oaa.user_id = u.id
        or (u.person_id is not null and oaa.person_id = u.person_id)
        or (
          u.email is not null
          and nullif(btrim(coalesce(oaa.grantee_email, '')), '') is not null
          and lower(oaa.grantee_email) = lower(u.email)
        )
      )
  )
  or exists (
    select 1
    from active_app_user u
    join public.person_officer_terms pot
      on pot.person_id = u.person_id
    where pot.local_unit_id = p_local_unit_id
      and pot.office_scope_code = 'council'
      and pot.office_code in ('grand_knight', 'financial_secretary')
      and (
        pot.service_end_year is null
        or pot.service_end_year >= extract(year from current_date)::int
      )
  );
$$;

comment on function app.user_is_local_unit_admin(uuid) is
  'Returns true when the signed-in user can administer the local unit through super admin status, organization admin assignment, or a current automatic officer role.';

create or replace function app.user_is_council_admin(p_council_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select app.user_is_local_unit_admin(lu.id)
      from public.local_units lu
      where lu.legacy_council_id = p_council_id
      order by lu.created_at asc
      limit 1
    ),
    false
  );
$$;

comment on function app.user_is_council_admin(uuid) is
  'Compatibility wrapper. Prefer app.user_is_local_unit_admin(uuid); this resolves the council to its local unit and evaluates local-unit-native admin access.';

commit;
