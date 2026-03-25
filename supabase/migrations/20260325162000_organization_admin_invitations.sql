create table if not exists public.organization_admin_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  council_id uuid references public.councils(id) on delete set null,
  invited_by_auth_user_id uuid references auth.users(id) on delete set null,
  invitee_email text not null,
  invitee_name text,
  status_code text not null default 'pending' check (status_code in ('pending', 'accepted', 'revoked', 'expired')),
  notes text,
  selector text not null unique,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by_auth_user_id uuid references auth.users(id) on delete set null,
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
  on public.organization_admin_invitations (invitee_email, status_code, created_at desc);

create trigger set_organization_admin_invitations_updated_at
before update on public.organization_admin_invitations
for each row execute function public.set_updated_at();
