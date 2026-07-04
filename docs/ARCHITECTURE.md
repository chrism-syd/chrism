# Chrism Architecture

This document is the current high-level architecture reference for Chrism.

Older dated handoff documents may still be useful for history, but this file should be treated as the current architecture reference unless a newer living architecture document explicitly supersedes it.

---

## 1. Executive summary

Chrism is an organization-first, local-unit-aware application for local organization administration, member/person management, events, public presence, and continuity of service.

The current architecture is built around two operational identifiers:

```text
organization_id
local_unit_id
```

These are the source of truth for authenticated operations.

Council identity still exists where it is product truth, especially for Knights of Columbus public identity, council numbers, public routes, historical imports, and compatibility during migration. A `council_id` reference is not automatically wrong. It must be classified before being changed.

The major architectural migration away from council-centric operational ownership is substantially complete. The app now treats councils as one possible local-organization identity shape rather than the universal root of authority.

---

## 2. Architectural invariants

These are the durable rules that should guide future changes.

### 2.1 Operational ownership

Authenticated operational ownership is always:

```text
organization_id
local_unit_id
```

These identifiers own work such as:

- people and directory management
- events
- RSVP and volunteer coordination
- custom lists
- local organization settings
- public profile configuration
- gallery/contact settings
- admin invitations
- imports and review flows
- access grants and permissions

### 2.2 Identity ownership

Human identity is represented through the identity/person spine.

```text
Supabase auth user
        |
        v
public.users
        |
        v
people
```

A signed-in user is not automatically a member, officer, manager, or admin. Access must be derived through explicit relationships, grants, and helper logic.

### 2.3 Public identity

Public identity is not the same thing as operational ownership.

For Knights of Columbus councils, public identity may intentionally include:

```text
council_id
council_number
council slug
public council URL
Knights-specific labels
```

This is product truth where visitors, members, and search engines expect council identity.

### 2.4 Compatibility

Compatibility exists to preserve important history and migration continuity, not to define new behavior.

Compatibility may exist in:

- historical migrations
- archived schema
- old route support
- import history
- public identity bridges
- explicit legacy fields
- generated schema mirrors

New code should not create new compatibility bridges unless there is no local-unit-native seam available and the decision is documented.

### 2.5 Classification before deletion

Every remaining `council_id` or council-shaped reference must be classified before changing it.

There are three categories:

1. **Product truth**  
   Keep it. Example: public Knights council page identity.

2. **Compatibility bridge**  
   Replace it when the local-unit-native seam is ready.

3. **Dead architecture**  
   Delete it.

Do not remove a council reference simply because it exists.

---

## 3. Product model

Chrism has three major product surfaces.

```text
Public visitor surface
Authenticated personal surface
Authenticated operations surface
```

### 3.1 Public visitor surface

Primary route:

```text
/o/[slug]
```

Purpose:

- public identity
- public events
- public contact
- gallery
- public leadership/officers
- organization story
- participation entry points

The public page is a projection of operational data. It should not become a separate website-builder silo.

### 3.2 Personal surface

Primary route:

```text
/me
```

Purpose:

- personal profile
- account state
- organization relationship status
- RSVP history
- member-facing actions
- entry points into settings for authorized users

The personal surface answers:

> What can this signed-in person see, update, or participate in?

### 3.3 Operations surface

Primary routes:

```text
/people
/events
/custom-lists
/me/council
/imports/supreme
```

Purpose:

- manage people
- manage events
- manage lists
- manage local organization settings
- review imports
- manage admin invitations
- prepare public data for projection

The operations surface answers:

> What work can this authorized person perform for this organization/local unit?

---

## 4. Domain model

The simplified domain flow is:

```text
Auth user
    |
    v
Person
    |
    v
Access / relationship
    |
    v
Local Unit
    |
    v
Organization
```

### 4.1 Organization

An organization is the broad account/product boundary.

It can contain one or more local units.

Examples:

- a Knights council organization
- a parish organization
- a ministry organization
- a school group organization
- a nonprofit organization

### 4.2 Local unit

A local unit is the concrete operating body where work happens.

Examples:

- a council
- a parish ministry
- a conference
- a committee
- a chapter
- a local volunteer group

Operational records should generally resolve to a local unit when they are about day-to-day work.

### 4.3 Council

A council is a Knights-specific local identity.

Council identity can be product truth for:

- public pages
- council numbers
- historical imports
- member-facing recognition
- legacy route compatibility

Council identity should not be used as a universal authorization boundary.

### 4.4 Person

A person is durable human identity.

A person can be connected to:

- a user account
- one or more local units
- one or more organization memberships
- officer terms
- event participation
- custom lists
- import history
- public contact submissions

Do not assume every person is a formal member.

### 4.5 User

A user is authentication/application identity.

A user can be associated with a person, but the user account itself should not be treated as the full domain identity.

---

## 5. Authority model

Authority should be resolved through shared helpers and database policy design, not through route-specific assumptions.

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
render page or perform mutation
```

Important files:

```text
lib/auth/permissions.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
app/app-header.tsx
app/me/
```

### 5.1 Server-side enforcement

UI hiding is not access control.

Any server action or mutation must independently verify:

- signed-in user
- active local-unit/organization context
- required permission area
- required access level
- ownership of client-supplied IDs

### 5.2 Area access

Area access is the preferred way to represent operational permissions.

Common conceptual areas include:

- people
- events
- custom lists
- admins
- settings
- imports

When adding a new feature area, inspect the existing access helpers before creating new permission logic.

### 5.3 Organization admin

Organization admin authority is canonical for organization-scoped management.

The retired council admin assignment bridge should not be reintroduced.

### 5.4 Officer-derived access

Some officer roles may imply authority in certain areas.

Officer-derived access should be explicit and resolved through helper logic. Do not assume every officer can manage every work area.

### 5.5 Super admin

Super admin behavior is support/maintenance behavior.

It should not mask whether normal local admins can perform real workflows.

When smoke testing permissions, test with realistic local admin accounts, not only super admin access.

---

## 6. Parallel Access baseline

Parallel Access was the architecture effort that moved the app from council-era authority toward organization/local-unit authority.

Current baseline:

- operational access is local-unit/organization based
- organization admin assignment is the canonical admin path
- retired council admin assignment paths should not be queried
- access helpers should be reused, not bypassed
- direct table access should not recreate old assumptions

The council dependency audit should remain:

```text
BLOCKER: 0
WARN:    0
```

INFO findings are allowed when intentional.

---

## 7. Public vs operations boundary

Public pages and operations pages serve different audiences.

### 7.1 Public pages

Audience:

- visitors
- prospective members
- families
- parish/community members
- search engines
- casual readers

Public pages should be:

- readable
- public-safe
- attractive
- simple
- mostly server-rendered
- stable in URL behavior
- free of internal operational jargon

### 7.2 Operations pages

Audience:

- admins
- officers
- volunteers
- signed-in members
- super admins

Operations pages should be:

- permission-aware
- task-oriented
- explicit
- safe for sensitive data
- clear in error states
- scoped to active local unit/organization

### 7.3 Projection rule

Public pages are projections.

```text
Operations/settings data
        |
        v
Public-safe view model
        |
        v
Public page
```

The public page should not own a second copy of operational truth.

---

## 8. Application layers

### 8.1 Route layer

Next.js App Router routes live in `app/`.

Routes should handle:

- route composition
- server rendering
- calling loaders/actions
- passing view models into components

Routes should not become dumping grounds for every helper, formatter, and mutation.

### 8.2 Component layer

Components should own markup and local presentation concerns.

Route-specific components can live near the route when the feature is not broadly reusable.

Shared components should be promoted only when there is real reuse.

### 8.3 Domain/helper layer

Domain logic belongs in `lib/`.

Important areas:

```text
lib/auth/
lib/organizations/
lib/local-pages/
lib/supabase/
lib/security/
lib/imports/
```

### 8.4 Database layer

Supabase/Postgres is the durable data layer.

Database changes should be made through migrations, mirrored in `supabase/schema.sql`, and reflected in generated TypeScript types.

---

## 9. Folder map

Important files and directories:

```text
README.md
docs/
app/
lib/
scripts/
supabase/
database.types.ts
package.json
```

### 9.1 Public page files

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

### 9.2 Operations files

```text
app/me/
app/me/council/
app/people/
app/people-list.tsx
app/events/
app/custom-lists/
app/imports/supreme/
```

### 9.3 Auth/access files

```text
lib/auth/permissions.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
```

---

## 10. Data ownership rules

Use this ownership hierarchy.

```text
Personal data             -> person/user
Operational local data    -> local_unit_id
Account boundary data     -> organization_id
Public presentation data  -> projection of operations/settings
Historical council data   -> council compatibility where required
```

### 10.1 Avoid duplication

Do not create a second public-page copy of data that belongs in organization/local-unit settings.

### 10.2 Avoid authority shortcuts

Do not use a public route slug, public council number, or public council identity as proof of operational access.

### 10.3 Validate client IDs

Every mutation that accepts an ID from the client must verify that the ID belongs to the active organization/local unit and that the user has authority to mutate it.

---

## 11. Import architecture

Supreme import is a manual spreadsheet upload and review workflow.

It is not:

- an admin invitation system
- a permission grant system
- a public registration system
- a shortcut around people review

Current expectations:

- import resolves through local-unit scope
- imported person/member data is reviewed before durable mutation
- import source attribution is correct
- import does not grant admin access
- spreadsheet parsing avoids vulnerable dependencies

Current spreadsheet libraries:

```text
read-excel-file
write-excel-file
```

Do not reintroduce `xlsx` without a deliberate security review.

---

## 12. Events architecture

Events are operational records that may have public projections.

An event may include:

- internal planning state
- RSVP settings
- volunteer needs
- public visibility
- message/routing behavior
- participant records

Public event display must not leak internal planning data.

Operations owns the event. Public pages display selected event details.

---

## 13. People architecture

The product is broader than a strict member list.

People may come from:

- member imports
- manual creation
- admin invitations
- public contact forms
- event participation
- volunteer interest
- profile/account linkage

Rules:

- do not assume every person is a formal member
- do not assume every member has a user account
- do not expose private person details publicly
- do not let public form submissions bypass review
- prefer durable identity relationships over duplicate people rows

Terminology is moving from "members" toward "people" in operational areas, while formal membership remains a real concept where appropriate.

---

## 14. Public page architecture

Public pages are local organization presentation surfaces.

Primary route:

```text
/o/[slug]
```

Public pages can show:

- organization name
- public identity
- public events
- contact information
- gallery
- public leadership/officers
- story/description
- external links
- get-involved/contact form

Public pages must not show:

- private member data
- admin notes
- unresolved import state
- raw access grants
- private contact details
- hidden operational relationships

---

## 15. Settings architecture

Local organization settings should own local organization profile data.

Examples:

- public name
- display profile
- public contact email
- meeting location
- external links
- gallery images
- public page enablement
- contact form settings
- officer/leadership presentation settings

Public pages consume this data.

---

## 16. Compatibility policy

Compatibility should be intentional, small, and temporary unless it represents durable product identity.

### Keep compatibility when

- public links depend on it
- council identity is part of the product
- historical migrations require it
- import history requires it
- removing it would break known users without a migration plan

### Remove compatibility when

- the local-unit-native seam exists
- a bridge is no longer read
- a table or trigger was only transitional
- the audit shows it is dead architecture
- it encourages future development in the wrong model

### Never do this

Do not create a new compatibility bridge just because it is faster than finding the right seam.

---

## 17. Security posture

Important current expectations:

- npm audit should report zero vulnerabilities before deploy
- `xlsx` should not be present
- server actions must verify access
- public pages must load only public-safe data
- imports must not become permission grants
- service-role operations should be narrow and justified
- super admin flows should not hide normal permission bugs

Dependency/security refresh completed before deployment validation:

- Next upgraded to `16.2.10`
- PostCSS forced to safe version through package override
- `xlsx` removed
- `read-excel-file` added
- `write-excel-file` added

---

## 18. Verification baseline

Before deployment after architecture-sensitive changes:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

Expected posture:

```text
Council audit BLOCKER: 0
Council audit WARN: 0
npm audit: 0 vulnerabilities
```

If the council audit shows a blocker or warning, classify it before bypassing it.

---

## 19. Deployment smoke test

After production deployment, verify:

### Auth

- login
- logout
- session persistence
- `/me`

### Operations

- `/people`
- people search/filter/sort
- people export
- `/imports/supreme`
- CSV/XLSX import review
- `/events`
- `/custom-lists`
- `/me/council`
- admin invitations

### Public

- `/o/[slug]`
- public events
- gallery states
- contact/get-involved form
- public identity labels
- mobile layout

### Access

- local admin user
- non-admin user
- super admin only where needed
- unauthorized mutations rejected server-side

---

## 20. Known architectural tensions

### 20.1 Route names lag behind architecture

`/me/council` is still council-flavored, but its direction is local organization settings.

Do not infer the full architecture from the route name.

### 20.2 Public council identity remains useful

A public council page can remain council-shaped while operations are organization/local-unit based.

### 20.3 Compatibility is seductive

Old bridge fields can seem convenient during bug fixes.

Pause before using them. Ask whether the local-unit-native seam exists.

### 20.4 Super admin can hide real bugs

Always test important flows with realistic local admin access.

### 20.5 Docs can fossilize old mental models

Living docs should be updated after architectural changes. Dated handoffs should move to archive once superseded.

---

## 21. Current GitHub priorities

Recently completed or substantially addressed:

- #6 Supreme import and official-member workflow before final council-id RLS cut
- #10 legacy council-id cleanup planning
- #15 organization-first data model migration
- PR sequence around #257 through #263 covering import cleanup, permissions cleanup, retired bridge cleanup, stale audit pruning, and homepage fallback cleanup

Still important:

- #103 local-unit readiness audit before deleting compatibility fallbacks
- #78 council officers public page and profile management
- #79 public page polish
- #80 core refactoring roadmap
- #81 public officers MVP with reusable portrait positioning

GitHub issues are the current todo list.

---

## 22. Contributor rules

1. Start from a GitHub issue.
2. Identify ownership first.
3. Identify permission rules before UI work.
4. Use existing helpers before creating new ones.
5. Keep public pages as projections.
6. Keep operations server-side authorized.
7. Classify council references before editing.
8. Avoid new compatibility bridges.
9. Commit one seam at a time.
10. Update docs/issues when a seam changes architectural behavior.

---

## 23. Read next

- `docs/OPERATIONS_ARCHITECTURE.md`
- `docs/PUBLIC_PAGES.md`
- `docs/DEVELOPMENT.md`
- `docs/SUPABASE_WORKFLOW.md`
- `docs/handoff/HANDOFF_2026-07-04_Parallel_Access_Cutover.md`
