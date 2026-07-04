begin;

drop trigger if exists council_admin_assignments_sync_org_admin on public.council_admin_assignments;
drop trigger if exists council_admin_assignments_sync_parallel_admin_package on public.council_admin_assignments;
drop trigger if exists observe_legacy_write_council_admin_assignments on public.council_admin_assignments;

drop function if exists public.trg_sync_org_admin_from_council_admin_assignment() cascade;
drop function if exists public.sync_organization_admin_assignment_from_council_admin_assignment(uuid) cascade;
drop function if exists public.trg_sync_parallel_admin_package_from_council_admin_assignment() cascade;
drop function if exists public.sync_parallel_admin_package_from_council_admin_assignment(uuid) cascade;

drop table if exists public.council_admin_assignments cascade;
drop table if exists public._archive_council_admin_assignments cascade;

commit;
