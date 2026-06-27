# Chrism operations architecture

This document describes the authenticated operations side of Chrism: the local-organization-specific member, people, event, list, settings, and admin workflows.

It is intentionally separate from the public page architecture. Public pages are visitor-facing presentation surfaces. Operations pages are permission-aware working surfaces for administrators, leaders, and signed-in participants.

## Purpose

The operations side of Chrism helps local organizations manage people, events, communication, volunteer coordination, and administrative continuity.

Current strongest use case:

- Knights of Columbus council operations

Long-term direction:

- councils
- parishes
- ministries
- school groups
- nonprofit boards
- volunteer organizations

## Major operations surfaces

### `/me`

Personal and organization-aware member area.

Responsibilities include:

- personal profile
- organization and account status
- claimed RSVP history
- profile update workflows
- entry points into organization settings when the user has admin access

This area is user-centered. It answers: what can this signed-in person do and see?

### `/me/council`

Current organization management surface for council and local organization settings.

Responsibilities include:

- organization profile fields
- public page settings
- contact details
- message routing
- gallery management
- admin invitations
- future officers/profile management

This area is evolving toward a broader Council Profile or Local Organization Profile surface. Information that describes the organization itself should generally live here, not inside a narrow public page settings silo.

### `/members`

Directory and people-management surface.

Current terminology still says members in places, but the product model is broadening toward People because the system may include:

- members
- prospects
- volunteers
- public form submitters
- matched people records
- local contacts

When adding new work here, avoid assuming every person record is a formal member unless the schema or product flow explicitly requires it.

### `/events`

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

### `/custom-lists`

Outreach, follow-up, and planning lists.

Responsibilities include:

- custom groupings of people
- shared list access
- follow-up workflows
- planning and continuity

Custom lists should respect organization context and role-aware access.

## Public pages vs operations pages

Public pages are designed for visitors. They should be polished, readable without context, mostly server-rendered, theme-aware, and safe to expose publicly.

Operations pages are designed for signed-in users doing work. They must be permission-aware, local-org-scoped, safe for sensitive operational data, and optimized for task completion.

Operations pages may expose review queues, admin controls, internal state, and warnings that would not belong on a public page.

## Local organization scope

The long-term product boundary is the local organization.

Important concepts:

- Organization: broader parent/account boundary.
- Local unit: concrete local operating unit.
- Council: current Knights-specific local organization model and legacy compatibility anchor.

Many current workflows still bridge through `council_id`. That is acceptable where required, but new work should avoid deepening council-only assumptions unless the feature is intentionally Knights-specific.

When building operations features, ask:

1. Is this data owned by the local organization?
2. Is this visible to all admins, only certain roles, or only the signed-in person?
3. Does this need to work for future non-council organization types?
4. Is the public page merely showing a projection of this operational data?

## Access and permissions

Operations pages should never rely on UI hiding alone.

Use server-side checks and existing access helpers.

Important areas:

- `lib/auth/permissions.ts`
- `lib/auth/acting-context.ts`
- `lib/auth/parallel-access-summary.ts`
- `app/app-header.tsx`

Preferred pattern:

1. resolve the signed-in user
2. resolve available organization/local-unit/council context
3. determine role and access on the server
4. render only the appropriate operational surface
5. keep mutations protected in server actions

## Data loading pattern

Operations pages often need richer data than public pages.

Common pattern:

1. resolve authenticated user
2. resolve acting organization/local-unit/council context
3. verify permissions
4. load task-specific data
5. render task UI
6. use server actions for mutations

Avoid duplicating organization-loading and access-checking logic in every route. If a pattern appears more than twice, consider a helper.

## Mutation pattern

Server actions should be explicit and defensive.

Prefer:

- validate required fields
- confirm user access server-side
- scope writes to the current local organization
- redirect with stable status query params when useful
- use clear user-facing messages
- avoid silent failures

Avoid:

- trusting client-provided organization IDs without verification
- updating records outside the active context
- mixing public visitor workflows with authenticated admin workflows

## Settings philosophy

The settings area should increasingly become the source of truth for local organization profile data.

Examples of organization-owned data:

- name and display profile
- address and meeting location
- public contact email
- message routing
- gallery images
- officers and officer portraits
- external links
- public page enablement and visibility controls

Public pages should consume this data. They should not become a separate website-builder state silo.

## Events philosophy

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

## People philosophy

The product is moving from a strict member directory mindset toward a broader people model.

This matters because public intake, volunteer interest, membership interest, admin invitations, and event participation can all create or match people-like records.

When extending directory features, avoid hard-coding assumptions that every person is a formal member.

## UI and styling conventions

Operations pages do not need to share the same presentation style as public pages.

They should prioritize:

- clarity
- readable admin workflows
- strong empty states
- predictable forms
- clear status messages
- permission-aware navigation

Public-page polish should not be forced onto operational tools where it makes work slower.

## Technical debt to watch

- Legacy council-only assumptions.
- Repeated Supabase query logic.
- Some route files may still mix data loading, mutations, and UI too heavily.
- Terminology is still evolving from Members toward People in some areas.
- Settings are evolving from public-page settings toward full local organization profile management.

These are tracked at a high level in GitHub issue #80.

## Recommended approach for new operations seams

1. Start from the active GitHub issue.
2. Identify local organization scope first.
3. Confirm access and mutation rules before UI work.
4. Build a narrow vertical slice.
5. Commit in small, reversible steps.
6. Refactor the seam before moving on.
7. Update docs or issues at the end.
