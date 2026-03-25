begin;

create table if not exists public.organization_claim_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  council_id uuid references public.councils(id) on delete set null,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  claimant_person_id uuid references public.people(id) on delete set null,
  claimant_email text,
  claimant_official_name text,
  claimant_preferred_name text,
  claimant_phone text,
  claimant_notes text,
  status_code text not null default 'pending',
  review_notes text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  approved_assignment_id uuid references public.organization_admin_assignments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  constraint organization_claim_requests_status_code_check
    check (status_code in ('pending', 'approved', 'rejected', 'cancelled'))
);

comment on table public.organization_claim_requests is
  'Pending and reviewed organization admin claim requests awaiting manual verification.';

comment on column public.organization_claim_requests.claimant_official_name is
  'Snapshot of the official name on file when the claim was submitted.';

comment on column public.organization_claim_requests.claimant_preferred_name is
  'Snapshot of the preferred display name when the claim was submitted.';

comment on column public.organization_claim_requests.review_notes is
  'Manual verification notes captured during super-admin review.';

create unique index if not exists organization_claim_requests_pending_user_uidx
  on public.organization_claim_requests (organization_id, claimant_user_id)
  where status_code = 'pending';

create index if not exists organization_claim_requests_status_requested_idx
  on public.organization_claim_requests (status_code, requested_at desc);

create index if not exists organization_claim_requests_org_requested_idx
  on public.organization_claim_requests (organization_id, requested_at desc);

alter table public.organization_admin_assignments
  add column if not exists source_code text not null default 'manual_assignment',
  add column if not exists organization_claim_request_id uuid references public.organization_claim_requests(id) on delete set null,
  add column if not exists grant_notes text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists revoked_notes text;

update public.organization_admin_assignments
set source_code = 'manual_assignment'
where source_code is distinct from 'manual_assignment'
  and organization_claim_request_id is null;

alter table public.organization_admin_assignments
  drop constraint if exists organization_admin_assignments_source_code_check;

alter table public.organization_admin_assignments
  add constraint organization_admin_assignments_source_code_check
  check (source_code in ('manual_assignment', 'approved_claim'));

comment on column public.organization_admin_assignments.source_code is
  'How this admin grant was created: manual assignment or approved claim.';

comment on column public.organization_admin_assignments.organization_claim_request_id is
  'Claim request that produced this admin grant, when source_code = approved_claim.';

comment on column public.organization_admin_assignments.grant_notes is
  'Optional onboarding or handoff notes kept with this admin grant.';

comment on column public.organization_admin_assignments.revoked_at is
  'Timestamp when this admin grant was manually revoked.';

comment on column public.organization_admin_assignments.revoked_notes is
  'Optional notes recorded when this admin grant was manually revoked.';

commit;
