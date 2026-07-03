begin;

-- Foundation for the server-only super-admin preview helper.
-- The following security hardening migration revokes public execution on this
-- function, so it must exist before that migration runs.

create or replace function public.list_super_admin_preview_local_units()
returns table (
  local_unit_id uuid,
  display_name text,
  official_name text,
  legacy_council_id uuid,
  legacy_organization_id uuid
)
language sql
stable
security definer
set search_path to public
as $$
  select
    lu.id as local_unit_id,
    lu.display_name,
    lu.official_name,
    lu.legacy_council_id,
    lu.legacy_organization_id
  from public.local_units lu
  join public.users u
    on u.id = auth.uid()
   and u.is_super_admin = true
   and u.is_active = true
  where lu.status <> 'archived'::public.local_unit_status
  order by lu.display_name, lu.official_name, lu.id;
$$;

comment on function public.list_super_admin_preview_local_units()
  is 'Server-side super-admin helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';

commit;
