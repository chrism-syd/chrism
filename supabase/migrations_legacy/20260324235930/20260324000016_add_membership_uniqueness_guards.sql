begin;

do $$
begin
  if exists (
    select 1
    from public.organization_memberships
    group by organization_id, person_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add membership uniqueness guards: duplicate organization_memberships rows already exist for the same organization/person.';
  end if;

  if exists (
    select 1
    from public.organization_memberships
    where membership_number is not null
    group by organization_id, membership_number
    having count(*) > 1
  ) then
    raise exception 'Cannot add membership uniqueness guards: duplicate membership_number values already exist within the same organization.';
  end if;

  if exists (
    select 1
    from public.organization_memberships
    where is_primary_membership is true
    group by organization_id, person_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add primary-membership guard: multiple primary memberships already exist for the same organization/person.';
  end if;
end
$$;

create unique index if not exists organization_memberships_org_person_uidx
  on public.organization_memberships (organization_id, person_id);

create unique index if not exists organization_memberships_org_membership_number_uidx
  on public.organization_memberships (organization_id, membership_number)
  where membership_number is not null;

create unique index if not exists organization_memberships_org_person_primary_uidx
  on public.organization_memberships (organization_id, person_id)
  where is_primary_membership is true;

comment on index public.organization_memberships_org_person_uidx is
  'Prevents duplicate membership rows for the same organization/person pair.';

comment on index public.organization_memberships_org_membership_number_uidx is
  'Prevents the same membership number from being assigned to multiple people within one organization.';

comment on index public.organization_memberships_org_person_primary_uidx is
  'Belt-and-suspenders guard so a person cannot have multiple primary memberships within the same organization.';

commit;
