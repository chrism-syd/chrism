begin;

comment on table public.council_admin_assignments is
  'Legacy council-scoped admin grants retained for compatibility. Active rows are mirrored into organization_admin_assignments, which is the canonical admin relationship source.';

create or replace function public.sync_organization_admin_assignment_from_council_admin_assignment(
  p_council_assignment_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.council_admin_assignments%rowtype;
  v_organization_id uuid;
  v_existing_id uuid;
  v_normalized_email text;
begin
  select *
    into v_assignment
  from public.council_admin_assignments
  where id = p_council_assignment_id
  limit 1;

  if not found or coalesce(v_assignment.is_active, false) = false then
    return;
  end if;

  select organization_id
    into v_organization_id
  from public.councils
  where id = v_assignment.council_id
  limit 1;

  if v_organization_id is null then
    return;
  end if;

  v_normalized_email := nullif(lower(btrim(coalesce(v_assignment.grantee_email, ''))), '');

  if v_assignment.person_id is not null then
    select id
      into v_existing_id
    from public.organization_admin_assignments
    where organization_id = v_organization_id
      and is_active = true
      and person_id = v_assignment.person_id
    limit 1;
  end if;

  if v_existing_id is null and v_assignment.user_id is not null then
    select id
      into v_existing_id
    from public.organization_admin_assignments
    where organization_id = v_organization_id
      and is_active = true
      and user_id = v_assignment.user_id
    limit 1;
  end if;

  if v_existing_id is null and v_normalized_email is not null then
    select id
      into v_existing_id
    from public.organization_admin_assignments
    where organization_id = v_organization_id
      and is_active = true
      and nullif(lower(btrim(coalesce(grantee_email, ''))), '') = v_normalized_email
    limit 1;
  end if;

  if v_existing_id is not null then
    update public.organization_admin_assignments
    set
      person_id = coalesce(public.organization_admin_assignments.person_id, v_assignment.person_id),
      user_id = coalesce(public.organization_admin_assignments.user_id, v_assignment.user_id),
      grantee_email = coalesce(nullif(btrim(public.organization_admin_assignments.grantee_email), ''), v_normalized_email),
      is_active = true,
      updated_at = now(),
      updated_by_user_id = coalesce(v_assignment.updated_by_user_id, public.organization_admin_assignments.updated_by_user_id)
    where id = v_existing_id;
  else
    insert into public.organization_admin_assignments (
      organization_id,
      person_id,
      user_id,
      grantee_email,
      is_active,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    values (
      v_organization_id,
      v_assignment.person_id,
      v_assignment.user_id,
      v_normalized_email,
      true,
      coalesce(v_assignment.created_at, now()),
      now(),
      v_assignment.created_by_user_id,
      coalesce(v_assignment.updated_by_user_id, v_assignment.created_by_user_id)
    );
  end if;
end;
$$;

comment on function public.sync_organization_admin_assignment_from_council_admin_assignment(uuid) is
  'Mirrors one active legacy council_admin_assignments row into organization_admin_assignments so organization-scoped admin access remains canonical.';

create or replace function public.trg_sync_org_admin_from_council_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_organization_admin_assignment_from_council_admin_assignment(new.id);
  return new;
end;
$$;

drop trigger if exists council_admin_assignments_sync_org_admin on public.council_admin_assignments;

create trigger council_admin_assignments_sync_org_admin
after insert or update on public.council_admin_assignments
for each row
execute function public.trg_sync_org_admin_from_council_admin_assignment();

do $$
declare
  v_assignment record;
begin
  for v_assignment in
    select id
    from public.council_admin_assignments
    where is_active = true
  loop
    perform public.sync_organization_admin_assignment_from_council_admin_assignment(v_assignment.id);
  end loop;
end;
$$;

create or replace function app.user_is_council_admin(p_council_id uuid)
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
      u.council_id,
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
  target_council as (
    select c.id, c.organization_id
    from public.councils c
    where c.id = p_council_id
    limit 1
  )
  select exists (
    select 1
    from active_app_user u
    where u.is_super_admin = true
  )
  or exists (
    select 1
    from active_app_user u
    join target_council tc
      on true
    join public.organization_admin_assignments oaa
      on oaa.organization_id = tc.organization_id
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
    where pot.council_id = p_council_id
      and pot.office_scope_code = 'council'
      and pot.office_code in ('grand_knight', 'financial_secretary')
      and (
        pot.service_end_year is null
        or pot.service_end_year >= extract(year from current_date)::int
      )
  );
$$;

comment on function app.user_is_council_admin(uuid) is
  'Returns true when the signed-in user is a super admin, has an active organization admin assignment for the council''s organization, or currently holds an automatic council-admin officer term.';

commit;
