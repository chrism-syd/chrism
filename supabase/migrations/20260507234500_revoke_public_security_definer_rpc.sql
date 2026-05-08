-- Revoke public RPC execution for SECURITY DEFINER internals.
--
-- Supabase Security Advisor flagged these functions as executable by anon and/or
-- authenticated roles through /rest/v1/rpc/*. These routines are database/server
-- internals, not browser-callable API endpoints.
--
-- Keep service_role execution for server-side/admin code and trigger/internal
-- workflows. Do not blanket-revoke all public functions here because many RLS
-- helper functions must remain executable by authenticated users inside policies.

begin;

-- Member lifecycle internals.
revoke execute on function public.archive_local_unit_member_record(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.archive_local_unit_member_record(uuid, uuid, text)
  from public, anon, authenticated;

revoke execute on function public.restore_local_unit_member_record(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.restore_local_unit_member_record(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.archive_local_unit_member_record(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.archive_local_unit_member_record(uuid, uuid, text)
  to service_role;
grant execute on function public.restore_local_unit_member_record(uuid, uuid)
  to service_role;
grant execute on function public.restore_local_unit_member_record(uuid, uuid, uuid)
  to service_role;

-- Super-admin preview helper. Server-only.
revoke execute on function public.list_super_admin_preview_local_units()
  from public, anon, authenticated;

grant execute on function public.list_super_admin_preview_local_units()
  to service_role;

-- RLS/bootstrap/internal sync helpers. Never browser-callable.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

revoke execute on function public.sync_organization_admin_assignment_from_council_admin_assignmen(uuid)
  from public, anon, authenticated;

revoke execute on function public.sync_user_unit_relationship_status_from_member_record()
  from public, anon, authenticated;

revoke execute on function public.trg_sync_org_admin_from_council_admin_assignment()
  from public, anon, authenticated;

grant execute on function public.rls_auto_enable()
  to service_role;
grant execute on function public.sync_organization_admin_assignment_from_council_admin_assignmen(uuid)
  to service_role;
grant execute on function public.sync_user_unit_relationship_status_from_member_record()
  to service_role;
grant execute on function public.trg_sync_org_admin_from_council_admin_assignment()
  to service_role;

comment on function public.archive_local_unit_member_record(uuid, uuid, uuid, text) is
  'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.archive_local_unit_member_record(uuid, uuid, text) is
  'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.restore_local_unit_member_record(uuid, uuid) is
  'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.restore_local_unit_member_record(uuid, uuid, uuid) is
  'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.list_super_admin_preview_local_units() is
  'Server-side super-admin helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.rls_auto_enable() is
  'Internal RLS/bootstrap helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.sync_organization_admin_assignment_from_council_admin_assignmen(uuid) is
  'Internal legacy organization-admin sync helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.sync_user_unit_relationship_status_from_member_record() is
  'Internal member relationship sync trigger/helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

comment on function public.trg_sync_org_admin_from_council_admin_assignment() is
  'Internal trigger helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

commit;
