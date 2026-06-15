# HANDOFF - Jun 15 Welcome, Monetization, Email, and Next-Helper Prompt

## Start here

This handoff supersedes the June 13 handoff for the latest session context. Keep the June 13 handoff for routing/domain history, but future helpers should start here, then read:

```text
docs/handoff/HANDOFF_Jun13_Routing_Onboarding_Smoke.md
docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
lib/auth/permissions.ts
```

Current repo:

```text
Repository: chrism-syd/chrism
Default branch: main
App stack: Next.js 16.1.7, React 19.2.3, Supabase, Vercel, Brevo planned/partially used
```

## Working style for future helpers

Syd works fastest with direct, practical implementation and grounded pushback.

Expectations:

- Inspect current repo state before making claims.
- Prefer targeted GitHub commits over large inline code dumps.
- Commit changed files only unless Syd explicitly asks for a bundle.
- Be honest about uncertainty, tool failures, and architectural risk.
- Push back when an idea is risky, overbuilt, or not aligned with the product.
- Avoid appeasement. Syd prefers real-world scrutiny.
- Keep chat concise, but do not omit important operational details.
- Written artifacts should be concise, direct, professional, and free of sarcasm.
- In normal chat, light humor is welcome.

After any GitHub commit, give Syd the exact local commands:

```bash
cd /Users/syd.fernandez/Chrism
git pull --ff-only origin main
npm run typecheck
npm run build
npx vercel --prod
```

Vercel note:

- Syd deploys manually.
- Do not assume GitHub commits are live in production.
- Say clearly whether a production deploy is needed.

## Current domain direction

```text
www.chrism.app / chrism.app       = app and operations
www.chrismworks.com               = canonical public marketing
chrismworks.ca                    = redirected/secondary marketing domain
operations.chrism.app             = deprecated, tracked under #42
```

## Welcome/admin and admin invite flow state

The admin welcome flow has been built and smoke-tested.

Key route:

```text
/welcome/admin
```

Current behavior:

- External admin invite acceptance redirects to `/welcome/admin`.
- Invite acceptance now resolves the invite's council/org to a matching `local_units.id` and stores that as operations scope before redirecting.
- `/welcome/admin` reads active local-unit scope and displays the correct council/org name and logo.
- Super-admin/staff smoke test can use:

```text
/welcome/admin?localUnitId=<local_units.id>
```

Important: the query param expects `local_units.id`, not `organizations.id`.

Smoke-test debugging found that using `organizations.id` silently fell back to the active St. Martin context. Correct query to find a local unit from an org:

```sql
select
  lu.id as local_unit_id,
  lu.legacy_organization_id,
  lu.legacy_council_id,
  c.name as council_name,
  c.council_number,
  o.display_name as organization_display_name,
  o.preferred_name as organization_preferred_name
from local_units lu
left join councils c
  on c.id = lu.legacy_council_id
left join organizations o
  on o.id = lu.legacy_organization_id
where lu.legacy_organization_id = '<organization_id>'
   or c.organization_id = '<organization_id>';
```

Recent verified examples from testing:

```text
/welcome/admin?localUnitId=6d09f535-3769-453e-a041-4b79dc777f59
-> St. Patrick's Council 7689

/welcome/admin?localUnitId=0733d02f-04cd-4182-813c-dc3386e1279e
-> St. Patrick's Council 5073
```

### Important implementation files

```text
app/admin-invite/actions.ts
app/welcome/admin/page.tsx
app/welcome/member/page.tsx
app/welcome/welcome-page.tsx
app/welcome/welcome.module.css
lib/auth/operations-scope-selection.ts
lib/auth/permissions.ts
```

### Recent welcome commits

```text
4d41f78 Relax welcome smoke test scope guard
ebc667c Simplify admin welcome actions
942036d Stack welcome card actions
```

Admin welcome copy/style changes now live after deploy:

- Title is `Welcome.`
- No `shepherd.` wording.
- Main left card still pushes members first.
- Organization settings button is under/beside `Start with members`.
- Bottom `Choose your next step` card is removed for admins only.
- Member welcome still keeps its next-step card.
- Side card copy:
  - `Keep member and volunteer contact information close.`
  - `Schedule meetings, plan events, and collect RSVPs and volunteer responses.`

## Permissions/access reminders

Do not casually change permission architecture.

Standing rules:

```text
local_unit_id = operational scope and ownership truth
council_id    = legacy/public-facing/compatibility/routing
people        = product noun
```

External admin invite acceptance may create/update:

```text
people: yes
organization_admin_assignments: yes
member_records: no
user_unit_relationships: no
```

The real Grand Knight/admin flow should not depend on the smoke-test query param. It should depend on operations scope set at invite acceptance.

Before changing access behavior, read:

```text
docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
lib/auth/permissions.ts
lib/auth/operations-scope-selection.ts
```

## Current first real user state

Syd sent an invite to Kristian, a Grand Knight and the first real user.

Syd confirmed `/welcome/admin` changes were deployed before/around this milestone. If Kristian reports friction:

- Ask for the exact screen and wording.
- Do not guess.
- Prioritize admin invite acceptance, first landing, correct council/logo, and member-directory path.
- Avoid broad refactors while the first real user is onboarding.

## Product/pricing direction created this session

Syd is actively shaping Chrism's monetization path. Core local-org functionality should remain free enough for ministries/councils to adopt, but Chrism must become sustainable.

Current pricing thesis:

```text
Community = free core for local orgs
Care      = paid operational relief, likely $20/month or $199/year
Network   = future umbrella body tier
```

Free should likely include:

- Member/contact directory
- Basic admin access
- Public landing page
- Create events
- Collect RSVPs
- View RSVP list
- Basic volunteer signup
- Manual exports

Care should likely include:

- Automated event emails
- RSVP reminders
- Volunteer reminders
- Post-event thank-you emails
- Post-event attendance/report summaries
- Volunteer hours reports
- Member custom lists/saved lists
- Follow-up/reminder structures
- Leadership handoff/continuity tools

Strong principle:

```text
Do not paywall basic RSVP collection.
Paywall automation, reporting, saved custom lists, and continuity workflows.
```

A strong trial idea:

```text
Community includes the first 10 events with automated reminders and post-event reports.
After that, events and RSVPs stay free; automation/reporting requires Care.
```

## New product issues created

### #56 Add public landing pages for local organizations

Goal: give local orgs a simple public web presence, useful especially for ministries/councils that cannot afford or maintain websites.

Important wedge:

```text
Local orgs may resist $20/month for software, but may accept $20/month to replace an existing website bill.
```

Syd is moving his local council away from Wix/Porkbun-style web hosting into GitHub/Vercel hosting and charging them $20/month, roughly matching their prior Wix hosting/domain cost.

### #57 Define Community/Care pricing and event automation entitlements

Pricing brain issue.

A comment was added with expanded paid surfaces:

- Member Care: custom/saved member lists
- Event Care: reminders, nudges, post-event reports
- Web presence as paid-adjacent acquisition wedge

### #58 Brevo Text Notifications

Explore SMS/text reminders through Brevo for older users and event/volunteer reminders, possibly OTP later. SMS must be opt-in and likely paid/usage-metered.

### #59 Opt-in / Opt-out Communication Compliance

User profile communication preferences, email opt-out, future SMS opt-in/out, per-org preferences, and consent copy.

Need to keep account/security messages separate from optional event/org announcements.

### #60 Assisted WhatsApp Notifications via Organizer Nudge Workflow

Instead of direct WhatsApp group API posting, Chrism nudges an organizer with a secure link. The organizer reviews a prefilled message and uses `https://wa.me/?text=...` to share it into their existing WhatsApp group.

This avoids Meta API swamp and keeps costs low.

## Email/domain work completed outside repo

Syd is moving toward `syd@chrismworks.com` as primary email.

Cloudflare Email Routing setup for `chrismworks.com`:

```text
syd@chrismworks.com -> sydsaddress@gmail.com
```

Inbound test passed:

```text
Non-Gmail account -> syd@chrismworks.com -> Gmail received
```

Important DNS actions done/understood:

- Delete old Porkbun MX records:
  - `fwd1.porkbun.com`
  - `fwd2.porkbun.com`
- Delete old Porkbun SPF TXT:
  - `v=spf1 include:_spf.porkbun.com ~all`
- Keep website/Vercel records.
- Keep catch-all OFF unless Syd intentionally wants all random addresses forwarded.
- Cloudflare Email Routing records should be:
  - `route1.mx.cloudflare.net`
  - `route2.mx.cloudflare.net`
  - `route3.mx.cloudflare.net`
  - `v=spf1 include:_spf.mx.cloudflare.net ~all`

Next email setup step if not already done:

```text
Gmail -> Settings -> Accounts and Import -> Send mail as -> Add another email address
Name: Syd Fernandez
Email: syd@chrismworks.com
Treat as alias: checked
Verify via forwarded email
Make default
Reply from same address message was sent to
```

## Email signature image added to repo

Syd provided `Chrism-works.png` for email signature use.

Committed to repo:

```text
5d50ebc Add Chrism Works email signature image
public/Chrism-works.png
```

After deploy, public URL should be:

```text
https://www.chrismworks.com/Chrism-works.png
```

Use this in Gmail signature if image insertion by URL works.

## Existing issue reminders

Keep these in mind:

```text
#14 Loading/pending action feedback
#42 Domain consolidation / retire operations.chrism.app
#45 Clean URL / flash-message replacement
#47 Admin onboarding after invite acceptance
#48 Admin invite verification errors and email styling
#49 Registration fallback path for unregistered login attempts
#50 Super-admin organization create/save flow
#51 Reporting year/officer term overlap: done/closed
#52 Top-level org defaults: backburner
#54 Welcome page copy variants
#55 Member find org/request-to-join
#56 Public landing pages
#57 Pricing and event automation entitlements
#58 Brevo text notifications
#59 Opt-in/out communication compliance
#60 WhatsApp organizer nudge workflow
```

Do not close #45 yet. Syd explicitly said leave the register seam and #45 open earlier.

## Known operational caution

The GitHub connector can update files directly. For large files, previous sessions saw clipping/truncation risk with full-file updates. Prefer:

- new docs/files when possible,
- small targeted files,
- re-fetch after update when touching critical code.

Especially be careful with:

```text
lib/organizations/admin-invitations.ts
app/me/council/actions.ts
```

## Suggested next-helper sequence

1. Start by asking what Syd wants to tackle next: Kristian/first-user friction, email setup, pricing surface planning, or code.
2. If code is requested, inspect current repo files before edits.
3. If touching access/auth/admin invite behavior, read permissions docs and code first.
4. If touching event automation/pricing, use #57 as the product anchor and avoid billing implementation until entitlements are shaped.
5. If touching communications, use #58/#59/#60 together. Consent and opt-out are not optional.
6. Keep production stable while the first real user is onboarding.

## Starter prompt for next helper

Use this prompt in the next chat:

```text
We are working in GitHub repo chrism-syd/chrism on main. Please read docs/handoff/HANDOFF_Jun15_Welcome_Monetization_Email.md first, then docs/handoff/HANDOFF_Jun13_Routing_Onboarding_Smoke.md and docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md before making repo changes.

Working style:
- Be direct, practical, and honest. Push back on risky assumptions.
- Syd prefers targeted GitHub commits, not huge inline code blocks.
- Inspect current repo state before making claims.
- After commits, provide:
  cd /Users/syd.fernandez/Chrism
  git pull --ff-only origin main
  npm run typecheck
  npm run build
  npx vercel --prod
- Vercel deploys are manual. Do not assume a commit is live.

Current state:
- www.chrism.app / chrism.app = app/operations.
- www.chrismworks.com = public marketing.
- operations.chrism.app is deprecated and tracked under #42.
- /welcome/admin exists and is deployed. Admin invite acceptance should set local-unit operations scope and redirect there.
- /welcome/admin?localUnitId=<local_units.id> is a smoke-test display override. It expects local_units.id, not organizations.id.
- The first real Grand Knight invite was sent to Kristian. Keep stability high and prioritize first-user friction.
- Email routing for syd@chrismworks.com -> Gmail works inbound through Cloudflare. Gmail Send As may still need final setup/verification.
- public/Chrism-works.png was added for email signature use and should resolve after deploy at https://www.chrismworks.com/Chrism-works.png.

Access model:
- local_unit_id = operational scope/ownership truth.
- council_id = legacy/public/compat/routing.
- people = product noun.
- External admin invite acceptance may create/update people and organization_admin_assignments, but not member_records or user_unit_relationships unless separately a real local member.

Product direction:
- Core should be free enough for local ministries/councils to adopt.
- Paid surfaces should be Chrism Care: automation, reporting, saved custom lists, communication nudges, leadership continuity.
- RSVP collection should remain free.
- Issues #56-#60 capture public pages, pricing entitlements, Brevo SMS, opt-in/out compliance, and WhatsApp organizer nudge workflow.

Ask Syd what he wants to tackle first, then make small, safe commits.
```
