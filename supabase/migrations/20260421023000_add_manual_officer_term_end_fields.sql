begin;

alter table public.person_officer_terms
  add column if not exists manual_end_effective_date date,
  add column if not exists ended_by_auth_user_id uuid,
  add column if not exists end_reason text;

create index if not exists person_officer_terms_manual_end_effective_date_idx
  on public.person_officer_terms (manual_end_effective_date);

alter table public.person_officer_terms
  add constraint person_officer_terms_ended_by_auth_user_id_fkey
  foreign key (ended_by_auth_user_id) references auth.users(id)
  on delete set null
  not valid;

alter table public.person_officer_terms
  validate constraint person_officer_terms_ended_by_auth_user_id_fkey;

commit;
