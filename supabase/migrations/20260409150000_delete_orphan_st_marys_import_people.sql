begin;

delete from public.people p
where p.id in (
  'd7a2f818-3ed2-4229-a6a9-1979f6df0f60',
  'f7a317aa-218d-4d07-a8b9-e0196d9d0fdb',
  '5cb23156-7832-43d1-9449-b8b73a7089a7'
)
  and p.created_source_code = 'supreme_import'
  and not exists (
    select 1 from public.organization_memberships om
    where om.person_id = p.id
  )
  and not exists (
    select 1 from public.member_records mr
    where mr.legacy_people_id = p.id
  )
  and not exists (
    select 1 from public.official_member_records omr
    where omr.person_id = p.id
  )
  and not exists (
    select 1 from public.users u
    where u.person_id = p.id
  )
  and not exists (
    select 1 from public.organization_admin_assignments oaa
    where oaa.person_id = p.id
  )
  and not exists (
    select 1 from public.council_admin_assignments caa
    where caa.person_id = p.id
  )
  and not exists (
    select 1 from public.person_officer_terms pot
    where pot.person_id = p.id
  );

commit;