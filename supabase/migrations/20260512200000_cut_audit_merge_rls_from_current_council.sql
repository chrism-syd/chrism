-- Cut audit_log and person_merges RLS off app.current_council_id().
--
-- These legacy council-scoped tables do not carry local_unit_id yet, so they
-- bridge through local_units.legacy_council_id. Operational authorization is
-- checked through effective local-unit members/manage access.
--
-- council_id remains legacy/public/routing compatibility only.

begin;

drop policy if exists audit_log_admin_only on public.audit_log;
drop policy if exists person_merges_admin_only on public.person_merges;

create policy audit_log_select_manageable_local_unit
on public.audit_log
for select
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = audit_log.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

create policy person_merges_manageable_local_unit
on public.person_merges
for all
to authenticated
using (
  exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access access
      on access.local_unit_id = lu.id
    where lu.legacy_council_id = person_merges.council_id
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
    join public.people source_person
      on source_person.id = person_merges.source_person_id
    join public.people target_person
      on target_person.id = person_merges.target_person_id
    where lu.legacy_council_id = person_merges.council_id
      and source_person.council_id = person_merges.council_id
      and target_person.council_id = person_merges.council_id
      and access.user_id = auth.uid()
      and access.is_effective = true
      and access.area_code = 'members'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
  )
);

commit;
