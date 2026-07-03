begin;

-- Replays the area-access foundation that early parallel-access migrations
-- assume exists. This keeps the migration chain replayable from zero.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'member_area_code'
  ) then
    create type public.member_area_code as enum (
      'members',
      'events',
      'custom_lists',
      'claims',
      'admins',
      'local_unit_settings'
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

create table if not exists public.area_access_grants (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  member_record_id uuid not null references public.member_records(id) on delete cascade,
  area_code public.member_area_code not null,
  access_level public.area_access_level not null,
  source_code public.grant_source_code not null default 'manual',
  granted_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null
);

create index if not exists idx_area_access_grants_member_scope
  on public.area_access_grants (member_record_id, local_unit_id, area_code)
  where revoked_at is null;

create unique index if not exists uq_area_access_grants_active_scope
  on public.area_access_grants (
    local_unit_id,
    member_record_id,
    area_code,
    access_level,
    source_code
  )
  where revoked_at is null;

drop trigger if exists area_access_grants_set_updated_at on public.area_access_grants;
create trigger area_access_grants_set_updated_at
before update on public.area_access_grants
for each row execute function public.set_updated_at();

create or replace view public.v_effective_area_access as
select
  aag.id as area_access_grant_id,
  aag.local_unit_id,
  lu.display_name as local_unit_name,
  aag.member_record_id,
  mr.legacy_people_id as person_id,
  uur.user_id,
  aag.area_code,
  aag.access_level,
  aag.source_code,
  aag.granted_at,
  aag.expires_at,
  aag.revoked_at,
  case
    when aag.revoked_at is not null then false
    when aag.expires_at is not null and aag.expires_at < now() then false
    when mr.lifecycle_state = 'archived'::public.member_record_lifecycle_state then false
    else true
  end as is_effective
from public.area_access_grants aag
join public.local_units lu on lu.id = aag.local_unit_id
join public.member_records mr on mr.id = aag.member_record_id
left join public.user_unit_relationships uur
  on uur.member_record_id = mr.id
 and uur.local_unit_id = aag.local_unit_id
 and uur.status = 'active'::public.relationship_status;

create or replace function public.has_area_access(
  p_user_id uuid,
  p_local_unit_id uuid,
  p_area_code public.member_area_code,
  p_min_access_level public.area_access_level
)
returns boolean
language sql
stable
set search_path to public, app, pg_temp
as $$
  select exists (
    select 1
    from public.v_effective_area_access v
    where v.user_id = p_user_id
      and v.local_unit_id = p_local_unit_id
      and v.area_code = p_area_code
      and v.is_effective = true
      and (
        v.access_level = p_min_access_level
        or p_min_access_level = 'read_only'
        or (
          p_min_access_level = 'edit_manage'
          and v.access_level in ('edit_manage', 'manage')
        )
        or (
          p_min_access_level = 'manage'
          and v.access_level = 'manage'
        )
        or (
          p_min_access_level = 'interact'
          and v.access_level in ('interact', 'edit_manage', 'manage')
        )
      )
  );
$$;

create or replace function public.auth_has_area_access(
  p_local_unit_id uuid,
  p_area_code public.member_area_code,
  p_min_access_level public.area_access_level
)
returns boolean
language sql
stable
set search_path to public, app, pg_temp
as $$
  select coalesce(auth.uid() is not null, false)
    and public.has_area_access(
      auth.uid(),
      p_local_unit_id,
      p_area_code,
      p_min_access_level
    );
$$;

commit;
