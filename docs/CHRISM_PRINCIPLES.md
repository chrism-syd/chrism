# Chrism principles

This document captures the durable product and engineering principles behind Chrism.

It is not a roadmap. GitHub issues are the roadmap.

It is not a detailed architecture reference. The architecture documents describe how the system works today.

This document explains why Chrism should be built a certain way.

## Why Chrism exists

Chrism exists to help local organizations preserve continuity, reduce administrative burden, and strengthen member belonging.

The product should make local leadership easier, not more technical. It should help volunteers and administrators keep good records, coordinate people, and communicate clearly without needing to become software experts.

The operations side is the practical hook: members, events, RSVPs, volunteers, public pages, officers, settings, and admin continuity.

The deeper long-term value is the member experience: belonging, profile ownership, prayer, reflection, devotional guidance, and spiritual formation.

## Primary audience

Chrism is built for real local organizations: councils, parishes, ministries, conferences, school groups, nonprofit boards, and volunteer teams.

Many users will be older adults. Many will be volunteers. Many will not be highly technical. Some will use the product only a few times per month.

Therefore Chrism should be:

- simple
- guided
- calm
- forgiving
- plainspoken
- predictable
- respectful of the user's time

Do not assume users know where to go, what a term means, or what will happen after pressing a button.

The interface should explain enough to help the user move forward confidently, without burying them in instructions.

## Preserve dignity and continuity

Local organizations depend on people who give their time generously. Officers rotate. Parish staff retire. Volunteers move on. Knowledge can vanish quickly.

Chrism should preserve institutional memory.

A person's record should not disappear because an event changed. An officer history should not be lost because a term ended. A public page should not become stale because only one person knew where the information lived.

The product should protect continuity between leadership changes.

## Operations are the source of truth

Operational data should be managed once, in the appropriate organization settings or workflow.

Public pages, calendars, officer pages, contact details, and future public experiences should be projections of that operational data.

Users should not have to update the same information in multiple places.

The settings and operations surfaces should own the data. Public pages should present it.

## Person first, organization aware

The durable identity in Chrism is the person.

A user account is how someone signs in. A person record represents the human being. Organization memberships describe where that person belongs.

A person may eventually belong to multiple organizations over time.

Do not treat a user's current council or organization as their whole identity.

## Organization first, council as subtype

Chrism began with Knights of Columbus council workflows, and councils remain a real and important use case.

But councils should not be the universal model for the whole product.

The long-term model is organization first:

- councils
- parishes
- ministries
- conferences
- school groups
- nonprofit boards
- volunteer teams

Council-specific fields and workflows should survive where they are honest domain requirements. They should not leak into every future organization type by accident.

## Plain language beats cleverness

Chrism should sound like a helpful human, not a CRM.

Prefer:

- clear labels
- descriptive buttons
- calm confirmations
- specific empty states
- direct next steps

Avoid:

- unexplained technical terms
- cute but unclear copy
- back-office jargon
- clever labels that hide the action

The best interface is the one a tired volunteer can use correctly after a long day.

## Guide, do not assume

Good Chrism workflows should answer:

- What am I looking at?
- What should I do next?
- What happens if I continue?
- Can I undo or correct this?
- Who will see this information?

Use sensible defaults. Reveal advanced choices only when they are needed. Prevent mistakes where possible instead of merely explaining them after the fact.

## Review instead of overwrite

Where data has governance value, prefer review queues over silent destructive edits.

Member-submitted profile changes, imported record conflicts, public contact matching, and future organization updates should be handled in ways that preserve trust and auditability.

A local organization should be able to understand who changed what and why.

## Public presence should feel alive but lightweight

Public local organization pages should help a group look current and credible without turning Chrism into a website builder.

The public page should be easy to maintain because it draws from operational truth:

- organization profile
- events
- meetings
- contact details
- gallery
- officers
- external links

The product should avoid asking local admins to maintain two separate systems.

## AI should reduce burden, not add mystery

AI features should help users complete real work.

They should:

- explain recommendations
- make next steps easier
- preserve user control
- avoid surprising behavior
- use compassionate, plain language

AI should not become a black box that makes local leaders feel less confident.

## Engineering principles

Build seams, not tangles.

Prefer:

- small reversible commits
- route-scoped CSS
- reusable components
- typed view models
- server-side access checks
- clear data ownership
- deliberate compatibility bridges
- GitHub issues for future work

Avoid:

- one-off hacks
- hidden DOM patching
- widening legacy assumptions
- duplicating query and access logic
- embedding future todos only in handoff docs

When a seam is complete, clean it up while the context is fresh.

## Migration principles

Do not delete old structures just because better structures exist.

Chrism is mid-migration from older council-shaped assumptions toward a broader organization-first model.

Retire legacy tables, columns, helpers, and routes only after:

- app code no longer depends on them
- database helpers and RLS no longer depend on them
- equivalent organization-native truth exists
- migrations are tested
- a regression pass confirms core flows still work

Compatibility bridges are not failure. They are scaffolding.

Remove scaffolding only when the building can stand without it.
