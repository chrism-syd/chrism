alter table public.ccic_orders
  drop constraint if exists ccic_orders_status_code_check;

update public.ccic_orders
set status_code = case status_code
  when 'new' then 'received'
  when 'reviewing' then 'received'
  when 'confirmed' then 'paid'
  when 'fulfilled' then 'shipped'
  else status_code
end;

alter table public.ccic_orders
  alter column status_code set default 'received';

alter table public.ccic_orders
  add constraint ccic_orders_status_code_check
  check (status_code in ('received', 'paid', 'packed', 'shipped', 'cancelled'));

alter table public.ccic_orders
  add column if not exists paid_at timestamptz,
  add column if not exists packed_at timestamptz,
  add column if not exists shipped_at timestamptz;

create index if not exists ccic_orders_workflow_idx
  on public.ccic_orders (status_code, created_at asc);
