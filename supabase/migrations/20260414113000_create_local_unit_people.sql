begin;

create table if not exists public.local_unit_people (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  source_code text not null default 'member_record_backfill',
  linked_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone null,
  linked_by_auth_user_id uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null
);

create index if not exists local_unit_people_local_unit_id_idx
  on public.local_unit_people (local_unit_id);

create index if not exists local_unit_people_person_id_idx
  on public.local_unit_people (person_id);

create unique index if not exists local_unit_people_active_unique_idx
  on public.local_unit_people (local_unit_id, person_id)
  where ended_at is null;

drop trigger if exists local_unit_people_set_updated_at on public.local_unit_people;
create trigger local_unit_people_set_updated_at
before update on public.local_unit_people
for each row
execute function public.set_updated_at();

insert into public.local_unit_people (
  local_unit_id,
  person_id,
  source_code,
  linked_at
)
select distinct
  mr.local_unit_id,
  mr.legacy_people_id,
  'member_record_backfill',
  coalesce(mr.created_at, now())
from public.member_records mr
join public.people p
  on p.id = mr.legacy_people_id
where mr.legacy_people_id is not null
  and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
  and p.archived_at is null
on conflict do nothing;

commit;