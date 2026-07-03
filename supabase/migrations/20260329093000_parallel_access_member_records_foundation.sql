begin;

-- Replays the member-record foundation that later parallel-access migrations
-- assume exists. This keeps the migration chain replayable from zero.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'member_record_lifecycle_state'
  ) then
    create type public.member_record_lifecycle_state as enum (
      'active',
      'inactive',
      'archived'
    );
  end if;
end
$$;

create table if not exists public.member_records (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete restrict,
  member_number text null,
  first_name text not null,
  middle_name text null,
  last_name text not null,
  suffix text null,
  preferred_display_name text null,
  email text null,
  phone text null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  province_state text null,
  postal_code text null,
  country_code text null,
  lifecycle_state public.member_record_lifecycle_state not null default 'active',
  archived_at timestamptz null,
  legacy_people_id uuid null references public.people(id) on delete set null,
  legacy_council_id uuid null references public.councils(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint member_records_first_name_not_blank check (btrim(first_name) <> ''),
  constraint member_records_last_name_not_blank check (btrim(last_name) <> ''),
  constraint member_records_member_number_not_blank check (
    member_number is null or btrim(member_number) <> ''
  )
);

create index if not exists idx_member_records_local_unit_id
  on public.member_records (local_unit_id);

create index if not exists idx_member_records_legacy_people_id
  on public.member_records (legacy_people_id);

create index if not exists idx_member_records_legacy_council_id
  on public.member_records (legacy_council_id);

create index if not exists idx_member_records_lifecycle_state
  on public.member_records (lifecycle_state);

create index if not exists idx_member_records_local_unit_email
  on public.member_records (local_unit_id, lower(email))
  where email is not null;

create index if not exists idx_member_records_local_unit_phone
  on public.member_records (local_unit_id, phone)
  where phone is not null;

create unique index if not exists uq_member_records_local_unit_member_number
  on public.member_records (local_unit_id, lower(member_number))
  where member_number is not null;

create unique index if not exists ux_member_records_one_active_local_unit_per_legacy_person
  on public.member_records (legacy_people_id)
  where archived_at is null
    and legacy_people_id is not null;

drop trigger if exists member_records_set_updated_at on public.member_records;
create trigger member_records_set_updated_at
before update on public.member_records
for each row execute function public.set_updated_at();

commit;
