-- 20260330153000_parallel_access_legacy_retirement_phase2_archive.sql
-- Purpose:
--   Archive null-user fossil rows out of gap reports and snapshot legacy tables
--   into archive copies so they can be dropped later with confidence.

begin;

-- Archive table snapshots (schema + data) for long-term reference.
create table if not exists public._archive_council_admin_assignments
as
select * from public.council_admin_assignments with no data;

insert into public._archive_council_admin_assignments
select ca.*
from public.council_admin_assignments ca
where not exists (
  select 1
  from public._archive_council_admin_assignments a
  where a.id = ca.id
);

create table if not exists public._archive_organization_admin_assignments
as
select * from public.organization_admin_assignments with no data;

insert into public._archive_organization_admin_assignments
select oa.*
from public.organization_admin_assignments oa
where not exists (
  select 1
  from public._archive_organization_admin_assignments a
  where a.id = oa.id
);

create table if not exists public._archive_custom_list_access
as
select * from public.custom_list_access with no data;

insert into public._archive_custom_list_access
select cla.*
from public.custom_list_access cla
where not exists (
  select 1
  from public._archive_custom_list_access a
  where a.id = cla.id
);

-- Resolve null-user fossils as intentionally ignored migration residue.
update public.migration_review_queue
   set resolved_at = now(),
       notes = coalesce(notes, '') || ' [Auto-resolved during legacy retirement: null-user fossil residue]'
 where resolved_at is null
   and review_type in ('legacy_write_observed', 'admin_package_write', 'admin_package_revoke')
   and payload ? 'target_user_id'
   and coalesce(payload->>'target_user_id', '') = '';

create or replace view public.v_parallel_legacy_gap_report_live as
select *
from public.v_parallel_legacy_gap_report
where user_id is not null;

create or replace view public.v_parallel_retirement_readiness_live as
with gap_counts as (
  select gap_type, count(*) as gap_count
  from public.v_parallel_legacy_gap_report_live
  group by gap_type
)
select
  coalesce((select gap_count from gap_counts where gap_type = 'org_admin_without_parallel_package'), 0) as org_admin_gap_count,
  coalesce((select gap_count from gap_counts where gap_type = 'custom_list_access_without_parallel_grant'), 0) as custom_list_gap_count,
  coalesce((select gap_count from gap_counts where gap_type = 'event_without_parallel_manager'), 0) as event_gap_count,
  (
    coalesce((select gap_count from gap_counts where gap_type = 'org_admin_without_parallel_package'), 0) = 0
    and coalesce((select gap_count from gap_counts where gap_type = 'custom_list_access_without_parallel_grant'), 0) = 0
    and coalesce((select gap_count from gap_counts where gap_type = 'event_without_parallel_manager'), 0) = 0
  ) as gap_free;

commit;