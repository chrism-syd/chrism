create table if not exists public.custom_lists (
  id uuid primary key default gen_random_uuid(),
  council_id uuid not null references public.councils(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid references public.users(id),
  updated_by_auth_user_id uuid references public.users(id),
  archived_at timestamptz,
  archived_by_auth_user_id uuid references public.users(id)
);

create index if not exists custom_lists_council_active_idx
  on public.custom_lists (council_id, archived_at, updated_at desc);

create table if not exists public.custom_list_members (
  id uuid primary key default gen_random_uuid(),
  custom_list_id uuid not null references public.custom_lists(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by_auth_user_id uuid references public.users(id),
  claimed_by_person_id uuid references public.people(id) on delete set null,
  claimed_at timestamptz,
  last_contact_at timestamptz,
  last_contact_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_list_members_unique_person unique (custom_list_id, person_id)
);

create index if not exists custom_list_members_list_idx
  on public.custom_list_members (custom_list_id, person_id);

create index if not exists custom_list_members_claimed_idx
  on public.custom_list_members (custom_list_id, claimed_by_person_id, claimed_at desc);

create table if not exists public.custom_list_access (
  id uuid primary key default gen_random_uuid(),
  custom_list_id uuid not null references public.custom_lists(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  grantee_email text,
  granted_at timestamptz not null default now(),
  granted_by_auth_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_list_access_one_target check (
    person_id is not null or user_id is not null or grantee_email is not null
  ),
  constraint custom_list_access_person_unique unique (custom_list_id, person_id),
  constraint custom_list_access_user_unique unique (custom_list_id, user_id),
  constraint custom_list_access_email_unique unique (custom_list_id, grantee_email)
);

create index if not exists custom_list_access_list_idx
  on public.custom_list_access (custom_list_id, granted_at desc);

create index if not exists custom_list_access_person_idx
  on public.custom_list_access (person_id);

create index if not exists custom_list_access_user_idx
  on public.custom_list_access (user_id);

create index if not exists custom_list_access_email_idx
  on public.custom_list_access (grantee_email);

grant usage on schema public to service_role;
grant select, insert, update, delete on public.custom_lists to service_role;
grant select, insert, update, delete on public.custom_list_members to service_role;
grant select, insert, update, delete on public.custom_list_access to service_role;
