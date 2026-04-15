begin;

create table if not exists public.person_identities (
  id uuid primary key default gen_random_uuid(),
  primary_user_id uuid null references public.users(id) on delete set null,
  display_name text null,
  normalized_email_hash text null,
  normalized_phone_hash text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null
);

create index if not exists person_identities_primary_user_id_idx
  on public.person_identities (primary_user_id);

create index if not exists person_identities_email_hash_idx
  on public.person_identities (normalized_email_hash);

create index if not exists person_identities_phone_hash_idx
  on public.person_identities (normalized_phone_hash);

drop trigger if exists person_identities_set_updated_at on public.person_identities;
create trigger person_identities_set_updated_at
before update on public.person_identities
for each row
execute function public.set_updated_at();

create table if not exists public.person_identity_links (
  id uuid primary key default gen_random_uuid(),
  person_identity_id uuid not null references public.person_identities(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  link_source text not null default 'manual',
  confidence_code text not null default 'confirmed',
  linked_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null
);

create index if not exists person_identity_links_identity_id_idx
  on public.person_identity_links (person_identity_id);

create index if not exists person_identity_links_person_id_idx
  on public.person_identity_links (person_id);

create unique index if not exists person_identity_links_active_person_unique_idx
  on public.person_identity_links (person_id)
  where ended_at is null;

drop trigger if exists person_identity_links_set_updated_at on public.person_identity_links;
create trigger person_identity_links_set_updated_at
before update on public.person_identity_links
for each row
execute function public.set_updated_at();

commit;