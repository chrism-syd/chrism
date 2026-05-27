# HANDOFF - May 27 Admin Invite + CCiC Storefront

## Current status

This handoff covers the long May 20-27 working thread that focused on two major seams:

1. Admin invite onboarding / Brevo delivery hardening.
2. Public Celebrate Christ in Christmas (`/christmas-cards`) storefront scaffold and pricing/UX polish.

As of this handoff, latest changes have been committed directly to `main`. Vercel should deploy from `main`.

Important: after the last direct commits, run local verification before starting more work:

```bash
cd /Users/syd.fernandez/Chrism

git checkout main
git pull --ff-only origin main

npm run verify
npm run build
node scripts/audit-council-id-dependencies.mjs
```

Do not assume the latest CSS/copy commits were locally verified unless the user confirms the commands have passed.

## Critical workstyle guidance for the next helper

### Direct-to-main for tiny polish edits

During this chat, repeated squash-merges from reused feature branches caused recurring conflicts. The practical rule going forward:

- For small CCiC copy/CSS/UI polish, work directly on latest `main`.
- Pull first, patch small, run verification, commit, push.
- Avoid reusing old feature branches after they have been squash-merged.

Recommended command loop:

```bash
git checkout main
git pull --ff-only origin main

# make small focused edit

npm run verify
npm run build
node scripts/audit-council-id-dependencies.mjs

git add .
git commit -m "Polish CCiC storefront"
git push origin main
```

Only use a branch for larger seams, and create it fresh from current `main`.

### Do not change product counts/pricing without explicit instruction

A mistake happened in this chat where the catalog was accidentally overwritten from a partial file view, reducing the number of card designs/components. The user called this out clearly.

Do not reduce the number of designs, case components, case size, or selection options unless explicitly asked.

Current expected core values:

- 35 boxes per case
- 12 cards + 12 envelopes per box
- 420 cards per case
- minimum catalog target is at least the 7+ designs that make up the curated case; current code uses 8 placeholder designs
- Classic Sacred Case: $449 CAD
- Promotion Package: +$65 CAD
- Campaign Package: +$195 CAD
- shipping wording: `Shipping calculated after order review.`

Avoid micro-fee language such as setup fee + per-box fee in public UI. The user specifically pivoted away from this.

## Admin invite seam summary

### What was completed

Brevo/admin invite flow was debugged and polished.

Key outcomes:

- Brevo sender email should be `welcome@chrism.app`.
- Brevo API key IP restrictions were disabled for API keys instead of upgrading for a static IP.
- Admin invite email copy was rewritten to avoid `magic link` wording.
- Email copy now explains a secure link opens a confirmation screen and may ask the user to sign in if needed.
- Chrism logo image is included from `/Chrism.png`.
- Invite-help link was removed from the failed invite screen.
- Direct admin invite URL in email was favored over a flow that sends the user back to email for a second login link.
- External invited admins were tested and verified not to become members of the local org.
- Revoke behavior was tested: website removed access and DB assignment became inactive.

Relevant commits found in GitHub search:

- `54b1b87` / `8249bd7` / `e7f84ed` - Polish admin invite onboarding
- `34102df` - Polish admin invite email copy
- `6455e11` - Use PNG logo in admin invite email
- `50901cb` - Use direct URL in admin invite email

Relevant files:

```text
lib/organizations/admin-invitations.ts
app/admin-invite/page.tsx
app/admin-invite/actions.ts
app/admin-invite/confirm/confirm-client.tsx
app/me/council/actions.ts
```

### Admin invite DB verification facts discovered

The invite test user was:

```text
syd.fernandez@cm2.ca
```

Test context:

```text
organization_id = 5ef1f6fc-152a-4d04-b837-43a343cc0507
council_id      = 0c85b312-0bc2-4557-9b9f-61e6826de45b
local_unit_id   = 6d09f535-3769-453e-a041-4b79dc777f59
```

Expected post-invite, pre-revoke state observed:

- public/users row existed and was active.
- `organization_admin_assignments` row existed with `is_active=true` and `source_code=admin_invitation`.
- no member/local-unit rows were returned for this email.

Expected post-revoke state observed:

- `organization_admin_assignments.is_active=false`.
- `revoked_at` populated.
- no `member_records` rows returned.
- no `local_unit_people` rows returned.

Schema gotchas from manual SQL testing:

- `public.users` did not have direct `email` column in the first attempted query pattern.
- `organization_admin_assignments` uses `created_at`, not `granted_at`.
- revoke notes column is `revoked_notes`, not `revoke_notes`.

### Admin invite unresolved / TODO

Created issue #37: `TODO: Revisit admin invite auth-link flow and clean URL notices`.

Open questions:

- Finalize the state machine for invited users who are logged out, logged in as same email, logged in as wrong email, invite accepted, invite revoked, invite expired.
- Decide whether the current wording/flow is final or whether direct session creation should be revisited.
- Clean URL notice/status handling still needs a pattern. The user does not want ugly `?notice=...` or status query strings to persist because refreshes can cause odd behavior.
- Preferred likely pattern: render transient toast/notice, then remove status query with `router.replace` or history replacement.

## CCiC storefront summary

Public route:

```text
/christmas-cards
```

Main files:

```text
app/christmas-cards/page.tsx
app/christmas-cards/order-builder.tsx
app/christmas-cards/box-gallery-card.tsx
app/christmas-cards/card-art.tsx
app/christmas-cards/payment-options-details.tsx
app/christmas-cards/sticky-header.tsx
app/christmas-cards/storefront.css
app/christmas-cards/payment-polish.css
lib/christmas-cards/catalog.ts
public/CCiC.png
public/Chrism.png
public/chrism_star.png
public/christmas-cards/<slug>-front.jpg
public/christmas-cards/<slug>-inside.jpg
public/christmas-cards/<slug>-outside.jpg
```

### Current positioning

This is not a traditional ecommerce page. Treat it as:

- a preorder portal
- a Catholic Christmas card fundraising program
- an organizational ordering workflow

Tone should be:

- traditional
- trustworthy
- organized
- premium but accessible
- simple enough for seniors and parish volunteers

Avoid:

- clutter
- micro-fees
- overly technical ecommerce language
- language like `fees`, `charges`, `extra costs`

Prefer:

- `package`
- `campaign`
- `promotion`
- `personalization`
- `fundraising`

### Current hero copy

Eyebrow:

```text
Christmas card ordering
```

Headline:

```text
Christmas cards made
for ministry
```

Intro copy:

```text
Meaningful Christmas cards for faith communities. Beautiful, faith-centered designs paired with psalms and Scripture verses. Perfect for churches, parishes, and ministries.
```

Payment card:

```text
No payment collected online
Payment options ↗ best suited to you.
```

Payment options opens a lightbox with placeholder sections for:

- E-transfer
- Cheque
- Square payment page

These details still need actual payment instructions.

### Trust callout

A trust strip was added below the hero:

```text
🍁 Designed, sourced, and printed in Canada
FSC Printed on FSC certified paper
```

Outstanding: decide whether to replace the emoji maple leaf with a proper SVG/icon and confirm FSC mark/wording treatment.

### Sticky header

There is a compact sticky header (`sticky-header.tsx`) that should appear only after the main CCiC hero logo scrolls past the page top. It shows:

```text
CCiC logo + Christmas card ordering
```

This was built with an IntersectionObserver watching `#ccic-hero-logo-anchor`.

### Card art behavior

Card art thumbnails use `CardArt`.

Important resolved bug:

- The image file/path was not the issue.
- The thumbnail wrapper was the issue: `next/image fill` needed the inner wrapper to have the sizing class.
- Fix: inner wrapper has `ccic-card-art ccic-card-art-${size}`.

The lightbox uses front / inside / outside image slots.

Image naming convention:

```text
public/christmas-cards/<slug>-front.jpg
public/christmas-cards/<slug>-inside.jpg
public/christmas-cards/<slug>-outside.jpg
```

Only Mary Gentle Mother image set was confirmed present during the chat. More real assets are needed.

### Current product/pricing model

Main product:

```text
Classic Sacred Case
$449 CAD
35 boxed greeting card sets
12 cards + 12 envelopes per box
420 cards total
Curated sacred Christmas artwork
Retail-ready packaging / parish fundraising resale program
```

Current case description:

```text
A complete Catholic Christmas card fundraising collection for parishes and councils.
```

Optional packages:

```text
Promotion Package +$65 CAD
Campaign Package +$195 CAD
```

Promotion Package should include:

- logo integration on every card, plus custom message
- digital proof approval
- production setup and formatting
- priority handling for customized orders

Campaign Package should include:

- everything in the Promotion Package
- 5 x 18x24 promotional posters
- 1 custom graphic for email, bulletin, or social media

The two package cards are side-by-side on desktop. There is a `Remove fundraising package` action shown after one is selected so users can unselect.

### Current selection logic

The separate `Build your own case` section was removed. Instead:

- individual box selections form the custom selection flow
- every full set of 35 selected individual boxes is treated/priced as a custom case
- leftover boxes remain individual boxes
- `Add X more boxes to make a case...` nudge appears only after at least 18 individual boxes are selected

Important: this means the UI can drive larger cart size without adding a duplicate build-your-own-case section.

### Current catalog

`lib/christmas-cards/catalog.ts` currently contains 8 placeholder design entries:

- Mary Gentle Mother
- Shepherds Adore
- Star of Bethlehem
- Heart of Mary
- Angelic Choir
- Madonna and Child
- The Nativity
- Child of Wonder

Only Mary Gentle Mother art was actually confirmed in `public/christmas-cards` during this chat. Do not delete or reduce the catalog/design count without explicit user instruction.

### CCiC commits from this seam

Representative commits include:

- `b0596a4` / `cb9b793` - Polish CCiC storefront selection UX
- `719abcb` / `1811abe` - Refine CCiC custom selection UX
- `d2c3c57` - Add sticky CCiC header and polish card tiles
- `c7c2da7` / `e5db2fe` - Add delayed sticky CCiC header and fix card thumbnails
- `bc9c6d4` - Polish CCiC storefront hero copy
- `18a3a3d` - Polish CCiC payment and hero copy
- `a0e0bfa` - Polish CCiC payment and customization pricing (partly superseded by later fundraising package pivot)
- `654cec7` - Reframe CCiC storefront as fundraising program
- `5fb7a05` - Polish CCiC fundraising package selector
- `6808ed7` - Style CCiC fundraising package cards
- `0ea1447` - Allow CCiC fundraising package removal
- `c550243` - Style CCiC package removal action
- `12c691e` - Add CCiC Canada and FSC trust callout
- `3458ac4` - Style CCiC Canada and FSC trust callout

## CCiC outstanding work

Created issue #35: `TODO: Finish CCiC order submission, emails, and order management`.

Needs:

- DB tables for CCiC orders and line items
- public order review/contact form step
- submitter confirmation email that works like an invoice/order summary draft
- internal email to Syd/admin with order details
- admin-only order list/detail pages
- order statuses such as new/reviewing/confirmed/fulfilled/cancelled
- access model for CCiC order admins that is not automatically all org admins

Created issue #36: `TODO: Finalize CCiC catalog assets, pricing, and payment details`.

Needs:

- real image assets for all card designs
- final inside messages
- final titles/SKUs
- final curated case mix
- final individual box pricing once print costs are known
- actual payment instructions for e-transfer/cheque/Square
- decision on maple leaf/FSC visual treatment

Closed issue #31: old CCiC gallery refinements, because it was mostly completed or superseded by the fundraising package model.

## Existing open TODOs still relevant from older handoff docs

From older handoffs / GitHub issues:

- #8 Investigate St. Martin de Porres member/alignment mismatches
- #9 Clean up Supreme import review UX and fallback matching clarity
- #10 Plan legacy council-id table cleanup after app sweep
- #11 Add parent-org-specific public local-org routes
- #12 Support multi-session events with per-session RSVP and volunteer commitments
- #13 Add duplicate action for existing events
- #14 Add loading and pending-action feedback for slow event/admin actions
- #15 Migrate officer/admin legacy council-shaped tables to local-unit scope
- #21 Add self-serve start local organization flow

Do not reopen the finished event/member council-id sweep unless the audit introduces new WARN/BLOCKER findings.

## User preferences and working style to preserve

- User wants direct, honest pushback.
- User dislikes appeasing answers.
- For code work, provide exact terminal blocks when the user needs to run commands.
- User prefers small, focused patches and production-ready changed files.
- User prefers future code deliveries include only changed files and note removals, not full repo bundles.
- User explicitly asked: always provide refresh/merge bash for terminal when needed.
- For CCiC: do not silently change business/product model assumptions such as case size, number of card designs, package pricing, or shipping.
- Keep copy simple and parish-volunteer friendly.

## Suggested next helper opening prompt

```text
We are on chrism-syd/chrism main.
Production is live at https://www.chrism.app.
Supabase project ref is wvaaijbvukzyfaglifoc.

Read these handoff docs first:
- docs/handoff/HANDOFF_May09_MVP_Live_Security_Hardened.md
- docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
- docs/handoff/HANDOFF_May13_Compatibility_Helpers_Retired.md
- docs/handoff/HANDOFF_May19_Council_Dependency_Audit_Clean.md
- docs/handoff/HANDOFF_May27_AdminInvite_CCIC_Storefront.md

Current focus: public Celebrate Christ in Christmas storefront at /christmas-cards and remaining admin invite polish.

Before changing anything, run:

git checkout main
git pull --ff-only origin main
npm run verify
npm run build
node scripts/audit-council-id-dependencies.mjs

For small CCiC copy/CSS polish, work directly on main. Do not reuse old squash-merged feature branches.

For CCiC, preserve these product rules unless explicitly changed:
- Classic Sacred Case = $449 CAD
- 35 boxes per case
- 12 cards + 12 envelopes per box
- 420 cards per case
- Promotion Package = +$65 CAD
- Campaign Package = +$195 CAD
- no micro-fee breakdown in public UI
- shipping wording = Shipping calculated after order review.
- do not reduce the card catalog or case design count without explicit instruction.

Open TODOs created/updated in the May 27 handoff:
- #35 Finish CCiC order submission, emails, and order management
- #36 Finalize CCiC catalog assets, pricing, and payment details
- #37 Revisit admin invite auth-link flow and clean URL notices

Work in owl mode: small patches, verify after each seam, no broad rewrites unless explicitly needed.
```
