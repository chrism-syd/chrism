# HANDOFF / TRANSITION STATE - May 13 Council RLS Sweep Complete

## Read this first

This document supersedes the May 9 MVP Live + Security Hardened handoff while preserving its mental model and working style.

Core model:

```text
local_unit_id = operational ownership / scope truth
council_id    = legacy / public / routing / compatibility truth only
people        = product noun
members       = one relationship/state inside a local org
```

Do not discard the Apr 27 or May 9 mental model. The major May 13 update is that the `app.current_council_id()` RLS policy sweep is complete: no RLS policies now depend on `app.current_council_id()`.

## Current checkpoint

```text
Production URL: https://chrism.app
Production branch: main
Supabase project ref: wvaaijbvukzyfaglifoc
Known-good tag still worth preserving: mvp-live-security-hardened
Latest schema/RLS checkpoint before this doc refresh: aa6f276 Refresh schema after council RLS cuts
```

Final verification after the council RLS sweep:

```sql
select
  count(*) as remaining_current_council_policy_count
from pg_policies
where coalesce(qual, '') ilike '%current_council_id%'
   or coalesce(with_check, '') ilike '%current_council_id%';
```

Expected/current result:

```text
remaining_current_council_policy_count = 0
```

## Syd's working style and helper expectations

Keep this section. It is working well.

Syd prefers direct, honest feedback with pushback. Do not appease. State clearly what is a blocker, what is not, and what is unknown.

The workflow that worked well in this phase:

- Think first, then make small targeted cuts.
- Use "owl mode" for architecture/security passes: slow, dependency-aware, audit-first, no broad sledgehammer changes.
- Inspect repo/GitHub state directly whenever possible. Do not make Syd act as a file courier.
- Prefer production-ready changed files, exact patches, or downloadable one-shot scripts over long inline snippets.
- Prefer changed files only, not full repo bundles, unless explicitly requested.
- Keep changes surgical and seam-aware.
- Maintain a running TODO ledger and connect work back to the larger transition.
- Treat loader + client + action + database bugs as one seam when applicable.
- Quote shell paths containing `[id]` or `[token]` in zsh.
- Be transparent when something is uncertain or not verified.
- For DB/app changes, use the full verification loop when the Supabase CLI is healthy:
  ```bash
  cd /Users/syd.fernandez/Chrism
  npx supabase db push --linked
  npm run schema:pull
  npx supabase db dump --linked --schema public -f supabase/schema.sql
  npx supabase gen types typescript --project-id wvaaijbvukzyfaglifoc --schema public > database.types.ts
  npm run verify
  npm run build
  git status --short
  git diff --stat
  ```
- Commit only after verify + build + relevant SQL audit + smoke pass.
- If Supabase CLI fails with socket/TLS/login-role errors, stop the generated schema pipeline and restore generated files. Manual SQL Editor application is acceptable, but repair migration history afterward.

Do not:

- Reintroduce `council_id` as operational truth.
- Treat `member_records` as the product noun.
- Assume admin assignment means someone is not a local member.
- Add backwards-compatible zombie wrappers when a future-state fix is safe.
- Keep asking for local diffs when current GitHub/repo state is available.
- Silence Supabase lint warnings by adding broad policies or grants without proving need.
- Add browser grants to internal/server-only tables just because the Data API grant audit reports them missing.

## Big-picture mission

The long-term transition remains:

```text
local_unit_id = operational ownership / scope truth
council_id    = legacy/public/routing/compatibility truth
people        = product noun
members       = one relationship/state inside a local org
```

The product manages people, not only members. A person can be a member, prospect, volunteer, external admin contact, officer, shared custom-list participant, or another future local human record type.

Golden rules:

1. Local org experiences must use local-unit-scoped people/access.
2. Hidden identity can group the same human across orgs, but must not silently swap in another org's row.
3. Do not dedupe by name alone.
4. Do not treat `member_records` as conceptual product truth.
5. Do not provision `member_records` or `user_unit_relationships` for external admin invite acceptance.
6. A real local member who also has admin access must remain visible in member surfaces.
7. If a bug spans loader, UI, action, and DB, patch the seam, not only one layer.
8. Test residue can look exactly like logic failure. Inspect data before assuming code is wrong.

## Current architecture direction

Local org-visible layer:

```text
people
local_unit_people
member_records
local_units
```

Hidden identity layer:

```text
person_identities
person_identity_links
```

Access layer:

```text
organization_admin_assignments
user_unit_relationships
area_access_grants
resource_access_grants
v_effective_area_access
v_effective_resource_access
permissions.ts
access-contexts
operations-scope-selection
```

## Work completed through May 9, preserved

### Production deployment

- GitHub repo is connected to Vercel.
- Production deploys from `main`.
- Production URL is `https://chrism.app`.
- Cloudflare handles DNS.
- Supabase Auth redirect URLs point magic links to production.

### Custom-list local-unit moat

Completed local-unit-first cleanup for custom lists:

```text
e180116 Cut custom list council scope bridge
b3a2c7d Scope member custom lists by local unit only
1bdffa1 Enforce local-unit ownership for custom lists
```

Key migration:

```text
supabase/migrations/20260505234500_custom_lists_local_unit_moat.sql
```

Current behavior:

- `custom_lists.council_id` is forced null and no longer acts as custom-list scope truth.
- Custom-list ownership is local-unit-only.
- Member detail custom-list reads use `local_unit_id` only.
- Compatibility bridge was removed where safe.

### Effective access cleanup for revoked admin access

Commit:

```text
f753feb Filter empty effective access contexts
```

Key migration:

```text
supabase/migrations/20260507143000_filter_empty_admin_package_access.sql
```

Current behavior:

- Revoked admin assignments do not appear as visible `/me` org cards.
- Zero-capability contexts are filtered out.
- Nathan's `/me` shows only St. Patrick's after St. Martin revoke.
- St. Martin pages remain inaccessible.

### Data-hygiene dashboard retired

Commit:

```text
2527fc9 Retire data hygiene scaffolding
```

Migration:

```text
supabase/migrations/20260507230000_retire_data_hygiene_scaffolding.sql
```

Current behavior:

- `/super-admin/data-hygiene` returns 404.
- Diagnostic/readiness views and legacy-write observer triggers were removed.
- `legacy_fossil_resolutions` remains as an internal audit table only.
- Direct `anon`/`authenticated` access to `legacy_fossil_resolutions` is intentionally revoked.

### Supabase security hardening through May 9

Completed:

```text
dcaa235 Secure public operational views
df2c15b Revoke public execution of security definer internals
19b84f2 Pin database function search paths
3d86568 Move pg_trgm extension out of public
```

Key migrations:

```text
supabase/migrations/20260507233000_secure_public_views.sql
supabase/migrations/20260507234500_revoke_public_security_definer_rpc.sql
supabase/migrations/20260508000000_set_function_search_paths.sql
supabase/migrations/20260508001500_move_pg_trgm_extension_schema.sql
```

Security Advisor expected status remains:

```text
ERRORs: 0
WARNs: 1 parked warning for leaked password protection
INFOs: RLS enabled/no policy notices remain and are intentionally parked
```

Reason leaked-password warning is parked:

- Supabase says leaked password protection requires a paid/Pro plan.
- Chrism is magic-link-first.
- Not a launch blocker on the current Free plan.

RLS INFO interpretation:

```text
RLS enabled + no policies = anon/authenticated browser roles are locked out.
```

Do not add broad policies just to silence INFO notices.

## Work completed after May 9 in this phase

### Event timezone rendering fixed

Commit:

```text
cd48a4b Fix event timezone rendering
```

Fixed meeting/event date-time display and edit behavior so general/executive meeting times display consistently on `/events`, `/events/[id]`, and council meeting pages.

### Legacy nonmember RPC browser access revoked

Completed a two-step lock-down of legacy nonmember creation RPC browser access:

```text
66a7914 Revoke legacy nonmember RPC browser access
2c17cdc Revoke local-unit nonmember RPC browser access
```

Result:

- Legacy nonmember/prospect/volunteer RPCs are no longer directly executable by browser roles where they should be server-controlled.
- `app.current_council_id` remained for compatibility at that moment, but browser-facing reliance was reduced.

### Event/org/officer/person-side RLS cuts

Sequential RLS cuts moved policies off `app.current_council_id()` and onto local-unit/effective-access bridge checks.

Key commits/migrations:

```text
978da8c Cut event RLS from current council helper
  supabase/migrations/20260509210000_cut_event_rls_from_current_council.sql

f4df4ce Cut org branding RLS from current council helper
  supabase/migrations/20260509211500_cut_org_brand_rls_from_current_council.sql

0aead1f [officer terms RLS cut commit in this phase]
  supabase/migrations/[officer_terms current_council cut]

5499562 Cut person side RLS from current council helper
  supabase/migrations/20260512193000_cut_person_side_rls_from_current_council.sql

71ac785 Cut audit and merge RLS from current council helper
  supabase/migrations/20260512200000_cut_audit_merge_rls_from_current_council.sql

1743236 Cut legacy user RLS from current council helper
  supabase/migrations/20260512201500_cut_legacy_user_rls_from_current_council.sql

451a3f9 Cut Supreme import RLS from current council helper
  supabase/migrations/20260513203000_cut_supreme_import_rls_from_current_council.sql

aa6f276 Refresh schema after council RLS cuts
```

Important final result:

```text
No RLS policies reference app.current_council_id().
```

Policy bridge pattern now used broadly:

```text
legacy council_id
-> local_units.legacy_council_id
-> v_effective_area_access
-> auth.uid() + area/access-level checks
```

For person-adjacent tables, bridge through `people` where needed:

```text
person_id
-> people.council_id
-> local_units.legacy_council_id
-> v_effective_area_access
```

For import/official-member tables, this was intentionally a narrow RLS hardening cut only. `/imports/supreme` UX/model cleanup remains a future project.

### RSVP vs volunteer model fixed

Problem found during event smoke testing:

- A normal RSVP was showing as a volunteer.
- Product rule clarified: all volunteers can count toward RSVPs/attendance, but not all RSVPs are volunteers.

Fix:

```text
Separate RSVP responses from volunteers
```

Key migration:

```text
supabase/migrations/20260511203000_separate_rsvp_attendees_from_volunteers.sql
```

Current behavior:

- `event_person_rsvp_attendees.is_volunteer` records volunteer intent.
- RSVP-only submissions count as attending/responses but not volunteers.
- Volunteer checkbox on public/manage RSVP pages marks volunteer intent.
- `/events/[id]` shows separate RSVP responses and volunteers.
- `/events/[id]/volunteers` shows only volunteer-flagged attendees.
- Event top stats show `Attending` and `Volunteers`; old `Reminder` stat card removed.
- Admins can remove an RSVP response from `/events/[id]`.
- Remove buttons support custom labels.

Smoke expectation:

```text
RSVP-only unchecked -> attending/responses increase, volunteers unchanged
Volunteer checked -> attending/responses increase, volunteers increase
Volunteer roster shows only volunteer-flagged rows
```

### Officer term currentness and lasting honorifics fixed

Problem:

- A `2024-2025 Grand Knight` term was treated as current during the 2025-2026 fraternal year.
- Historical Grand Knight was displayed as current Grand Knight.
- Historical Grand Knight could appear officer-admin eligible.

Fix:

```text
Treat officer end years as exclusive
```

Current semantics:

```text
service_end_year = ending year of the fraternal-year label.
Example: 2024-2025 is active during fraternal start year 2024.
It is past once the 2025-2026 fraternal year begins.
```

Current behavior:

- Historical Grand Knight displays as `Past Grand Knight`.
- Historical Grand Knight does not appear under current officers.
- Historical Grand Knight does not grant officer-derived admin access.
- Lasting honorifics now show on:
  ```text
  /members
  /members/[id]
  /members/[id]/officers
  ```

Confirmed sample:

```text
Rand Comishen
2024-2025 Grand Knight
currently_officer_admin_eligible = false
has_active_manual_org_admin_assignment = false
```

### Admin and officer smoke checks

After the officer/currentness fixes:

- Org/council/branding surfaces smoke-tested well.
- Officer term surfaces smoke-tested well.
- `/me/council` no longer shows historical Grand Knight as officer-derived admin.
- Current active admin audit showed expected manual and officer-derived admins.

### Login stale-tab UX TODO logged

GitHub issue:

```text
#5 UX polish: soften stale magic-link login tab after email is sent
```

Idea:

- After a magic link is sent, show a countdown.
- Try `window.close()` after a delay.
- If blocked, show “You can safely close this tab.”

Important caveat:

```text
Browsers usually block window.close() unless the window/tab was opened by script.
```

### Supreme import / official-member cleanup TODO logged, then RLS cut completed

GitHub issue:

```text
#6 Rework Supreme import and official-member workflow before final council-id RLS cut
```

Original intent was to leave this as UX/model cleanup before RLS, but audit showed:

```text
official_import_batches = 0 rows
official_import_rows = 0 rows
official_member_records = 0 rows
supreme_update_queue = 1 row
```

The single queue row was real pending residue, so it was kept.

RLS was safely cut as a narrow hardening step:

```text
supabase/migrations/20260513203000_cut_supreme_import_rls_from_current_council.sql
```

The broader `/imports/supreme` UX/model cleanup remains open under issue #6.

### Supabase Data API explicit grants TODO logged

GitHub issue:

```text
#7 Migration habit: make Data API grants explicit for new public tables
```

Current audit found only `legacy_fossil_resolutions` missing `anon`/`authenticated` grants, which is intentional.

Future migration habit:

- Internal/server-only table: no browser grants; document intentional lockout.
- App/client table: explicit grants to `authenticated` plus RLS policies.
- Public table: `anon` grant only if intentionally public.
- Service-role Data API use: explicit `service_role` grants where needed.

### Supabase CLI/network incident and password note

During final schema refresh, Supabase CLI failed repeatedly with socket/TLS/login-role errors. Root cause appeared to be local network/IPv6/router behavior, not Chrism app code or SQL.

Observed signals:

```text
A record for db.wvaaijbvukzyfaglifoc.supabase.co returned no IPv4 address.
AAAA returned IPv6.
CLI and PostHog requests failed with socket is not connected.
Router restart restored connection.
Docker Desktop also needed to be open for schema dump.
```

A migration was applied manually via SQL Editor, then migration history was repaired with:

```bash
npx supabase migration repair --linked --status applied 20260513203000
```

Important security note:

```text
Rotate the Supabase DB password.
It appeared in terminal/chat output during troubleshooting.
```

## Current deployment / environment notes

```text
Supabase project ref: wvaaijbvukzyfaglifoc
Supabase region: Canada (Central)
Production domain: https://chrism.app
DNS: Cloudflare
Vercel: production deploys from main
Docker Desktop: required locally for Supabase schema dump pipeline
```

## Current production smoke status

Smoke-tested as passing in this phase:

```text
/login
/me
/me/council
/members
/members/[id]
/members/[id]/edit
/members/[id]/officers
/members/officers
/custom-lists
/events
/events/[id]
/events/[id]/volunteers
/imports/supreme loads without throwing
/account context switching via UI flows
/parallel-area-context switching via UI flows
/councils/[councilNumber]/meetings
/councils/[councilNumber]/meetings.ics
```

Notes:

- `/account/context` and `/account/parallel-area-context` are POST-only route handlers. Direct browser GET returns HTTP 405 and is expected.
- Smoke testing those routes means using the UI forms/switchers that POST to them.

## Remaining required work

### Highest priority technical follow-up

1. Rotate Supabase DB password because it appeared in troubleshooting output.
2. Compatibility helper audit:
   ```text
   app.current_council_id
   app.create_prospect
   app.create_volunteer_only
   ```
   Audit usage first. Retire/restrict only if safe. Do not assume these can all be dropped just because RLS policies no longer call `current_council_id()`.
3. Add/expand tests around the access and model seams touched in this phase:
   ```text
   access matrix
   org-admin assignment -> area access
   RSVP vs volunteer
   officer currentness / Past Grand Knight
   custom-list share/revoke/contact/claim behavior
   ```

### Still important architecture cleanup

- Rebaseline Supabase migrations so shadow replay/db pull is less brittle.
- Finish identity-aware custom-list share/revoke behavior.
- Reduce area/resource grant dependency on `member_record_id`.
- Continue deeper `lib/auth/permissions.ts` refactor.
- Continue admin/officer access propagation cleanup.
- Continue import/restore/reactivation edge-case sweep.
- Final custom-list consistency sweep.
- Continue council-era fallback cleanup, especially `council_admin_assignments`.

### Identity-spine cleanup, later

- `users.person_id`
- `users.council_id`
- `people.council_id`
- `person_identities`
- `person_identity_links`

Do not rush this. The hidden identity spine must not silently swap in another org's row.

### Product polish / UX

Events/UI TODOs:

```text
replace browser confirm in edit-event flow with app UI
split archive/history IA:
  past events
  past meetings
  manually archived
clarify historical vs archived labels
fix event edit header card styling
external invitee send/share UI missing
event manager / event admin UI missing
polish /events/[id] RSVP/volunteer panels
```

Other polish:

```text
Supreme import UX/model cleanup (#6)
login stale-tab UX polish (#5)
admin handbook
admin history/notes UI
mobile layout polish
login/onboarding copy polish
toast/notice cleanup
```

## Important files for next helper

Custom lists:

```text
lib/custom-lists.ts
app/custom-lists/actions.ts
app/custom-lists/page.tsx
app/custom-lists/[id]/page.tsx
app/custom-lists/[id]/detail-client.tsx
app/custom-lists/archive/page.tsx
```

Auth/access:

```text
lib/auth/permissions.ts
lib/auth/access-contexts.ts
lib/auth/area-access.ts
lib/auth/operations-scope-selection.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
app/components/user-menu.tsx
app/components/access-context-switcher.tsx
app/components/operations-scope-switcher.tsx
app/account/context/route.ts
app/account/parallel-area-context/route.ts
```

Members/people/officers:

```text
app/members/page.tsx
app/members/[id]/page.tsx
app/members/[id]/edit/page.tsx
app/members/[id]/officers/page.tsx
app/members/officers/page.tsx
app/members/actions.ts
app/members/delete-member-icon-button.tsx
app/members/member-officer-service-section.tsx
lib/members/directory-data.ts
lib/members/officer-roles.ts
```

Me/council/admin:

```text
app/me/page.tsx
app/me/actions.ts
app/me/account-summary-section.tsx
app/me/council/page.tsx
app/me/council/actions.ts
app/me/council/admins/[id]/...
lib/organizations/admin-invitations.ts
lib/organizations/admin-assignments.ts
```

Events/RSVP:

```text
app/events/actions.ts
app/events/page.tsx
app/events/[id]/page.tsx
app/events/[id]/edit/page.tsx
app/events/[id]/volunteers/page.tsx
app/events/[id]/export/route.ts
app/events/archive/page.tsx
app/events/archive/[id]/page.tsx
app/events/event-form.tsx
app/events/remove-volunteer-button.tsx
app/rsvp/[token]/page.tsx
app/rsvp/[token]/manage/page.tsx
app/rsvp/[token]/event/page.tsx
lib/rsvp/person-rsvp.ts
lib/rsvp/claim.ts
```

Imports:

```text
app/imports/supreme/page.tsx
app/imports/supreme/actions.ts
app/imports/supreme/supreme-import-workbench.tsx
lib/imports/supreme.ts
```

Key recent migrations:

```text
supabase/migrations/20260509210000_cut_event_rls_from_current_council.sql
supabase/migrations/20260509211500_cut_org_brand_rls_from_current_council.sql
supabase/migrations/20260511203000_separate_rsvp_attendees_from_volunteers.sql
supabase/migrations/20260512193000_cut_person_side_rls_from_current_council.sql
supabase/migrations/20260512200000_cut_audit_merge_rls_from_current_council.sql
supabase/migrations/20260512201500_cut_legacy_user_rls_from_current_council.sql
supabase/migrations/20260513203000_cut_supreme_import_rls_from_current_council.sql
```

## Docs/source-of-truth status

These handoff docs should now be treated as the current source of truth for the next helper:

```text
docs/handoff/HANDOFF_May09_MVP_Live_Security_Hardened.md
docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
docs/handoff/SCHEMA_DIAGRAM_May09_UPDATED.md
```

Generated schema/reference docs were refreshed after the final RLS cut:

```text
supabase/schema.sql
supabase/reference/public-schema-reference.md
supabase/reference/public-schema-summary.json
```

`database.types.ts` and `supabase/reference/public-openapi.json` did not change in the final schema refresh.

## SQL/debug snippets worth preserving

### Confirm no RLS policy uses current_council_id

```sql
select
  count(*) as remaining_current_council_policy_count
from pg_policies
where coalesce(qual, '') ilike '%current_council_id%'
   or coalesce(with_check, '') ilike '%current_council_id%';
```

Expected:

```text
0
```

### St. Patrick's baseline counts

```sql
select
  'active_member_records' as area,
  count(*) as count
from member_records
where local_unit_id = '6d09f535-3769-453e-a041-4b79dc777f59'
  and archived_at is null

union all

select
  'archived_member_records' as area,
  count(*) as count
from member_records
where local_unit_id = '6d09f535-3769-453e-a041-4b79dc777f59'
  and archived_at is not null

union all

select
  'custom_lists' as area,
  count(*) as count
from custom_lists
where local_unit_id = '6d09f535-3769-453e-a041-4b79dc777f59'
  and archived_at is null

union all

select
  'events' as area,
  count(*) as count
from events
where local_unit_id = '6d09f535-3769-453e-a041-4b79dc777f59'
  and status_code <> 'cancelled'

union all

select
  'active_org_admin_assignments' as area,
  count(*) as count
from organization_admin_assignments
where organization_id = '5ef1f6fc-152a-4d04-b837-43a343cc0507'
  and is_active = true
  and revoked_at is null;
```

### Current admin audit

```sql
select
  p.first_name,
  p.last_name,
  oaa.user_id,
  oaa.grantee_email,
  oaa.source_code,
  oaa.created_at
from organization_admin_assignments oaa
left join people p on p.id = oaa.person_id
where oaa.organization_id = '5ef1f6fc-152a-4d04-b837-43a343cc0507'
  and oaa.is_active = true
  and oaa.revoked_at is null
order by p.last_name, p.first_name;
```

### Officer currentness sanity check

Historical `2024-2025 Grand Knight` should not be current during fraternal year 2025-2026.

```sql
select
  current_date as today,
  extract(year from current_date)::int as calendar_year,
  case
    when extract(month from current_date)::int >= 7
      then extract(year from current_date)::int
    else extract(year from current_date)::int - 1
  end as kofc_fraternal_start_year;
```

### Data API grants habit

For new public tables, explicitly decide grants:

```sql
-- app/client table example
grant select, insert, update, delete on public.your_table to authenticated;
alter table public.your_table enable row level security;

-- internal table example
revoke all on table public.your_internal_table from anon, authenticated;
```

## Suggested next-helper opening prompt

```text
We are on chrism-syd/chrism main.
Production is live at https://chrism.app.
Supabase project ref is wvaaijbvukzyfaglifoc.
Latest schema/RLS checkpoint is aa6f276 Refresh schema after council RLS cuts.

Read these docs first:
- docs/handoff/HANDOFF_May09_MVP_Live_Security_Hardened.md
- docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
- docs/handoff/SCHEMA_DIAGRAM_May09_UPDATED.md

Do not reintroduce council_id as operational truth.
No RLS policies currently reference app.current_council_id(); final SQL count is 0.

Current recommended next task:
Compatibility helper audit:
- app.current_council_id
- app.create_prospect
- app.create_volunteer_only

Goal:
Audit usage first, then decide whether each helper can be retired, restricted further, or left as a documented compatibility shim. No broad changes without verification.

Important model rules:
- local_unit_id = operational ownership/scope truth.
- council_id = legacy/public/routing/compatibility truth only.
- people is the product noun, not member_records.
- External admin contacts should have people + organization_admin_assignments, but should not get member_records or user_unit_relationships unless they are also real local members.
- Do not reintroduce backwards-compatible zombie wrappers when a future-state fix is safe.
- Use canonical permissions/access helpers. Do not invent page-specific permission oracles unless there is no shared seam.

Please inspect repo state directly before asking me for files.
Work in owl mode: slow, dependency-aware, audit-first, small patches, verify after each seam.
```

## Most likely next bugs to watch for

1. Stale operations-scope cookie confusion.
2. Multi-org users seeing wrong org because a page uses custom logic instead of canonical area access.
3. Custom-list share/revoke identity edge cases for multi-org users.
4. External admin contact accidentally getting `member_records`.
5. Officer currentness mismatch if future code forgets end-year-exclusive semantics.
6. RSVP vs volunteer regression if future UI treats attendees as volunteers by default.
7. Type drift from local copies of shared types.
8. `catch(() => [])` causing `never[]` TypeScript inference.
9. zsh globbing paths with `[id]` or `[token]`; quote those paths.
10. Dirty test data impersonating a live bug.
11. Migration replay/shadow DB brittleness until rebaseline.
12. Supabase CLI network/Docker assumptions during schema refresh.

## Final honest status

Chrism is live at `chrism.app`, smoke-tested, and materially hardened.

The `current_council_id()` RLS sweep is complete. No RLS policies depend on it. Core access, onboarding, custom-list, member, officer, event, RSVP/volunteer, archive/restore, context-switching, and production login flows are in good MVP shape based on smoke tests.

Remaining work is now less about urgent RLS hardening and more about compatibility helper retirement, migration rebaseline, tests, permission refactor, identity-spine cleanup, and product/UX polish.
