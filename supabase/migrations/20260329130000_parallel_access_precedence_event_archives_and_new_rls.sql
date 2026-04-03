-- Parallel access precedence cleanup, event archive local-unit rails, and first-pass RLS on new tables

begin;

alter table public.event_archives
  add column if not exists local_unit_id uuid null references public.local_units(id) on delete restrict;

update public.event_archives ea
set local_unit_id = lu.id
from public.local_units lu
where ea.local_unit_id is null
  and lu.legacy_council_id = ea.council_id;

create index if not exists idx_event_archives_local_unit_id
  on public.event_archives (local_unit_id);

create index if not exists idx_event_archives_local_unit_deleted_at
  on public.event_archives (local_unit_id, deleted_at desc)
  where local_unit_id is not null;

drop trigger if exists event_archives_sync_local_unit_id_from_legacy_council on public.event_archives;
create trigger event_archives_sync_local_unit_id_from_legacy_council
before insert or update of council_id, local_unit_id on public.event_archives
for each row execute function public.sync_local_unit_id_from_legacy_council();

create or replace function public.parallel_grant_source_rank(p_source public.grant_source_code)
returns integer
language sql
immutable
as $$
  select case p_source
    when 'manual' then 10
    when 'system' then 20
    when 'invite_package' then 30
    when 'title_default' then 40
    when 'legacy_backfill' then 90
    else 100
  end
$$;

create or replace view public.v_effective_area_access as
with ranked as (
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
    end as is_effective,
    row_number() over (
      partition by aag.local_unit_id, aag.member_record_id, aag.area_code, aag.access_level
      order by public.parallel_grant_source_rank(aag.source_code), aag.granted_at desc nulls last, aag.created_at desc
    ) as source_rank
  from public.area_access_grants aag
  join public.local_units lu on lu.id = aag.local_unit_id
  join public.member_records mr on mr.id = aag.member_record_id
  left join public.user_unit_relationships uur
    on uur.member_record_id = mr.id
   and uur.local_unit_id = aag.local_unit_id
   and uur.status = 'active'::public.relationship_status
)
select
  area_access_grant_id,
  local_unit_id,
  local_unit_name,
  member_record_id,
  person_id,
  user_id,
  area_code,
  access_level,
  source_code,
  granted_at,
  expires_at,
  revoked_at,
  is_effective
from ranked
where source_rank = 1;

create or replace view public.v_effective_resource_access as
with ranked as (
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
    end as is_effective,
    row_number() over (
      partition by rag.local_unit_id, rag.member_record_id, rag.resource_type, rag.resource_key, rag.access_level
      order by public.parallel_grant_source_rank(rag.source_code), rag.granted_at desc nulls last, rag.created_at desc
    ) as source_rank
  from public.resource_access_grants rag
  join public.local_units lu on lu.id = rag.local_unit_id
  join public.member_records mr on mr.id = rag.member_record_id
  left join public.user_unit_relationships uur
    on uur.member_record_id = mr.id
   and uur.local_unit_id = rag.local_unit_id
   and uur.status = 'active'::public.relationship_status
)
select
  resource_access_grant_id,
  local_unit_id,
  local_unit_name,
  member_record_id,
  person_id,
  user_id,
  resource_type,
  resource_key,
  access_level,
  source_code,
  granted_at,
  expires_at,
  revoked_at,
  is_effective
from ranked
where source_rank = 1;

alter table public.local_units enable row level security;
alter table public.member_records enable row level security;
alter table public.user_unit_relationships enable row level security;
alter table public.local_role_definitions enable row level security;
alter table public.role_assignments enable row level security;
alter table public.area_access_grants enable row level security;
alter table public.resource_access_grants enable row level security;
alter table public.event_assignments enable row level security;
alter table public.membership_claim_requests enable row level security;
alter table public.event_archives enable row level security;

drop policy if exists local_units_select_related on public.local_units;
create policy local_units_select_related
on public.local_units
for select
to authenticated
using (
  exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.local_unit_id = local_units.id
  )
);

drop policy if exists member_records_select_admin_or_self on public.member_records;
create policy member_records_select_admin_or_self
on public.member_records
for select
to authenticated
using (
  exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = member_records.id
  )
  or public.auth_has_area_access(member_records.local_unit_id, 'members', 'read_only')
);

drop policy if exists user_unit_relationships_select_self_or_admin on public.user_unit_relationships;
create policy user_unit_relationships_select_self_or_admin
on public.user_unit_relationships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.auth_has_area_access(local_unit_id, 'admins', 'manage')
);

drop policy if exists local_role_definitions_select_members_or_self on public.local_role_definitions;
create policy local_role_definitions_select_members_or_self
on public.local_role_definitions
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'members', 'read_only')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.local_unit_id = local_role_definitions.local_unit_id
  )
);

drop policy if exists role_assignments_select_members_or_self on public.role_assignments;
create policy role_assignments_select_members_or_self
on public.role_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.member_records mr
    join public.user_unit_relationships uur on uur.member_record_id = mr.id
    where uur.user_id = auth.uid()
      and mr.id = role_assignments.member_record_id
  )
  or exists (
    select 1
    from public.member_records mr
    where mr.id = role_assignments.member_record_id
      and public.auth_has_area_access(mr.local_unit_id, 'members', 'read_only')
  )
);

drop policy if exists area_access_grants_select_admin_or_self on public.area_access_grants;
create policy area_access_grants_select_admin_or_self
on public.area_access_grants
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'admins', 'manage')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = area_access_grants.member_record_id
      and uur.local_unit_id = area_access_grants.local_unit_id
  )
);

drop policy if exists resource_access_grants_select_admin_or_self on public.resource_access_grants;
create policy resource_access_grants_select_admin_or_self
on public.resource_access_grants
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'admins', 'manage')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = resource_access_grants.member_record_id
      and uur.local_unit_id = resource_access_grants.local_unit_id
  )
);

drop policy if exists event_assignments_select_event_managers_or_self on public.event_assignments;
create policy event_assignments_select_event_managers_or_self
on public.event_assignments
for select
to authenticated
using (
  public.auth_has_area_access(local_unit_id, 'events', 'manage')
  or exists (
    select 1
    from public.user_unit_relationships uur
    where uur.user_id = auth.uid()
      and uur.member_record_id = event_assignments.member_record_id
      and uur.local_unit_id = event_assignments.local_unit_id
  )
);

drop policy if exists membership_claim_requests_select_claims_or_requester on public.membership_claim_requests;
create policy membership_claim_requests_select_claims_or_requester
on public.membership_claim_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or public.auth_has_area_access(local_unit_id, 'claims', 'manage')
);

drop policy if exists event_archives_select_event_managers on public.event_archives;
create policy event_archives_select_event_managers
on public.event_archives
for select
to authenticated
using (
  (local_unit_id is not null and public.auth_has_area_access(local_unit_id, 'events', 'manage'))
);

commit;
