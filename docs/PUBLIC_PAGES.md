# Public pages architecture

This document describes the current architecture and conventions for Chrism public local organization pages.

It focuses on the `/o/[slug]` public surface and its relationship to authenticated operations.

## Purpose

Public pages give local organizations a simple, credible public presence without requiring them to build or maintain a separate website.

They should help a visitor understand:

- who the organization is
- what the organization does
- how to attend or participate
- how to get in touch
- what events or meetings are coming up
- who serves in visible leadership roles

Public pages should feel alive, but lightweight.

They are not intended to become a generic website builder.

## Core principle

Public pages are projections of operational truth.

Authenticated operations and settings own the durable data. The public page presents a public-safe version of that data.

```text
Operations/settings data
        |
        v
Public-safe view model
        |
        v
Public page
        |
        v
Visitor
```

Users should not need to maintain public information in multiple places.

## Public identity vs operational ownership

This distinction is central to Chrism.

Operational ownership is organization/local-unit based:

```text
organization_id
local_unit_id
```

Public identity may still be council-shaped for council pages:

```text
council number
council slug
public council labels
legacy public council routes
```

Both can be true at once.

A council can have public identity as a council while its authenticated operations are resolved through organization/local-unit context.

Do not remove public council terminology merely because the operations model is organization-first. Remove council assumptions only when they are incorrectly used for operational authority.

## Current route

Primary public local organization route:

```text
app/o/[slug]
```

Important files:

```text
app/o/[slug]/layout.tsx
app/o/[slug]/page.tsx
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

## Page composition pattern

`page.tsx` should primarily do three jobs:

1. load public-safe data
2. build view models
3. compose section components

Section components should own their markup.

Route-scoped CSS should own presentation.

Avoid returning to a large route file that mixes all data loading, business logic, markup, and styling.

Preferred flow:

```text
load public-safe data
        |
        v
build render-ready view models
        |
        v
render section components
        |
        v
apply route-scoped styling
```

## Current section components

### `PublicHeader`

Public navigation/header for the local organization page.

Should remain simple, public-safe, and clear.

### `PublicHero`

Primary identity and introduction area.

Uses organization display name, theme, hero copy, and public-facing identity labels.

For council pages, council identity can appear here when it helps visitors understand the organization.

### `PublicEvents`

Shows public-facing upcoming events/meetings.

This should remain a projection of event data, not the operational event-management surface.

Do not show planning state, internal volunteer notes, draft events, or private RSVP context.

### `PublicStory`

Shows organization narrative and gallery/visual content.

Gallery empty states should be rendered by React components, not injected after render.

### `PublicContact`

Shows contact details, external links, and the public contact/get-involved form when enabled.

The public form should remain simple and non-intimidating.

### `PublicContactFormExpander`

Client component that controls the contact form reveal.

This should remain React-driven, not DOM-patched by a route-level enhancer.

### `PublicFooter`

Closing public page footer.

Should reinforce trust, provide simple navigation, and avoid operational/admin language.

## Styling pattern

Public page styling is route-scoped.

Current route styles:

```text
app/o/[slug]/public-page.css
app/o/[slug]/public-gallery.css
app/o/[slug]/public-contact-expander.css
```

Prefer:

- route-scoped classes
- theme variables
- small named selectors
- component-owned markup
- responsive behavior within the route stylesheet
- accessible contrast and readable typography

Avoid:

- inline style sprawl
- public-page selectors in global CSS
- DOM post-processing for visual behavior
- adding one-off styles that should become component classes
- importing operations/admin styling into public pages

## Theme approach

Public pages should be theme-aware and organization-type-aware.

Theme helpers currently live under:

```text
lib/local-pages/themes
```

Public page code should use theme variables rather than hard-coding brand colors directly into components.

Organization-specific tone is good. Organization-specific hard-coding is not.

For future organization types, themes should support distinctive identity without turning the code into one-off branches for every organization.

## Data and view models

Public pages should load only public-safe data.

View-model builders should convert raw database rows into simple render-ready shapes for components.

This keeps components easier to understand and reduces accidental exposure of operational details.

When adding new sections, prefer:

```text
load data -> build view model -> render component
```

Public components should not need to know about raw access grants, internal admin state, unresolved import conflicts, or private member relationships.

## Public-safe data boundary

A public page may show:

- public organization name and description
- public council identity where appropriate
- public meeting/event information
- public contact details
- public gallery images
- leadership selected for public display
- external links
- simple contact/get-involved form

A public page should not show:

- private member data
- internal event planning notes
- unpublished events
- admin review queues
- unresolved import conflicts
- private contact details
- hidden local-unit relationships
- raw access grants
- internal-only source codes

If a visitor action creates operational work, route that work into authenticated operations surfaces.

## Contact form philosophy

The public contact form should be welcoming and low-friction.

It should support visitors who may be:

- interested in becoming a member
- interested in volunteering
- trying to contact the organization
- asking a simple question

The form should not feel like a CRM intake form.

Use plain language. Ask only for what is needed.

Submitted messages should connect to operational review/routing flows rather than disappearing into an inbox with no ownership.

## Gallery philosophy

Gallery images make a public page feel alive.

Images should be managed from settings, not from the public page itself.

Public rendering should handle:

- no images
- one image
- multiple images
- broken/missing image paths where practical
- responsive layouts

Empty-state content should be clear and helpful for admins without exposing internal setup language to ordinary visitors where inappropriate.

## Leadership seam

The public leadership/officers feature should build on the public page architecture rather than bypassing it.

Guiding ideas:

- leadership is operational/profile data first
- public leadership display is a projection
- portraits should use reusable positioning metadata
- placeholder states should keep layout stable
- the design should be future-friendly for other organization types
- management access should remain separate from public leadership display

Relevant issue:

```text
#81 Public Officers feature (MVP) with reusable portrait positioning
```

## Portrait positioning

For leadership and future people portraits, prefer lightweight display positioning over destructive cropping.

Store metadata such as:

```text
photo_storage_path
photo_zoom
photo_position_x
photo_position_y
```

Render with a fixed frame, object fit, object position, and optional transform/scale behavior.

Do not build a full image editor for the MVP.

## Public routes and legacy council routes

The preferred current public surface is:

```text
/o/[slug]
```

Some older or council-specific public routes may still exist or be referenced historically.

Classify them before changing them:

- visitor-facing council identity can be product truth
- old route support can be compatibility
- unused route plumbing should be removed only when no longer needed

Treat public links carefully. Public URLs have a different stability requirement than internal helper code.

## SEO and discoverability

Public pages should be readable and indexable where appropriate.

Prefer:

- meaningful page titles
- clear organization names
- public-safe descriptions
- semantic headings
- server-rendered content where practical
- stable public slugs

Avoid:

- hiding all meaningful content behind client-only behavior
- exposing operational/internal labels in metadata
- changing public URLs without redirect planning

## Public vs operations boundary

Public pages should not become admin tools.

A public page may invite action, but it should not perform privileged work.

Examples:

```text
Visitor submits contact form
        |
        v
Operational review/routing flow
        |
        v
Authorized admin follows up
```

The public page starts the conversation. Operations owns the follow-up.

## Copy and audience

Many visitors and admins are older adults or volunteers.

Public pages should be clear, calm, and welcoming.

Avoid jargon. Avoid clever labels that hide meaning. Buttons should make the next action obvious.

Council-specific language is appropriate when the audience is looking for a council. Broader language is better when the page should support many organization types.

## Future organization types

Public pages should support councils well without making every future organization sound like a council.

When wording is truly council-specific, keep it scoped to council contexts.

When a phrase can be broader, prefer local organization language.

Future organization types may include:

- parishes
- ministries
- conferences
- local chapters
- nonprofit boards
- school groups

## What to avoid

Avoid turning the public page into:

- a generic website builder
- a separate data silo
- a marketing page disconnected from operations
- a place where internal state appears publicly
- a collection of route-only hacks
- a workaround for authenticated operations

The best public page work makes the organization look current because the operations data is current.

## Verification checklist for public-page work

After public-page changes, smoke test:

- page loads for a known public slug
- hero content renders correctly
- public events display only public-safe events
- gallery handles empty and populated states
- contact/get-involved form opens and submits as expected
- public contact details do not expose private member data
- responsive layout works on mobile and desktop
- no operations-only labels appear publicly
- no permission-sensitive data is loaded into the public view model

## Related docs

Read these before major public-page work:

- `docs/CHRISM_PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS_ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/handoff/HANDOFF_2026-07-04_Parallel_Access_Cutover.md`

## Related issues

Current and recent public-page work is tracked in GitHub issues, including:

- #78 Add Council Officers public page and profile management
- #79 Public page refactoring follow-up polish
- #81 Public Officers feature (MVP) with reusable portrait positioning

GitHub issues are the public-page todo list. This document explains the conventions.
