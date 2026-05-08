-- Retire super-admin data hygiene scaffolding after MVP stabilization.
--
-- Context:
--   The data hygiene dashboard has served its purpose:
--     - redundant event assignments: 0
--     - open null-user fossils: 0
--     - unresolved legacy writes: 0
--
-- The remaining legacy gap counts are no longer authoritative because current
-- effective access uses local-unit-first views and direct organization admin
-- assignment expansion, rather than requiring old rows to be mirrored into
-- transitional grant rows.
--
-- This migration removes the diagnostic API surface and turns off legacy-write
-- observability noise. It intentionally preserves legacy_fossil_resolutions as
-- a small audit table, but removes direct browser-role access.

begin;

-- Stop generating migration-review noise for legacy compatibility writes.
drop trigger if exists observe_legacy_write_council_admin_assignments on public.council_admin_assignments;
drop trigger if exists observe_legacy_write_organization_admin_assignments on public.organization_admin_assignments;
drop trigger if exists observe_legacy_write_custom_list_access on public.custom_list_access;

drop function if exists public.log_parallel_legacy_write();

-- Remove super-admin hygiene RPCs now that the page is retired.
drop function if exists public.cleanup_redundant_event_assignments(uuid);
drop function if exists public.resolve_null_user_fossils(uuid, text, uuid[], text);

-- Drop diagnostic/readiness views in dependency order.
drop view if exists public.v_legacy_retirement_status;
drop view if exists public.v_parallel_retirement_readiness_live;
drop view if exists public.v_parallel_legacy_gap_report_live;
drop view if exists public.v_parallel_retirement_readiness;
drop view if exists public.v_parallel_resolved_null_user_fossils;
drop view if exists public.v_parallel_null_user_fossils;
drop view if exists public.v_parallel_null_user_fossils_all;
drop view if exists public.v_parallel_event_assignment_redundancy;
drop view if exists public.v_parallel_legacy_gap_report;

-- Preserve the small resolution audit table, but do not expose it to browser roles.
revoke all on table public.legacy_fossil_resolutions from anon, authenticated;

comment on table public.legacy_fossil_resolutions is
  'Retained audit table for resolved legacy fossil decisions. The super-admin data hygiene dashboard and diagnostic views were retired after MVP stabilization.';

commit;
