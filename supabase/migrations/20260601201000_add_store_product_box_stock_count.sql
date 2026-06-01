-- Add a simple admin-only stock count for sellable card boxes.
--
-- This is not public availability logic. It is a manual "boxes left" count
-- for super-admin catalog/order review workflows. Purchasers should not see
-- stock scarcity messaging.

begin;

alter table public.store_products
  add column if not exists boxes_left_count integer;

alter table public.store_products
  drop constraint if exists store_products_boxes_left_count_shape;

alter table public.store_products
  add constraint store_products_boxes_left_count_shape check (
    boxes_left_count is null
    or (
      product_kind = 'christmas_card_box'
      and boxes_left_count >= 0
    )
  );

comment on column public.store_products.boxes_left_count is
  'Admin-only manual count of sellable boxes left for a christmas_card_box product. Not displayed to purchasers and not public availability logic.';

commit;
