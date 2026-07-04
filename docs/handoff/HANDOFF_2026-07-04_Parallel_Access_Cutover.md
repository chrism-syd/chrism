# Handoff: Parallel Access Cutover

Date: 2026-07-04

This is the current project handoff after the organization/local-unit migration, council-compatibility cleanup, and pre-deployment dependency refresh.

It is written for a future helper or engineer who has not read the working chat.

---

## 1. Executive summary

Chrism has completed a major architectural migration away from council-centric operational ownership.

The current operational model is:

```text
organization_id
local_unit_id
```

These are the source of truth for authenticated operations, access, people/member management, events, custom lists, settings, imports, and admin workflows.

Council identity still exists intentionally for:

- Knights public URLs
- council numbers
- historical imports
- compatibility during migration
- archived migrations and schema history
- public-facing council identity

A `council_id` reference is not automatically wrong. It must be classified before it is changed.

---

## 2. Current project state

The architecture has crossed from "mid-migration" to "organization/local-unit baseline."

Current posture:

- operational authority is organization/local-unit based
- legacy council admin assignment bridges are retired
- permissions no longer depend on the retired council-admin bridge
- Supreme import has been separated from admin invitation/access concepts
- public pages remain projections of operational data
- council dependency audit is clean at blocker/warn level
- npm audit is expected to be clean after the dependency refresh
- living docs have been updated to describe the current baseline

The next major step is production deployment and full smoke testing.

---

## 3. Architecture baseline

### 3.1 Identity spine

```text
Supabase auth user
        |
        v
public.users
        |
        v
people
```

A signed-in user is not automatically a local admin, member manager, event manager, or officer. Access must be resolved server-side.

### 3.2 Operations spine

```text
person identity
        |
        v
active organization/local-unit context
        |
        v
effective access
        |
        v
permissioned route or server action
```

### 3.3 Public projection spine

```text
operations/settings data
        |
        v
public-safe view model
        |
        v
/o/[slug]
```

Public pages are not the system of record.

---

## 4. Core product rules

Operational ownership:

```text
organization_id
local_unit_id
```

Public or historical council identity may still use:

```text
council_id
council_number
public council routes
historical import references
```

Every remaining council reference should be classified as one of:

1. Product truth: keep it.
2. Compatibility bridge: replace it when the local-unit-native seam is ready.
3. Dead architecture: delete it.

Do not remove a council reference simply because it exists.

Do not add a new compatibility bridge unless the underlying local-unit-native seam is unavailable and the reason is documented.

---

## 5. Work completed in the recent cleanup

### 5.1 Supreme import cleanup

Supreme import is a manual spreadsheet upload and review workflow. It is not an admin invitation flow.

Recent cleanup corrected assumptions around:

- imported people source attribution
- local-unit-native import behavior
- separation between import review and organization/admin access
- avoiding Supreme import as an implicit access path

### 5.2 Permissions cleanup

The permission stack was simplified away from the retired council admin assignment bridge.

Going forward:

- inspect `lib/auth/permissions.ts` first
- inspect `lib/auth/acting-context.ts` for active context behavior
- inspect `lib/auth/parallel-access-summary.ts` for access summary behavior
- do not invent route-local access systems unless an issue documents why
- server actions must re-check permissions

### 5.3 Council admin bridge retirement

The legacy council admin assignment bridge was removed from the live architecture.

Do not reintroduce:

- retired council admin assignment tables
- old sync triggers
- old compatibility fallbacks already cut
- permission checks through retired council-era structures

### 5.4 Homepage fallback cleanup

The old homepage fallback through `permissions.councilId` was removed.

### 5.5 Audit cleanup

The council dependency audit should currently report:

```text
BLOCKER: 0
WARN:    0
INFO:    1530
```

INFO findings are expected to include documentation, historical migrations, import history, public identity, and intentional compatibility.

### 5.6 Dependency refresh

Before deployment validation, the security dependency findings were addressed.

Completed:

- removed vulnerable `xlsx` dependency
- avoided ExcelJS because it introduced a vulnerable transitive dependency in the current audit context
- added `read-excel-file` for spreadsheet import
- added `write-excel-file` for spreadsheet export
- upgraded Next to `16.2.10`
- forced safe PostCSS resolution through package override
- npm audit expected result: zero vulnerabilities

Do not reintroduce `xlsx` without deliberate review.

---

## 6. Important files

Architecture docs:

```text
README.md
docs/ARCHITECTURE.md
docs/OPERATIONS_ARCHITECTURE.md
docs/PUBLIC_PAGES.md
docs/CHRISM_PRINCIPLES.md
docs/DEVELOPMENT.md
docs/SUPABASE_WORKFLOW.md
```

Auth and access:

```text
lib/auth/permissions.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
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

Database artifacts:

```text
supabase/migrations/
supabase/schema.sql
database.types.ts
```

---

## 7. GitHub issue status

Recently completed or substantially addressed:

- #6 Rework Supreme import and official-member workflow before final council-id RLS cut
- #10 Plan legacy council-id table cleanup after app sweep
- #15 Complete organization-first data model migration
- PRs #257 through #263 covering import cleanup, permissions cleanup, retired bridge cleanup, stale audit pruning, and homepage fallback cleanup

Still important:

- #103 Add local-unit readiness audit before deleting compatibility fallbacks
- #78 Add Council Officers public page and profile management
- #79 Public page refactoring follow-up polish
- #80 Core application refactoring and optimization roadmap
- #81 Public Officers feature MVP with reusable portrait positioning

GitHub issues are the todo list. Historical handoff documents are reference only.

---

## 8. Deployment status

The architecture/security cleanup is ready for production validation, but the production smoke test still needs to happen after deployment.

Before deployment or before accepting production fixes, run:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

Expected:

```text
Council audit BLOCKER: 0
Council audit WARN: 0
npm audit: 0 vulnerabilities
```

---

## 9. Smoke test checklist

### 9.1 Authentication and personal area

- login
- logout
- session persistence
- `/me`
- profile state
- organization/account status

### 9.2 Operations

- `/people` loads for an authorized user
- people search/filter/sort works
- people export works with the new spreadsheet export library
- `/imports/supreme` accepts CSV/XLSX as intended
- Supreme import review does not grant admin access
- `/events` loads and respects permissions
- `/custom-lists` loads and respects permissions
- `/me/council` loads local organization settings for authorized users
- admin invitation workflow remains separate from Supreme import

### 9.3 Public pages

- `/o/[slug]` loads for a known public page
- public events show only public-safe data
- gallery empty and populated states work
- contact/get-involved form opens and submits
- no private member data appears publicly
- public council identity appears only where intended

### 9.4 Access boundaries

- non-admin users cannot access admin-only operations
- server actions reject unauthorized mutations
- super admin behavior does not mask normal-user permission bugs

### 9.5 Dependencies

- npm audit remains clean
- no `xlsx` dependency is present
- spreadsheet import/export still works

---

## 10. Hidden factors to watch

### 10.1 Route names lag behind architecture

`/me/council` is still council-flavored, but the surface is becoming local organization settings. Do not infer operational architecture from the route name alone.

### 10.2 Public identity is not operational authority

Council identity can remain correct on public pages while being wrong as an operational permission source.

### 10.3 Super admin can hide bugs

A workflow that works for a super admin may still fail for a real local admin. Always smoke test with realistic permission levels where possible.

### 10.4 Imports and invitations are separate

Supreme import manages people/member data from a spreadsheet. Admin invitations grant operational access. Do not merge their mental models.

### 10.5 Compatibility code attracts regressions

Old bridge concepts can look convenient during a fix. Avoid that convenience unless the bridge is still intentionally active.

### 10.6 Public pages should not become a second CMS

If public content needs better management, improve the operations/settings source of truth rather than creating public-only duplicated state.

---

## 11. Recommended next work

1. Merge the documentation refresh.
2. Deploy to Vercel.
3. Run the smoke test checklist above.
4. Fix production-impacting regressions only.
5. Use issue #103 for a deliberate local-unit readiness audit after deployment validation.
6. Resume feature work such as public officers/profile management only after the smoke test is stable.

---

## 12. Instructions for the next helper

Start by reading:

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/OPERATIONS_ARCHITECTURE.md`
4. `docs/PUBLIC_PAGES.md`
5. this handoff

Then inspect the relevant GitHub issue before changing code.

Rules:

- classify old council-shaped code before changing it
- keep public page council identity separate from operations authority
- keep admin invitations and Supreme imports separate
- use server-side permission checks
- do not reintroduce `xlsx`
- work one seam at a time
- keep commits reversible
- update docs or issues when a seam changes architecture
