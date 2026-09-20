# CCIC Supplies — Project Handoff

_Last updated: September 20, 2026_

This document is the working handoff for the `ccic.supplies` Celebrate Christ in Christmas (CCIC) Christmas card ordering program. It is intended to let another developer/helper pick up the project without reconstructing product strategy, checkout behavior, shipping decisions, admin workflow, or integration history from chat.

## 1. Project purpose

`ccic.supplies` is the ordering storefront for the Canadian CCIC Christmas card program. The primary customers are Knights of Columbus councils and parishes using the cards as a Christmas/fundraising program.

The experience is deliberately simpler than a conventional ecommerce store:

- customers assemble an order of finished retail card boxes/cases;
- the site calculates the order and, where possible, Shipping & Handling;
- the customer submits the order request;
- **no payment is collected online**;
- CCIC follows up with payment instructions/options and handles fulfillment operationally.

Customer-facing screens should remain polished and simple. Operational/carrier complexity belongs in the admin tools, not checkout.

## 2. Repository / deployment context

- Repository: `chrism-syd/chrism`
- Primary shipping branch: `ccic-shiptime-canada-post`
- Christmas seals feature branch: `ccic-christmas-seals`
- Production site: `https://ccic.supplies/`
- Hosting: Vercel
- Database/order persistence: Supabase
- Email: Brevo / `orders@ccic.supplies`

Important routes include:

- storefront: `/ccic`
- review/order page: `/ccic/review`
- admin orders: `/ccic/admin/orders`
- admin order detail: `/ccic/admin/orders/[id]`
- packing list: `/ccic/admin/packing-list`
- shipping rate API: `/api/ccic/shipping/rates`

Important shipping files:

- `lib/christmas-cards/shiptime.ts`
- `lib/christmas-cards/canada-post.ts`
- `app/api/ccic/shipping/rates/route.ts`
- `app/api/ccic/orders/route.ts`
- `app/christmas-cards/review-order-form.tsx`
- `app/christmas-cards/google-address-autocomplete.tsx`

## 3. Product / packaging model

### Retail product

Each finished clear PET retail box contains:

- 12 Christmas cards
- 12 envelopes

Retail box dimensions are approximately:

- `5 13/16 × 8 13/16 × 1/2 in`
- decimal: `5.8125 × 8.8125 × 0.5 in`

Internal production cost basis used in shipping/value discussions has been `$0.64 per card all-in`, including envelope and retail packaging, or `$7.68` per 12-card retail box.

### Classic Case

A Classic Case is **32 finished retail boxes**. The storefront also supports individual box selections and custom combinations.

Do not confuse a retail box with a shipping carton. Orders are shipped as **finished retail packages**, not unassembled components.

## 4. Shipping carton strategy

The active automated packing strategy uses two primary carton sizes:

| Retail boxes being packed | Shipping carton | Role |
| --- | --- | --- |
| up to 32 retail boxes | `12 × 9 × 9 in` | standard carton / full Classic Case |
| up to 42 retail boxes | `16 × 12 × 8 in` | large carton |

A `9 × 6 × 6 in` carton is also available as a **backup smaller carton** if a particular small shipment makes it useful. Physical discussion suggests roughly 10–12 retail boxes may fit using edge/upright packing, but it is not part of the automated shipping-calculator rules and should not be given its own threshold unless actual fulfillment experience shows a need for it.

For orders larger than a single carton, use combinations of the standard and large cartons. Avoid creating a nearly empty second carton when a more balanced split is operationally sensible. The calculator's packing algorithm is a useful estimate, but the final packed shipment may be adjusted manually.

**Current decision:** keep the shipping calculator based on the `12 × 9 × 9` and `16 × 12 × 8` cartons. Keep `9 × 6 × 6` documented only as an optional operational backup.

### Physical calibration still required

Weights in the calculator are provisional. Earlier calculations used an old 32-box shipment weight of 6.5 kg, giving a provisional per-retail-box weight of `6.5 / 32 = 0.203125 kg`.

Once the final printed cards, envelopes, retail boxes and cartons are physically available:

1. pack representative shipments in the 12×9×9 and 16×12×8 cartons;
2. confirm actual box-count fit for each carton;
3. optionally test the 9×6×6 backup carton for small shipments;
4. weigh the packed cartons;
5. replace the provisional weight model with measured profiles;
6. retest shipping-rate parity.

Final packed weight should always be confirmed before creating the actual label.

## 5. Shipping strategy

### Customer-facing philosophy

The customer sees a single **Shipping & Handling** amount.

Do not expose:

- carrier discount mechanics;
- insurance calculations;
- individual parcel pricing;
- service-code plumbing;
- transit estimates unless the product strategy changes.

A hidden **$2.00 handling allowance per order** is added to the calculated carrier amount to help cover carton/packing cost. It is once per order, not once per parcel.

### Carrier / rating path

The intended carrier is Canada Post.

Direct Canada Post Rating API integration was built, but Canada Post's new Developer Portal production provisioning has not behaved correctly. The direct implementation is intentionally retained in `lib/christmas-cards/canada-post.ts` so it can be reactivated if Canada Post fixes production access.

Current working rate path is:

`CCIC checkout → server shipping helper → ShipTime REST API → connected Canada Post account (BYOR)`

ShipTime is being used as a rating bridge, not as the long-term architectural preference. If Canada Post grants reliable direct production API access, the desired strategy is to retire ShipTime and call Canada Post directly.

### ShipTime rate selection

The ShipTime account has CCIC's own Canada Post account connected. ShipTime can return both ShipTime carrier rates and connected-account rates. Code prefers Canada Post results where `isShipTimeCarrier === false`, i.e. the connected/BYOR Canada Post rate, and falls back to another Canada Post result if necessary.

Actual labels can be created manually because expected order volume is modest (historically fewer than roughly 100 orders). There is no need to over-engineer automated label creation unless volume warrants it.

### Signature

The current ShipTime request includes the `SIGNATURE` service option. Keep this unless the business decision changes.

### Insurance decision — current

**Do not purchase additional shipping insurance.**

As of September 6, 2026, the business decision is that whatever standard coverage is included with the Canada Post service is sufficient. The shipping calculation should not add ShipTime insurance or an extra declared-value insurance premium.

The ShipTime implementation was updated accordingly:

- removed `insuranceType: 'SHIPTIME'`;
- removed the declared value from rate requests;
- retained Signature;
- retained the $2/order handling allowance.

Relevant commits:

- `8f519fb` — Remove added insurance from CCIC shipping quotes
- `1ec7816` — Stop declaring CCIC shipping insurance value

A Vancouver test after removing insurance used an order of 42 retail boxes (1 Classic Case of 32 plus 10 Individual Boxes). Merchandise subtotal was `$446.40`, Shipping & Handling was `$45.65`, and total was `$492.05`. This is a useful reference test for the current no-extra-insurance configuration.

## 6. Direct Canada Post API status

The direct Canada Post implementation uses:

- OAuth token endpoint: `https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token`
- Rating endpoint: `https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/prices`

Environment variables:

- `CANADA_POST_CLIENT_ID`
- `CANADA_POST_CLIENT_SECRET`
- `CANADA_POST_CUSTOMER_NUMBER`
- optional `CANADA_POST_CONTRACT_ID`

Customer number is displayed by Canada Post as `0001287681`; retain the leading zeros.

Production application:

- app: `[Production] CCIC Shipping Rates`
- Rating 4.0.0 subscription is shown in the Developer Portal.

Canada Post support was contacted because earlier Rating calls appeared to return static/mock Regular Parcel data (notably `$35.70` with fixed dates) regardless of payload, while portal analytics showed zero calls.

A later fresh OAuth test using verified Production credentials returned HTTP 401:

`unauthorized_client: Invalid client ID or secret, or client not subscribed to this API`

The Client ID/API key and secret were verified against the Production application. A traceable failed request on Aug. 31, 2026 at 14:15:32 EDT returned `x-global-transaction-id: 65587a596a95c4c4082fd8b1`.

This strongly suggests a Canada Post backend provisioning/subscription problem. Developer Support has been asked to investigate. Do not delete the direct Canada Post code while this is unresolved.

## 7. ShipTime integration

Server-side environment variables:

- `SHIPTIME_CLIENT_ID`
- `SHIPTIME_CLIENT_SECRET`

Endpoints currently used:

- OAuth: `https://restapi.shiptime.com/oauth2/token`
- rates: `https://restapi.shiptime.com/rest/rates`

Rate requests include:

- real origin/destination data;
- package dimensions and provisional weight;
- metric units;
- next-business-day ship date;
- Signature;
- no extra insurance.

The amount used by checkout is ShipTime's returned Canada Post `totalCharge`, with the order-level $2 handling allowance added afterward.

## 8. Address entry / Google Places

The review page uses Google address autocomplete to reduce bad shipping addresses.

Environment variable:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

This is intentionally client-visible because Google Maps/Places runs in the browser. The key must be restricted in Google Cloud rather than treated as a server secret.

Current restrictions established:

- Application restriction: Websites
- APIs: Maps JavaScript API + Places API (New)
- referrers include `http://localhost:3000/*` and `https://ccic.supplies/*`

The UI includes a manual-address fallback if Google is unavailable. Autocomplete populates the shipping fields and triggers the rate calculation. A prior React `removeChild` error was fixed by keeping React-owned status UI separate from the DOM host Google mutates.

## 9. Checkout / cart UX decisions

The storefront has been iterated heavily around a simple ordering experience.

Key decisions:

- terminology is **Individual Boxes**, not "Individual selections" in customer-facing copy;
- Classic Cases and individual boxes are distinguished clearly;
- completed custom-case combinations are grouped in the cart rather than leaving the customer to interpret raw quantities;
- redundant shipping rows/progress clutter were removed;
- the review screen calculates Shipping & Handling from the entered address;
- no payment is collected online;
- payment options are presented as part of the order-request workflow;
- carrier/service/transit details stay out of the customer experience;
- if live rating is unavailable, checkout uses clear manual-shipping fallback messaging rather than inventing a price.

Performance work included lazy-loading individual artwork while keeping important storefront imagery eager/priority where appropriate.

## 10. Order persistence / Supabase

Orders and lines are stored in Supabase, including tables such as:

- `ccic_orders`
- `ccic_order_lines`

Shipping quote metadata has a migration:

- `supabase/migrations/20260823023000_add_ccic_shipping_quote_metadata.sql`

The order flow persists the calculated shipping price/metadata where available. Inventory allocation RPC security was also tightened (`Restrict CCIC inventory allocation RPC`, commit `6013813`).

If an environment reports that a shipping-related column does not exist, check that all Supabase migrations have been applied before changing application code.

## 11. Admin order workflow

Admin order detail is intentionally more operational than customer checkout.

It includes:

- order/customer information;
- order status workflow and timestamps;
- customer-detail copy controls;
- individual copy buttons for Organization, Contact, Email, Phone and Address;
- `Copy shipping details` for fast manual label entry;
- order items;
- a separate **Shipping quote packing plan** card.

The packing-plan card shows the calculator's proposed parcel allocation, carton dimensions and provisional pricing weight. It is explicitly a calculator recommendation, not an instruction to blindly ship without weighing the carton.

Current note concept:

> Packing plan by the custom CCIC shipping calculator, using Canada Post via ShipTime. Confirm the final packed weight before creating the label.

Do not show an admin explanatory sentence about the $2 handling allowance. The allowance remains in the calculation but was deliberately removed from that UI.

The packing plan is currently recomputed from the present packing rules rather than stored as an immutable parcel-plan snapshot. At current low order volume this is acceptable. If historical/audit fidelity becomes important, store the parcel breakdown as JSON when the order is created.

## 12. Payment / fulfillment operating model

This is not a self-serve paid ecommerce checkout. The intended workflow is:

1. customer selects product;
2. customer provides contact/shipping details;
3. site calculates Shipping & Handling where possible;
4. customer submits order request;
5. order appears in admin;
6. CCIC reviews it and handles payment offline;
7. staff packs the finished retail boxes;
8. staff verifies final packed weight;
9. staff creates Canada Post label manually (currently via ShipTime/Canada Post workflow);
10. order status is advanced administratively.

This manual-last-mile strategy is intentional because expected volume does not justify a complicated fulfillment automation layer.

## 13. Key environment/configuration notes

In addition to shipping and Google variables, the CCIC order/admin flow has used:

- `CCIC_ORDER_ADMIN_EMAILS`
- `CCIC_ORDER_NOTIFICATION_EMAIL`
- `CCIC_ADMIN_SESSION_SECRET`

Admin email configuration currently expects the configured allowlist shape used by the application. Do not expose secrets in docs or commits.

## 14. Important recent shipping commits / evolution

Useful breadcrumbs in Git history include:

- `e749c4b` Add Canada Post rating backend for CCIC
- `97c5f7f` Expose server-side CCIC shipping rate endpoint
- `f18c17e` Remove fixed CCIC shipping charge
- `5815878` Calculate CCIC shipping from address on review screen
- `4e499fb` Persist verified Canada Post shipping price on CCIC orders
- `8629032` Support Canada Post contract rates and full-case multi-parcel quotes
- `cc9b1cf` Add CCIC two-carton shipping strategy
- `43e90ca` Include insurance and signature in CCIC shipping quotes (insurance later reversed)
- `2b29eec` Add CCIC shipping handling allowance
- `959690b` Add CCIC packing plan to admin orders
- `0f96d82` Separate CCIC packing plan admin card
- `d20bfe9` Remove CCIC packing plan handling note
- `e8d9260` Clarify CCIC packing plan source
- `8f519fb` Remove added insurance from CCIC shipping quotes
- `1ec7816` Stop declaring CCIC shipping insurance value

The commit history documents experimentation. **Current decisions in this handoff supersede earlier intermediate commits.** In particular, extra insurance is no longer part of the strategy.

## 15. Immediate next work

Highest-value next steps:

1. When physical product arrives, test actual fit in the primary `12 × 9 × 9` and `16 × 12 × 8` cartons and record real packed weights.
2. Test the `9 × 6 × 6` carton only as an optional backup for small shipments; do not add it to `buildCcicPackingPlan` unless real fulfillment experience justifies it.
3. Replace the provisional `6.5 kg / 32 boxes` weight model with measured values.
4. Re-run ShipTime/Canada Post quote comparisons after physical calibration.
5. Continue Canada Post Developer Support thread. If direct production Rating begins working reliably, test parity and then remove ShipTime from the active rating path.
6. Keep manual label creation unless actual order volume demonstrates a need for automation.

## 16. Guardrails for future helpers

- Do not redesign the checkout into a conventional online-payment store without an explicit business decision.
- Do not expose carrier plumbing, discounts, insurance, service codes or transit estimates to customers merely because the API provides them.
- Do not re-add paid insurance unless explicitly requested. Standard included carrier coverage is currently sufficient.
- Keep the $2 handling allowance once per **order**, not per parcel.
- Preserve direct Canada Post code until the Developer Portal production-access issue is resolved.
- Treat calculator weights as provisional until physical weighing is complete.
- Prefer simple manual operational workflows over automation for automation's sake at this order volume.
- The admin UI can show operational detail that the customer UI intentionally hides.
- The active packing calculator uses `12 × 9 × 9` and `16 × 12 × 8`. The `9 × 6 × 6` carton is backup-only and should not be added to automated packing rules without a new decision.

## 17. September 2026 measured shipping model

The provisional shipping notes earlier in this document are historical. The live calculator has since been calibrated with measured finished products and deliberately conservative carton tare weights.

### Product weights used by the calculator

- standard/case-eligible finished retail card box: **0.165 kg**
- non-case-pricing Catholic Prayer Card box: **0.200 kg**
- Christmas Seals accessory sheet: **0.010 kg**

The 0.200 kg rule applies to the heavier non-case-pricing individual card boxes, not to accessories.

### Automated cartons

| Carton | Automated capacity | Calculator tare |
| --- | ---: | ---: |
| 9 × 6 × 6 in | 1–12 card boxes | **0.160 kg** |
| 12 × 9 × 9 in | 13–32 card boxes | **0.270 kg** |
| 16 × 12 × 8 in | 33–42 card boxes | **0.460 kg** |

The medium and large cartons were later physically weighed at approximately 0.230 kg and 0.345 kg respectively. **Do not replace the calculator values with those lower figures.** The 0.270/0.460 kg values were intentionally retained as a conservative packing-material/weight buffer.

Current packing behavior:

- 1–12 boxes → one small carton
- 13–32 → one medium carton
- 33–42 → one large carton
- 43–57 → two medium cartons, approximately balanced
- 58–74 → 42 in a large carton plus the remainder in a medium
- above 74 → recursively allocate 42-box large cartons, then apply the normal rules to the remainder

A few \`19 × 9 × 6.75 in\` cartons may exist operationally and appear capable of holding roughly 39 retail boxes. They are **not** part of the automated calculator.

Final packed weight must still be confirmed before purchasing a label.

## 18. Christmas Seals accessory

Christmas Seals were added on the isolated \`ccic-christmas-seals\` branch as SKU **CA-6021**.

Current product configuration:

- customer price: **$2.50 per sheet**
- each sheet contains **50 gold-stamped seals in 4 assorted colours**
- customer copy: “Sheet of 50 gold-stamped seals in 4 assorted colours. Self-sticking for easy use.”
- starting inventory entered in Supabase: **20 sheets**
- measured shipping weight: **10 g per sheet**
- main transparent storefront artwork: \`/public/christmas-cards/christmas_seals.png\`
- detail/full-sheet artwork: \`/public/christmas-cards/christmas-seals-sheet.jpg\`

The seals are modeled inside the existing catalog/order machinery but marked with \`isAccessory: true\`. This is deliberate. The live database constrains order-line types to \`classic_case\` and \`individual_box\`, so introducing a third line type would have required an unnecessary live schema migration.

Accessory rules:

- seals remain an \`individual_box\` database line for compatibility;
- they **do not count as card boxes**;
- they **do not contribute to Custom Case pricing**;
- they **do not count as heavier non-case-pricing card boxes**;
- inventory allocates one unit per sheet;
- cart/review/admin wording identifies them as sheets/accessories;
- their 10 g-per-sheet weight is included in shipping;
- a seals-only shipping order is valid and uses the small carton rather than inventing a card box;
- the cart badge uses total selected units so a seals-only cart is not displayed as empty.

The storefront presents the accessory as a grey separator banner immediately before the Catholic Prayer Cards collection rather than as a normal card-gallery tile. Clicking its artwork uses the existing Quick View/lightbox and provides the transparent seals view plus the full-sheet image.

### Important shipping request detail

Both the client-side review shipping request and the server-side final order calculation must pass \`accessorySheetCount\`. A bug was found where the request key included the sheet count but the POST body omitted it. That caused seals-only shipping to be interpreted as an empty cart and caused mixed-order quotes to omit seal weight. The checkout request was corrected in commit \`c1885cd\`.

When changing accessory shipping in future, verify all three counts travel through the complete path:

- \`totalBoxes\`
- \`nonCasePricingBoxCount\`
- \`accessorySheetCount\`

## 19. Current admin / inventory behavior

The admin Store Control language now uses **Products** / **Product inventory** so accessories are not mislabeled as card boxes.

Order detail reconstructs the current product mix from saved order lines and uses it to show the operational packing plan. It distinguishes card boxes from seal sheets.

A compact artwork thumbnail has also been added beside each item in **Admin → Order details → Order items**. Individual products use their catalog front artwork; the Classic Case uses the existing Classic 32 assortment image. This is a visual packing/reference aid only and does not affect order data.

Historical customer shipping amounts are not recalculated or rewritten when packing logic improves. Existing paid orders retain the Shipping & Handling amount stored when they were submitted.

## 20. Regression references

A useful real-order regression is order \`CCIC-26-4009\`: 72 card boxes total, consisting of 68 regular boxes and 4 heavier non-case-pricing boxes. The corrected packing model produces:

- parcel 1: 42 boxes, **7.460 kg**
- parcel 2: 30 boxes, **5.290 kg**

The stored customer Shipping & Handling remains **$48.25** and the stored order total remains **$789.05**.

Useful single-parcel weight checks:

- 1 regular card box in small carton → **0.325 kg**
- 1 regular box + 1 seal sheet → **0.335 kg**
- 1 heavy box + 1 seal sheet → **0.370 kg**
- 32 regular boxes in medium carton → **5.550 kg**
- 32 regular boxes + 20 seal sheets → **5.750 kg**
- 1 seal sheet only in small carton → **0.170 kg**
- 20 seal sheets only in small carton → **0.360 kg**

These are calculator expectations, not substitutes for final physical label weights.

## 21. Safe-change / deployment practice

The CCIC storefront is live and receives real orders. Treat changes as production-sensitive.

Preferred workflow:

1. make narrow changes on an isolated branch where practical;
2. avoid unrelated refactors while fixing live behavior;
3. run \`npm run build\` before production deployment;
4. preserve stored historical order prices/totals;
5. verify inventory/order/shipping behavior independently when a change touches those paths;
6. deploy with Vercel only after the branch/build is clean;
7. perform a minimal live smoke test without submitting unnecessary test orders.

The local development storefront may be blocked by the project's login behavior, so a green build does not imply that a local end-to-end storefront test was performed. Do not claim browser/UI validation unless it was actually performed.

## 22. Handoff usage

A new helper should start by reading this document, then inspect the current branch implementation rather than assuming every historical commit still represents current strategy. The most important live code for shipping is `lib/christmas-cards/canada-post.ts` and `lib/christmas-cards/shiptime.ts`.

Update this handoff whenever a material CCIC decision changes, especially carton capacities/weights, carrier integration, payment workflow, or fulfillment strategy.