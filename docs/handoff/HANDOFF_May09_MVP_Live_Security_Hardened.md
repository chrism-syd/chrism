# HANDOFF / TRANSITION STATE - May 9 MVP Live + Security Hardened

## Read this first

This handoff supersedes and extends the Apr 27 MVP Stabilization handoff. Do not discard the earlier mental model:

```text
local_unit_id = operational ownership / scope truth
council_id    = legacy/public/routing/compatibility truth
people        = product noun
members       = one relationship/state inside a local org
```

The Apr 27 handoff remains directionally correct, especially the rules around local-unit-first scope, people-first product semantics, hidden identity links, external admin contacts, dirty-data warnings, and not reintroducing `council_id` as operational truth.

## Current known-good checkpoint

```text
Production URL:
  https://chrism.app

Production branch:
  main

Known-good tag:
  mvp-live-security-hardened

Latest known-good commit:
  3d86568 Move pg_trgm extension out of public
```

Recent commit stack on `main`:

```text
3d86568 Move pg_trgm extension out of public
19b84f2 Pin database function search paths
df2c15b Revoke public execution of security definer internals
dcaa235 Secure public operational views
2527fc9 Retire data hygiene scaffolding
a1cc3bd Trigger first Vercel deployment
5ab7fb4 Merge branch 'audit/post-merge-stabilization'
f753feb Filter empty effective access contexts
1bdffa1 Enforce local-unit ownership for custom lists
b3a2c7d Scope member custom lists by local unit only
```

Git tags:

```text
audit-post-merge-stabilized
mvp-stabilized-main
mvp-live-security-hardened
```

## Syd's working style and helper expectations

Syd prefers direct, honest feedback with pushback. Do not appease. State clearly what is a blocker, what is not, and what is unknown.

The workflow that worked well in this phase:

- Think first, then make small targeted cuts.
- Use “owl mode” for architecture/security passes: slow, dependency-aware, audit-first, no broad sledgehammer changes.
- Inspect repo/GitHub state directly whenever possible. Do not make Syd act as a file courier.
- Prefer production-ready changed files, exact patches, or downloadable one-shot scripts over long inline snippets.
- Prefer changed files only, not full repo bundles, unless explicitly requested.
- Keep changes surgical and seam-aware.
- Maintain a running TODO ledger and connect work back to the larger transition.
- Treat loader + client + action + database bugs as one seam when applicable.
- Quote shell paths containing `[id]` in zsh.
- Be transparent when something is uncertain or not verified.
- After each DB/app change, use:
  ```bash
  cd /Users/syd.fernandez/Chrism
  npx supabase db push --linked
  npm run schema:pull
  npx supabase db dump --linked --schema public -f supabase/schema.sql
  npx supabase gen types typescript --project-id wvaaijbvukzyfaglifoc --schema public > database.types.ts
  npm run verify
  git status --short
  git diff --stat
  ```
- Commit only after verify + relevant SQL audit + smoke pass.

Do not:

- Reintroduce `council_id` as operational truth.
- Treat `member_records` as the product noun.
- Assume admin assignment means someone is not a local member.
- Add backwards-compatible zombie wrappers when a future-state fix is safe.
- Keep asking for local diffs when current GitHub/repo state is available.
- Silence Supabase lint warnings by adding broad policies or grants without proving need.

## Big-picture mission

The long-term transition remains:

```text
local_unit_id = operational ownership / scope truth
council_id    = legacy/public/routing/compatibility truth
people        = product noun
members       = one relationship/state inside a local org
```

The product manages people, not only members. A person can be a member, prospect, volunteer, external admin contact, officer, shared custom-list participant, or another future local human record type.

## Architecture direction

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

Golden rules:

1. Local org experiences must use local-unit-scoped people/access.
2. Hidden identity can group the same human across orgs, but must not silently swap in another org's row.
3. Do not dedupe by name alone.
4. Do not treat `member_records` as conceptual product truth.
5. Do not provision `member_records` or `user_unit_relationships` for external admin invite acceptance.
6. A real local member who also has admin access must remain visible in member surfaces.
7. If a bug spans loader, UI, action, and DB, patch the seam, not only one layer.
8. Test residue can look exactly like logic failure. Inspect data before assuming code is wrong.

## Apr 27 baseline carried forward

The Apr 27 docs established the MVP stabilization baseline:

```text
St. Patrick's baseline clean
manual admin invite works
multi-org admin access works
section-level org switching works
user-menu org switching works
/members scoping works
/custom-lists scoping works
/me/council scoping works
/me org logos work
preferred name works for admin-only profile
custom-list sharing works
custom-list contact logging works
claim behavior preserved
build passes
lint had no errors at handoff
```

St. Patrick's baseline from Apr 27:

```text
active_member_records        125
archived_member_records      0
custom_lists                 1
events                       8
active_org_admin_assignments 2
```

Active org admins:

```text
Sydney Fernandez
Nathan Fernandez
```

Current officer terms at that handoff:

```text
Kristian Chan     grand_knight          2025-2026
Sydney Fernandez  deputy_grand_knight   2025-2026
```

## Work completed after Apr 27

### Supabase migration-history repair and schema refresh

- Linked local repo to Supabase project `wvaaijbvukzyfaglifoc`.
- Repaired migration history mismatch so local and remote migration lists aligned.
- Refreshed:
  ```text
  database.types.ts
  supabase/schema.sql
  supabase/reference/public-openapi.json
  supabase/reference/public-schema-reference.md
  supabase/reference/public-schema-summary.json
  ```

### Production deployment

- Connected GitHub repo to Vercel.
- Added Vercel environment variables:
  ```text
  BREVO_API_KEY
  BREVO_SENDER_EMAIL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  NEXT_PUBLIC_SUPABASE_URL
  PII_ENCRYPTION_KEY
  SUPABASE_SECRET_KEY
  ```
- Connected `chrism.app` through Cloudflare DNS.
- Set Supabase Auth Site URL/redirect URLs so magic links point to `https://chrism.app/auth/confirm` instead of localhost.
- `chrism.app` is live.
- Vercel production deploys from `main`.

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

- `custom_lists.council_id` is forced to null and no longer acts as custom-list scope truth.
- Custom-list ownership is local-unit-only.
- Member detail custom-list reads use `local_unit_id` only.
- Compatibility bridge removed where safe.

### Effective access cleanup for revoked admin access

Problem:

- Nathan had revoked St. Martin external admin access.
- He could not access St. Martin pages, but `/me` still showed St. Martin logo because zero-capability access contexts were still emitted.

Fix:

```text
f753feb Filter empty effective access contexts
```

Key migration:

```text
supabase/migrations/20260507143000_filter_empty_admin_package_access.sql
```

Current behavior:

- Effective access contexts suppress zero-capability admin residue.
- Nathan's `/me` shows only St. Patrick's.
- St. Martin pages remain inaccessible.

### Data-hygiene dashboard retired

Before retirement, the dashboard had:

```text
Open null-user fossils: 2
Unresolved legacy writes: 140
Legacy gap reports that were no longer authoritative
```

Actions performed:

- Resolved null-user fossils.
- Marked historical legacy-write observations resolved.
- Confirmed the remaining gap reports were obsolete transitional diagnostics, not active authority.
- Removed `/super-admin/data-hygiene`; it now returns 404.

Commit:

```text
2527fc9 Retire data hygiene scaffolding
```

Migration:

```text
supabase/migrations/20260507230000_retire_data_hygiene_scaffolding.sql
```

Removed:

```text
app/super-admin/data-hygiene/actions.ts
app/super-admin/data-hygiene/page.tsx
lib/super-admin/data-hygiene.ts
```

Dropped obsolete diagnostic/readiness views and old legacy-write observer triggers.

### Supabase security hardening

Security Advisor was reduced from many errors/warnings to only one parked warning.

Completed cuts:

#### 1. Secure public operational views

Commit:

```text
dcaa235 Secure public operational views
```

Migration:

```text
supabase/migrations/20260507233000_secure_public_views.sql
```

Retired:

```text
v_auth_effective_area_access
v_auth_effective_resource_access
v_auth_effective_admin_package_access
v_parallel_admin_package_audit
v_parallel_event_assignment_audit
v_parallel_custom_list_access_audit
```

Hardened with `security_invoker=true`:

```text
v_effective_area_access
v_effective_resource_access
v_effective_admin_package_access
v_effective_event_management_access
event_person_rsvp_summary
event_council_rsvp_rollups
event_host_summary
```

Direct `anon`/`authenticated` access to these operational views was revoked where appropriate; server-side/service-role access remains.

#### 2. Revoke public execution of SECURITY DEFINER internals

Commit:

```text
df2c15b Revoke public execution of security definer internals
```

Migration:

```text
supabase/migrations/20260507234500_revoke_public_security_definer_rpc.sql
```

Revoked direct `anon`/`authenticated` RPC execution for flagged internal functions, including:

```text
archive_local_unit_member_record(...)
restore_local_unit_member_record(...)
list_super_admin_preview_local_units()
rls_auto_enable()
sync_organization_admin_assignment_from_council_admin_assignmen(...)
sync_user_unit_relationship_status_from_member_record()
trg_sync_org_admin_from_council_admin_assignment()
```

Smoke after this passed, including prospect creation, archive, and restore.

#### 3. Pin function search paths

Commit:

```text
19b84f2 Pin database function search paths
```

Migration:

```text
supabase/migrations/20260508000000_set_function_search_paths.sql
```

Set explicit `search_path` for all functions Supabase flagged as mutable-search-path warnings.

#### 4. Move `pg_trgm` out of public

Commit:

```text
3d86568 Move pg_trgm extension out of public
```

Migration:

```text
supabase/migrations/20260508001500_move_pg_trgm_extension_schema.sql
```

Pre-checks showed:

- `pg_trgm` dependencies were extension-owned objects only.
- No app trigram indexes were found.

Moved `pg_trgm` from `public` to `extensions`.

### Supabase Security Advisor status

Current expected status:

```text
ERRORs: 0
WARNs: 1
INFOs: RLS enabled/no policy notices remain
```

Only parked warning:

```text
Leaked Password Protection Disabled
```

Reason parked:

- Supabase says leaked password protection requires a paid/Pro plan.
- Chrism is magic-link-first.
- Not a launch blocker on the current Free plan.

INFO notices:

- RLS enabled/no policy for many archive, lookup, internal, and future-feature tables.
- This is intentionally parked.
- RLS enabled with no policies means browser roles are locked out by default.
- Do not add broad policies just to silence INFO notices.

## Production smoke tests passed

After final hardening:

```text
/login
/me
/me/council
/events
/members
/custom-lists
/super-admin/data-hygiene returns 404
create prospect
archive dummy/member record
restore dummy/member record
Nathan production access check:
  /me shows only St. Patrick's
  St. Martin does not appear
  St. Martin pages are inaccessible
```

## Current deployment / environment notes

```text
Supabase project ref:
  wvaaijbvukzyfaglifoc

Supabase project name:
  sydsaddress@gmail.com's Project

Region:
  Canada (Central)

Production domain:
  https://chrism.app

DNS:
  Cloudflare handles DNS.

Vercel:
  Connected to GitHub repo.
  Production deploys from main.
```

Old Vercel preview deployments do not need to be preserved manually. GitHub commits/tags are the archive.

## Remaining required work

### High priority after MVP launch

- Continue removing legacy `council_id` assumptions where safe.
- Audit/drop remaining compatibility helpers:
  ```text
  app.create_prospect
  app.create_volunteer_only
  app.current_council_id
  ```
- Rebaseline Supabase migrations so shadow replay/db pull is clean and the migration stack becomes less brittle.
- Finish identity-aware custom-list share/revoke behavior.
- Reduce area/resource grant dependency on `member_record_id`.
- Continue deeper `lib/auth/permissions.ts` refactor from the earlier local-unit permission audit snapshot.
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

Events TODOs from Apr 27 remain unless already handled:

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
```

Nice-to-haves:

```text
automated tests for access matrix
tests for custom-list share/revoke/contact/claim behavior
tests for org-admin assignments feeding area access
better /me org card labels
admin handbook
roster import UI
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
app/account/parallel-area-context/...
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

Events:

```text
app/events/actions.ts
app/events/page.tsx
app/events/[id]/page.tsx
app/events/[id]/edit/page.tsx
app/events/[id]/volunteers/page.tsx
app/events/archive/page.tsx
app/events/archive/[id]/page.tsx
app/events/event-form.tsx
app/rsvp/[token]/page.tsx
app/rsvp/[token]/manage/page.tsx
app/rsvp/[token]/event/page.tsx
```

Migrations to understand:

```text
supabase/migrations/20260427223000_include_org_admins_in_effective_area_access.sql
supabase/migrations/20260505234500_custom_lists_local_unit_moat.sql
supabase/migrations/20260507143000_filter_empty_admin_package_access.sql
supabase/migrations/20260507230000_retire_data_hygiene_scaffolding.sql
supabase/migrations/20260507233000_secure_public_views.sql
supabase/migrations/20260507234500_revoke_public_security_definer_rpc.sql
supabase/migrations/20260508000000_set_function_search_paths.sql
supabase/migrations/20260508001500_move_pg_trgm_extension_schema.sql
```

## Docs/source-of-truth status

Generated schema/reference docs were refreshed during the hardening sequence:

```text
database.types.ts
supabase/schema.sql
supabase/reference/public-openapi.json
supabase/reference/public-schema-reference.md
supabase/reference/public-schema-summary.json
```

The main README remains directionally accurate. It still describes the app as moving from legacy council-only assumptions toward a local-unit model, and points future helpers to the core auth/custom-list/event/me areas.

No dedicated committed “permissions doc” or “schema diagram doc” was found in the repo beyond uploaded handoff docs and generated schema references. This handoff should be kept alongside the updated permissions/schema notes if those docs are committed later.

## SQL/debug snippets worth preserving

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

Expected Apr 27 baseline:

```text
125
0
1
8
2
```

### Active admins

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

Expected Apr 27 baseline:

```text
Nathan Fernandez
Sydney Fernandez
```

### Security advisor sanity checks

Security-definer view check should be clean except intentional current views with `security_invoker=true`.

```sql
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
order by c.relname;
```

`pg_trgm` should be in `extensions`:

```sql
select
  e.extname,
  n.nspname as extension_schema
from pg_extension e
join pg_namespace n
  on n.oid = e.extnamespace
where e.extname = 'pg_trgm';
```

Expected:

```text
pg_trgm | extensions
```

## Suggested next-helper opening prompt

```text
We are on chrism-syd/chrism main.
Known-good tag is mvp-live-security-hardened.
Production is live at https://chrism.app.
Supabase project ref is wvaaijbvukzyfaglifoc.

Read the May 9 handoff, permissions note, and schema note first. They extend the Apr 27 MVP stabilization docs.

Do not reintroduce council_id as operational truth.
Current remaining direction:
- continue local-unit-first / people-first cleanup
- rebaseline Supabase migrations
- audit app.create_prospect, app.create_volunteer_only, app.current_council_id
- continue permissions.ts refactor
- keep external admin contacts out of member_records/user_unit_relationships unless they are real local members
- keep RLS INFO notices parked unless a table needs direct browser access
- leaked password protection warning is parked due Supabase Free plan and magic-link-first auth

Please inspect repo state directly before asking me for files.
Use small audited cuts, verify after each DB/app change, and avoid broad compatibility zombies.
```

## Most likely next bugs to watch for

1. Stale operations-scope cookie confusion.
2. Multi-org users seeing wrong org because a page uses custom logic instead of canonical area access.
3. Custom-list share/revoke identity edge cases for multi-org users.
4. External admin contact accidentally getting `member_records`.
5. Officer currentness mismatch due to term row shape.
6. Type drift from local copies of shared types.
7. `catch(() => [])` causing `never[]` TypeScript inference.
8. zsh globbing paths with `[id]`; quote those paths.
9. Dirty test data impersonating a live bug.
10. Migration replay/shadow DB brittleness until rebaseline.

## Final honest status

Chrism is live at `chrism.app`, smoke-tested, tagged, and materially hardened.

Core access, onboarding, custom-list, member, event, archive/restore, and production login flows are in good MVP shape. Supabase Security Advisor is effectively clean except for leaked password protection, which is parked due Free plan and magic-link-first auth. Remaining INFO notices are locked-table notices and should not be “fixed” with careless broad policies.

Next phase should be controlled MVP use, rebaseline, tests, and deeper cleanup of the remaining council-era compatibility seams.
