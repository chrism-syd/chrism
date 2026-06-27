# Public pages architecture

This document describes the current architecture and conventions for Chrism public local organization pages.

It focuses on the `/o/[slug]` public surface.

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

Organization settings, events, gallery images, officers, contact details, and external links should be managed in authenticated operations/settings surfaces.

The public page should present that data cleanly.

Users should not need to maintain public information in multiple places.

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

1. load public page data
2. build view models
3. compose section components

Section components should own their markup.

Route-scoped CSS should own presentation.

Avoid returning to a large route file that mixes all data loading, business logic, markup, and styling.

## Current section components

### `PublicHeader`

Public navigation/header for the local organization page.

Should remain simple and public-safe.

### `PublicHero`

Primary identity and introduction area.

Uses organization display name, theme, and hero copy.

### `PublicEvents`

Shows public-facing upcoming events/meetings.

This should remain a projection of event data, not the operational event-management surface.

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

Avoid:

- inline style sprawl
- public-page selectors in global CSS
- DOM post-processing for visual behavior
- adding one-off styles that should become component classes

## Theme approach

Public pages should be theme-aware and organization-type-aware.

Theme helpers currently live under:

```text
lib/local-pages/themes
```

Public page code should use theme variables rather than hard-coding brand colors directly into components.

Organization-specific tone is good. Organization-specific hard-coding is not.

## Data and view models

Public pages should load only public-safe data.

View-model builders should convert raw database rows into simple render-ready shapes for components.

This keeps components easier to understand and reduces accidental exposure of operational details.

When adding new sections, prefer:

```text
load data -> build view model -> render component
```

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

## Officers seam

The Officers feature should build on the public page architecture rather than bypassing it.

Guiding ideas:

- officers are operational/profile data first
- public officer display is a projection
- portraits should use reusable positioning metadata
- placeholder states should keep layout stable
- the design should be future-friendly for other organization types

Relevant issue:

```text
#81 Public Officers feature (MVP) with reusable portrait positioning
```

## Portrait positioning

For officer and future people portraits, prefer lightweight display positioning over destructive cropping.

Store metadata such as:

```text
photo_storage_path
photo_zoom
photo_position_x
photo_position_y
```

Render with a fixed frame, object fit, object position, and optional transform/scale behavior.

Do not build a full image editor for the MVP.

## Public vs operations boundary

Public pages should not become admin tools.

A public page may show:

- public events
- public contact details
- public gallery images
- officers selected for public display
- external links
- simple contact/get-involved form

A public page should not show:

- admin review queues
- internal event planning state
- private member data
- unresolved import conflicts
- internal-only notes
- private contact details

If a visitor action creates operational work, route that work into authenticated operations surfaces.

## Copy and audience

Many visitors and admins are older adults or volunteers.

Public pages should be clear, calm, and welcoming.

Avoid jargon. Avoid clever labels that hide meaning. Buttons should make the next action obvious.

## Future organization types

Public pages should support councils well without making every future organization sound like a council.

When wording is truly council-specific, keep it scoped to council/KofC contexts.

When a phrase can be broader, prefer local organization language.

Future organization types may include:

- parishes
- ministries
- conferences
- CWL groups
- SSVP conferences
- nonprofit boards
- school groups

## What to avoid

Avoid turning the public page into:

- a generic website builder
- a separate data silo
- a marketing page disconnected from operations
- a place where internal state leaks publicly
- a pile of route-only hacks

The best public page work makes the organization look current because the operations data is current.

## Related docs

Read these before major public-page work:

- `docs/CHRISM_PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS_ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`

## Related issues

Current and recent public-page work is tracked in GitHub issues, including:

- #78 Add Council Officers public page and profile management
- #79 Public page refactoring follow-up polish
- #81 Public Officers feature (MVP) with reusable portrait positioning

GitHub issues are the public-page todo list. This document explains the conventions.
