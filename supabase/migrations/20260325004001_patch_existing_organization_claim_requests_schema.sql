begin;

-- Patch older organization_claim_requests shape forward to the newer lookup/public-entry model.
-- Safe to run even if some of these changes already exist.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'claimant_user_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'requested_by_auth_user_id'
  ) then
    execute 'alter table public.organization_claim_requests rename column claimant_user_id to requested_by_auth_user_id';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'claimant_person_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'requested_by_person_id'
  ) then
    execute 'alter table public.organization_claim_requests rename column claimant_person_id to requested_by_person_id';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'claimant_email'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'requester_email'
  ) then
    execute 'alter table public.organization_claim_requests rename column claimant_email to requester_email';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'claimant_phone'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'requester_phone'
  ) then
    execute 'alter table public.organization_claim_requests rename column claimant_phone to requester_phone';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'claimant_notes'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'request_notes'
  ) then
    execute 'alter table public.organization_claim_requests rename column claimant_notes to request_notes';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'reviewed_by_user_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_claim_requests'
      and column_name = 'reviewed_by_auth_user_id'
  ) then
    execute 'alter table public.organization_claim_requests rename column reviewed_by_user_id to reviewed_by_auth_user_id';
  end if;
end $$;

alter table public.organization_claim_requests
  alter column organization_id drop not null,
  alter column requested_by_auth_user_id drop not null;

alter table public.organization_claim_requests
  add column if not exists requester_name text,
  add column if not exists requested_council_number text,
  add column if not exists requested_council_name text,
  add column if not exists requested_city text,
  add column if not exists initiated_via_code text not null default 'signed_in_member';

update public.organization_claim_requests
set requester_name = coalesce(
  nullif(claimant_preferred_name, ''),
  nullif(claimant_official_name, ''),
  nullif(requester_email, ''),
  'Requester'
)
where requester_name is null;

comment on column public.organization_claim_requests.requester_name is
  'Display name snapshot captured when the claim was submitted.';

comment on column public.organization_claim_requests.initiated_via_code is
  'Entry point used to submit the claim request, such as signed_in_member or public_request.';

comment on column public.organization_claim_requests.status_code is
  'Claim workflow status. Expected values are pending, approved, rejected, or cancelled.';

drop index if exists public.organization_claim_requests_pending_user_uidx;
drop index if exists public.organization_claim_requests_status_requested_idx;
drop index if exists public.organization_claim_requests_org_requested_idx;

create unique index if not exists organization_claim_requests_pending_org_user_uidx
  on public.organization_claim_requests (organization_id, requested_by_auth_user_id)
  where status_code = 'pending'
    and requested_by_auth_user_id is not null
    and organization_id is not null;

create index if not exists organization_claim_requests_status_created_idx
  on public.organization_claim_requests (status_code, created_at desc);

create index if not exists organization_claim_requests_org_idx
  on public.organization_claim_requests (organization_id);

create index if not exists organization_claim_requests_council_idx
  on public.organization_claim_requests (council_id);

commit;
