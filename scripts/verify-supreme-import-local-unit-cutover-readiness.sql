-- Read-only readiness check for cutting Supreme import from council-shaped
-- operational scope to explicit local_unit_id scope.
--
-- Run in Supabase SQL Editor before changing apply_supreme_import_row.
-- Clean readiness means:
--   - current RPC exists with the expected council-shaped signature
--   - every Knights council local unit has a legacy council bridge
--   - every legacy council used by local units has exactly one council local unit
--
-- This script does not mutate data.

with current_rpc as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'apply_supreme_import_row'
), council_local_units_missing_legacy_bridge as (
  select
    lu.id as local_unit_id,
    lu.display_name,
    lu.legacy_organization_id,
    lu.legacy_council_id
  from public.local_units lu
  where lu.local_unit_kind = 'council'::public.local_unit_kind
    and lu.legacy_council_id is null
), legacy_council_bridge_counts as (
  select
    lu.legacy_council_id,
    count(*) filter (
      where lu.local_unit_kind = 'council'::public.local_unit_kind
    ) as council_local_unit_count
  from public.local_units lu
  where lu.legacy_council_id is not null
  group by lu.legacy_council_id
), ambiguous_legacy_council_bridges as (
  select *
  from legacy_council_bridge_counts
  where council_local_unit_count <> 1
), current_rpc_has_legacy_council_scope as (
  select exists (
    select 1
    from current_rpc
    where args ilike 'p_council_id uuid,%'
      and args ilike '%p_organization_id uuid%'
      and args ilike '%p_auth_user_id uuid%'
  ) as passed
), current_rpc_already_has_local_unit_scope as (
  select exists (
    select 1
    from current_rpc
    where args ilike 'p_local_unit_id uuid,%'
       or args ilike '%, p_local_unit_id uuid,%'
  ) as passed
)
select
  (select count(*) from current_rpc) as apply_supreme_import_row_signature_count,
  (select passed from current_rpc_has_legacy_council_scope) as current_rpc_has_legacy_council_scope,
  (select passed from current_rpc_already_has_local_unit_scope) as current_rpc_already_has_local_unit_scope,
  (select count(*) from council_local_units_missing_legacy_bridge) as council_local_units_missing_legacy_bridge_count,
  (select count(*) from ambiguous_legacy_council_bridges) as ambiguous_legacy_council_bridge_count;

-- Detail rows. Clean readiness should return no rows.

select
  'council_local_unit_missing_legacy_bridge' as failure_kind,
  local_unit_id,
  display_name,
  legacy_organization_id,
  legacy_council_id
from (
  select
    lu.id as local_unit_id,
    lu.display_name,
    lu.legacy_organization_id,
    lu.legacy_council_id
  from public.local_units lu
  where lu.local_unit_kind = 'council'::public.local_unit_kind
    and lu.legacy_council_id is null
) missing_bridge

union all

select
  'ambiguous_legacy_council_bridge' as failure_kind,
  bridge.legacy_council_id as local_unit_id,
  null::text as display_name,
  null::uuid as legacy_organization_id,
  bridge.legacy_council_id
from (
  select
    lu.legacy_council_id,
    count(*) filter (
      where lu.local_unit_kind = 'council'::public.local_unit_kind
    ) as council_local_unit_count
  from public.local_units lu
  where lu.legacy_council_id is not null
  group by lu.legacy_council_id
) bridge
where bridge.council_local_unit_count <> 1
order by failure_kind, display_name nulls last, local_unit_id;
