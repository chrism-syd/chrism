begin;

-- Replays membership claim foundations that the precedence/RLS migration
-- assumes already exist. This keeps the migration chain replayable from zero.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'membership_claim_status_code'
  ) then
    create type public.membership_claim_status_code as enum (
      'pending',
      'approved',
      'denied',
      'withdrawn',
      'expired'
    );
  end if;
end
$$;

create table if not exists public.membership_claim_requests (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete restrict,
  requester_user_id uuid null references auth.users(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  requester_phone text null,
  member_number text null,
  status_code public.membership_claim_status_code not null default 'pending',
  reviewer_notes text null,
  reviewed_by_auth_user_id uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_claim_requests_member_number_not_blank check (
    member_number is null or btrim(member_number) <> ''
  ),
  constraint membership_claim_requests_requester_email_not_blank check (
    btrim(requester_email) <> ''
  ),
  constraint membership_claim_requests_requester_name_not_blank check (
    btrim(requester_name) <> ''
  )
);

create index if not exists idx_membership_claim_requests_local_unit_status
  on public.membership_claim_requests (local_unit_id, status_code);

create index if not exists idx_membership_claim_requests_requester_user_id
  on public.membership_claim_requests (requester_user_id);

drop trigger if exists membership_claim_requests_set_updated_at on public.membership_claim_requests;
create trigger membership_claim_requests_set_updated_at
before update on public.membership_claim_requests
for each row execute function public.set_updated_at();

commit;
