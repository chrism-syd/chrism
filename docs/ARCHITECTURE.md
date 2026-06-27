# Chrism architecture overview

This document is the current high-level map of the Chrism application. Older dated handoff documents may still be useful for history, but this file should be treated as the current architecture reference.

## Product model

Chrism is a Next.js application for local organization administration and public presence.

The product has three major surfaces:

1. **Public organization pages**
   - Public-facing pages under `/o/[slug]`.
   - Used by councils, ministries, parishes, charities, and other local organizations.
   - Currently strongest for Knights of Columbus councils, but designed to become organization-type-aware.

2. **Member / personal area**
   - Personal profile and participation flows under `/me`.
   - Claimed RSVP history, organization/account state, and profile management.

3. **Operations / admin area**
   - Directory, events, custom lists, organization settings, admin invitations, and related staff workflows.
   - Some routes still carry legacy council assumptions while the data model moves toward local-unit-aware organization context.

## Current architectural direction

The app is moving away from one-off council-specific assumptions toward a more general model:

- Organization-aware access control.
- Local-unit-aware public pages and settings.
- Legacy `council_id` compatibility only where the schema still requires it.
- Route-scoped CSS and reusable components instead of large route files.
- GitHub issues as the canonical todo list.

## Public page architecture

The public local organization page under `app/o/[slug]` has been refactored into a component-based structure.

Key files:

- `app/o/[slug]/page.tsx`
- `app/o/[slug]/layout.tsx`
- `app/o/[slug]/public-page.css`
- `app/o/[slug]/public-gallery.css`
- `app/o/[slug]/public-contact-expander.css`
- `app/o/[slug]/public-header.tsx`
- `app/o/[slug]/public-hero.tsx`
- `app/o/[slug]/public-events.tsx`
- `app/o/[slug]/public-story.tsx`
- `app/o/[slug]/public-contact.tsx`
- `app/o/[slug]/public-contact-form-expander.tsx`
- `app/o/[slug]/public-footer.tsx`

Current pattern:

- `page.tsx` loads data, builds view models, and composes section components.
- Section components own their markup.
- Route-scoped CSS owns public page presentation.
- Public contact reveal is React-driven, not DOM-patched after render.
- Public gallery empty states and contact icons are rendered directly by components.

This is the preferred model for upcoming public-page work, including the Officers seam.

## Styling conventions

Prefer:

- Route-scoped CSS for route-specific presentation.
- Shared components for stable repeated UI patterns.
- CSS variables and theme tokens as the design-token layer.
- Small, named classes over inline style objects.

Avoid:

- DOM enhancement scripts that rewrite server-rendered markup after load.
- Route-specific selectors in global CSS unless truly global.
- Large monolithic route files that mix data loading, business logic, and full page markup.

A larger CSS architecture audit is tracked in GitHub issue #80.

## Data and access model

Important concepts:

- Organizations are the long-term product boundary.
- Local units represent concrete local organization instances.
- Councils remain important, especially for Knights of Columbus workflows, but should not become the only model.
- Legacy `council_id` bridges still exist and must be handled carefully.
- Public slugs are currently derived for some council pages, with a follow-up issue tracking persistent public slugs.

When touching permissions, organization context, or member/admin access, inspect the existing helpers before widening behavior.

Key areas to understand:

- `lib/auth/permissions.ts`
- `lib/auth/acting-context.ts`
- `lib/auth/parallel-access-summary.ts`
- `lib/organizations/`
- `app/app-header.tsx`
- `app/me/`
- `app/o/[slug]/`

## Current roadmap

GitHub issues are the canonical todo list.

Important current issues:

- #78 Add Council Officers public page and profile management
- #79 Public page refactoring follow-up polish
- #80 Core application refactoring and optimization roadmap
- #81 Public Officers feature (MVP) with reusable portrait positioning

Do not rely on old handoff files as the todo list. If something matters, create or update a GitHub issue.
