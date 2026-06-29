# Chrism development workflow

This document describes how to work on Chrism effectively.

It is intentionally process-focused. Architecture belongs in the architecture docs. Future work belongs in GitHub issues.

## Source of truth

GitHub issues are the canonical todo list.

Do not rely on dated handoff documents as the active backlog. If future work matters, it should be captured in an issue.

Use docs for durable guidance:

- principles
- architecture
- workflow
- Supabase process
- feature-area conventions

Use issues for work to be done.

## Preferred working style

Chrism is best developed one seam at a time.

A seam is a bounded slice of product and architecture that can be understood, implemented, cleaned up, and closed.

Examples:

- public contact form reveal
- public gallery empty state
- public officers MVP
- organization settings profile fields
- event volunteer response flow
- profile review queue

Avoid sprawling work that touches many unrelated concerns at once.

## The seam lifecycle

Use this lifecycle for meaningful work:

1. Start from a GitHub issue.
2. Read the relevant docs.
3. Identify the data ownership and access rules.
4. Make the smallest useful vertical slice.
5. Commit in small, reversible steps.
6. Refactor while the context is fresh.
7. Run a cleanup pass.
8. Update or create follow-up issues.
9. Update docs if the architecture changed.
10. Close the issue when the seam is complete.

A seam is not done when it merely works. It is done when the code is understandable and future work has a clear place to land.

## Commit philosophy

Prefer small commits with clear intent.

Good commit examples:

- `Extract public hero component`
- `Render public events from component`
- `Add scoped public page stylesheet`
- `Make public contact form reveal React-driven`
- `Add operations architecture overview`

Avoid giant commits that combine unrelated changes.

If a change is risky, make it more incremental.

## Refactor timing

Refactor while the seam is still warm.

If a feature requires temporary awkwardness, clean it up before moving to the next feature. Chrism should not accumulate avoidable debt just because the next feature is exciting.

The preferred rhythm is:

```text
build -> verify -> refactor -> verify -> document -> close
```

## UI and UX expectations

Chrism is built for local organization leaders, many of whom are volunteers or older adults.

Interfaces should be:

- guided
- plainspoken
- forgiving
- predictable
- calm
- accessible

Avoid assuming that the user understands technical or administrative jargon.

Use empty states, helper text, status messages, and clear buttons to answer the user's next question.

## Access and safety expectations

Do not rely on hidden buttons as security.

For authenticated operations work:

- resolve the signed-in user
- resolve acting organization/local-unit/council context
- check permissions on the server
- scope queries and mutations deliberately
- keep server actions defensive

For public pages:

- expose only intended public data
- treat public pages as projections of operational truth
- avoid leaking internal operational state

## Data ownership expectations

Before building, ask where the data belongs.

Common rules:

- organization profile data belongs in settings/profile surfaces
- public pages consume organization-owned data
- events own operational event state
- people records represent durable humans
- user records represent authentication/application identity
- councils are a Knights-specific subtype, not the universal model

When data ownership is unclear, stop and clarify it in the issue before creating new structures.

## New-plumbing rule

New work should be wired to the organization/local-unit model by default.

Do not build new features by adding more operational dependence on legacy council-shaped plumbing.

Prefer:

- `organization_id` for organization-owned account/profile data
- `local_unit_id` for local operating-unit ownership and permissions
- `local_unit_people` or member-record helpers for local membership scope
- public pages as projections of organization/local-unit data

Avoid:

- adding new operational ownership through `council_id`
- deriving a `council_id` just to keep an old query shape alive
- using compatibility bridges as the foundation for new features
- expanding legacy helpers when a local-unit-native helper should exist instead

`council_id` may still be valid for Knights-specific public identifiers, imported/historical data, and temporary compatibility during a deliberate migration. It should not be the default ownership key for new builds.

If a feature touches an old compatibility bridge, prefer to cut that seam over to the new model rather than feeding the compatibility monster.

## CSS and component expectations

Prefer:

- route-scoped CSS for route-specific presentation
- reusable components for stable UI patterns
- typed view models for complex page data
- small named classes over inline style sprawl
- React state over DOM patching

Avoid:

- route-specific selectors in global CSS
- hidden post-render DOM mutation
- giant route files that mix data loading, markup, and behavior
- duplicating a component with slight changes instead of extracting the shared pattern

## Supabase expectations

Database and code changes should stay synchronized.

When a feature needs schema changes:

- create a migration
- apply it intentionally
- update generated types when appropriate
- commit migration and related code together when possible
- document any unusual database repair or rebaseline work

See `docs/SUPABASE_WORKFLOW.md` for the detailed Supabase process.

## Documentation expectations

Update docs when a decision becomes durable.

Do not document every small implementation detail. Do document patterns that future work should follow.

Useful docs include:

- `docs/CHRISM_PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS_ARCHITECTURE.md`
- `docs/PUBLIC_PAGES.md`
- `docs/SUPABASE_WORKFLOW.md`

Historical handoffs should not become the active todo list.

## Follow-up issues

If cleanup or future work is important but out of scope, create a GitHub issue.

A good follow-up issue should include:

- context
- why it matters
- proposed scope
- out-of-scope boundaries if useful
- success criteria

Do not leave important future work only in chat history.

## When to pause

Pause and clarify before making a change when:

- the data model could affect future organization types
- a migration could alter live data
- access rules are unclear
- a change could expose private data publicly
- a feature could become a broad product decision rather than an implementation detail

Small implementation choices can move quickly. Product boundaries should be deliberate.

## End-of-seam checklist

Before declaring a seam complete:

- code is committed in logical slices
- obvious dead code is removed
- old DOM or CSS helpers are cleaned up
- accessibility basics are checked
- responsive behavior is considered
- follow-up issues are created or updated
- relevant docs are updated
- completed issue is closed

Leave the next helper a clear trail, not a treasure map with half the clues missing.
