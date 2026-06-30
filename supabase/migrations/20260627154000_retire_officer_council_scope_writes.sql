begin;

update public.person_officer_terms term
set local_unit_id = unit.id
from public.local_units unit
where term.local_unit_id is null
  and term.council_id = unit.legacy_council_id;

update public.officer_role_emails email
set local_unit_id = unit.id
from public.local_units unit
where email.local_unit_id is null
  and email.council_id = unit.legacy_council_id;

alter table public.person_officer_terms
  alter column local_unit_id set not null;

alter table public.officer_role_emails
  alter column local_unit_id set not null;

alter table public.person_officer_terms
  alter column council_id drop not null;

alter table public.officer_role_emails
  alter column council_id drop not null;

commit;
