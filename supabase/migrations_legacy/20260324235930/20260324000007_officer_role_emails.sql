create table if not exists public.officer_role_emails (
  id uuid primary key default gen_random_uuid(),
  council_id uuid not null references public.councils(id) on delete cascade,
  office_scope_code text not null,
  office_code text not null,
  office_rank integer,
  email text not null,
  login_enabled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid,
  updated_by_auth_user_id uuid
);

create unique index if not exists officer_role_emails_active_role_key_idx
  on public.officer_role_emails (
    council_id,
    office_scope_code,
    office_code,
    coalesce(office_rank, -1)
  )
  where is_active = true;

create unique index if not exists officer_role_emails_active_email_idx
  on public.officer_role_emails (lower(email))
  where is_active = true and login_enabled = true;

create index if not exists officer_role_emails_email_lookup_idx
  on public.officer_role_emails (lower(email));
