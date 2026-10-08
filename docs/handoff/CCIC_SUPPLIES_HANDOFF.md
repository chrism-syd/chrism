# CCIC Supplies — Project Handoff

_Last updated: October 8, 2026 (school fundraiser / Square sandbox update)_

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
- Current working branch for shipping work: `ccic-shiptime-canada-post`
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

## 17. Handoff usage

A new helper should start by reading this document, then inspect the current branch implementation rather than assuming every historical commit still represents current strategy. The most important live code for shipping is `lib/christmas-cards/canada-post.ts` and `lib/christmas-cards/shiptime.ts`.

Update this handoff whenever a material CCIC decision changes, especially carton capacities/weights, carrier integration, payment workflow, or fulfillment strategy.

---

## 18. October 8, 2026: School fundraiser checkout and Square sandbox

**This section supersedes the older “no online payment” language ONLY for school-specific fundraisers.** The original council/parish storefront remains an offline cheque/e-transfer order-request workflow. Never accidentally migrate the council checkout to Square.

### Branch, routes, and schools

- Development branch: `ccic-school-mixed-inventory` in `chrism-syd/chrism`.
- Main school route: `/ccic/schools-2/[school]`.
- School checkout: `/ccic/schools-2/[school]/checkout`.
- Original `/ccic/schools/[school]` routes remain separately implemented; do not assume the new `schools-2` changes automatically update the older route.
- School registry: `lib/christmas-cards/schools.ts`. Schools currently include St. Francis Xavier, St. Edward, St. Patrick, San Lorenzo Ruiz, All Saints, and St. Brother André. The new dynamic route resolves registered schools, but **only St. Francis Xavier has explicit cutoff and delivery dates configured**. Other schools need their own campaign configuration before public launch.
- St. Francis Xavier: `STFRANCISXAVIER26`, ordering closes **November 15, 2026, 11:59:59 p.m. Eastern**; delivery by **November 30, 2026**. Date labels are derived from registry config, not hard-coded across schools.
- When ordering closes, leave QR-code URL accessible, show the products without purchase controls, and block checkout. Server payment endpoint independently enforces campaign cutoff.

### School product, pricing, inventory

- Four mixed-box SKUs: `CCIC-26-01-MIX` through `CCIC-26-04-MIX`.
- Each mixed box: 12 cards and envelopes, three cards from each of four designs.
- Price: **$16.90 CAD per box**. School contribution: **$4.50 per box**.
- Mixed inventory commitments: `ccic_mixed_box_commitments`.
- For each collection, one full source box of each of four designs is reserved for every started batch of four mixed boxes: `ceil(committedMixedBoxes / 4)` source boxes per design. This reservation also reduces regular storefront availability.
- New `ccic_finalize_school_payment` database function commits each order's mixed inventory **once** under a row lock. It is safe to call again for an already-finalized order.
- **Not yet solved:** simultaneous different customers can pass the pre-payment availability read before either finalizes, so strict stock reservation/capacity enforcement under concurrent checkouts remains a production gate. There is no expiring inventory hold at checkout yet.

### School UX

- Mixed-only storefront component: `app/christmas-cards/school-mixed-storefront.tsx`.
- School checkout: `app/christmas-cards/school-checkout-form.tsx`; styling `school-checkout.css`.
- Parent/guardian name, email, optional phone; student name, grade, room, teacher.
- No shipping address. School delivers to classrooms. Student information is sensitive and must not be sent to Square.
- Intro pink band contains boxed `Order by` / `Delivery by` labels, when configured.
- Checkout has dark-red/white error alerts, Square embedded sandbox card form, and payment confirmation.
- The school draft and contact details currently use browser `sessionStorage`; clear after confirmed payment.

### Square sandbox setup

- Square Developer application: **CCIC Web School Fundraisers**.
- Sandbox location ID: `LF8QJQQ2CK288` (public identifier).
- Local `.env.local` (never commit secrets):
  - `SQUARE_APPLICATION_ID` = sandbox application ID
  - `SQUARE_ACCESS_TOKEN` = sandbox secret token
  - `SQUARE_LOCATION_ID=LF8QJQQ2CK288`
  - `SQUARE_ENVIRONMENT=sandbox`
  - `PII_ENCRYPTION_KEY` = existing encryption secret
- The server checkout route passes safe application/location identifiers to the browser. Access token stays server-side.
- Browser SDK: `https://sandbox.web.squarecdn.com/v1/square.js`.
- Square API endpoint: `https://connect.squareupsandbox.com/v2/payments`.
- School payment API: `app/api/ccic/school-payments/route.ts`.
- Webhook endpoint: `app/api/ccic/square-webhook/route.ts`.
- The payment API is deliberately **sandbox-only**. Do not flip to production by merely changing an env var. Production readiness requires separate explicit review.
- No raw card numbers stored or transmitted through CCIC servers.
- No student/classroom details in Square notes, metadata, or reference IDs.

### Supabase tables and security

- Project: **Chrism-main** (`wvaaijbvukzyfaglifoc`), Canada region.
- `ccic_school_orders`: one school checkout/payment attempt, encrypted parent/contact and student/classroom fields, Square references, statuses, totals, contribution, idempotency key, inventory and email timestamps.
- `ccic_school_order_lines`: SKUs, quantities, prices.
- `ccic_square_webhook_events`: webhook event receipt and processing audit.
- `ccic_mixed_box_commitments`: committed mixed-box quantities by collection.
- Service-role-only access; RLS enabled, anon/auth revoked. The application uses `lib/security/pii.ts` AES-GCM protection.
- Migrations:
  - `20261008010000_ccic_mixed_box_inventory.sql`
  - `20261008150000_ccic_school_orders.sql`
  - `20261008194500_ccic_school_payment_hardening.sql`
- Hardening SQL was executed on connected Chrism-main project. The original school order and inventory migrations were also previously applied.

### Payment lifecycle and safeguards (October 8)

1. Browser validates details and tokenizes card using Square's SDK.
2. Client retains a UUID checkout key in `sessionStorage`. Server checks it against unique `checkout_key` to block accidental repeat charges.
3. Server validates school, cutoff, cart/prices, contact fields and inventory availability. A transient Supabase inventory fetch is retried once. On persistent failure, returns 503 **before charging**.
4. Server persists pending order and lines before calling Square. Square's idempotency key is the stored order UUID; Square reference ID is the order UUID.
5. Explicit Square decline marks `payment_failed`; a timeout or unknown response **does not** assume payment failed. Such attempts remain pending and must be reconciled, not blindly retried.
6. For completed payments, `lib/christmas-cards/school-payment-finalize.ts` verifies Square payment ID, reference, location, CAD amount, environment, and completed status before calling the atomic database finalizer.
7. Finalizer marks paid and commits mixed inventory once, even if browser and webhook both run it.
8. Confirmation email uses Brevo from `orders@ccic.supplies`; email claim/sent/error timestamps support deduplication and investigation. Emails are best-effort and must not reverse successful payments.
9. Signed Square `payment.created`/`payment.updated` webhooks independently retrieve payment from Square before reconciliation; webhook signature uses HMAC-SHA256 of notification URL plus exact raw request body, compared in constant time. Event IDs are logged to avoid reprocessing completed deliveries.

**Important remaining risks:** Confirmation email delivery has not been sandbox-tested; if Brevo accepts a message but the response is lost, automatic retry could send a duplicate. Checkout key prevents duplicate submissions within one browser session, but separate sessions or manually restarted orders need operational reconciliation. Stock capacity still needs atomic pre-payment reservation. Refund/cancellation accounting and rollback of mixed commitments are not implemented.

### Verified sandbox transaction

On **October 8, 2026**, the first sandbox payment succeeded:

- Order `CCIC-S-26-3BA40829`, school `STFRANCISXAVIER26`.
- 1 × Collection 3 + 1 × Collection 4 = **$33.80 CAD**.
- School contribution = **$9.00**.
- Supabase status `paid`, Square status `COMPLETED`, Square payment ID stored.
- `ccic_mixed_box_commitments`: 1 each for `ccic-26-03-mix` and `ccic-26-04-mix`.
- After the hardening migration, running `ccic_finalize_school_payment` again for the same paid order returned `false` (no new inventory committed). Existing counts were preserved.
- This order predates confirmation-email code and was not automatically emailed.

### Square webhook configuration STILL REQUIRED

The webhook handler code is committed but **not activated/tested against real Square webhook deliveries**. In the Square Developer dashboard, create a **Sandbox** webhook subscription for `payment.created` and `payment.updated` pointing to a publicly reachable HTTPS URL ending in `/api/ccic/square-webhook`. Then configure the server-only environment variables:

- `SQUARE_WEBHOOK_SIGNATURE_KEY`: subscription signature key, never expose.
- `SQUARE_WEBHOOK_NOTIFICATION_URL`: exact full notification URL as registered with Square; signature validation depends on an exact match.

Localhost cannot directly receive Square webhooks. Use a safe temporary HTTPS tunnel or a protected sandbox-only deployment, **not the live public CCIC site**. Verify valid signature, rejected invalid signature, duplicate delivery, delayed completion, and missing browser callback. Never paste the signature key into chat.

### Production gates and immediate next steps

1. **Pull and build/test** current branch locally (`git pull`, `npm run build` or `npx tsc --noEmit`). New hardening code has **not yet been validated by a full local TypeScript/build run**.
2. Set up sandbox webhook subscription and secrets; test verified webhook delivery and recovery.
3. Test new sandbox orders after hardening: success, explicit decline, repeated submission, delayed/unknown Square outcome, duplicate webhook, inventory idempotency, and confirmation email.
4. Add atomic capacity-aware temporary reservations with expiry before allowing simultaneous customer purchases at production scale.
5. Implement admin reconciliation for pending/unknown payments and refunds; do not automatically refund or decrement inventory on arbitrary webhook state changes.
6. Validate email sender/domain, deliverability, copy and school-specific delivery date; set privacy retention policy for student data.
7. Build `CCIC Admin → School Fundraisers`: school selector, campaign totals, paid orders, collection quantities, school proceeds, packing/distribution export grouped Teacher → Room → Student.
8. Configure per-school dates and pilot activation; verify other `schools-2` slugs and original `schools` routes independently.
9. Separate sandbox from production, review merchant of record/settlement and fees, and conduct explicit production cutover review before enabling live cards.

**Safety:** The original council store remains unchanged. Do not store secret Square credentials in GitHub, handoff documents or chat. Do not interpret a payment HTTP timeout as proof of failure. Do not mark a payment complete solely because a client or unverified webhook says so.

