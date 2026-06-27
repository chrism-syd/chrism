# HANDOFF - Jun 13 Routing, Domains, Onboarding TODOs, and Smoke Test Follow-up

## Start here

This handoff updates the Jun 05 launch/routing work after the June 13 routing cleanup, restored operations home, onboarding TODO creation, and smoke-test pass.

Current product direction:

```text
www.chrism.app / chrism.app       = app / operations experience
www.chrismworks.com / .ca         = public marketing / ChrismWorks landing
operations.chrism.app             = deprecated, not canonical, remove when ready
```

The old advanced signed-in operations home has been restored at `/` for staff/admin users. The simple placeholder page created during routing repair was removed.

## Working style for future helpers

Syd prefers direct, practical implementation with repo edits made through GitHub whenever possible.

Workflow expectations:

- Inspect the current repo before making claims.
- Make surgical commits to GitHub, usually on `main` unless Syd asks for a branch.
- Prefer changed files only, not full repo bundles.
- Do not paste giant code blocks into chat unless necessary.
- After GitHub commits, give Syd the exact bash needed to update local and deploy:

```bash
cd /Users/syd.fernandez/Chrism
git pull --ff-only origin main
npx vercel --prod
```

Important Vercel note:

- Vercel does **not** automatically deploy every GitHub edit by design.
- Syd deploys manually to avoid exhausting deploys during long sessions.
- Commit to GitHub, then explicitly say whether a production deploy is needed.

Communication style:

- Be direct and honest.
- Push back when something is risky or logically wrong.
- Do not appease.
- Keep written artifacts concise and professional.
- Be transparent when something is uncertain or unverified.

## Current domain and route behavior

Expected routing now:

```text
Signed-out www.chrism.app / chrism.app       -> /login
Signed-in staff/admin on www.chrism.app /    -> restored operations home
Signed-in non-staff on www.chrism.app /      -> /me
Signed-out chrismworks.com/.ca               -> public marketing landing
Marketing Launch Operations button           -> https://www.chrism.app
/app                                         -> /
/operations                                  -> /
operations.chrism.app                        -> deprecated; may remain functional until DNS/Vercel removed
```

Commits from this routing/domain cleanup:

```text
b912028 Restore signed-in operations landing at root
016e8d1 Route app entry to root landing
67e7d80 Route operations entry to root landing
1890ceb Keep app domains out of marketing landing
2e6741f Remove operations subdomain rewrite
17e53be Point marketing operations link to app domain
bb8e985 Restore advanced operations home page
```

The quick root operations page created during troubleshooting was intentionally replaced by the restored advanced page from the preserved tag:

```text
mvp-live-security-hardened
```

Restored pieces:

```text
app/page.tsx      signed-in OperationsHomePage logic restored into current root page
app/home.module.css existing CSS reused
```

The restored advanced home includes:

- local organization/council header
- organization avatar/logo
- `Your ministry, organized.` hero
- local organization switcher
- Members card
  - Member Directory
  - Custom Lists
- Events card
  - Public Meeting Calendar
  - Events Scheduler

## Domain TODO state

Issue #42 tracks domain consolidation. A comment was added with the new direction.

Remaining non-code domain cleanup:

- Remove `operations.chrism.app` from Vercel domains when ready.
- Remove/delete the Cloudflare `operations` DNS record when ready.
- Review Supabase Auth redirect allowlist and remove/update `operations.chrism.app` URLs if still present.
- Update canonical metadata, sitemap, robots, and docs references after final domain cleanup.

Do not create a duplicate domain issue unless Syd explicitly wants a smaller tactical issue. Update #42 instead.

## New GitHub TODOs created in this session

### #46 TODO: Add welcome onboarding screen for newly registered users

Current behavior is acceptable for now:

```text
new registration -> /me
```

Future behavior:

```text
new registration -> welcome/onboarding screen -> normal home/profile
```

The screen should be first-run only and should not interrupt returning users.

### #47 TODO: Add admin onboarding screen for newly accepted admins

Successful external admin invite acceptance currently lands cleanly at:

```text
/me/council
```

Future behavior:

```text
accepted external admin invite -> admin onboarding landing -> admin work areas
```

A comment was added to #47 clarifying that this should be the dedicated post-acceptance landing for newly accepted external admins.

### #48 TODO: Polish admin invite verification errors and email styling

Smoke test findings:

- Admin invite email should match the login one-time-code email colors/style.
- Incorrect shared phrase error should be red.
- Expired/used/incorrect code error should be red.
- Current expired-code message:

```text
That code has expired or was already used. Send yourself a new code and try again.
```

Desired direction for replacement copy:

```text
Incorrect or expired code. Please resend a verification code and use the shared verification phrase exactly as provided by the person who invited you.
```

Keep `?token=` while the invite is in progress. That token is functional and should remain.

### #49 TODO: Create registration fallback path for unregistered login attempts

Smoke test finding:

- Registration appeared to stall after entering a one-time code.
- This may have happened because the email address had already been used.
- User then sent a login request.

Desired flow:

- If someone attempts login with an unregistered email, prompt them to register.
- If someone attempts registration with an existing email, prompt them to sign in.
- Do not silently stall after OTP entry.

Need to inspect exact Supabase errors for:

- `signInWithOtp` with `shouldCreateUser: false` and nonexistent email
- registration/OTP verification with already-existing email

### #50 TODO: Create or expose super-admin organization create/save flow

Smoke-test checklist included:

```text
super-admin organization save/create
```

But we do not know if a full user-facing pathway exists.

First step:

- Audit current repo for existing super-admin organization create/save pages/actions.
- If pages/actions exist but are not linked, add a pathway.
- If actions exist but UI does not, create UI.
- If neither exists, design the minimum safe flow.

Important model rule for this issue:

```text
local_unit_id = operational scope truth
organization_id = parent/brand/org container where appropriate
council_id = legacy/public compatibility, not new operational truth
```

## Existing issues touched by comments

### #45 Clean up notice and error query-string URLs across the site

A smoke-test comment was added.

Still failing:

```text
Removing external admin -> /me/council?notice=Manual+admin+access+removed.
Sending external admin invite -> /me/council?notice=Admin+invite+sent+to+...+Share+the+verification+phrase+...
```

Good behavior confirmed:

- Incorrect phrase kept functional `?token=` URL.
- Successful admin invite acceptance landed cleanly at `/me/council`.
- Archiving an event gave a clean URL.
- Creating a new event landed directly on the new event page.

Interpretation:

- The broad query cleaner helps after hydration, but server-action redirects still expose message copy briefly/directly in the URL.
- Proper flash-message replacement is still needed.
- Keep #45 open.
- #23 and #24 overlap with #45. Do not close them until #45 smoke testing is fully accepted.

### #14 Loading and pending-action feedback

A comment was added with Syd's preferred pattern:

```text
Saving...
Archiving...
Deleting...
Sending...
Removing...
```

This should apply broadly to event/admin action buttons where server actions can feel slow.

### #42 Domain consolidation

A comment was added with the updated direction to retire `operations.chrism.app` and use `www.chrism.app` as operations/app entry.

### #47 Admin onboarding

A comment was added that successful external admin acceptance currently lands cleanly at `/me/council`, but future behavior should route first-time accepted admins to the onboarding screen.

## Duplicate / overlapping issue cleanup still recommended

- #43 and #44 are duplicates: both are `Keep meetings column visible when council has no public meetings`.
  - Keep one and close the other as duplicate.
- #23 and #24 overlap with #45.
  - Keep until #45 is fully accepted, then close as absorbed if appropriate.
- #25 Supabase magic-link expiry may be stale for admin invites because admin invite flow now uses verification code + shared phrase, but it may still matter for regular login/auth. Review before closing.

## Smoke-test notes from Syd

### Admin removal / invite sending

Still showed message query params:

```text
https://www.chrism.app/me/council?notice=Manual+admin+access+removed.
https://www.chrism.app/me/council?notice=Admin+invite+sent+to+real.nathan.fernandez%40gmail.com.+Share+the+verification+phrase+with+the+invitee+separately.
```

Track under #45.

### Admin invite verification

Good:

- Incorrect shared phrase kept `?token=` URL.
- That is correct because token is functional.
- Successful acceptance landed cleanly at `/me/council`.

Needs work:

- Error messages should be red.
- Expired/used code copy should be clearer.
- Admin invite email styling should match login OTP email.

Track under #48.

### Registration/login

Observation:

- Register page appeared to stall after entering verification one-time code.
- May have used an email address that already existed.
- User then sent a login request.

Track under #49.

### Events

Good:

```text
Creating a new event -> /events/[eventId]
Archiving event -> clean URL
```

Need UX polish:

- Action buttons should show active pending states like `Archiving...`.

Track under #14.

## Permissions and access note

No permission model change was made in this session.

The existing permissions document remains directionally correct:

```text
docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
```

Do not revise access behavior casually. Current standing rules remain:

```text
local_unit_id = operational scope and ownership truth
council_id = public-facing / compatibility / routing where needed
people = product noun
```

External admin rule remains:

```text
people: yes
organization_admin_assignments: yes
member_records: no
user_unit_relationships: no
```

If #50 touches super-admin org create/save, use the permissions doc and current `lib/auth/permissions.ts` as source of truth before changing access checks.

## Important caveat about one previous attempted fix

A previous attempt to update `app/members-list.tsx` to auto-dismiss action notices did **not** land because GitHub returned a 409 conflict. Do not assume that change exists.

Intended behavior was a small notice auto-dismiss/pointer-dismiss hook, but it should be re-fetched and reapplied cleanly if still desired.

## Suggested next helper sequence

1. Pull latest `main` locally and deploy only when Syd is ready:

```bash
cd /Users/syd.fernandez/Chrism
git pull --ff-only origin main
npx vercel --prod
```

2. Decide whether to clean issue duplicates:

- Close one of #43/#44 as duplicate.
- Leave #23/#24 until #45 is fully accepted.

3. Pick one near-term seam.

Recommended first seam:

```text
#48 admin invite verification errors and email styling
```

Why first:

- Small and concrete.
- Directly follows the smoke test.
- Low architecture risk.

Recommended second seam:

```text
#45 flash-message replacement for /me/council admin actions
```

Why second:

- More cross-cutting.
- Needs careful redirect/message architecture.
- Avoid jamming sensitive/user-facing copy into URLs.

4. For any domain cleanup, update #42 and verify Vercel/Cloudflare/Supabase allowlists before deleting anything.

## Starter prompt for next helper

Use this prompt to pick up the work:

```text
We are working in GitHub repo chrism-syd/chrism on main. Read docs/handoff/HANDOFF_Jun13_Routing_Onboarding_Smoke.md first, then inspect current repo state before making edits.

Current direction:
- www.chrism.app / chrism.app = app and operations.
- chrismworks.com / chrismworks.ca = public marketing site.
- operations.chrism.app is deprecated and should eventually be removed from Vercel/Cloudflare/Supabase allowlists, tracked under #42.
- Signed-in staff/admin root `/` should show the restored advanced operations home.
- Signed-out app domain should go to `/login`.
- Signed-out ChrismWorks domain should show the marketing landing.

Important working style:
- Make targeted GitHub commits rather than giving giant inline code.
- After commits, give Syd bash:
  cd /Users/syd.fernandez/Chrism
  git pull --ff-only origin main
  npx vercel --prod
- Vercel does not auto-deploy GitHub edits; Syd deploys manually to avoid exhausting deploys.
- Be direct, practical, and honest. Push back on risky assumptions.

Open near-term issues:
- #45 clean URL/flash-message replacement. Still failing for external admin remove/send invite notices on /me/council.
- #48 polish admin invite verification errors and email styling. Good first small seam.
- #49 registration fallback path for unregistered login attempts.
- #50 create or expose super-admin organization create/save flow.
- #47 admin onboarding after external admin invite acceptance.
- #14 pending button states like Saving..., Archiving..., Sending...

Do not change permission architecture casually. Permissions/access remain local-unit-first. External admin invite acceptance should create people + organization_admin_assignments, not member_records or user_unit_relationships unless the person is separately a real local member.
```