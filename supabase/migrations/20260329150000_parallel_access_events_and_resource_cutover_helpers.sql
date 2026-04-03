-- 20260329150000_parallel_access_events_and_resource_cutover_helpers.sql
-- Purpose:
--   Strengthen event/resource rails so the app can keep moving off broad legacy council checks.

begin;

create table if not exists public.event_assignment_roles (
  code text primary key,
  label text not null,
  precedence integer not null default 100
);

insert into public.event_assignment_roles (code, label, precedence)
values
  ('manager', 'Manager', 10),
  ('volunteer_coordinator', 'Volunteer coordinator', 20),
  ('viewer', 'Viewer', 30)
on conflict (code) do update
  set label = excluded.label,
      precedence = excluded.precedence;

create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  member_record_id uuid not null references public.member_records(id) on delete cascade,
  role_code text not null references public.event_assignment_roles(code) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint uq_event_assignments_scope unique (event_id, member_record_id, role_code)
);

drop trigger if exists event_assignments_set_updated_at on public.event_assignments;
create trigger event_assignments_set_updated_at
before update on public.event_assignments
for each row execute function public.set_updated_at();

create index if not exists idx_event_assignments_local_unit_member
  on public.event_assignments (local_unit_id, member_record_id);

create index if not exists idx_event_assignments_event_role
  on public.event_assignments (event_id, role_code);

alter table public.events
  add column if not exists local_unit_id uuid null references public.local_units(id) on delete set null;

update public.events e
set local_unit_id = lu.id
from public.local_units lu
where e.local_unit_id is null
  and lu.legacy_council_id = e.council_id;

create or replace function public.sync_event_local_unit_from_council()
returns trigger
language plpgsql
as $$
begin
  if new.local_unit_id is null and new.council_id is not null then
    select lu.id
      into new.local_unit_id
    from public.local_units lu
    where lu.legacy_council_id = new.council_id
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists events_sync_local_unit_from_council on public.events;
create trigger events_sync_local_unit_from_council
before insert or update on public.events
for each row execute function public.sync_event_local_unit_from_council();

-- seed creator as event manager where possible
insert into public.event_assignments (
  event_id,
  local_unit_id,
  member_record_id,
  role_code,
  created_at,
  updated_at,
  created_by_auth_user_id,
  updated_by_auth_user_id
)
select
  e.id,
  e.local_unit_id,
  mr.id,
  'manager',
  coalesce(e.created_at, now()),
  coalesce(e.updated_at, now()),
  e.created_by_user_id,
  e.updated_by_user_id
from public.events e
join public.users u
  on u.id = e.created_by_user_id
join public.member_records mr
  on mr.legacy_people_id = u.person_id
 and mr.local_unit_id = e.local_unit_id
where e.local_unit_id is not null
on conflict (event_id, member_record_id, role_code) do nothing;

create or replace view public.v_effective_event_management_access as
select distinct
  ea.local_unit_id,
  lu.display_name as local_unit_name,
  ea.event_id,
  ea.member_record_id,
  mr.legacy_people_id as person_id,
  uur.user_id,
  ea.role_code,
  true as is_effective
from public.event_assignments ea
join public.local_units lu on lu.id = ea.local_unit_id
join public.member_records mr on mr.id = ea.member_record_id
left join public.user_unit_relationships uur
  on uur.member_record_id = ea.member_record_id
 and uur.local_unit_id = ea.local_unit_id
 and uur.status = 'active'::public.relationship_status
where mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state

union

select
  v.local_unit_id,
  v.local_unit_name,
  e.id as event_id,
  v.member_record_id,
  v.person_id,
  v.user_id,
  'manager'::text as role_code,
  true as is_effective
from public.v_effective_area_access v
join public.events e
  on e.local_unit_id = v.local_unit_id
where v.area_code = 'events'::public.member_area_code
  and v.access_level = 'manage'::public.area_access_level
  and v.is_effective = true;

create or replace function public.has_event_management_access(
  p_user_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.v_effective_event_management_access v
    where v.user_id = p_user_id
      and v.event_id = p_event_id
      and v.is_effective = true
  );
$$;

create or replace function public.list_manageable_event_ids_for_user(
  p_user_id uuid
)
returns table (event_id uuid)
language sql
stable
as $$
  select distinct v.event_id
  from public.v_effective_event_management_access v
  where v.user_id = p_user_id
    and v.is_effective = true
  order by v.event_id;
$$;

commit;