begin;

create table if not exists public.public_registration_intakes (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  normalized_email text not null,
  phone text,
  consent_version text not null,
  consent_text text not null,
  consent_accepted_at timestamptz not null default now(),
  email_verification_status text not null default 'pending',
  matched_person_id uuid references public.people(id) on delete set null,
  matched_at timestamptz,
  admin_review_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_registration_intakes_email_verification_status_check check (
    email_verification_status in ('pending', 'verified')
  ),
  constraint public_registration_intakes_admin_review_status_check check (
    admin_review_status in ('pending', 'matched', 'needs_review', 'dismissed')
  )
);

create unique index if not exists public_registration_intakes_normalized_email_key
  on public.public_registration_intakes (normalized_email);

create index if not exists public_registration_intakes_matched_person_id_idx
  on public.public_registration_intakes (matched_person_id);

alter table public.public_registration_intakes enable row level security;

revoke all on table public.public_registration_intakes from anon, authenticated;

grant all on table public.public_registration_intakes to service_role;

comment on table public.public_registration_intakes is
  'Public registration intake records collected before email verification and admin/member matching. Written only through server-side service role actions.';

comment on column public.public_registration_intakes.consent_text is
  'Exact registration consent text accepted by the registrant at submission time.';

commit;
