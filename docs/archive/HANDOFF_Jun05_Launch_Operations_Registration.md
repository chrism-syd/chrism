# HANDOFF - Jun 05 Launch Landing + Operations + Registration OTP

## Current branch / deployment status

Work in this handoff is on:

```text
launch-hide-spiritual
```

As of this handoff, this branch is ahead of `main` and needs to be merged/pushed to `main` for the production Vercel deployment, assuming Vercel production still deploys from `main`.

Recommended deploy path:

```bash
cd /Users/syd.fernandez/Chrism

git checkout launch-hide-spiritual
git pull --ff-only origin launch-hide-spiritual
rm -rf .next
npm run verify
npm run build

git checkout main
git pull --ff-only origin main
git merge launch-hide-spiritual
git push origin main
```

After Vercel deploys, test:

```text
https://chrism.app
https://chrism.app/operations
https://operations.chrism.app
https://chrism.app/about
```

Expected:

- `chrism.app/` shows the public Chrism Ecosystem landing page.
- `/about` redirects to `/`.
- `/operations` is the app gateway.
- `operations.chrism.app/` internally rewrites to `/operations` while keeping the subdomain URL clean.

## Critical workstyle guidance

- User prefers direct, practical implementation and file-based changes over huge pasted code in chat.
- For small landing page polish after this branch is merged, work directly on latest `main` unless a larger seam is being started.
- Pull before editing. Avoid reusing old branches after they have been merged.
- Always keep browser URLs clean. The user strongly dislikes persistent `?error=`, `?notice=`, or other status query strings. Prefer transient UI state and `router.replace` / history cleanup.
- The current public launch priority is ministry management / operations. Spiritual/product devotional areas are intentionally hidden/suppressed for launch.

## What was completed in this seam

### 1. Public landing page

The public homepage has been changed from the previous app-like entry screen into a Chrism Ecosystem landing page.

Primary files:

```text
app/page.tsx
app/about/page.tsx
app/about/about.module.css
```

Routes:

```text
/      -> public landing page
/about -> redirects to /
```

Current landing page structure:

- Top nav with Chrism logo and `Launch Operations` button.
- Hero: `The Chrism Ecosystem`.
- Lead paragraph: Chrism bridges commercial enterprise and community stewardship so operational capital stays closer to ministries, schools, councils, and local organizations.
- `Why Chrism Exists` section with large image and plain page-background copy.
- `Community, Faith, and Service` value section.
- `Three connected parts. One purpose.` section with three divided columns:
  - Chrism Operations
  - Chrism Commerce
  - Chrism Brokerage
- `How the model works` flywheel section using numbered flow, not boxed cards.
- Yellow free-functionality callout.
- Trust section: `Responsible stewardship`.
- Lightweight FAQ with divider-only rows.
- CTA section.

Recent design direction:

- Keep the landing page simple, modern, and spacious.
- User wants to keep refining the lower half to reduce box fatigue.
- Avoid making the page read like a white paper.
- The page should be brand vision first, with practical details mostly in FAQ.

Important copy currently in the `Why Chrism Exists` section:

```text
Ministry runs on care: volunteers who show up, leaders who remember names, and members who stay connected across seasons of life.

What they rarely have is a simple, affordable tool built to support that work. Enterprise CRM software wasn't designed for parish life. Spreadsheets don't scale. And the people doing this work deserve better than cobbled-together workarounds — better tools, and better economics.

Faith-driven communities, families, educators, and leaders are called to pursue excellence, support their neighbors, and build healthy local institutions. But the tools around that work are fragmented, expensive, and designed for businesses rather than communities.

Chrism exists to make that work lighter. By combining ministry software, fundraising goods, and institutional print sourcing, Chrism creates a closed-loop ecosystem where commercial activity helps fund the infrastructure local ministries need.
```

### 2. Operations naming and app entry route

The administrative/ministry-management side is now being positioned as:

```text
Chrism Operations
```

Primary files:

```text
app/operations/page.tsx
app/app/page.tsx
proxy.ts
```

`/operations` is the preferred gateway. `/app` also exists as a compatibility gateway from an earlier pass.

Current `/operations` behavior:

- Signed-out users redirect to `/login?next=/operations`.
- Signed-in users without staff access redirect to `/me`.
- Super admin acting as member redirects to `/me`.
- Staff/admin users route to their most relevant operations area:
  - `canManageEvents` -> `/events`
  - `canAccessMemberData` -> `/members`
  - `canManageCustomLists` -> `/custom-lists`
  - `canAccessOrganizationSettings` or `canManageAdmins` -> `/me/council`
  - fallback -> `/me`

### 3. Operations subdomain

Subdomain chosen:

```text
operations.chrism.app
```

Code behavior:

- `proxy.ts` checks `request.nextUrl.hostname`.
- If hostname is `operations.chrism.app` and path is `/`, it rewrites internally to `/operations`.
- The rewrite keeps the clean subdomain in the browser.
- `proxy.ts` also preserves Supabase session update behavior via `updateSession(request)`.

Important Next.js 16 note:

- Do not add `middleware.ts`.
- This project uses `proxy.ts` only.
- A build failed when both `middleware.ts` and `proxy.ts` existed.
- The fix was to move subdomain logic into `proxy.ts` and delete `middleware.ts`.

Cloudflare/Vercel DNS setup notes:

- In Vercel, add existing domain: `operations.chrism.app`.
- In Cloudflare DNS, add/edit a CNAME for host `operations` pointing to the specific Vercel target shown by Vercel.
- User saw target:

```text
c3ef4ecc6c622ad3.vercel-dns-017.com
```

- Cloudflare showed an error that an A/AAAA/CNAME with the same host already existed. That means search DNS records for `operations`, then edit/delete the existing record rather than adding a duplicate.
- Start with DNS only for Vercel verification.

Supabase redirect URLs to add/check:

```text
https://operations.chrism.app/auth/confirm
https://operations.chrism.app/operations
https://chrism.app/operations
```

The most important is:

```text
https://operations.chrism.app/auth/confirm
```

### 4. Registration OTP / public intake

Registration was changed toward OTP verification instead of magic-link language/flow.

Primary files:

```text
app/register/actions.ts
app/register/verify-registration-code-form.tsx
lib/registration/consent.ts
lib/auth/otp-messages.ts
lib/auth/redirects.ts
```

Key behavior:

- New public registration collects first name, last name, email, and optional phone.
- User must accept a ministry contact-sharing consent notice.
- Registration writes/upserts `public_registration_intakes` keyed by `normalized_email`.
- Registration sends Supabase OTP using `admin.auth.signInWithOtp` with `shouldCreateUser: true`.
- Verification form uses `supabase.auth.verifyOtp({ type: 'email' })`.
- After OTP verification, `markRegistrationEmailVerifiedAction()` links or creates profile state.

Existing-user handling:

- If `public.users.person_id` already exists for the authenticated user, registration marks intake as verified/matched and returns an `existing_user_profile` status.
- It should not reveal that a person exists only in a local org/ministry list. Only a user-initiated/profile-linked account should be treated as an existing Chrism profile.

New-user handling:

- If the auth user has no `public.users.person_id`, the verified intake creates a provisional `people` row and upserts `public.users.person_id`.
- First/last name are initial-capped.
- Phone is carried into `people.cell_phone`.
- `public_registration_intakes` is marked:
  - `email_verification_status = verified`
  - `admin_review_status = matched`
  - `matched_person_id = <new person id>`
  - `matched_at = now()`

Known successful test:

```text
syd.fernandez@chrism.app
```

Observed verified/matched output after reset + retest:

```text
first_name: Sydney
last_name: Fernandez
email: syd.fernandez@chrism.app
phone: +14168039793
email_verification_status: verified
admin_review_status: matched
matched_person_id populated
public.users.person_id populated and matched
```

Useful reset SQL for retesting the same inbox:

```sql
begin;

with target_auth_user as (
  select id
  from auth.users
  where lower(email) = lower('syd.fernandez@chrism.app')
),
target_app_user as (
  select u.id, u.person_id
  from public.users u
  join target_auth_user au on au.id = u.id
),
deleted_intake as (
  delete from public.public_registration_intakes
  where normalized_email = lower('syd.fernandez@chrism.app')
  returning id
),
removed_unit_relationships as (
  delete from public.user_unit_relationships
  where user_id in (select id from target_auth_user)
  returning id
),
unlinked_app_user as (
  update public.users
  set
    person_id = null,
    updated_at = now()
  where id in (select id from target_auth_user)
  returning id
)
select
  (select count(*) from deleted_intake) as deleted_registration_intakes,
  (select count(*) from removed_unit_relationships) as removed_unit_relationships,
  (select count(*) from unlinked_app_user) as unlinked_app_users;

commit;
```

Do not delete the `auth.users` row for repeated OTP inbox testing.

### 5. Registration UX gotchas found

- Supabase sends OTP emails but may also use/label its default template in a way that can look like confirm-signup/magic-link unless templates are configured. Need confirm production email templates after deployment.
- User experienced OTP delay of around 10 minutes at least once.
- A UI hang occurred after OTP verification: backend had already created and linked the profile, but client navigation got stuck. A timeout/try-catch was added in `verify-registration-code-form.tsx`.
- The form now races profile sync against a 15s timeout and shows a readable message instead of spinning forever.

### 6. Spiritual areas hidden for launch

This branch began as `launch-hide-spiritual`. The product direction changed:

- Do not launch the spiritual/devotional side yet.
- Concentrate on ministry management / operations.
- Hide/suppress spiritual areas and menu references for launch.
- The future spiritual side is still part of the larger Chrism vision but is not the launch surface.

Next helper should verify whether any public nav/menu/sidebar still references hidden spiritual areas after merging.

## Outstanding / unfinished work

### Must verify before production

- Run `npm run verify` and `npm run build` locally after pulling latest branch.
- Merge branch to `main` and push if production Vercel deploys from `main`.
- Confirm Vercel production deployment is green.
- Confirm `operations.chrism.app` is valid in Vercel.
- Confirm Cloudflare DNS has only one `operations` host record and it points to the Vercel target.
- Confirm Supabase redirect URLs include operations domain.

### Registration / OTP

- Verify production email template sends an OTP code, not just a magic link.
- Confirm `/register` URL cleanup. Some status flows still use query params; user wants clean URLs long term.
- Confirm profile carryover to `/me` after registration still shows first name, last name, email, and phone.
- Plan invite acceptance flow using the same OTP mechanism:
  - admin invites
  - local org member invites
  - existing Chrism users link to org context
  - new users go through intake first, then connect to local org

### Landing page design

User will keep tweaking. Most recent lower-page direction:

- Ecosystem pillars should use columns and thin dividers, not equal cards.
- Tags identify the three pillars without heavy card borders.
- Flywheel should use numbered flow with large muted numerals.
- FAQ should be light, using divider rows, not cards.
- User may still want to reduce card-heavy treatment in other sections.

### Public domain / routing

- Decide whether `/app` should remain as a compatibility route or eventually redirect to `/operations`.
- Decide whether the Operations subdomain should rewrite all paths or only root. Current implementation only rewrites `operations.chrism.app/` to `/operations`; other paths pass through normally.
- Confirm login `next` flow handles `/operations` and operations subdomain cleanly.

### Admin invite issue still relevant

Issue #37 from the previous handoff is still relevant:

```text
TODO: Revisit admin invite auth-link flow and clean URL notices
```

The new OTP approach is intended to become the shared mechanism for invites, but it has not yet fully replaced the admin invite acceptance flow.

## Suggested starter prompt for next helper

```text
You are helping me continue work on the Chrism Next.js/Supabase app.

Please read these repo docs first:
- docs/handoff/HANDOFF_Jun05_Launch_Operations_Registration.md
- docs/handoff/SCHEMA_AND_ACCESS_Jun05_Registration_Operations.md
- docs/handoff/HANDOFF_May27_AdminInvite_CCIC_Storefront.md

Current working branch is launch-hide-spiritual unless I say otherwise. We recently changed chrism.app into the public landing page, added /operations as the ministry-management gateway, set up operations.chrism.app routing, and moved public registration toward OTP verification with public_registration_intakes.

My priorities now are:
1. Deploy/verify the current branch on Vercel.
2. Keep public URLs clean.
3. Keep spiritual/devotional areas hidden for launch.
4. Continue polishing the landing page without making it too box-heavy.
5. Stabilize OTP registration and later use the same mechanism for admin/member invites.

Before changing code, confirm the current branch, pull latest, and run npm run verify and npm run build after changes.
```
