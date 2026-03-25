begin;

-- Step 8: remove legacy Knights-specific fields from public.people now that
-- the importer writes to organization_memberships, person_kofc_profiles,
-- and organization_kofc_profiles.
--
-- Intentionally keep public.people.birth_date because it is still a shared,
-- core person field.
--
-- Intentionally leave public.organization_memberships.member_number in place
-- for now so older compatibility paths do not break during rollout.

drop index if exists public.people_member_number_hash_idx;

alter table public.people
  drop column if exists member_number_hash,
  drop column if exists member_number,
  drop column if exists supreme_member_type,
  drop column if exists supreme_member_class,
  drop column if exists assembly_number,
  drop column if exists first_degree_date,
  drop column if exists second_degree_date,
  drop column if exists third_degree_date,
  drop column if exists reentry_date,
  drop column if exists years_of_service,
  drop column if exists mail_returned_flag,
  drop column if exists supreme_exempt_flag;

commit;
