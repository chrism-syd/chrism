-- 20260330160000_parallel_access_legacy_retirement_phase3_drop_views.sql
-- Purpose:
--   Optional final severance. Only run after at least one quiet period with no legacy writes
--   and after verifying all app paths work without the legacy tables.

begin;

do $$
declare
  v_status record;
begin
  select * into v_status from public.v_legacy_retirement_status;
  if coalesce(v_status.unresolved_legacy_write_count, 0) <> 0 then
    raise exception 'Cannot finalize legacy retirement: unresolved legacy writes still observed.';
  end if;
end
$$;

-- Keep archive copies, remove live compatibility tables only if you are fully ready.
-- Uncomment these in a future release window, not immediately.
-- drop table public.council_admin_assignments;
-- drop table public.organization_admin_assignments;
-- drop table public.custom_list_access;

commit;