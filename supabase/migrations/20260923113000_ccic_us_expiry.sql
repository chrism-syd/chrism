-- Automatically release abandoned U.S. inventory reservations.
-- Inventory availability already ignores cancelled orders, so expiry is implemented
-- by cancelling only U.S. orders whose customer-confirmation deadline has passed.

create or replace function public.ccic_expire_us_order_confirmations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.ccic_orders
     set us_confirmation_status = 'expired',
         status_code = 'cancelled',
         us_expired_at = coalesce(us_expired_at, now()),
         updated_at = now()
   where market_code = 'US'
     and us_confirmation_status = 'awaiting_customer_confirmation'
     and us_confirmation_expires_at is not null
     and us_confirmation_expires_at <= now()
     and status_code <> 'cancelled';

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.ccic_expire_us_order_confirmations() from public;
grant execute on function public.ccic_expire_us_order_confirmations() to service_role;
