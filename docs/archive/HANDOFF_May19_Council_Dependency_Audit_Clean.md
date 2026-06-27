# HANDOFF - May 19 Council Dependency Audit Clean

## Status

The OWL-style council dependency sweep is complete for the current app-code pass.

Latest local verification before this handoff:

```text
npm run verify passed
npm run build passed
git status --short returned no output
```

Latest council dependency audit result:

```text
Files scanned: 379
BLOCKER: 0
WARN:    0
INFO:    1820
```

The audit report was written locally to:

```text
/Users/syd.fernandez/Downloads/chrism-council-id-audit-report.txt
```

## Meaning of the audit result

`BLOCKER: 0` means no live app/RLS references were found to the retired council-context helpers or old council-shaped Supreme import RPC signature.

`WARN: 0` means there are no unclassified live-app `council_id` dependency warnings left in the current audit model.

`INFO` findings remain expected. They include:

- schema/reference generated files
- historical handoff docs and migrations
- intentional audit/verifier guardrails
- compatibility bridge fields
- public Knights council-number routes
- legacy officer/admin bridge tables that still structurally use `council_id`
- compatibility context fields named `councilId`

Do not treat remaining `INFO` entries as work items by default. Inspect the note in the audit report first.

## Model rules reaffirmed

```text
local_unit_id = operational ownership / scope truth
council_id    = legacy / public / routing / compatibility truth only
people        = product noun
```

Use `local_unit_id` for new operational scope. Use `council_id` only where the schema or product concept explicitly requires a Knights compatibility/public routing bridge.

Public Knights local-org routes may still use council-number/council-id semantics where the URL is intentionally local-org terminology specific, for example:

```text
/councils/[councilNumber]/meetings
/councils/[councilNumber]/meetings.ics
```

Future equivalent routes for other parent orgs should use that parent org's local-org noun and identifier model, not blindly reuse Knights council naming.

## Event cleanup completed

The event cluster was cut from `council_id` fallback filters to `local_unit_id` scope.

Main surfaces cleaned and smoke-tested:

```text
/events
/events/archive
/events/archive/[id]
/events/[id]
/events/[id]/edit
/events/[id]/export
/events/[id]/volunteers
```

Smoke-test outcomes:

```text
Event surfaces loaded.
Event detail opened.
Edit opened and saved.
CSV export downloaded.
Archive/delete of disposable event succeeded.
Duplicate archived event as draft succeeded.
Host manual volunteer add/edit/remove succeeded.
```

Event write actions now scope through `local_unit_id`. Remaining `council_id` tokens in event files are compatibility data selects/inserts or context bridge values, not operational fallback filters.

## Member/directory cleanup completed

Safe member-scope cleanup completed:

- Removed the unused council-scoped member directory loader.
- Removed the stale `council_id` rollback filter from member create cleanup.
- Preserved local-unit-aware directory/member flows.

Remaining member officer references are intentionally classified as legacy bridge work because `person_officer_terms` and related officer/admin tables still structurally use `council_id`.

## Audit script updates completed

The audit script now separates real risk from known intentional categories:

- historical/reference material -> `INFO`
- audit/verifier/patch guardrails -> `INFO`
- public Knights council-number routes -> `INFO`
- documented officer/admin legacy bridge files -> `INFO`
- documented remaining compatibility/fallback bridge files -> `INFO`

The audit is still useful: a new direct `council_id` operational filter in an unclassified live file should come back as `WARN`.

## Known legacy bridge buckets, not safe app-only cleanup

Several remaining `INFO` clusters are real technical debt, but not safe to fix by changing app filters alone.

### Officer/admin legacy tables

Tracked in issue #15.

Legacy council-shaped tables:

```text
person_officer_terms
officer_role_emails
council_admin_assignments
```

Affected areas include:

```text
/me/council
/me/council/admins/[id]
/members/[id]
/members/officers
lib/auth/permissions.ts
lib/organizations/admin-managers.ts
```

These need a database/schema cut before app filters can be honestly moved to local-unit scope.

### Super-admin organization claim bridge

`organization_claim_requests` and council-admin compatibility checks still carry `council_id` for legacy claim/council linkage.

Affected areas:

```text
app/super-admin/organization-claims/page.tsx
app/super-admin/organization-claims/actions.ts
```

Treat as documented bridge work unless and until the claim model is migrated to explicit `local_unit_id`/organization structure.

### RSVP/profile fallback bridges

Some RSVP/profile paths still have documented council fallback logic or `hostCouncilId` compatibility, often behind local-unit-aware matching already.

Affected areas include:

```text
lib/rsvp/claim.ts
lib/rsvp/person-rsvp.ts
lib/profile-change-reviews.ts
```

Do not patch blindly. Review whether each path already prefers `local_unit_id` and whether the fallback is still needed for old data/public RSVP compatibility.

## Product TODOs logged during this pass

New issues created:

```text
#12 TODO: Support multi-session events with per-session RSVP and volunteer commitments
#13 TODO: Add duplicate action for existing events
#14 TODO: Add loading and pending-action feedback for slow event/admin actions
#15 TODO: Migrate officer/admin legacy council-shaped tables to local-unit scope
```

Important context:

- Multi-session events should support one parent event with multiple dated sessions, and per-session RSVP/volunteer choices.
- Existing active/scheduled/draft events need a visible “Duplicate as draft” UI action.
- Slow server actions need pending/loading feedback so users know work is happening.
- Officer/admin legacy tables need DB cleanup before their `council_id` filters can be removed honestly.

## Current highest-priority remaining work

1. Product/UX cleanup for `/imports/supreme`, including clearer skipped-row feedback and the Rand/no-member-number issue.
2. Database cleanup planning for legacy council-shaped tables, especially officer/admin tables from issue #15.
3. Investigate remaining St. Martin de Porres legacy-council alignment rows separately.
4. Scan UI for hardcoded Knights-specific terminology and move generic product language to the local-org terminology seam.
5. Add pending/loading feedback for slow event/admin actions from issue #14.
6. Add existing-event “Duplicate as draft” UI from issue #13.
7. Plan multi-session event data model from issue #12.
8. Rebaseline Supabase migrations when ready so replay/shadow DB stays less brittle.

## Suggested next helper opening prompt

```text
We are on chrism-syd/chrism main.
Production is live at https://chrism.app.
Supabase project ref is wvaaijbvukzyfaglifoc.

Read these first:
- docs/handoff/HANDOFF_May09_MVP_Live_Security_Hardened.md
- docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md
- docs/handoff/SCHEMA_DIAGRAM_May09_UPDATED.md
- docs/handoff/HANDOFF_May13_Compatibility_Helpers_Retired.md
- docs/handoff/HANDOFF_May19_Council_Dependency_Audit_Clean.md

Council dependency audit is clean for the current app-code pass:
- BLOCKER: 0
- WARN: 0
- INFO entries remain expected/documented compatibility/reference/legacy bridge cases.

Do not reopen the finished event/member app-code sweep unless a new WARN appears.

Model rules:
- local_unit_id = operational ownership/scope truth
- council_id = legacy/public/routing/compatibility truth only
- people = product noun

Known remaining DB-shaped cleanup:
- officer/admin tables still structurally use council_id: person_officer_terms, officer_role_emails, council_admin_assignments.
- This is tracked under issue #15 and should be handled as database/schema cleanup, not fake app-only filter replacement.

Product privacy rule:
- A human can be a member of more than one local org.
- Contact/profile details may intentionally differ by local org.
- Do not automatically merge people/member records across local units just because they look like the same human.
- Preserve the privacy wall between local org records.

Useful current commands:
npm run verify
npm run build
node scripts/audit-council-id-dependencies.mjs

Work in owl mode: small patches, verify after each seam, no broad rewrites unless explicitly needed.
```
