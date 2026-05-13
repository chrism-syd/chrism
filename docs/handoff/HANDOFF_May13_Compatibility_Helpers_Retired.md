# HANDOFF - May 13 Compatibility Helpers Retired

## Status

The compatibility helper audit is complete.

Production remains live at:

```text
https://chrism.app
```

Supabase project ref:

```text
wvaaijbvukzyfaglifoc
```

Latest commit for this checkpoint:

```text
a5f0ed2 Retire current council compatibility helpers
```

Follow-up test/access verification checkpoint commits:

```text
50f27b6 Wire officer role checks into verify
36eed24 Wire RSVP volunteer checks into verify
ec23c69 Narrow RSVP submission id before attendee rows
acbc57b Wire custom list state checks into verify
8872602 Wire org admin access checks into verify
cea1e0e Add DB access matrix SQL verifier
```

## What changed

The old council-context compatibility helpers were retired:

```text
app.current_council_id()
app.create_prospect(...)
app.create_volunteer_only(...)
```

The local-unit-first service-role helpers remain:

```text
app.create_prospect_for_local_unit(...)
app.create_volunteer_only_for_local_unit(...)
```

These remaining helpers are intentionally restricted:

```text
anon          execute = false
authenticated execute = false
service_role  execute = true
```

## Verification performed

### RLS policy check

```sql
select
  count(*) as remaining_current_council_policy_count
from pg_policies
where coalesce(qual, '') ilike '%current_council_id%'
   or coalesce(with_check, '') ilike '%current_council_id%';
```

Result:

```text
remaining_current_council_policy_count = 0
```

### Function dependency check

Function dependency search for `current_council_id` returned no rows after the migration.

### Remaining helper grant check

Only the local-unit-first helpers remain in the audited helper set, and they are service-role-only.

## Migration

```text
supabase/migrations/20260513220000_retire_current_council_compatibility_helpers.sql
```

This migration was applied manually first, then migration history was repaired with:

```bash
npx supabase migration repair --linked --status applied 20260513220000
```

Then schema/reference files were refreshed.

## Verification loop passed

```bash
npm run verify
npm run build
```

Both passed before push.

## Regression verification checkpoint

The default verification loop now includes lightweight regression checks for the recently hardened model/access seams.

Current `npm run verify` covers:

```text
lint
typecheck
officer role regression checks
RSVP volunteer regression checks
custom-list member state checks
org-admin area access checks
```

Regression scripts added:

```text
scripts/verify-officer-roles.mjs
scripts/verify-rsvp-volunteer-semantics.mjs
scripts/verify-custom-list-member-state.mjs
scripts/verify-org-admin-area-access.mjs
```

Pure helper seams added/extracted:

```text
lib/rsvp/person-rsvp-attendees.ts
lib/custom-lists/member-state.ts
lib/auth/org-admin-area-access.ts
```

### Officer currentness / Past Grand Knight

Covered behavior:

```text
June 30 remains in the previous KofC fraternal year.
July 1 starts the next KofC fraternal year.
2024-2025 Grand Knight is current during fraternal start year 2024.
2024-2025 Grand Knight is not current once fraternal start year 2025 begins.
Past Grand Knight receives lasting honorific and PGK suffix.
Current officer summaries exclude historical Grand Knight terms.
Grand Knight office code can be automatic-admin eligible, but currentness must still be checked separately.
```

### RSVP vs volunteer

Covered behavior:

```text
RSVP-only unchecked creates attendee rows but does not create volunteers.
Primary volunteer checked counts as one volunteer.
Additional attendees preserve their own is_volunteer flag.
Volunteer roster inclusion is based on attendee is_volunteer state.
Host-manual submissions still count as explicit volunteer submissions.
```

### Custom-list contact / claim / revoke state

Covered behavior:

```text
Logging contact updates last_contact_at and last_contact_by_person_id only.
Logging contact does not claim, clear, or steal a claim.
Claiming updates claimed_by_person_id and claimed_at only.
Claiming does not log contact.
Releasing a claim clears claimed_by_person_id and claimed_at only.
Releasing a claim preserves contact history.
Revoking a share releases claims only when the revoked person owns the claim.
```

Important caveat:

```text
lib/custom-lists/member-state.ts captures the pure state contract.
The large app/custom-lists/actions.ts file has not yet been fully refactored to call every helper because that file is broad and should be patched surgically.
```

### Org-admin area access contract

Covered behavior:

```text
Active org admins get manage access for:
- members
- events
- custom_lists
- admins
- local_unit_settings

claims remains intentionally excluded.
All emitted rows preserve local_unit_id/local_unit_name context.
No unsupported area/access enum values are introduced.
```

## Live DB access matrix verification

A read-only SQL verifier was added:

```text
scripts/verify-db-access-matrix.sql
```

It is intentionally not part of `npm run verify` because it depends on live Supabase data and should be run in Supabase SQL Editor after access/DB changes.

Live result from the May 13 verification run:

```text
sample_count = 5
missing_effective_area_row_count = 0
unexpected_claim_row_count = 0
failing_has_area_access_count = 0
failing_list_accessible_units_count = 0
```

The two failure-detail SQL queries returned no rows.

This verifies the sampled live path:

```text
organization_admin_assignments
-> local_units via legacy_organization_id
-> v_effective_area_access
-> has_area_access(...)
-> list_accessible_local_units_for_area(...)
```

## Model rules reaffirmed

```text
local_unit_id = operational ownership / scope truth
council_id    = legacy / public / routing / compatibility truth only
people        = product noun
```

Do not reintroduce `app.current_council_id()` or council-scoped wrappers as backwards-compatible zombie shims. If a future feature needs creation scope, use explicit `local_unit_id` and canonical access helpers.

External admin contacts should continue to receive:

```text
people + organization_admin_assignments
```

They should not receive:

```text
member_records or user_unit_relationships
```

unless they are also real local members through a separate member path.

## Current highest-priority remaining work

1. Rotate the Supabase DB password because it appeared in terminal/chat output during troubleshooting.
2. Continue `/imports/supreme` UX/model cleanup under issue #6.
3. Continue Data API grant habit from issue #7.
4. Rebaseline Supabase migrations when ready so replay/shadow DB stays less brittle.
5. Continue threading pure helper seams into broad action files where safe, especially custom-list contact/claim/revoke helpers.

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

The May 13 council-id RLS sweep is complete.
The compatibility helper audit is complete.
No RLS policies reference app.current_council_id().
app.current_council_id, app.create_prospect, and app.create_volunteer_only are retired.
The local-unit-first nonmember helpers remain service-role-only.

Regression checks now cover:
- officer currentness / Past Grand Knight
- RSVP vs volunteer separation
- custom-list contact / claim / revoke state semantics
- org-admin area access contract

Live DB access matrix verifier exists at:
- scripts/verify-db-access-matrix.sql

Latest live DB access matrix result:
- sample_count = 5
- all failure counts = 0
- detail queries returned no rows

Next recommended engineering task: rotate the Supabase DB password, then continue /imports/supreme UX/model cleanup or Data API grant habit work.
Work in owl mode: slow, dependency-aware, audit-first, small patches, verify after each seam.
```
