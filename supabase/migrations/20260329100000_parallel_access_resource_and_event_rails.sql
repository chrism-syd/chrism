-- Parallel access resource and event rails
-- Safe to run after the manual multi-local-unit foundation setup.
-- Idempotent where practical so existing dev databases can reconcile cleanly.

begin;

create table if not exists public.migration_review_queue (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_row_id uuid not null,
  review_type text not null,
  notes text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint migration_review_queue_source_table_not_blank check (btrim(source_table) <> ''),
  constraint migration_review_queue_review_type_not_blank check (btrim(review_type) <> '')
);

create index if not exists idx_migration_review_queue_source
  on public.migration_review_queue (source_table, source_row_id);

create index if not exists idx_migration_review_queue_unresolved
  on public.migration_review_queue (resolved_at)
  where resolved_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'event_assignment_scope_code'
  ) then
    create type public.event_assignment_scope_code as enum ('all_events', 'event', 'event_kind');
  end if;
end
$$;

create or replace function public.sync_local_unit_id_from_legacy_council()
returns trigger
language plpgsql
as $$
begin
  if new.local_unit_id is null and new.council_id is not null then
    select lu.id into new.local_unit_id
    from public.local_units lu
    where lu.legacy_council_id = new.council_id
    limit 1;
  end if;

  return new;
end;
$$;

alter table public.events
  add column if not exists local_unit_id uuid null references public.local_units(id) on delete restrict;

update public.events e
set local_unit_id = lu.id
from public.local_units lu
where e.local_unit_id is null
  and lu.legacy_council_id = e.council_id;

create index if not exists idx_events_local_unit_id
  on public.events (local_unit_id);

create index if not exists idx_events_local_unit_starts_at
  on public.events (local_unit_id, starts_at desc)
  where local_unit_id is not null;

drop trigger if exists events_sync_local_unit_id_from_legacy_council on public.events;
create trigger events_sync_local_unit_id_from_legacy_council
before insert or update of council_id, local_unit_id on public.events
for each row execute function public.sync_local_unit_id_from_legacy_council();

alter table public.custom_lists
  add column if not exists local_unit_id uuid null references public.local_units(id) on delete restrict;

update public.custom_lists cl
set local_unit_id = lu.id
from public.local_units lu
where cl.local_unit_id is null
  and lu.legacy_council_id = cl.council_id;

create index if not exists idx_custom_lists_local_unit_id
  on public.custom_lists (local_unit_id);

create index if not exists idx_custom_lists_local_unit_archived_at
  on public.custom_lists (local_unit_id, archived_at)
  where local_unit_id is not null;

drop trigger if exists custom_lists_sync_local_unit_id_from_legacy_council on public.custom_lists;
create trigger custom_lists_sync_local_unit_id_from_legacy_council
before insert or update of council_id, local_unit_id on public.custom_lists
for each row execute function public.sync_local_unit_id_from_legacy_council();

create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  member_record_id uuid not null references public.member_records(id) on delete cascade,
  assignment_scope public.event_assignment_scope_code not null,
  event_id uuid null references public.events(id) on delete cascade,
  legacy_event_kind_code text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  updated_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint event_assignments_scope_target_check check (
    (assignment_scope = 'all_events' and event_id is null and legacy_event_kind_code is null)
    or (assignment_scope = 'event' and event_id is not null and legacy_event_kind_code is null)
    or (assignment_scope = 'event_kind' and event_id is null and legacy_event_kind_code is not null and btrim(legacy_event_kind_code) <> '')
  )
);

create index if not exists idx_event_assignments_local_unit_member_record
  on public.event_assignments (local_unit_id, member_record_id);

create index if not exists idx_event_assignments_event_id
  on public.event_assignments (event_id)
  where event_id is not null;

create index if not exists idx_event_assignments_event_kind
  on public.event_assignments (local_unit_id, legacy_event_kind_code)
  where legacy_event_kind_code is not null;

create unique index if not exists uq_event_assignments_all_events
  on public.event_assignments (local_unit_id, member_record_id, assignment_scope)
  where assignment_scope = 'all_events';

create unique index if not exists uq_event_assignments_specific_event
  on public.event_assignments (local_unit_id, member_record_id, event_id)
  where assignment_scope = 'event' and event_id is not null;

create unique index if not exists uq_event_assignments_event_kind
  on public.event_assignments (local_unit_id, member_record_id, legacy_event_kind_code)
  where assignment_scope = 'event_kind' and legacy_event_kind_code is not null;

drop trigger if exists event_assignments_set_updated_at on public.event_assignments;
create trigger event_assignments_set_updated_at
before update on public.event_assignments
for each row execute function public.set_updated_at();

insert into public.event_assignments (
  local_unit_id,
  member_record_id,
  assignment_scope,
  event_id,
  legacy_event_kind_code,
  notes,
  created_at,
  updated_at,
  created_by_auth_user_id,
  updated_by_auth_user_id
)
select
  lu.id,
  mr.id,
  'all_events'::public.event_assignment_scope_code,
  null::uuid,
  null::text,
  'Seeded from active legacy council admin assignment.',
  ca.created_at,
  ca.updated_at,
  null::uuid,
  null::uuid
from public.council_admin_assignments ca
join public.local_units lu on lu.legacy_council_id = ca.council_id
join public.member_records mr on mr.legacy_people_id = ca.person_id and mr.local_unit_id = lu.id
where ca.is_active = true
  and ca.person_id is not null
  and ca.user_id is not null
  and not exists (
    select 1
    from public.event_assignments ea
    where ea.local_unit_id = lu.id
      and ea.member_record_id = mr.id
      and ea.assignment_scope = 'all_events'
  );

with direct_person_access as (
  select
    cla.id as legacy_access_id,
    cl.local_unit_id,
    mr.id as member_record_id,
    cla.custom_list_id::text as resource_key,
    cla.granted_at,
    cla.created_at,
    cla.updated_at
  from public.custom_list_access cla
  join public.custom_lists cl on cl.id = cla.custom_list_id
  join public.member_records mr on mr.legacy_people_id = cla.person_id and mr.local_unit_id = cl.local_unit_id
  where cla.person_id is not null
    and cl.local_unit_id is not null
),
direct_user_access as (
  select
    cla.id as legacy_access_id,
    cl.local_unit_id,
    uur.member_record_id,
    cla.custom_list_id::text as resource_key,
    cla.granted_at,
    cla.created_at,
    cla.updated_at,
    row_number() over (
      partition by cla.id
      order by case when uur.status = 'active' then 0 else 1 end, uur.created_at asc
    ) as relationship_rank
  from public.custom_list_access cla
  join public.custom_lists cl on cl.id = cla.custom_list_id
  join public.user_unit_relationships uur
    on uur.user_id = cla.user_id
   and uur.local_unit_id = cl.local_unit_id
   and uur.member_record_id is not null
  where cla.person_id is null
    and cla.user_id is not null
    and cl.local_unit_id is not null
),
resolved_user_access as (
  select legacy_access_id, local_unit_id, member_record_id, resource_key, granted_at, created_at, updated_at
  from direct_user_access
  where relationship_rank = 1
),
resolved_custom_list_access as (
  select * from direct_person_access
  union all
  select * from resolved_user_access
)
insert into public.resource_access_grants (
  local_unit_id,
  member_record_id,
  resource_type,
  resource_key,
  access_level,
  source_code,
  granted_at,
  expires_at,
  revoked_at,
  created_at,
  updated_at,
  created_by_auth_user_id,
  updated_by_auth_user_id
)
select
  r.local_unit_id,
  r.member_record_id,
  'custom_list'::public.resource_type_code,
  r.resource_key,
  'interact'::public.area_access_level,
  'legacy_backfill'::public.grant_source_code,
  r.granted_at,
  null::timestamptz,
  null::timestamptz,
  r.created_at,
  r.updated_at,
  null::uuid,
  null::uuid
from resolved_custom_list_access r
where not exists (
  select 1
  from public.resource_access_grants rag
  where rag.local_unit_id = r.local_unit_id
    and rag.member_record_id = r.member_record_id
    and rag.resource_type = 'custom_list'
    and rag.resource_key = r.resource_key
    and rag.source_code = 'legacy_backfill'
    and rag.revoked_at is null
);

insert into public.migration_review_queue (
  source_table,
  source_row_id,
  review_type,
  notes,
  payload
)
select
  'public.custom_list_access',
  cla.id,
  'custom_list_access_without_member_record',
  'Legacy custom list access row could not be mapped to a member record in the same local unit.',
  jsonb_build_object(
    'custom_list_id', cla.custom_list_id,
    'person_id', cla.person_id,
    'user_id', cla.user_id,
    'grantee_email', cla.grantee_email,
    'local_unit_id', cl.local_unit_id
  )
from public.custom_list_access cla
join public.custom_lists cl on cl.id = cla.custom_list_id
left join public.member_records mr_person
  on mr_person.legacy_people_id = cla.person_id
 and mr_person.local_unit_id = cl.local_unit_id
left join public.user_unit_relationships uur
  on uur.user_id = cla.user_id
 and uur.local_unit_id = cl.local_unit_id
 and uur.member_record_id is not null
where cl.local_unit_id is not null
  and mr_person.id is null
  and uur.id is null
  and not exists (
    select 1
    from public.migration_review_queue q
    where q.source_table = 'public.custom_list_access'
      and q.source_row_id = cla.id
      and q.review_type = 'custom_list_access_without_member_record'
      and q.resolved_at is null
  );

create or replace view public.v_effective_resource_access as
select
  rag.id as resource_access_grant_id,
  rag.local_unit_id,
  lu.display_name as local_unit_name,
  rag.member_record_id,
  mr.legacy_people_id as person_id,
  uur.user_id,
  rag.resource_type,
  rag.resource_key,
  rag.access_level,
  rag.source_code,
  rag.granted_at,
  rag.expires_at,
  rag.revoked_at,
  case
    when rag.revoked_at is not null then false
    when rag.expires_at is not null and rag.expires_at < now() then false
    when mr.lifecycle_state = 'archived'::public.member_record_lifecycle_state then false
    else true
  end as is_effective
from public.resource_access_grants rag
join public.local_units lu on lu.id = rag.local_unit_id
join public.member_records mr on mr.id = rag.member_record_id
left join public.user_unit_relationships uur
  on uur.member_record_id = mr.id
 and uur.local_unit_id = rag.local_unit_id
 and uur.status = 'active'::public.relationship_status;

create or replace function public.has_resource_access(
  p_user_id uuid,
  p_local_unit_id uuid,
  p_resource_type public.resource_type_code,
  p_resource_key text,
  p_min_access_level public.area_access_level
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.v_effective_resource_access v
    where v.user_id = p_user_id
      and v.local_unit_id = p_local_unit_id
      and v.resource_type = p_resource_type
      and v.resource_key = p_resource_key
      and v.is_effective = true
      and (
        v.access_level = p_min_access_level
        or (p_min_access_level = 'read_only')
        or (p_min_access_level = 'edit_manage' and v.access_level in ('edit_manage', 'manage'))
        or (p_min_access_level = 'manage' and v.access_level = 'manage')
        or (p_min_access_level = 'interact' and v.access_level in ('interact', 'edit_manage', 'manage'))
      )
  );
$$;

create or replace function public.has_event_management_access(
  p_user_id uuid,
  p_local_unit_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
as $$
  with target_event as (
    select e.id, e.local_unit_id, e.event_kind_code
    from public.events e
    where e.id = p_event_id
      and e.local_unit_id = p_local_unit_id
  )
  select
    public.has_area_access(
      p_user_id,
      p_local_unit_id,
      'events'::public.member_area_code,
      'manage'::public.area_access_level
    )
    or exists (
      select 1
      from target_event e
      join public.user_unit_relationships uur
        on uur.user_id = p_user_id
       and uur.local_unit_id = e.local_unit_id
       and uur.status = 'active'::public.relationship_status
       and uur.member_record_id is not null
      join public.event_assignments ea
        on ea.local_unit_id = e.local_unit_id
       and ea.member_record_id = uur.member_record_id
      where ea.assignment_scope = 'all_events'
         or (ea.assignment_scope = 'event' and ea.event_id = e.id)
         or (ea.assignment_scope = 'event_kind' and ea.legacy_event_kind_code = e.event_kind_code)
    );
$$;

commit;
