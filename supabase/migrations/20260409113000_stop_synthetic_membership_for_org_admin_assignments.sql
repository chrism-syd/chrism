begin;

create or replace function public.ensure_parallel_membership_for_org_admin_assignment(
  p_assignment_id uuid
)
returns void
language plpgsql
as $$
begin
  -- Intentionally no-op.
  --
  -- Organization-scoped admin assignments must no longer synthesize
  -- member_records / user_unit_relationships for external admins.
  -- Direct admin access is now derived from the real admin assignment path
  -- in application permissions, while true local-member mappings can still
  -- be reused by the downstream grant sync if they already exist.
  return;
end;
$$;

comment on function public.ensure_parallel_membership_for_org_admin_assignment(uuid) is
  'No-op bridge retained for compatibility. Organization admin assignments must not synthesize member_records or user_unit_relationships for external admins.';

commit;
