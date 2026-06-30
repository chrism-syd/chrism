begin;

drop index if exists public.officer_role_emails_active_role_key_idx;
drop index if exists public.person_officer_terms_council_idx;
drop index if exists public.person_officer_terms_current_lookup_idx;
drop index if exists public.person_officer_terms_council_person_idx;
drop index if exists public.person_officer_terms_council_id_idx;

alter table public.person_officer_terms
  drop column if exists council_id cascade;

alter table public.officer_role_emails
  drop column if exists council_id cascade;

commit;
