begin;

create or replace view public.v_parallel_event_assignment_redundancy as
with raw_redundancy as (
  select
    ea.id as redundant_assignment_id,
    ea.assignment_scope as redundant_assignment_scope,
    'event_assignment_covered_by_all_events'::text as redundancy_reason,
    10 as reason_rank,
    ea.local_unit_id,
    lu.display_name as local_unit_name,
    ea.event_id,
    e.title as event_title,
    ea.member_record_id,
    uur.user_id,
    coalesce(ea.role_code, 'manager') as role_code,
    cover.id as covered_by_assignment_id,
    cover.assignment_scope as covered_by_scope
  from public.event_assignments ea
  join public.event_assignments cover
    on cover.local_unit_id = ea.local_unit_id
   and cover.member_record_id = ea.member_record_id
   and coalesce(cover.role_code, 'manager') = coalesce(ea.role_code, 'manager')
   and cover.assignment_scope = 'all_events'::public.event_assignment_scope_code
   and cover.id <> ea.id
  join public.local_units lu
    on lu.id = ea.local_unit_id
  left join public.events e
    on e.id = ea.event_id
  left join public.user_unit_relationships uur
    on uur.member_record_id = ea.member_record_id
   and uur.local_unit_id = ea.local_unit_id
   and uur.status = 'active'::public.relationship_status
  where ea.assignment_scope = 'event'::public.event_assignment_scope_code

  union all

  select
    ea.id as redundant_assignment_id,
    ea.assignment_scope as redundant_assignment_scope,
    'event_assignment_covered_by_event_kind'::text as redundancy_reason,
    20 as reason_rank,
    ea.local_unit_id,
    lu.display_name as local_unit_name,
    ea.event_id,
    e.title as event_title,
    ea.member_record_id,
    uur.user_id,
    coalesce(ea.role_code, 'manager') as role_code,
    cover.id as covered_by_assignment_id,
    cover.assignment_scope as covered_by_scope
  from public.event_assignments ea
  join public.events e
    on e.id = ea.event_id
  join public.event_assignments cover
    on cover.local_unit_id = ea.local_unit_id
   and cover.member_record_id = ea.member_record_id
   and coalesce(cover.role_code, 'manager') = coalesce(ea.role_code, 'manager')
   and cover.assignment_scope = 'event_kind'::public.event_assignment_scope_code
   and cover.legacy_event_kind_code = e.event_kind_code
   and cover.id <> ea.id
  join public.local_units lu
    on lu.id = ea.local_unit_id
  left join public.user_unit_relationships uur
    on uur.member_record_id = ea.member_record_id
   and uur.local_unit_id = ea.local_unit_id
   and uur.status = 'active'::public.relationship_status
  where ea.assignment_scope = 'event'::public.event_assignment_scope_code
    and nullif(btrim(coalesce(e.event_kind_code, '')), '') is not null

  union all

  select
    ea.id as redundant_assignment_id,
    ea.assignment_scope as redundant_assignment_scope,
    'event_kind_assignment_covered_by_all_events'::text as redundancy_reason,
    30 as reason_rank,
    ea.local_unit_id,
    lu.display_name as local_unit_name,
    null::uuid as event_id,
    null::text as event_title,
    ea.member_record_id,
    uur.user_id,
    coalesce(ea.role_code, 'manager') as role_code,
    cover.id as covered_by_assignment_id,
    cover.assignment_scope as covered_by_scope
  from public.event_assignments ea
  join public.event_assignments cover
    on cover.local_unit_id = ea.local_unit_id
   and cover.member_record_id = ea.member_record_id
   and coalesce(cover.role_code, 'manager') = coalesce(ea.role_code, 'manager')
   and cover.assignment_scope = 'all_events'::public.event_assignment_scope_code
   and cover.id <> ea.id
  join public.local_units lu
    on lu.id = ea.local_unit_id
  left join public.user_unit_relationships uur
    on uur.member_record_id = ea.member_record_id
   and uur.local_unit_id = ea.local_unit_id
   and uur.status = 'active'::public.relationship_status
  where ea.assignment_scope = 'event_kind'::public.event_assignment_scope_code
)
select distinct on (redundant_assignment_id)
  redundant_assignment_id,
  redundant_assignment_scope,
  redundancy_reason,
  local_unit_id,
  local_unit_name,
  event_id,
  event_title,
  member_record_id,
  user_id,
  role_code,
  covered_by_assignment_id,
  covered_by_scope
from raw_redundancy
order by redundant_assignment_id, reason_rank, covered_by_assignment_id;

create table if not exists public.legacy_fossil_resolutions (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_row_id uuid not null,
  resolution_code text not null default 'ignored_residue',
  notes text null,
  resolved_at timestamptz not null default now(),
  resolved_by_auth_user_id uuid null references auth.users(id) on delete set null,
  constraint legacy_fossil_resolutions_source_not_blank check (btrim(source_table) <> ''),
  constraint legacy_fossil_resolutions_resolution_not_blank check (btrim(resolution_code) <> ''),
  constraint legacy_fossil_resolutions_unique_source unique (source_table, source_row_id)
);

create index if not exists idx_legacy_fossil_resolutions_resolved_at
  on public.legacy_fossil_resolutions (resolved_at desc);

create or replace view public.v_parallel_null_user_fossils_all as
select
  'public.council_admin_assignments'::text as source_table,
  ca.id as source_row_id,
  lu.display_name as local_unit_name,
  ca.person_id,
  ca.grantee_email,
  ca.council_id as legacy_owner_id,
  ca.notes,
  ca.created_at
from public.council_admin_assignments ca
left join public.local_units lu
  on lu.legacy_council_id = ca.council_id
where ca.user_id is null
  and ca.is_active = true

union all

select
  'public.organization_admin_assignments'::text as source_table,
  oa.id as source_row_id,
  lu.display_name as local_unit_name,
  oa.person_id,
  oa.grantee_email,
  oa.organization_id as legacy_owner_id,
  null::text as notes,
  oa.created_at
from public.organization_admin_assignments oa
left join public.local_units lu
  on lu.legacy_organization_id = oa.organization_id
where oa.user_id is null
  and oa.is_active = true

union all

select
  'public.custom_list_access'::text as source_table,
  cla.id as source_row_id,
  lu.display_name as local_unit_name,
  cla.person_id,
  cla.grantee_email,
  cl.council_id as legacy_owner_id,
  null::text as notes,
  cla.created_at
from public.custom_list_access cla
join public.custom_lists cl
  on cl.id = cla.custom_list_id
left join public.local_units lu
  on lu.id = cl.local_unit_id
where cla.user_id is null;

create or replace view public.v_parallel_null_user_fossils as
select fossil.*
from public.v_parallel_null_user_fossils_all fossil
left join public.legacy_fossil_resolutions resolution
  on resolution.source_table = fossil.source_table
 and resolution.source_row_id = fossil.source_row_id
where resolution.id is null;

create or replace view public.v_parallel_resolved_null_user_fossils as
select
  fossil.source_table,
  fossil.source_row_id,
  fossil.local_unit_name,
  fossil.person_id,
  fossil.grantee_email,
  fossil.legacy_owner_id,
  fossil.notes,
  fossil.created_at,
  resolution.resolution_code,
  resolution.notes as resolution_notes,
  resolution.resolved_at as fossil_resolved_at,
  resolution.resolved_by_auth_user_id
from public.v_parallel_null_user_fossils_all fossil
join public.legacy_fossil_resolutions resolution
  on resolution.source_table = fossil.source_table
 and resolution.source_row_id = fossil.source_row_id;

create or replace function public.cleanup_redundant_event_assignments(
  p_actor_user_id uuid default null
)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  insert into public.migration_review_queue (
    source_table,
    source_row_id,
    review_type,
    notes,
    payload
  )
  select distinct on (redundancy.redundant_assignment_id)
    'public.event_assignments',
    redundancy.redundant_assignment_id,
    'event_assignment_cleanup',
    'Removed redundant event assignment during Batch 6 hygiene cleanup.',
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'redundancy_reason', redundancy.redundancy_reason,
      'covered_by_assignment_id', redundancy.covered_by_assignment_id,
      'covered_by_scope', redundancy.covered_by_scope,
      'role_code', redundancy.role_code,
      'event_id', redundancy.event_id,
      'member_record_id', redundancy.member_record_id,
      'local_unit_id', redundancy.local_unit_id
    )
  from public.v_parallel_event_assignment_redundancy redundancy
  order by redundancy.redundant_assignment_id, redundancy.covered_by_assignment_id;

  delete from public.event_assignments ea
  using (
    select distinct redundant_assignment_id
    from public.v_parallel_event_assignment_redundancy
  ) redundancy
  where ea.id = redundancy.redundant_assignment_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.resolve_null_user_fossils(
  p_actor_user_id uuid default null,
  p_source_table text default null,
  p_source_row_ids uuid[] default null,
  p_notes text default null
)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  v_notes text := coalesce(nullif(btrim(p_notes), ''), 'Resolved as intentional migration residue from the data hygiene page.');
begin
  insert into public.legacy_fossil_resolutions (
    source_table,
    source_row_id,
    resolution_code,
    notes,
    resolved_by_auth_user_id
  )
  select
    fossil.source_table,
    fossil.source_row_id,
    'ignored_residue',
    v_notes,
    p_actor_user_id
  from public.v_parallel_null_user_fossils fossil
  where (p_source_table is null or fossil.source_table = p_source_table)
    and (p_source_row_ids is null or fossil.source_row_id = any(p_source_row_ids))
  on conflict (source_table, source_row_id) do nothing;

  get diagnostics v_count = row_count;

  update public.migration_review_queue q
     set resolved_at = coalesce(q.resolved_at, now()),
         resolved_by_auth_user_id = coalesce(q.resolved_by_auth_user_id, p_actor_user_id),
         notes = trim(both from concat_ws(' ', q.notes, '[Resolved from data hygiene as intentional fossil residue]'))
   where q.resolved_at is null
     and exists (
       select 1
       from public.legacy_fossil_resolutions resolution
       where resolution.source_table = q.source_table
         and resolution.source_row_id = q.source_row_id
         and (p_source_table is null or resolution.source_table = p_source_table)
         and (p_source_row_ids is null or resolution.source_row_id = any(p_source_row_ids))
     );

  return v_count;
end;
$$;

comment on view public.v_parallel_event_assignment_redundancy is
  'Batch 6 hygiene view. Shows event assignments that are already covered by broader grants and can be safely removed.';

comment on view public.v_parallel_null_user_fossils is
  'Batch 6 hygiene view. Shows unresolved legacy compatibility rows with no linked user_id so they remain reviewable without being mistaken for current authority.';

comment on view public.v_parallel_resolved_null_user_fossils is
  'Batch 6 hygiene view. Audit trail for null-user fossils that were intentionally resolved out of the active hygiene queue.';

comment on function public.resolve_null_user_fossils(uuid, text, uuid[], text) is
  'Records an intentional-resolution decision for null-user fossils so they stop cluttering the active hygiene queue without dropping legacy tables.';

commit;
