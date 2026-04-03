-- 20260330150000_parallel_access_legacy_retirement_phase1.sql
-- Purpose:
--   Freeze legacy compatibility tables into read-only, explicitly deprecated state
--   without dropping them yet. This is the safe retirement step.

begin;

-- Safety check: do not proceed if retirement readiness is not gap-free.
do $$
declare
  v_ready record;
begin
  select * into v_ready
  from public.v_parallel_retirement_readiness;

  if v_ready.gap_free is distinct from true then
    raise exception 'Legacy retirement blocked: v_parallel_retirement_readiness.gap_free is not true. Resolve remaining gaps or explicitly accept null-user fossil residue before continuing.';
  end if;
end
$$;

-- Legacy compatibility tables stay readable, but no longer writable by authenticated users.
alter table public.council_admin_assignments enable row level security;
alter table public.organization_admin_assignments enable row level security;
alter table public.custom_list_access enable row level security;

drop policy if exists council_admin_assignments_legacy_read on public.council_admin_assignments;
create policy council_admin_assignments_legacy_read
on public.council_admin_assignments
for select
to authenticated
using (
  true
);

drop policy if exists organization_admin_assignments_legacy_read on public.organization_admin_assignments;
create policy organization_admin_assignments_legacy_read
on public.organization_admin_assignments
for select
to authenticated
using (
  true
);

drop policy if exists custom_list_access_legacy_read on public.custom_list_access;
create policy custom_list_access_legacy_read
on public.custom_list_access
for select
to authenticated
using (
  true
);

-- Explicitly block authenticated writes to legacy compatibility tables.
drop policy if exists council_admin_assignments_legacy_insert_block on public.council_admin_assignments;
create policy council_admin_assignments_legacy_insert_block
on public.council_admin_assignments
for insert
to authenticated
with check (false);

drop policy if exists council_admin_assignments_legacy_update_block on public.council_admin_assignments;
create policy council_admin_assignments_legacy_update_block
on public.council_admin_assignments
for update
to authenticated
using (false)
with check (false);

drop policy if exists council_admin_assignments_legacy_delete_block on public.council_admin_assignments;
create policy council_admin_assignments_legacy_delete_block
on public.council_admin_assignments
for delete
to authenticated
using (false);

drop policy if exists organization_admin_assignments_legacy_insert_block on public.organization_admin_assignments;
create policy organization_admin_assignments_legacy_insert_block
on public.organization_admin_assignments
for insert
to authenticated
with check (false);

drop policy if exists organization_admin_assignments_legacy_update_block on public.organization_admin_assignments;
create policy organization_admin_assignments_legacy_update_block
on public.organization_admin_assignments
for update
to authenticated
using (false)
with check (false);

drop policy if exists organization_admin_assignments_legacy_delete_block on public.organization_admin_assignments;
create policy organization_admin_assignments_legacy_delete_block
on public.organization_admin_assignments
for delete
to authenticated
using (false);

drop policy if exists custom_list_access_legacy_insert_block on public.custom_list_access;
create policy custom_list_access_legacy_insert_block
on public.custom_list_access
for insert
to authenticated
with check (false);

drop policy if exists custom_list_access_legacy_update_block on public.custom_list_access;
create policy custom_list_access_legacy_update_block
on public.custom_list_access
for update
to authenticated
using (false)
with check (false);

drop policy if exists custom_list_access_legacy_delete_block on public.custom_list_access;
create policy custom_list_access_legacy_delete_block
on public.custom_list_access
for delete
to authenticated
using (false);

-- Mark compatibility triggers as deprecated bridges.
comment on trigger council_admin_assignments_sync_parallel_admin_package on public.council_admin_assignments is
  'DEPRECATED COMPATIBILITY BRIDGE. Legacy writes should be blocked; retained only for emergency/manual admin use.';
comment on trigger organization_admin_assignments_sync_parallel_admin_package on public.organization_admin_assignments is
  'DEPRECATED COMPATIBILITY BRIDGE. Legacy writes should be blocked; retained only for emergency/manual admin use.';
comment on trigger observe_legacy_write_council_admin_assignments on public.council_admin_assignments is
  'DEPRECATED OBSERVABILITY TRIGGER. Should remain quiet once legacy retirement succeeds.';
comment on trigger observe_legacy_write_organization_admin_assignments on public.organization_admin_assignments is
  'DEPRECATED OBSERVABILITY TRIGGER. Should remain quiet once legacy retirement succeeds.';
comment on trigger observe_legacy_write_custom_list_access on public.custom_list_access is
  'DEPRECATED OBSERVABILITY TRIGGER. Should remain quiet once legacy retirement succeeds.';

create or replace view public.v_legacy_retirement_status as
select
  current_timestamp as checked_at,
  (select count(*) from public.council_admin_assignments) as council_admin_rows,
  (select count(*) from public.organization_admin_assignments) as organization_admin_rows,
  (select count(*) from public.custom_list_access) as custom_list_access_rows,
  (select count(*) from public.migration_review_queue where review_type = 'legacy_write_observed' and resolved_at is null) as unresolved_legacy_write_count,
  (select gap_free from public.v_parallel_retirement_readiness) as gap_free;

commit;