-- Allow store case products to carry the actual saved box count.
--
-- Original CCiC seed starts at 35 boxes, but admins may intentionally change
-- case composition later. The admin UI requires confirmation and updates
-- boxes_per_case to match the saved composition total.

begin;

alter table public.store_products
  drop constraint if exists store_products_christmas_card_case_shape;

alter table public.store_products
  add constraint store_products_christmas_card_case_shape check (
    product_kind <> 'christmas_card_case'
    or (
      boxes_per_case is not null
      and boxes_per_case > 0
      and cards_per_box is null
      and envelopes_per_box is null
    )
  );

comment on column public.store_products.boxes_per_case is
  'For christmas_card_case products, stores the current saved number of boxes in the case. Initial CCiC seed is 35, but admins may intentionally change the composition total with confirmation.';

commit;
