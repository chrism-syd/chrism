# CCIC Supplies - Technical and Operational Handoff

_Last updated: September 20, 2026_

This is the canonical handoff for the `ccic.supplies` Celebrate Christ in Christmas (CCIC) ordering program. It records the current production logic and the business decisions behind it so future work does not have to reconstruct the system from chat or historical commits.

Where Git history differs from this document, inspect the current code before changing production behavior. Historical commits include experiments that were later superseded.

## 1. Purpose and operating model

`ccic.supplies` is the Canadian CCIC Christmas card ordering storefront, primarily serving Knights of Columbus councils and parishes.

It is intentionally not a conventional paid ecommerce checkout:

1. customer selects finished retail card boxes/cases and optional accessories;
2. customer chooses pickup or shipping;
3. the site calculates Shipping & Handling when possible;
4. customer submits an order request;
5. the order is stored in Supabase and appears in admin;
6. CCIC reviews the order and handles payment offline;
7. staff packs the order, verifies final physical weight and creates the shipping label manually;
8. staff advances the order status administratively.

**No payment is collected online.**

Customer-facing screens should stay simple and polished. Carrier mechanics, packing details and operational information belong in admin.

## 2. Repository, branches and deployment

- Repository: `chrism-syd/chrism`
- Primary shipping branch: `ccic-shiptime-canada-post`
- Christmas Seals feature branch: `ccic-christmas-seals`
- Production: `https://ccic.supplies/`
- Hosting/deployment: Vercel
- Database/order persistence: Supabase
- Outbound email: Brevo / `orders@ccic.supplies`

Important routes:

- storefront: `/ccic`
- review/order: `/ccic/review`
- admin orders: `/ccic/admin/orders`
- admin order detail: `/ccic/admin/orders/[id]`
- packing list: `/ccic/admin/packing-list`
- Store Control: `/ccic/admin/store-control`
- shipping API: `/api/ccic/shipping/rates`

Important implementation files:

- `lib/christmas-cards/catalog.ts`
- `lib/christmas-cards/order.ts`
- `lib/christmas-cards/inventory.ts`
- `lib/christmas-cards/canada-post.ts`
- `lib/christmas-cards/shiptime.ts`
- `app/api/ccic/shipping/rates/route.ts`
- `app/api/ccic/orders/route.ts`
- `app/christmas-cards/storefront-order-builder.tsx`
- `app/christmas-cards/review-order-form.tsx`
- `app/christmas-cards/google-address-autocomplete.tsx`

## 3. Core product model

### Standard retail card box

A finished clear PET retail box contains:

- 12 Christmas cards
- 12 envelopes

Approximate retail box dimensions:

- `5 13/16 x 8 13/16 x 1/2 in`
- decimal: `5.8125 x 8.8125 x 0.5 in`

Internal production cost reference: **$0.64 per card all-in**, including envelope and retail packaging, or **$7.68 per 12-card retail box**.

### Classic Case

A Classic Case contains **32 finished retail boxes**. The storefront also supports individual boxes and Custom Case combinations.

A retail box is not a shipping carton. Orders ship as finished retail packages.

### Product shipping weights

The active calculator uses measured finished-product weights:

- standard/case-eligible retail card box: **0.165 kg**
- heavier non-case-pricing Catholic Prayer Card box: **0.200 kg**
- Christmas Seals accessory sheet: **0.010 kg**

The regular/heavy card-box weights include cards, envelopes and the clear retail case.

## 4. Automated packing model

The calculator uses three shipping cartons:

| Card-box quantity | Carton | Calculator tare |
| --- | --- | ---: |
| 1-12 | `9 x 6 x 6 in` | **0.160 kg** |
| 13-32 | `12 x 9 x 9 in` | **0.270 kg** |
| 33-42 | `16 x 12 x 8 in` | **0.460 kg** |

For larger orders:

- 43-57 boxes: two medium cartons, split approximately evenly
- 58-74 boxes: 42 boxes in one large carton, remainder in one medium
- above 74: recursively allocate 42-box large cartons, then apply the normal rules to the remainder

Examples:

- 32 -> one medium
- 42 -> one large
- 47 -> 24 + 23 in two mediums
- 64 -> 42 large + 22 medium
- 128 -> 42 + 42 + 23 + 21

A few `19 x 9 x 6.75 in` cartons exist operationally. Geometry suggests roughly 39 retail boxes, but these are **not part of the automated calculator**.

### Deliberately conservative carton tare

Physical checks later measured approximately:

- medium `12 x 9 x 9`: **0.230 kg**
- large `16 x 12 x 8`: **0.345 kg**

**Do not replace the calculator tare values with those lower measurements.** The calculator intentionally retains **0.270 kg** and **0.460 kg** to provide a conservative weight buffer for packing material and normal fulfillment variation. Small remains **0.160 kg**.

Always confirm the final packed physical weight before purchasing the actual label.

## 5. Shipping & Handling pricing

The customer sees one combined **Shipping & Handling** amount.

The active price is:

**selected Canada Post carrier charge + $2.00 handling buffer per order**

The code constant is `SHIPPING_HANDLING_FEE_CENTS = 200` in `lib/christmas-cards/canada-post.ts`.

The **$2.00 handling buffer is intentional**. It helps cover CCIC's physical packaging/handling costs, including corrugated shipping cartons and normal packing materials. It is:

- added **once per order**, not once per parcel;
- added after the selected parcel carrier charges are combined;
- part of the customer-facing Shipping & Handling total;
- not itemized or explained separately to the customer;
- not an insurance charge.

Do not accidentally remove it when changing carrier/rating code, and do not multiply it by parcel count.

Customer checkout should not expose:

- carrier discount mechanics;
- connected-account/BYOR details;
- parcel-by-parcel pricing;
- service codes;
- insurance plumbing;
- transit estimates.

The admin UI also does not need a special explanatory line for the $2 buffer. It is an internal pricing rule.

## 6. Carrier/rating architecture

The intended carrier is Canada Post.

Current active path:

`CCIC checkout -> server shipping helper -> ShipTime REST API -> connected Canada Post account (BYOR)`

ShipTime is a rating bridge. It is not the preferred permanent architecture.

### ShipTime

Environment variables:

- `SHIPTIME_CLIENT_ID`
- `SHIPTIME_CLIENT_SECRET`

Endpoints:

- OAuth: `https://restapi.shiptime.com/oauth2/token`
- rates: `https://restapi.shiptime.com/rest/rates`

Requests include actual origin/destination, package dimensions/weight, metric units, next-business-day ship date and `SIGNATURE`.

ShipTime can return house rates and connected-account rates. Code prefers Canada Post rates where `isShipTimeCarrier === false`, meaning the connected/BYOR Canada Post account, and falls back to another Canada Post result if necessary.

ShipTime's Canada Post `totalCharge` is treated as the carrier charge. The $2 order-level handling buffer is then added by the CCIC shipping helper.

### Insurance

**Do not purchase additional shipping insurance.**

Current business decision: standard carrier coverage is sufficient. Do not send ShipTime insurance or declared value solely for insurance pricing.

Signature remains enabled.

### Direct Canada Post implementation

Direct Canada Post rating code is intentionally retained in `lib/christmas-cards/canada-post.ts` for a future switch-back.

Environment variables:

- `CANADA_POST_CLIENT_ID`
- `CANADA_POST_CLIENT_SECRET`
- `CANADA_POST_CUSTOMER_NUMBER`
- optional `CANADA_POST_CONTRACT_ID`

Canada Post customer number is `0001287681`; preserve leading zeros.

Production Developer Portal provisioning previously failed despite the Rating subscription appearing active. A traceable Aug. 31, 2026 production OAuth attempt returned HTTP 401 `unauthorized_client`, transaction ID `65587a596a95c4c4082fd8b1`. Canada Post Developer Support was contacted.

If direct production Rating becomes reliable, test parity first, then retire ShipTime from the active path. Do not delete the direct implementation while the issue remains unresolved.

## 7. Christmas Seals accessory

Christmas Seals are the first storefront accessory.

Current configuration:

- catalog ID: `ca-6021`
- SKU: `CA-6021`
- customer price: **$2.50 per sheet**
- 50 gold-stamped seals in 4 assorted colours per sheet
- description: “Sheet of 50 gold-stamped seals in 4 assorted colours. Self-sticking for easy use.”
- initial Supabase inventory: **20 sheets**
- measured shipping weight: **0.010 kg per sheet**
- `isAccessory: true`
- `isCasePricingEligible: false`
- storefront artwork: `/christmas-cards/christmas_seals.png`
- full-sheet detail artwork: `/christmas-cards/christmas-seals-sheet.jpg`

The storefront presents seals in a grey accessory banner before Catholic Prayer Cards, not as a normal card-gallery tile. Existing CardArt/Quick View displays the main artwork and full sheet.

### Why accessories still use `individual_box`

The live database constrains order-line types to `classic_case` and `individual_box`. Seals therefore intentionally remain an `individual_box` database line while catalog metadata marks them as an accessory. This avoided an unnecessary live schema migration.

Accessory rules:

- one ordered unit = one sheet;
- sheets do **not** count as card boxes;
- sheets do **not** contribute to Custom Case pricing;
- sheets do **not** count as heavier non-case-pricing card boxes;
- inventory decrements per sheet;
- low-stock logic should apply to accessories too, using **sheet/sheets** wording;
- sheet weight is included in shipping;
- seals-only shipping is valid;
- seals-only orders use the small carton without inventing a card box;
- cart totals/badges use total selected units so a seals-only cart is not treated as empty.

### Accessory shipping data path

All accessory-aware shipping paths must carry:

- `totalBoxes`
- `nonCasePricingBoxCount`
- `accessorySheetCount`

A live-test bug exposed that `review-order-form.tsx` included `accessorySheetCount` in its request cache key but omitted it from the shipping POST body. The result was:

- seals-only shipping appeared empty and failed to price;
- mixed orders priced but silently omitted seal weight.

Commit `c1885cd` corrected the request body. Preserve this field in both preview rating and server-side final order recalculation.

Weight examples:

- 1 seal sheet only: **0.170 kg** = 0.160 carton + 0.010 sheet
- 2 seal sheets only: **0.180 kg**
- 20 seal sheets only: **0.360 kg**
- 1 regular box + 1 seal: **0.335 kg**
- 1 heavy box + 1 seal: **0.370 kg**
- 32 regular boxes + 20 seals: **5.750 kg**

## 8. Order calculation and pricing rules

Order calculations live primarily in `lib/christmas-cards/order.ts`.

Important distinctions:

- Classic Cases are curated 32-box cases.
- Case-eligible individual boxes can accumulate toward Custom Case pricing.
- Non-case-pricing card products remain individual boxes and use the heavier 0.200 kg shipping profile.
- Accessories remain orderable inventory units but are excluded from all card-box/Custom Case counts.

Do not use `cardsPerBox` or database `line_type` alone to infer shipping semantics. Catalog flags such as `isAccessory` and `isCasePricingEligible` are intentional.

Historical order prices are immutable operational records. **Do not recalculate or overwrite a customer's stored Shipping & Handling or total because packing/weight logic later improves.**

## 9. Inventory

Inventory is stored in Supabase and exposed to storefront/admin through the existing CCIC inventory machinery.

Availability controls maximum storefront quantities. A product with zero availability is sold out.

Christmas Seals use the same inventory mechanism, with one unit representing one sheet. Low-stock messaging should apply consistently to card products and accessories, with product-appropriate nouns.

Inventory allocation RPC security was tightened in commit `6013813` (`Restrict CCIC inventory allocation RPC`).

## 10. Checkout and address UX

Customer-facing terminology uses **Individual Boxes**.

Key UX decisions:

- no online payment;
- Shipping & Handling is calculated from the entered shipping address;
- pickup remains $0;
- carrier/service/transit details stay hidden;
- if live rating fails, checkout clearly falls back to manual Shipping & Handling review rather than inventing a price;
- completed Custom Case combinations are grouped in the cart;
- accessories have their own cart/review grouping.

Google address autocomplete uses:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Maps JavaScript API
- Places API (New)

The key is intentionally client-visible and must be protected with Google Cloud website/API restrictions. Manual address entry remains available.

A prior React `removeChild` issue was fixed by separating React-owned status UI from the DOM host mutated by Google.

## 11. Supabase persistence

Core tables include:

- `ccic_orders`
- `ccic_order_lines`

Shipping quote metadata migration:

- `supabase/migrations/20260823023000_add_ccic_shipping_quote_metadata.sql`

If code reports a missing shipping-related column, confirm migrations before changing application logic.

Stored order shipping/total values represent what the customer was quoted at submission time and should remain unchanged later.

## 12. Admin workflow

Admin order detail intentionally contains more operational detail than customer checkout.

It includes:

- order/customer information;
- status workflow/timestamps;
- copy controls for customer/shipping details;
- order items;
- compact artwork thumbnails beside order items for packing reference;
- Shipping quote packing plan;
- carton dimensions and calculator pricing weight.

Individual product thumbnails use catalog front artwork. Classic Case uses the Classic 32 assortment image.

The packing plan is recomputed from current packing rules rather than stored as an immutable parcel-plan snapshot. At current order volume this is acceptable. If audit fidelity becomes important, store the parcel plan as JSON at order creation.

The packing-plan note should continue to remind staff to confirm final packed weight before creating the label.

## 13. Payment and fulfillment

After an order request:

1. CCIC reviews it;
2. payment instructions are handled offline;
3. staff packs finished retail products;
4. staff confirms actual packed weight;
5. staff creates the Canada Post label manually;
6. status is updated in admin.

Manual label creation is intentional at the present order volume. Do not automate fulfillment merely for architectural neatness.

## 14. Email/admin environment

Additional configuration includes:

- `CCIC_ORDER_ADMIN_EMAILS`
- `CCIC_ORDER_NOTIFICATION_EMAIL`
- `CCIC_ADMIN_SESSION_SECRET`

Do not place actual secrets in this handoff or commits.

Customer replies to `orders@ccic.supplies`; email routing/delivery infrastructure is operationally separate from the storefront order calculation.

## 15. Regression references

Real order `CCIC-26-4009` is a useful packing regression:

- 72 total card boxes
- 68 regular
- 4 heavier/non-case-pricing
- parcel 1: 42 boxes, **7.460 kg**
- parcel 2: 30 boxes, **5.290 kg**
- stored Shipping & Handling: **$48.25**
- stored total: **$789.05**

The product-aware weight correction did not change that historical stored customer price.

Other calculator checks:

- 1 regular box: **0.325 kg**
- 32 regular boxes: **5.550 kg**
- 42 regular boxes: **7.390 kg**

Final physical label weights still override calculator estimates operationally.

## 16. Important Git breadcrumbs

Useful historical commits include:

- `e749c4b` Add Canada Post rating backend for CCIC
- `97c5f7f` Expose server-side CCIC shipping rate endpoint
- `f18c17e` Remove fixed CCIC shipping charge
- `5815878` Calculate CCIC shipping from address on review screen
- `4e499fb` Persist verified Canada Post shipping price on CCIC orders
- `8629032` Support Canada Post contract rates and full-case multi-parcel quotes
- `cc9b1cf` Add CCIC two-carton shipping strategy
- `2b29eec` Add CCIC shipping handling allowance
- `959690b` Add CCIC packing plan to admin orders
- `8f519fb` Remove added insurance from CCIC shipping quotes
- `1ec7816` Stop declaring CCIC shipping insurance value
- `4479c60` Track heavier non-case CCIC boxes for shipping
- `7d20a89` Support heavier non-case CCIC boxes in shipping
- `8b124e6` Show product-aware CCIC packing weights in admin
- `c1885cd` Send seal sheet count in checkout shipping request

Git history contains intermediate experiments. Current code and the current decisions documented here supersede abandoned approaches.

## 17. Production guardrails

The storefront is live and receives real orders.

For future work:

- make surgical changes;
- avoid unrelated refactors while fixing live behavior;
- run `npm run build` before production deployment;
- preserve historical stored order prices/totals;
- verify inventory, pricing and shipping paths independently when touched;
- perform minimal live smoke tests without submitting unnecessary orders;
- do not expose carrier plumbing to customers;
- do not re-add paid insurance without a new business decision;
- preserve the **$2 handling buffer once per order**;
- preserve the deliberately conservative carton tare weights unless explicitly revisited;
- keep accessories excluded from card-box and Custom Case counts;
- keep direct Canada Post code until the production provisioning question is resolved.

The local development storefront may hit the project's login screen. A green build therefore does **not** mean a local end-to-end storefront test occurred. Do not claim UI/browser validation unless it was actually performed.

## 18. Future work

- Continue Canada Post Developer Support follow-up and test direct Rating if production provisioning is repaired.
- If direct Canada Post works reliably, compare rate parity before removing ShipTime from the active path.
- Keep manual label creation unless actual order volume warrants automation.
- Continue recording meaningful product, packing, pricing and fulfillment changes in this file.

## 19. Handoff usage

Future helpers should read this file first, then inspect the current implementation before making changes. In particular, shipping work should begin with `lib/christmas-cards/canada-post.ts` and `lib/christmas-cards/shiptime.ts`.

This file should be updated whenever a material CCIC decision changes, especially product semantics, carton capacities/weights, Shipping & Handling pricing, carrier integration, inventory behavior, payment workflow or fulfillment strategy.
