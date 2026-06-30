begin;

drop index if exists public.officer_role_emails_active_role_key_idx;

create unique index if not exists officer_role_emails_active_local_unit_role_key_idx
  on public.officer_role_emails (
    local_unit_id,
    office_scope_code,
    office_code,
    coalesce(office_rank, -1)
  )
  where is_active = true;

create index if not exists officer_role_emails_local_unit_email_lookup_idx
  on public.officer_role_emails (local_unit_id, lower(email))
  where is_active = true and login_enabled = true;

commit;
