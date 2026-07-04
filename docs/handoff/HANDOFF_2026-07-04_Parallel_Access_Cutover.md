# Handoff: Parallel Access Cutover

Date: 2026-07-04

This is the current project handoff after the organization/local-unit migration and council-compatibility cleanup. It is written for a future helper or engineer who has not read the working chat.

## Executive summary

Chrism has completed a major architectural migration away from council-centric operational ownership.

The current operational model is:

```text
organization_id
local_unit_id
```

These are the source of truth for authenticated operations, access, people/member management, events, custom lists, settings, imports, and admin workflows.

Council identity still exists intentionally for:

- public council URLs
- council numbers
- public council identity
- historical imports
- compatibility during migration
- archived migrations and schema history

The rule is not "remove every council reference." The rule is: classify every council reference before changing it.

## Current architecture baseline

Identity:

```text
Supabase auth user
        |
        v
public.users
        |
        v
people
```

Operational ownership:

```text
Organization
        |
        v
Local unit
        |
        v
Operational data
```

Public projection:

```text
Operational data
        |
        v
Public-safe view model
        |
        v
/o/[slug]
```

Council identity remains part of the product where the context is public identity, public URLs, council numbers, historical import data, or migration history.

## Architectural invariants

Future work should preserve these rules:

1. Operational ownership is organization/local-unit based.
2. Server-side access checks are required for operations and mutations.
3. Public pages are projections of operational truth.
4. Council references must be classified before removal.
5. New work should not deepen compatibility bridges.
6. Supreme import and admin invitations are different product workflows.
7. Public contact/registration should not automatically grant local-unit membership.
8. GitHub issues are the canonical todo list.
9. Historical handoffs are reference material, not active architecture.
10. Vulnerable spreadsheet dependencies must not be reintroduced casually.

## Completed migration work

Recent work completed the main council-compatibility cleanup.

Highlights:

- Supreme import no longer depends on the old people council bridge for operational ownership.
- Admin invitation person-source logic was corrected away from Supreme import assumptions.
- Permissions were cut away from the retired council-admin assignment bridge.
- Retired council admin assignment tables were dropped.
- Related sync triggers/functions were removed.
- Homepage permissions fallback was removed.
- Stale audit rules and obsolete compatibility scripts were pruned.
- Generated schema artifacts were refreshed during the migration work.
- Council dependency audit was brought to clean operational posture.

Current council audit expectation:

```text
BLOCKER: 0
WARN:    0
```

INFO-level references remain because documentation, public identity, archived migrations, historical imports, and compatibility surfaces still contain intentional council language.

## GitHub issue status

Completed or effectively completed during this cutover:

- #6 Rework Supreme import and official-member workflow before final council-id RLS cut
- #10 Plan legacy council-id table cleanup after app sweep
- #15 Complete organization-first data model migration

Still important:

- #103 Add local-unit readiness audit before deleting compatibility fallbacks

Issue #103 should be treated as the next broad architecture/readiness audit after production deployment and smoke testing.

Public page/refactoring issues still relevant:

- #78 Add Council Officers public page and profile management
- #79 Public page refactoring follow-up polish
- #80 Core application refactoring and optimization roadmap
- #81 Public Officers feature (MVP) with reusable portrait positioning

## Security and dependency cleanup

The vulnerable `xlsx` dependency was removed.

Current spreadsheet approach:

- `read-excel-file` for spreadsheet import
- `write-excel-file` for spreadsheet export

Next.js was updated to `16.2.10`, and a PostCSS override forces `8.5.16`.

Expected security check:

```bash
npm audit
```

Expected result:

```text
found 0 vulnerabilities
```

Do not reintroduce `xlsx` without a deliberate security review.

## Current documentation map

Living docs:

- `README.md` - quick orientation and development workflow
- `docs/ARCHITECTURE.md` - canonical high-level architecture reference
- `docs/OPERATIONS_ARCHITECTURE.md` - authenticated operations and access architecture
- `docs/PUBLIC_PAGES.md` - public page architecture and public/operations boundary
- `docs/CHRISM_PRINCIPLES.md` - durable product and engineering principles
- `docs/DEVELOPMENT.md` - seam workflow and working conventions
- `docs/SUPABASE_WORKFLOW.md` - database migration and schema workflow

Current handoff:

- `docs/handoff/HANDOFF_2026-07-04_Parallel_Access_Cutover.md`

Historical handoffs belong in:

- `docs/archive/`

## Current route model

Public:

```text
/o/[slug]
```

Personal/member-facing:

```text
/me
```

Operations:

```text
/people
/events
/custom-lists
/me/council
/imports/supreme
```

Compatibility:

```text
/members
```

The `/me/council` route name remains council-flavored but should be treated as the current local organization settings surface.

## Key code areas

Architecture and access:

```text
lib/auth/permissions.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
lib/organizations/
app/app-header.tsx
```

Operations:

```text
app/me/
app/me/council/
app/people/
app/people-list.tsx
app/events/
app/custom-lists/
app/imports/supreme/
```

Public pages:

```text
app/o/[slug]/
lib/local-pages/
```

Database and generated schema:

```text
supabase/migrations/
supabase/schema.sql
lib/supabase/database.types.ts
```

Audit:

```text
scripts/audit-council-id-dependencies.mjs
```

## Supreme import cautions

Supreme import is a manual spreadsheet workflow. It is not the admin invitation system.

Preserve this distinction:

- Supreme import reviews and reconciles people/member data.
- Admin invitations grant operational access.
- Local-unit ownership should be explicit.
- Import source codes should remain accurate.
- Import review should not become an implicit admin-access path.

## Permission cautions

When touching permissions:

1. Start with `lib/auth/permissions.ts` and related helpers.
2. Resolve active organization/local-unit context first.
3. Keep mutation checks server-side.
4. Avoid route-only permission logic.
5. Do not revive retired council-admin assignment bridges.
6. Do not infer current authority from public council identity.

## Public page cautions

Public pages should show only public-safe data.

They may show:

- public organization profile
- public council identity where appropriate
- public events
- public contact options
- public gallery images
- public leadership/officer display
- external links

They should not show:

- private member details
- internal planning state
- unresolved import state
- raw access grants
- admin review queues
- local-unit relationships that are not meant for visitors

Public pages start visitor conversations. Operations owns follow-up.

## Deployment status

At the time of this handoff, production smoke testing still needs to happen after deployment.

Before deployment, run:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

Expected:

- lint passes
- typecheck passes
- verify passes
- council audit shows BLOCKER 0 / WARN 0
- npm audit reports 0 vulnerabilities

## Smoke test checklist

Authentication:

- login
- logout
- session persistence
- redirect behavior for unauthenticated users

Personal area:

- `/me` loads for signed-in user
- profile/account status appears correctly
- RSVP history does not error

Operations:

- `/people` loads for authorized user
- people search/filter works
- people export works with new spreadsheet dependency
- `/events` loads
- event visibility/public projection behaves correctly
- `/custom-lists` loads
- `/me/council` loads for authorized admin
- unauthorized users cannot access admin surfaces

Supreme import:

- CSV import still works
- XLSX import works with `read-excel-file`
- review flow loads
- import does not grant admin access

Public pages:

- known `/o/[slug]` loads
- hero content renders
- public events render only public-safe events
- gallery works empty and populated
- contact/get-involved form opens and submits
- private member data is not exposed

Security/architecture:

- npm audit remains clean
- council dependency audit remains BLOCKER 0 / WARN 0
- server actions reject out-of-scope mutations

## Known risks after cutover

- Some route names and UI copy remain council-flavored while architecture is broader.
- `/me/council` is still the settings surface name even though the concept is local organization settings.
- Remaining INFO-level council references require ongoing discipline.
- Production deployment may reveal assumptions not covered by local checks.
- Public/officer feature work is not complete.
- Smoke testing has not yet been completed after this documentation refresh.

## Recommended next work

1. Deploy to Vercel.
2. Run the smoke test checklist above.
3. Fix real regressions or production blockers first.
4. Update #103 with deployment findings.
5. Use #103 to audit remaining compatibility references.
6. Resume feature work after the core surfaces are verified.

## Guidance for the next helper

Do not start by renaming things.

Start by classifying ownership:

```text
Is this operational truth?
Is this public identity?
Is this compatibility?
Is this historical?
Is this dead architecture?
```

Then inspect existing helpers before writing new logic.

Chrism is not trying to erase councils. Chrism is separating public council identity from operational authority so the product can support councils well and still grow beyond council-only assumptions.
