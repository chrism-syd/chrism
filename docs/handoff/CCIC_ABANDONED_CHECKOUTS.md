# CCIC council abandoned checkouts

Base branch: `ccic-school-v2-production-prep`. Work branch: `ccic-abandoned-checkouts`.
No changes to school checkout, school payments, pricing, shipping quotes, or inventory.

## Operation
- Only the regular CCIC **shipping** review form sends checkout activity.
- A name and valid email are required before tracking starts. Customer, council, phone, cart lines, and displayed shipping estimate are saved after a 1.2-second input pause.
- A checkout appears in `/ccic/admin/abandoned-checkouts` after 60 minutes with no saved activity.
- Once an order is successfully created and inventory allocated, its checkout record is marked completed and excluded.
- Activity tracking is best-effort and must never prevent a customer from submitting an order.
- Email and phone are encrypted using the existing PII helpers. Admin access uses existing CCIC order-admin sessions.
- No automatic messages, discount codes, or Google Analytics are included.
- School and pickup checkouts are excluded.

## Before deployment
1. Apply `supabase/migrations/20261008220000_ccic_abandoned_checkouts.sql` to the target Supabase database.
2. Run `npm run typecheck` and `npm run build` on this branch.
3. Test an incomplete shipping checkout with a real-looking but controlled contact and quote; verify it appears after 60 minutes.
4. Test a completed order in a safe environment; verify the record is marked completed and never appears as abandoned.
5. Confirm pickup and school checkout do not call `/api/ccic/checkout-activity`.
6. Add operational retention cleanup for abandoned records (suggested 90 days) before production rollout.

**Do not deploy to production without these checks.** The migration is additive but required by the tracking endpoint and admin page.
