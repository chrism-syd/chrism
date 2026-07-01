# Chrism

Chrism is a Next.js + Supabase application for local organization administration, public presence, and member belonging.

It currently supports operations workflows for councils and local organizations, while moving toward a broader organization-first model that can support councils, parishes, ministries, conferences, school groups, nonprofit boards, and volunteer teams.

## Start here

Before making major changes, read the living documentation:

- `docs/CHRISM_PRINCIPLES.md` — durable product and engineering principles
- `docs/ARCHITECTURE.md` — current high-level application architecture
- `docs/OPERATIONS_ARCHITECTURE.md` — authenticated local-org operations architecture
- `docs/PUBLIC_PAGES.md` — public organization page architecture and conventions
- `docs/DEVELOPMENT.md` — working process, commit rhythm, and seam lifecycle
- `docs/SUPABASE_WORKFLOW.md` — migrations, schema mirrors, repairs, and generated types

GitHub issues are the canonical todo list. Historical handoff documents are reference material only.

## Product surfaces

### Public organization pages

Public local organization pages live under:

```text
/o/[slug]
```

They are visitor-facing projections of operational data such as organization profile, public events, contact details, gallery images, external links, and visible leadership.

### Member and personal workflows

Member-facing and personal workflows live primarily under:

```text
/me
```

This area handles profile, organization/account status, claimed RSVP history, and personal participation flows.

### Operations workflows

Authenticated operations workflows include:

```text
/people
/events
/custom-lists
/me/council
```

These areas handle people/member management, event planning, RSVP and volunteer coordination, custom lists, organization settings, admin invitations, and future organization profile/officer management. Legacy `/members` routes remain as compatibility routes during migration.

## Current architectural direction

Chrism is moving from older council-shaped assumptions toward an organization-first and local-unit-aware architecture.

Important ideas:

- durable identity is person-first
- users represent authentication/application identity
- organizations are the long-term product boundary
- councils remain an important Knights-specific subtype
- legacy `council_id` compatibility bridges still exist and should be handled carefully
- public pages should present operational truth, not become separate data silos

Do not retire legacy database structures simply because better structures exist. Follow the migration principles in the docs and track future cleanup in GitHub issues.

## Tech stack

- Next.js app router
- React
- Supabase
- TypeScript
- Route-aware server actions and access checks

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
```

## Recommended code areas

Start with these areas depending on the work:

```text
app/app-header.tsx
app/me/
app/me/council/
app/members/
app/events/
app/custom-lists/
app/o/[slug]/
lib/auth/
lib/organizations/
lib/local-pages/
lib/supabase/
```

## Development process

Work one seam at a time.

A good seam starts from a GitHub issue, identifies data ownership and access rules, builds a narrow vertical slice, commits in small reversible steps, refactors while context is fresh, updates docs/issues, then closes the issue.

See `docs/DEVELOPMENT.md` for the full workflow.

## Supabase

Database changes should stay aligned with Git history.

When changing schema, commit migrations, generated types, related application code, and any intentional schema mirror updates together where practical.

See `docs/SUPABASE_WORKFLOW.md` before migration repair, rebaseline, or dashboard-derived schema work.

## Deployment

This is a Next.js app. Standard deployment guidance applies for Vercel or another Next.js host.

Ensure required environment variables and Supabase credentials are configured for the target environment before deployment.
