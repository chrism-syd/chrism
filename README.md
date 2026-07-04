# Chrism

Chrism is a Next.js + Supabase application for local organization administration, public presence, and member belonging.

The current architecture is organization-first and local-unit-aware. Operational ownership is defined by:

```text
organization_id
local_unit_id
```

Council identity remains important for Knights of Columbus public pages, council numbers, historical imports, public URLs, and compatibility, but it is not the universal source of operational authority.

---

## Start here

Before making major changes, read the living documentation:

- `docs/CHRISM_PRINCIPLES.md` - durable product and engineering principles
- `docs/ARCHITECTURE.md` - current high-level application architecture
- `docs/OPERATIONS_ARCHITECTURE.md` - authenticated operations and access architecture
- `docs/PUBLIC_PAGES.md` - public organization page architecture and conventions
- `docs/DEVELOPMENT.md` - working process, commit rhythm, and seam lifecycle
- `docs/SUPABASE_WORKFLOW.md` - migrations, schema mirrors, repairs, and generated types
- `docs/handoff/HANDOFF_2026-07-04_Parallel_Access_Cutover.md` - current project-state handoff after the council-compatibility cleanup

GitHub issues are the canonical todo list. Historical handoff documents are reference material only.

---

## Product surfaces

### Public organization pages

Public local organization pages live under:

```text
/o/[slug]
```

They are visitor-facing projections of operational data such as organization profile, public events, contact details, gallery images, external links, and visible leadership.

For Knights of Columbus councils, public council identity remains intentional. A council number or public council URL can still be product truth for visitor-facing identity while operations remain owned by organization/local-unit context.

### Member and personal workflows

Member-facing and personal workflows live primarily under:

```text
/me
```

This area handles profile, organization/account status, claimed RSVP history, personal participation flows, and entry points into local organization settings when the signed-in person has access.

### Operations workflows

Authenticated operations workflows include:

```text
/people
/events
/custom-lists
/me/council
/imports/supreme
```

These areas handle people management, event planning, RSVP and volunteer coordination, custom lists, organization settings, admin invitations, Supreme import review, and local-unit administration.

Legacy `/members` routes remain compatibility routes during migration. New work should prefer people/local-unit terminology unless a feature is intentionally membership-specific or council-specific.

---

## Architectural baseline

Chrism's current operational model is:

```text
User authentication
      |
      v
Person identity
      |
      v
Organization / local-unit access
      |
      v
Permissioned operations
```

Operational truth:

```text
organization_id
local_unit_id
```

Public identity and compatibility truth may still include:

```text
council_id
council number
public council routes
historical imports
legacy migrations
```

Do not remove a `council_id` reference simply because it exists. Classify it first:

1. Product truth, such as public Knights council identity.
2. Compatibility bridge, to replace when the local-unit-native seam is ready.
3. Dead architecture, to delete.

New code should not deepen legacy compatibility layers. Find the underlying organization/local-unit seam instead.

---

## Tech stack

- Next.js App Router
- React 19
- TypeScript
- Supabase Auth and Postgres
- Vercel deployment
- Tailwind CSS 4 / route-scoped CSS
- `read-excel-file` for spreadsheet import
- `write-excel-file` for spreadsheet export

Security note: the vulnerable `xlsx` dependency was removed during the July 2026 architecture/security cleanup. Do not reintroduce it casually.

---

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

The council dependency audit should stay at:

```text
BLOCKER: 0
WARN:    0
```

INFO findings are expected to include intentional public identity, archived migrations, historical imports, and documentation references.

---

## Recommended code areas

Start with these areas depending on the work:

```text
app/app-header.tsx
app/me/
app/me/council/
app/people/
app/people-list.tsx
app/members/
app/events/
app/custom-lists/
app/imports/supreme/
app/o/[slug]/
lib/auth/
lib/organizations/
lib/local-pages/
lib/supabase/
supabase/migrations/
supabase/schema.sql
```

---

## Development process

Work one seam at a time.

A good seam starts from a GitHub issue, identifies data ownership and access rules, builds a narrow vertical slice, commits in small reversible steps, refactors while context is fresh, updates docs/issues, then closes or updates the issue.

See `docs/DEVELOPMENT.md` for the full workflow.

---

## Supabase

Database changes should stay aligned with Git history.

When changing schema, commit migrations, generated types, related application code, and any intentional schema mirror updates together where practical.

See `docs/SUPABASE_WORKFLOW.md` before migration repair, rebaseline, or dashboard-derived schema work.

---

## Deployment

This is a Next.js app deployed through Vercel or another Next.js-compatible host.

Before production deployment after an architecture or security seam:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

Then smoke test:

- login / logout
- `/me`
- `/people`
- Supreme import review
- people export
- `/events`
- `/custom-lists`
- `/me/council`
- public `/o/[slug]` pages
- public contact / get-involved flow
- permission boundaries for admin and non-admin users

Ensure required environment variables and Supabase credentials are configured for the target environment before deployment.
