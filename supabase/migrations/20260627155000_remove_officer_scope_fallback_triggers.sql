begin;

drop trigger if exists person_officer_terms_set_local_unit_id on public.person_officer_terms;
drop function if exists public.set_person_officer_terms_local_unit_id();

drop trigger if exists officer_role_emails_set_local_unit_id on public.officer_role_emails;
drop function if exists public.set_officer_role_emails_local_unit_id();

commit;
