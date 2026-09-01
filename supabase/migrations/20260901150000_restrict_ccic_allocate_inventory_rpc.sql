-- CCIC storefront inventory allocation is server-only.
-- Keep SECURITY DEFINER because the routine coordinates writes across locked CCIC tables,
-- but remove direct API execution from anonymous and signed-in client roles.

revoke execute
on function public.ccic_allocate_order_inventory(uuid, jsonb)
from anon, authenticated;

grant execute
on function public.ccic_allocate_order_inventory(uuid, jsonb)
to service_role;
