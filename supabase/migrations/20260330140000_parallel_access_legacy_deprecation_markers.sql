-- 20260330140000_parallel_access_legacy_deprecation_markers.sql
begin;

comment on table public.council_admin_assignments is
  'LEGACY COMPATIBILITY TABLE. Authority decisions should use area_access_grants / v_effective_area_access. Transitional sync input only.';

comment on table public.organization_admin_assignments is
  'LEGACY COMPATIBILITY TABLE. Authority decisions should use area_access_grants / v_effective_area_access. Transitional sync input only.';

comment on table public.custom_list_access is
  'LEGACY COMPATIBILITY TABLE. Resource decisions should use resource_access_grants / v_effective_resource_access. Transitional sync input only.';

create or replace view public.v_parallel_retirement_readiness as
with gap_counts as (
  select gap_type, count(*) as gap_count
  from public.v_parallel_legacy_gap_report
  group by gap_type
),
legacy_write_counts as (
  select
    source_table,
    count(*) filter (where resolved_at is null) as unresolved_legacy_writes
  from public.migration_review_queue
  where review_type = 'legacy_write_observed'
  group by source_table
)
select
  coalesce((select gap_count from gap_counts where gap_type = 'org_admin_without_parallel_package'), 0) as org_admin_gap_count,
  coalesce((select gap_count from gap_counts where gap_type = 'custom_list_access_without_parallel_grant'), 0) as custom_list_gap_count,
  coalesce((select gap_count from gap_counts where gap_type = 'event_without_parallel_manager'), 0) as event_gap_count,
  coalesce((select unresolved_legacy_writes from legacy_write_counts where source_table = 'public.council_admin_assignments'), 0) as council_admin_legacy_write_count,
  coalesce((select unresolved_legacy_writes from legacy_write_counts where source_table = 'public.organization_admin_assignments'), 0) as organization_admin_legacy_write_count,
  coalesce((select unresolved_legacy_writes from legacy_write_counts where source_table = 'public.custom_list_access'), 0) as custom_list_access_legacy_write_count,
  (
    coalesce((select gap_count from gap_counts where gap_type = 'org_admin_without_parallel_package'), 0) = 0
    and coalesce((select gap_count from gap_counts where gap_type = 'custom_list_access_without_parallel_grant'), 0) = 0
    and coalesce((select gap_count from gap_counts where gap_type = 'event_without_parallel_manager'), 0) = 0
  ) as gap_free;

commit;