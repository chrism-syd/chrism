begin;

-- Officer operational scope is now local_unit_id-native.
-- Remove the remaining nullable council_id compatibility residue from the
-- officer tables after the app, RLS policies, effective access view, and SQL
-- helpers have been cut over to local_unit_id.

drop index if exists public.person_officer_terms_council_idx;
drop index if exists public.person_officer_terms_current_lookup_idx;
drop index if exists public.officer_role_emails_active_role_key_idx;

alter table public.person_officer_terms
  drop constraint if exists person_officer_terms_council_id_fkey;

alter table public.officer_role_emails
  drop constraint if exists officer_role_emails_council_id_fkey;

alter table public.person_officer_terms
  drop column if exists council_id;

alter table public.officer_role_emails
  drop column if exists council_id;

create unique index if not exists officer_role_emails_active_local_unit_role_key_idx
  on public.officer_role_emails (
    local_unit_id,
    office_scope_code,
    office_code,
    coalesce(office_rank, -1)
  )
  where is_active = true;

create index if not exists person_officer_terms_local_unit_current_lookup_idx
  on public.person_officer_terms (
    local_unit_id,
    service_end_year,
    office_scope_code,
    office_code,
    service_start_year desc
  );

comment on table public.person_officer_terms is
  'Officer service terms scoped by local_unit_id. Knights council identity is resolved through local_units compatibility data where needed.';

comment on table public.officer_role_emails is
  'Officer role login email mapping scoped by local_unit_id.';

commit;
