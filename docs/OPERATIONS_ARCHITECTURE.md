# Chrism operations architecture

This document is the living reference for Chrism's authenticated operations side.

Operations pages are permission-aware working surfaces for administrators, leaders, officers, volunteers, and signed-in participants. Public pages are visitor-facing projections. Operations pages are where durable organizational work happens.

---

## 1. Current baseline

Chrism operations are organization-first and local-unit-aware.

Operational ownership is:

```text
organization_id
local_unit_id
```

These identifiers define the active work context for authenticated surfaces such as people, events, custom lists, imports, settings, admin invitations, and public profile management.

Council identity remains meaningful for Knights of Columbus public identity, council numbers, historical imports, and compatibility. It is not the universal operational authority model.

---

## 2. Purpose

The operations side helps local organizations manage:

- people and member records
- events
- RSVP and volunteer coordination
- custom lists
- public profile/settings
- admin invitations
- Supreme import review
- leadership continuity
- public-page readiness

Current strongest use case:

- Knights of Columbus council operations

Long-term supported shapes:

- councils
- parishes
- ministries
- school groups
- nonprofit boards
- volunteer organizations
- other local units that need administration and public presence

---

## 3. Authority model

Operations authority should resolve through the existing access stack.

Preferred flow:

```text
Supabase auth user
        |
        v
public.users / person identity
        |
        v
active operations scope
        |
        v
local_unit_id + organization_id
        |
        v
effective access grants and capabilities
        |
        v
server-rendered page or protected mutation
```

Do not build new route-specific permission models unless there is a clear product reason and a GitHub issue documents it.

---

## 4. Active operations scope

A signed-in person may have access to more than one local unit.

The active operations scope decides which local unit the user is working in. Operations pages should resolve that scope before loading sensitive data or performing mutations.

Important helpers and files:

```text
lib/auth/permissions.ts
lib/auth/acting-context.ts
lib/auth/parallel-access-summary.ts
app/app-header.tsx
app/me/
```

The app may still expose council-flavored labels in current Knights workflows, but the authority decision should be local-unit/organization based.

---

## 5. Access sources

Access may come from several sources.

### 5.1 Organization administration

Organization admin assignments are canonical for organization-scoped admin authority.

Legacy council admin assignment tables have been retired. Do not recreate or query that bridge for new work.

### 5.2 Local-unit access grants

Local-unit access defines what a person can do in a specific operating unit.

Examples:

- people/member data access
- events access
- custom-list access
- admin management
- settings/profile management
- import review access

### 5.3 Area access grants

Area access grants define permission by work area and access level.

Use existing effective-access helpers instead of hand-checking raw tables wherever possible.

### 5.4 Officer-derived access

Some officer roles can imply management capabilities.

This should remain explicit, audited, and resolved through helper logic. Do not assume every officer can manage every area.

### 5.5 Super admin acting mode

Super admin behavior is a support and maintenance surface, not the normal product model.

Super admin tools should avoid becoming hidden dependencies for ordinary operations. Where super admin needs to act in a local unit, it should still resolve an active local-unit context.

Super admin smoke tests are not enough. Test ordinary local admin access before treating a workflow as production-ready.

---

## 6. Major operations surfaces

### 6.1 `/me`

Personal and organization-aware member area.

Responsibilities include:

- personal profile
- organization and account status
- claimed RSVP history
- profile update workflows
- entry points into organization settings when the user has admin access

This area is user-centered. It answers: what can this signed-in person do and see?

### 6.2 `/me/council`

Current local organization management surface.

The route name remains council-flavored for current product history, but the surface should be treated as local organization settings.

Responsibilities include:

- organization profile fields
- public page settings
- contact details
- message routing
- gallery management
- admin invitations
- local organization visibility
- future officers/profile management

Information that describes the organization itself belongs here, not inside a narrow public-page-only silo.

### 6.3 `/people`

Directory and people-management surface.

Current model is People-first, not strictly Members-only.

The system may contain:

- members
- prospects
- volunteers
- public form submitters
- matched people records
- local contacts
- imported members
- provisional profile records

When adding work here, avoid assuming every person record is a formal member unless the schema or product flow explicitly requires it.

Legacy `/members` routes remain compatibility routes.

### 6.4 `/events`

Event planning and RSVP/volunteer coordination surface.

Responsibilities include:

- event creation
- public meeting visibility
- RSVP tracking
- volunteer roles
- participant lists
- event communication
- operational follow-up

Events are operational first. Public event display is a projection of selected event data.

### 6.5 `/custom-lists`

Outreach, follow-up, and planning lists.

Responsibilities include:

- custom groupings of people
- shared list access
- follow-up workflows
- planning and continuity

Custom lists should respect organization context and role-aware access.

### 6.6 `/imports/supreme`

Manual Supreme spreadsheet import and review surface.

Important distinction:

- Supreme import creates or updates people/member records from a manual spreadsheet workflow.
- Admin invitations grant access to operational surfaces.

Do not confuse these. They are different product actions, different audit stories, and different permission concerns.

Current expectations:

- import applies through local-unit scope
- spreadsheet parsing must avoid vulnerable dependencies
- created people should use the correct source code
- import should not become an implicit admin-access path

---

## 7. Public pages vs operations pages

Public pages are for visitors. They should be polished, readable without context, mostly server-rendered, theme-aware, and safe to expose publicly.

Operations pages are for signed-in users doing work. They must be permission-aware, local-unit-scoped, safe for sensitive operational data, and optimized for task completion.

Operations pages may expose review queues, admin controls, internal state, and warnings that would not belong on a public page.

---

## 8. Data loading pattern

Operations pages often need richer data than public pages.

Common pattern:

```text
resolve authenticated user
        |
        v
resolve acting organization/local-unit context
        |
        v
verify permissions
        |
        v
load task-specific data
        |
        v
render task UI
        |
        v
mutate through server actions
```

Avoid duplicating organization-loading and access-checking logic in every route. If a pattern appears more than twice, consider a helper.

---

## 9. Mutation pattern

Server actions should be explicit and defensive.

Prefer:

- validate required fields
- confirm user access server-side
- scope writes to the current local unit or organization
- verify client-provided IDs belong to the active context
- redirect with stable status query params when useful
- use clear user-facing messages
- avoid silent failures

Avoid:

- trusting client-provided organization IDs without verification
- updating records outside the active context
- mixing public visitor workflows with authenticated admin workflows
- relying on legacy council compatibility to infer operational ownership
- creating broad service-role paths without a narrow product reason

---

## 10. Settings philosophy

The settings area is the source of truth for local organization profile data.

Examples of organization/local-unit-owned data:

- name and display profile
- address and meeting location
- public contact email
- message routing
- gallery images
- officers and officer portraits
- external links
- public page enablement and visibility controls

Public pages consume this data. They should not become a separate website-builder state silo.

---

## 11. Events philosophy

Events are operational first.

Public visibility should be controlled deliberately.

An event may have:

- internal planning state
- volunteer assignments
- RSVP state
- public visibility
- message routing
- captain/contact ownership

Public event display is a projection. Operations pages remain the source of truth.

---

## 12. People philosophy

The product is broader than a strict member directory.

Public intake, volunteer interest, membership interest, admin invitations, event participation, and imports can all create or match people-like records.

Important rules:

- Do not assume every person is a formal member.
- Do not expose private member details publicly.
- Do not connect public registration directly to local-unit membership without explicit review or invite context.
- Prefer durable identity and local-unit relationships over duplicating people rows.

---

## 13. Compatibility philosophy

Council compatibility can exist, but it should be classified.

Keep:

- public council identity
- council numbers
- historical migrations
- archived import context
- deliberate route compatibility

Replace:

- live operational fallbacks that can now resolve through local-unit context
- permission paths that use council-era tables
- duplicate helper logic that bypasses Parallel Access

Delete:

- retired sync triggers
- obsolete audit scripts
- dead bridge tables
- old compatibility checks after their seam is cut

---

## 14. UI and styling conventions

Operations pages should prioritize:

- clarity
- readable admin workflows
- strong empty states
- predictable forms
- clear status messages
- permission-aware navigation
- fast task completion

Public-page polish should not be forced onto operational tools where it makes work slower.

---

## 15. Technical debt to watch

Current watch list:

- terminology still evolving from Members toward People in some areas
- `/me/council` route name remains council-flavored despite broader local organization purpose
- remaining INFO-level council references must stay intentional
- settings are still evolving toward full local organization profile management
- public officers/profile work remains upcoming
- route files may still mix data loading, mutation wiring, and UI too heavily

These are tracked at a high level in GitHub issue #80 and by more specific feature issues.

---

## 16. Recommended approach for new operations seams

1. Start from the active GitHub issue.
2. Identify local-unit and organization ownership first.
3. Confirm access and mutation rules before UI work.
4. Inspect existing helpers before adding new ones.
5. Build a narrow vertical slice.
6. Commit in small, reversible steps.
7. Refactor the seam before moving on.
8. Update docs or issues at the end.

---

## 17. Verification baseline

Before deploying or merging architecture-sensitive operations work:

```bash
npm run lint
npm run typecheck
npm run verify
node scripts/audit-council-id-dependencies.mjs
npm audit
```

The council dependency audit should remain:

```text
BLOCKER: 0
WARN:    0
```

---

## 18. Read next

- `docs/ARCHITECTURE.md`
- `docs/PUBLIC_PAGES.md`
- `docs/DEVELOPMENT.md`
- `docs/SUPABASE_WORKFLOW.md`
- `docs/handoff/HANDOFF_2026-07-04_Parallel_Access_Cutover.md`
