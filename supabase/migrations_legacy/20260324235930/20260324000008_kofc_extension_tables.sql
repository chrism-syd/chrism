-- 1. organization_kofc_profiles

create table public.organization_kofc_profiles (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,

  council_number text not null unique,
  assembly_number text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 2. person_kofc_profiles

create table public.person_kofc_profiles (
  person_id uuid primary key
    references public.people(id) on delete cascade,

  first_degree_date date,
  second_degree_date date,
  third_degree_date date,

  years_in_service integer,

  member_type text,
  member_class text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 3. add membership_number to organization_memberships

alter table public.organization_memberships
add column if not exists membership_number text;