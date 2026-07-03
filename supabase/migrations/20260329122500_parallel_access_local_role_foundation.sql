begin;

-- Replays local role foundations that the precedence/RLS migration assumes
-- already exist. This keeps the migration chain replayable from zero.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'role_kind'
  ) then
    create type public.role_kind as enum (
      'officer',
      'service'
    );
  end if;
end
$$;

create table if not exists public.local_role_definitions (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  role_kind public.role_kind not null,
  code text null,
  label text not null,
  precedence integer not null default 100,
  is_single_seat boolean not null default false,
  is_active boolean not null default true,
  source_template_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint local_role_definitions_code_not_blank check (
    code is null or btrim(code) <> ''
  ),
  constraint local_role_definitions_label_not_blank check (
    btrim(label) <> ''
  )
);

create index if not exists idx_local_role_definitions_local_unit_kind_active
  on public.local_role_definitions (local_unit_id, role_kind, is_active);

create unique index if not exists uq_local_role_definitions_code_per_unit
  on public.local_role_definitions (local_unit_id, role_kind, lower(code))
  where code is not null;

drop trigger if exists local_role_definitions_set_updated_at on public.local_role_definitions;
create trigger local_role_definitions_set_updated_at
before update on public.local_role_definitions
for each row execute function public.set_updated_at();

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  member_record_id uuid not null references public.member_records(id) on delete cascade,
  local_role_definition_id uuid not null references public.local_role_definitions(id) on delete restrict,
  start_year integer null,
  end_year integer null,
  active_override boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint role_assignments_year_order check (
    start_year is null
    or end_year is null
    or end_year >= start_year
  )
);

create index if not exists idx_role_assignments_local_role_definition_id
  on public.role_assignments (local_role_definition_id);

create index if not exists idx_role_assignments_member_record_id
  on public.role_assignments (member_record_id);

drop trigger if exists role_assignments_set_updated_at on public.role_assignments;
create trigger role_assignments_set_updated_at
before update on public.role_assignments
for each row execute function public.set_updated_at();

commit;
