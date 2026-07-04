# Chrism architecture overview

This document is the current high-level map of the Chrism application. Older dated handoff documents may still be useful for history, but this file should be treated as the current architecture reference.

Chrism is now organized around an organization-first, local-unit-aware operating model. Councils remain important for Knights of Columbus identity, public pages, council numbers, and historical compatibility, but they are no longer the universal source of operational authority.

## Architectural invariants

These rules should be treated as the laws of physics for the application.

### Operational truth

Authenticated operations are owned by:

```text
organization_id
local_unit_id
```

These values define the active work context for people, events, lists, settings, imports, admin access, and organization management.

### Identity truth

Authentication and profile identity flow through:

```text
Supabase auth user
        |
        v
public.users
        |
        v
people
```

A signed-in user is not automatically a local organization admin. Access must be resolved through server-side permission helpers and active organization/local-unit context.

### Public identity truth

Public Knights identity may still use:

```text
council_id
council number
public council URLs
Knights-specific slugs and labels
```

This is intentional product identity. Do not remove it simply because it contains council terminology.

### Compatibility truth

Legacy council-shaped data can remain where it is needed for:

```text
historical imports
archived migrations
public Knights identity
compatibility during migration
old route support
schema history
```

New work should not deepen these bridges. When a bridge is encountered, classify it before changing it.

## Council reference classification

Every remaining `council_id` reference should be treated as one of three categories.

### 1. Product truth

Keep it.

Examples:

```text
/councils/7689
Council number 7689
Knights public identity
historical council labels
```

### 2. Compatibility bridge

Replace it when the local-unit-native seam is ready.

Questions to ask:

- Is this still required by a live route or migration bridge?
- Can the code now resolve through organization/local-unit context?
- Is there a safer helper that already does this?

### 3. Dead architecture

Delete it.

Examples:

- obsolete bridge tables
- retired sync triggers
- duplicate audit rules
- council admin assignment fallbacks after organization admin authority exists

Do not feed the compatibility layer. If new code needs a bridge, pause and find the underlying seam.

## Product model

Chrism supports three major surfaces.

### Public organization pages

Visitor-facing local organization pages live under:

```text
/o/[slug]
```

They present public-safe projections of operational data, including profile details, public events, gallery images, contact options, external links, and visible leadership.

### Member and personal area

Personal workflows live under:

```text
/me
```

This area answers: what can this signed-in person see, update, or participate in?

It includes profile, organization/account status, RSVP history, and entry points into organization settings when the user has access.

### Operations and administration

Authenticated working surfaces include:

```text
/people
/events
/custom-lists
/me/council
/imports/supreme
```

These routes are permission-aware and must resolve access server-side. They should operate in organization/local-unit context, even where labels remain council-flavored for current Knights workflows.

## Domain model

The simplified domain flow is:

```text
Auth user
    |
    v
Person
    |
    v
Access grants / relationships
    |
    v
Local unit
    |
    v
Organization
```

Another way to read the product boundary:

```text
Organization
    |
    v
Local unit
    |
    v
Operational data
    |
    v
Public projections
```

Key concepts:

- **Organization** is the broader product/account boundary.
- **Local unit** is the concrete operating body where work happens.
- **Person** is durable human identity.
- **User** is authentication/application identity.
- **Council** is a Knights-specific public and historical identity surface, not the universal operational owner.

## Access architecture

Access is resolved through helper code, not through scattered route-specific assumptions.

Important areas:

```text
lib/auth/permissions.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
lib/organizations/
app/app-header.tsx
app/me/
```

Preferred flow:

```text
resolve signed-in user
        |
        v
resolve person identity
        |
        v
resolve active organization/local-unit context
        |
        v
resolve effective access
        |
        v
render or mutate only what is allowed
```

Server actions must repeat permission checks. UI hiding is never sufficient.

## Parallel Access baseline

The Parallel Access work moved Chrism away from legacy council admin plumbing and toward organization/local-unit authority.

Current baseline:

- Organization/local-unit context is the operational source of truth.
- Organization admin authority is canonical.
- Retired council admin assignment bridges should not be reintroduced.
- Effective access should be resolved through existing helpers.
- Admin routes should not invent their own access model.

When changing access, inspect the helper stack first. Most bugs in this area come from bypassing an existing helper or reintroducing old council assumptions.

## Public page architecture

Public pages are projections of operational truth.

The public local organization page under `app/o/[slug]` follows a component-based structure.

Key files:

```text
app/o/[slug]/page.tsx
app/o/[slug]/layout.tsx
app/o/[slug]/public-page.css
app/o/[slug]/public-gallery.css
app/o/[slug]/public-contact-expander.css
app/o/[slug]/public-header.tsx
app/o/[slug]/public-hero.tsx
app/o/[slug]/public-events.tsx
app/o/[slug]/public-story.tsx
app/o/[slug]/public-contact.tsx
app/o/[slug]/public-contact-form-expander.tsx
app/o/[slug]/public-footer.tsx
app/o/[slug]/actions.ts
```

Preferred pattern:

```text
load public-safe data
        |
        v
build view models
        |
        v
compose section components
        |
        v
render route-scoped presentation
```

Public pages should not become a separate website-builder silo. Operations/settings surfaces own the data. Public pages display it.

## Operations architecture

Operations routes should be understood as work surfaces, not isolated pages.

Primary work surfaces:

```text
/people          people and directory management
/events          events, RSVP, volunteer coordination
/custom-lists    outreach and planning lists
/me/council      local organization profile/settings/admin area
/imports/supreme Supreme spreadsheet import review
```

Legacy `/members` routes remain compatibility routes. New work should prefer People terminology unless the feature is intentionally membership-specific.

## Data ownership

Use this ownership hierarchy when deciding where data belongs.

```text
Personal data             -> person / user profile
Operational local data    -> local unit
Account boundary data     -> organization
Public presentation data  -> operational data projected through public page settings
Historical Knights data   -> council compatibility where required
```

Avoid duplicating data for convenience. The public page should not own a second copy of information that belongs to local organization settings.

## Import architecture

Supreme import is a manual spreadsheet upload and review workflow. It is not the same as admin invitations, access grants, or organization onboarding.

Current expectations:

- Supreme import data should be reviewed before it mutates durable people records.
- Admin invitations should use the admin/invite access model, not Supreme import assumptions.
- Import rows may preserve historical council information, but operational ownership should resolve through local-unit context where possible.
- Spreadsheet import/export must not reintroduce the vulnerable `xlsx` dependency.

## Styling conventions

Prefer:

- route-scoped CSS for route-specific presentation
- shared components for stable repeated UI patterns
- CSS variables and theme tokens as the design-token layer
- small, named classes over inline style objects
- React-owned behavior over DOM enhancement scripts

Avoid:

- DOM scripts that rewrite server-rendered markup after load
- route-specific selectors in global CSS unless truly global
- large route files that mix data loading, business logic, mutations, and full page markup
- styling that makes operations workflows slower for administrators

A larger CSS architecture audit is tracked in GitHub issue #80.

## Verification baseline

Before deployment after architecture work, run:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

Expected council dependency audit posture:

```text
BLOCKER: 0
WARN:    0
```

INFO references are acceptable only when they are intentional: documentation, archived migrations, historical imports, public identity, or compatibility seams.

## Current roadmap

GitHub issues are the canonical todo list.

Current architectural priority:

```text
#103 Add local-unit readiness audit before deleting compatibility fallbacks
```

Issue #103 should be used as the next broad audit after deployment smoke testing. It should not reopen already-completed council-admin bridge cleanup unless production testing reveals a regression.

Other relevant public-page and refactoring issues include:

- #78 Add Council Officers public page and profile management
- #79 Public page refactoring follow-up polish
- #80 Core application refactoring and optimization roadmap
- #81 Public Officers feature (MVP) with reusable portrait positioning

Do not rely on old handoff files as the todo list. If something matters, create or update a GitHub issue.

## Read next

- `docs/OPERATIONS_ARCHITECTURE.md`
- `docs/PUBLIC_PAGES.md`
- `docs/DEVELOPMENT.md`
- `docs/SUPABASE_WORKFLOW.md`
- `docs/handoff/HANDOFF_2026-07-04_Parallel_Access_Cutover.md`
