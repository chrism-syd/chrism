begin;

-- Replays the user/local-unit relationship foundation that early
-- parallel-access migrations assume exists. This keeps the migration chain
-- replayable from zero.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'relationship_kind'
  ) then
    create type public.relationship_kind as enum (
      'linked_member_record',
      'parish_self_claim'
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
      and t.typname = 'relationship_status'
  ) then
    create type public.relationship_status as enum (
      'active',
      'inactive'
    );
  end if;
end
$$;

create table if not exists public.user_unit_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_unit_id uuid not null references public.local_units(id) on delete restrict,
  relationship_kind public.relationship_kind not null,
  status public.relationship_status not null default 'active',
  member_record_id uuid null references public.member_records(id) on delete set null,
  is_primary_parish boolean not null default false,
  activated_at timestamptz null,
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint user_unit_relationships_member_record_required_for_link check (
    (
      relationship_kind = 'linked_member_record'::public.relationship_kind
      and member_record_id is not null
    )
    or relationship_kind = 'parish_self_claim'::public.relationship_kind
  )
);

comment on table public.user_unit_relationships is
  'Includes legacy linked-member relationships. Active links to archived member_records should be treated as stale residue and cleaned up for org-admin-only subjects.';

create index if not exists idx_user_unit_relationships_local_unit_id
  on public.user_unit_relationships (local_unit_id);

create index if not exists idx_user_unit_relationships_member_record_id
  on public.user_unit_relationships (member_record_id);

create unique index if not exists uq_user_unit_relationships_active_member_record
  on public.user_unit_relationships (member_record_id)
  where member_record_id is not null
    and status = 'active'::public.relationship_status;

create unique index if not exists uq_user_unit_relationships_active_user_local_unit
  on public.user_unit_relationships (user_id, local_unit_id)
  where status = 'active'::public.relationship_status;

create unique index if not exists uq_user_unit_relationships_primary_parish
  on public.user_unit_relationships (user_id)
  where is_primary_parish = true
    and status = 'active'::public.relationship_status;

drop trigger if exists user_unit_relationships_set_updated_at on public.user_unit_relationships;
create trigger user_unit_relationships_set_updated_at
before update on public.user_unit_relationships
for each row execute function public.set_updated_at();

commit;
