-- Store catalog foundation.
--
-- Current use case: Celebrate Christ in Christmas boxed card catalog.
-- Future-safe, but intentionally not a full marketplace model.
--
-- CCiC product truth preserved here:
--   - card art is sold as boxes, not individual cards
--   - each Christmas card box contains 12 cards + 12 envelopes
--   - a Christmas card case contains 35 boxes

begin;

create table public.store_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_auth_user_id uuid,
  updated_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_categories_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint store_categories_slug_unique unique (slug)
);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.store_categories(id) on delete restrict,
  slug text not null,
  sku text,
  product_kind text not null,
  title text not null,
  short_description text,
  description text,
  price_cents integer not null default 0,
  currency_code text not null default 'CAD',
  status_code text not null default 'draft',
  is_public boolean not null default false,
  sort_order integer not null default 0,
  cards_per_box integer,
  envelopes_per_box integer,
  boxes_per_case integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by_auth_user_id uuid,
  updated_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_products_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint store_products_slug_unique unique (slug),
  constraint store_products_sku_unique unique (sku),
  constraint store_products_price_nonnegative check (price_cents >= 0),
  constraint store_products_currency_code_format check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$'),
  constraint store_products_status_code_check check (status_code in ('draft', 'active', 'archived')),
  constraint store_products_product_kind_check check (product_kind in (
    'christmas_card_box',
    'christmas_card_set',
    'christmas_card_case',
    'store_add_on',
    'physical_item'
  )),
  constraint store_products_christmas_card_box_shape check (
    product_kind <> 'christmas_card_box'
    or (
      cards_per_box = 12
      and envelopes_per_box = 12
      and boxes_per_case is null
    )
  ),
  constraint store_products_christmas_card_case_shape check (
    product_kind <> 'christmas_card_case'
    or (
      boxes_per_case = 35
      and cards_per_box is null
      and envelopes_per_box is null
    )
  )
);

create table public.store_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  media_kind text not null default 'gallery',
  public_url text,
  storage_bucket text,
  storage_path text,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by_auth_user_id uuid,
  updated_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_media_kind_check check (media_kind in ('front', 'inside', 'outside', 'gallery', 'logo', 'preview')),
  constraint store_product_media_has_source check (
    public_url is not null
    or (storage_bucket is not null and storage_path is not null)
  )
);

create table public.store_product_components (
  id uuid primary key default gen_random_uuid(),
  parent_product_id uuid not null references public.store_products(id) on delete cascade,
  component_product_id uuid not null references public.store_products(id) on delete restrict,
  quantity integer not null,
  component_role text not null default 'included',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by_auth_user_id uuid,
  updated_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_components_not_self check (parent_product_id <> component_product_id),
  constraint store_product_components_quantity_positive check (quantity > 0),
  constraint store_product_components_role_check check (component_role in ('included', 'optional')),
  constraint store_product_components_unique unique (parent_product_id, component_product_id, component_role)
);

create table public.store_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text,
  description text,
  discount_kind text not null,
  discount_percent numeric(5, 2),
  discount_cents integer,
  currency_code text not null default 'CAD',
  applies_to_category_id uuid references public.store_categories(id) on delete restrict,
  applies_to_product_id uuid references public.store_products(id) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_auth_user_id uuid,
  updated_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_promo_codes_code_format check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  constraint store_promo_codes_code_unique unique (code),
  constraint store_promo_codes_discount_kind_check check (discount_kind in ('percent', 'amount_cents')),
  constraint store_promo_codes_currency_code_format check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$'),
  constraint store_promo_codes_discount_shape check (
    (
      discount_kind = 'percent'
      and discount_percent is not null
      and discount_percent > 0
      and discount_percent <= 100
      and discount_cents is null
    )
    or (
      discount_kind = 'amount_cents'
      and discount_cents is not null
      and discount_cents > 0
      and discount_percent is null
    )
  ),
  constraint store_promo_codes_redemptions_positive check (max_redemptions is null or max_redemptions > 0),
  constraint store_promo_codes_time_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index store_categories_active_sort_idx
  on public.store_categories (is_active, sort_order, name);

create index store_products_category_status_sort_idx
  on public.store_products (category_id, status_code, sort_order, title);

create index store_products_kind_idx
  on public.store_products (product_kind);

create index store_product_media_product_sort_idx
  on public.store_product_media (product_id, sort_order);

create index store_product_components_parent_sort_idx
  on public.store_product_components (parent_product_id, sort_order);

create index store_product_components_component_idx
  on public.store_product_components (component_product_id);

create index store_promo_codes_active_window_idx
  on public.store_promo_codes (is_active, starts_at, ends_at);

alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_media enable row level security;
alter table public.store_product_components enable row level security;
alter table public.store_promo_codes enable row level security;

revoke all on table public.store_categories from anon, authenticated;
revoke all on table public.store_products from anon, authenticated;
revoke all on table public.store_product_media from anon, authenticated;
revoke all on table public.store_product_components from anon, authenticated;
revoke all on table public.store_promo_codes from anon, authenticated;

grant select, insert, update, delete on table public.store_categories to service_role;
grant select, insert, update, delete on table public.store_products to service_role;
grant select, insert, update, delete on table public.store_product_media to service_role;
grant select, insert, update, delete on table public.store_product_components to service_role;
grant select, insert, update, delete on table public.store_promo_codes to service_role;

comment on table public.store_categories is
  'Server-managed store category table. First use is CCiC Christmas cards; future categories may include rosaries, prayer cards, apparel, and other simple physical goods.';

comment on table public.store_products is
  'Server-managed store product table. Christmas card products are boxes, sets, cases, or add-ons. Individual CCiC cards are intentionally not sellable products.';

comment on column public.store_products.product_kind is
  'Supported kinds: christmas_card_box, christmas_card_set, christmas_card_case, store_add_on, physical_item. Keep this intentionally small; this is not a marketplace model.';

comment on column public.store_products.cards_per_box is
  'For christmas_card_box products, must be 12. Single-card CCiC products are not allowed.';

comment on column public.store_products.envelopes_per_box is
  'For christmas_card_box products, must be 12.';

comment on column public.store_products.boxes_per_case is
  'For christmas_card_case products, must be 35.';

comment on table public.store_product_components is
  'Composition table for sets and cases. Example: a CCiC case can contain selected card-box products directly or through set products.';

comment on table public.store_promo_codes is
  'Server-managed promo code table for simple category/product discounts. Redemption/order tracking is intentionally deferred.';

commit;
