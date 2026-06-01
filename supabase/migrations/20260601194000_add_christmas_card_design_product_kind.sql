-- Add internal, non-sellable CCiC card designs.
--
-- A sellable christmas_card_box is a 12-pack. Each box can contain four
-- christmas_card_design products at three cards each. Designs are not sold
-- directly and do not carry box/case sizing.

begin;

alter table public.store_products
  drop constraint if exists store_products_product_kind_check;

alter table public.store_products
  add constraint store_products_product_kind_check check (product_kind in (
    'christmas_card_design',
    'christmas_card_box',
    'christmas_card_set',
    'christmas_card_case',
    'store_add_on',
    'physical_item'
  ));

alter table public.store_products
  drop constraint if exists store_products_christmas_card_design_shape;

alter table public.store_products
  add constraint store_products_christmas_card_design_shape check (
    product_kind <> 'christmas_card_design'
    or (
      price_cents = 0
      and is_public = false
      and cards_per_box is null
      and envelopes_per_box is null
      and boxes_per_case is null
    )
  );

comment on column public.store_products.product_kind is
  'Supported kinds: christmas_card_design, christmas_card_box, christmas_card_set, christmas_card_case, store_add_on, physical_item. Card designs are internal, non-sellable components of boxed CCiC 12-packs.';

comment on table public.store_product_components is
  'Composition table for store products. Example: a CCiC 12-pack box contains card design products, and a CCiC case contains selected card-box products.';

commit;
