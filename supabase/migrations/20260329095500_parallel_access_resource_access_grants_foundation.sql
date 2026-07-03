begin;

-- Replays the resource-access foundation that early parallel-access migrations
-- assume exists. This keeps the migration chain replayable from zero.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'resource_type_code'
  ) then
    create type public.resource_type_code as enum (
      'custom_list',
      'event',
      'event_type',
      'all_events'
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
      and t.typname = 'area_access_level'
  ) then
    create type public.area_access_level as enum (
      'read_only',
      'edit_manage',
      'manage',
      'interact'
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
      and t.typname = 'grant_source_code'
  ) then
    create type public.grant_source_code as enum (
      'manual',
      'title_default',
      'invite_package',
      'legacy_backfill',
      'system'
    );
  end if;
end
$$;

create table if not exists public.resource_access_grants (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  member_record_id uuid not null references public.member_records(id) on delete cascade,
  resource_type public.resource_type_code not null,
  resource_key text not null,
  access_level public.area_access_level not null,
  source_code public.grant_source_code not null default 'manual',
  granted_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint resource_access_grants_resource_key_not_blank check (btrim(resource_key) <> '')
);

create index if not exists idx_resource_access_grants_member_scope
  on public.resource_access_grants (member_record_id, local_unit_id, resource_type)
  where revoked_at is null;

create unique index if not exists uq_resource_access_grants_active_scope
  on public.resource_access_grants (
    local_unit_id,
    member_record_id,
    resource_type,
    resource_key,
    access_level,
    source_code
  )
  where revoked_at is null;

drop trigger if exists resource_access_grants_set_updated_at on public.resource_access_grants;
create trigger resource_access_grants_set_updated_at
before update on public.resource_access_grants
for each row execute function public.set_updated_at();

commit;
