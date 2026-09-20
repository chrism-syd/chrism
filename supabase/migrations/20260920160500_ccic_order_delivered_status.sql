alter table public.ccic_orders
  drop constraint if exists ccic_orders_status_code_check;

alter table public.ccic_orders
  add constraint ccic_orders_status_code_check
  check (status_code in ('received', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'));
