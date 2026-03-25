begin;

create table if not exists public.organization_admin_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  council_id uuid references public.councils(id) on delete set null,
  invited_by_auth_user_id uuid references auth.users(id) on delete set null,
  invitee_email text not null,
  invitee_name text,
  status_code text not null default 'pending'
    check (status_code in ('pending', 'accepted', 'revoked', 'expired')),
  notes text,
  selector text not null unique,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by_auth_user_id uuid references auth.users(id) on delete set null,
  accepted_assignment_id uuid references public.organization_admin_assignments(id) on delete set null,
  accepted_at timestamptz,
  revoked_by_auth_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists organization_admin_invitations_org_status_idx
  on public.organization_admin_invitations (organization_id, status_code, created_at desc);

create index if not exists organization_admin_invitations_email_status_idx
  on public.organization_admin_invitations (lower(invitee_email), status_code, created_at desc);

create unique index if not exists organization_admin_invitations_one_pending_per_email_uidx
  on public.organization_admin_invitations (organization_id, lower(invitee_email))
  where status_code = 'pending';

drop trigger if exists set_organization_admin_invitations_updated_at on public.organization_admin_invitations;
create trigger set_organization_admin_invitations_updated_at
before update on public.organization_admin_invitations
for each row execute function public.set_updated_at();

alter table public.organization_admin_assignments
  drop constraint if exists organization_admin_assignments_source_code_check;

alter table public.organization_admin_assignments
  add constraint organization_admin_assignments_source_code_check
  check (source_code in ('manual_assignment', 'approved_claim', 'admin_invitation'));

comment on table public.organization_admin_invitations is
  'Secure invitation records for intentional organization-admin onboarding.';

comment on column public.organization_admin_assignments.source_code is
  'How this admin grant was created: manual assignment, approved claim, or accepted admin invitation.';

commit;
