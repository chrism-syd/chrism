begin;

-- Replays the local-unit foundation that was previously assumed to exist
-- before the parallel access migrations. This makes supabase db reset able
-- to build the schema from zero without manual setup.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'local_unit_kind'
  ) then
    create type public.local_unit_kind as enum (
      'parish',
      'council',
      'conference',
      'ministry',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'local_unit_status'
  ) then
    create type public.local_unit_status as enum (
      'active',
      'inactive',
      'archived'
    );
  end if;
end
$$;

create table if not exists public.organization_families (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  terminology_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  legacy_organization_id uuid null references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint organization_families_code_not_blank check (btrim(code) <> ''),
  constraint organization_families_display_name_not_blank check (btrim(display_name) <> '')
);

alter table public.organization_families
  add constraint organization_families_code_key unique (code);

create table if not exists public.local_units (
  id uuid primary key default gen_random_uuid(),
  organization_family_id uuid not null references public.organization_families(id) on delete restrict,
  official_name text not null,
  display_name text not null,
  local_unit_kind public.local_unit_kind not null,
  status public.local_unit_status not null default 'active',
  visibility text not null default 'private',
  timezone text null,
  city text null,
  province_state text null,
  postal_code text null,
  country_code text null,
  legacy_council_id uuid null references public.councils(id) on delete set null,
  legacy_organization_id uuid null references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint local_units_official_name_not_blank check (btrim(official_name) <> ''),
  constraint local_units_display_name_not_blank check (btrim(display_name) <> ''),
  constraint local_units_visibility_not_blank check (btrim(visibility) <> '')
);

create index if not exists idx_organization_families_legacy_organization_id
  on public.organization_families (legacy_organization_id);

create index if not exists idx_local_units_organization_family_id
  on public.local_units (organization_family_id);

create index if not exists idx_local_units_kind
  on public.local_units (local_unit_kind);

create index if not exists idx_local_units_status
  on public.local_units (status);

create index if not exists idx_local_units_legacy_council_id
  on public.local_units (legacy_council_id);

create index if not exists idx_local_units_legacy_organization_id
  on public.local_units (legacy_organization_id);

drop trigger if exists organization_families_set_updated_at on public.organization_families;
create trigger organization_families_set_updated_at
before update on public.organization_families
for each row execute function public.set_updated_at();

drop trigger if exists local_units_set_updated_at on public.local_units;
create trigger local_units_set_updated_at
before update on public.local_units
for each row execute function public.set_updated_at();

commit;
