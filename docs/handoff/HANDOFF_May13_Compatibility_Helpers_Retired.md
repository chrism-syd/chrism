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

Terminology/access hardening follow-up commits:

```text
6c9b2bd Add local unit terminology helper
4d472f3 Add local unit terminology regression checks
f63e92d Wire local unit terminology checks into verify
6f4e567 Use local unit terminology in Supreme import mismatch copy
f1e85f1 Pass local unit kind to Supreme import workbench
40fea2c Add Vercel Analytics
```

Supreme import local-unit cutover follow-up commits:

```text
bc26f4c Cut Supreme import RPC to local unit scope
3347f3a Pass local unit scope to Supreme import RPC
63b1ccc Refresh schema after Supreme import local unit cutover
e1d6ac2 Add Supreme import page local unit readiness verifier
de44c68 Fix Supreme import page readiness verifier CTE scope
c90cb8a Backfill local unit people from council people
a057c30 Avoid duplicate active local unit people on backfill
ecc281d Repair remaining local unit people backfill gap
d4ba5d4 Log remaining Supreme import local unit backfill gap
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
local-unit terminology checks
```

Regression scripts added:

```text
scripts/verify-officer-roles.mjs
scripts/verify-rsvp-volunteer-semantics.mjs
scripts/verify-custom-list-member-state.mjs
scripts/verify-org-admin-area-access.mjs
scripts/verify-local-unit-terminology.mjs
```

Pure helper seams added/extracted:

```text
lib/rsvp/person-rsvp-attendees.ts
lib/custom-lists/member-state.ts
lib/auth/org-admin-area-access.ts
lib/local-units/terminology.ts
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

### Local-unit terminology contract

Covered behavior:

```text
Council remains valid Knights local-org terminology.
Conference remains valid SVDP-style local-org terminology.
Parish, ministry, and generic local organization labels are available.
Unknown local-unit kinds fall back safely to generic local organization terminology.
Supreme import council-mismatch copy now uses the terminology seam instead of fully hardcoded council copy.
```

Important distinction:

```text
The problem is not visible use of “council” for Knights local orgs.
The problem is hardcoded Knights/council terminology being used as generic product language.
Future UI copy should pull local-org nouns from lib/local-units/terminology.ts or a future parent-org terminology source.
```

## Supreme import local-unit checkpoint

The Supreme import apply RPC was cut from council-shaped operational scope to explicit `local_unit_id` scope.

Current RPC signature begins with:

```text
p_local_unit_id uuid, p_organization_id uuid, p_auth_user_id uuid
```

The old `p_council_id` RPC signature is gone. The RPC still writes `people.council_id` from the local unit's legacy council bridge for Knights compatibility/routing only.

Readiness verifiers:

```text
scripts/verify-supreme-import-local-unit-cutover-readiness.sql
scripts/verify-supreme-import-page-local-unit-readiness.sql
```

Current unresolved page-query blocker:

```text
One active/unmerged St. Mary's Council member remains in people.council_id but has no active local_unit_people link:
local_unit_id = 4a59e6d2-8376-4c64-b278-b2fa42ea96db
person_id     = 7171d2f6-8067-40bf-9d09-987d3b80fced
```

Notes:

```text
The two local_unit_people backfill migrations were applied:
- 20260514000000_backfill_local_unit_people_from_council_people.sql
- 20260514001500_repair_remaining_local_unit_people_link.sql

The stubborn person still qualifies through people.council_id -> local_units.legacy_council_id, but no row currently appears in local_unit_people for that exact local_unit_id/person_id pair.
Further investigation showed this is not a simple missing-link issue. The Sydney Fernandez records are cross-wired across local org surfaces and should be treated as a targeted identity/data-boundary cleanup, not an automatic merge/backfill.
```

`missing_from_member_records` still returns rows, including member and volunteer_only records. That is not itself a blocker for the Supreme import page-query cut because the import flow must continue to see nonmember conversion candidates. Do not move the page query to member_records-only.

### Cross-local member privacy boundary

Product truth:

```text
A human can be a member of more than one local org.
Their local-org member records should not be automatically merged just because name/email/person-like identity matches.
One local org's data for a member must not bleed into another local org's record.
Contact/profile details may intentionally differ by local org because the member may have shared different information with each org.
```

Implication:

```text
Do not automatically merge people/member records across local units as a cleanup shortcut.
Before merging or archiving duplicate-looking people rows, verify local_unit_id, member_records, organization_memberships, organization_admin_assignments, and any org-specific profile fields.
Prefer targeted repairs that preserve the privacy wall between local org records.
```

Current Sydney data observation:

```text
6616ec81-6f3a-400b-af3b-b88b734f1bd2 and 7171d2f6-8067-40bf-9d09-987d3b80fced are both Sydney Fernandez rows, but they carry different local-org/admin/member artifacts.
7171d2f6-8067-40bf-9d09-987d3b80fced is not simply a St. Mary's member missing local_unit_people; it has St. Patrick's member/local-unit artifacts while its people.council_id points at St. Mary's.
6616ec81-6f3a-400b-af3b-b88b734f1bd2 carries active admin assignments for St. Mary's and St. Martin de Porres and a St. Patrick's organization_membership.
Do not repair this by blindly adding St. Mary's local_unit_people or by blindly merging the two Sydney people rows.
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

## Security/ops checkpoint

The Supabase DB password was rotated after it appeared in terminal/chat output during troubleshooting.

Verification after rotation:

```text
Supabase CLI db dump works with the new SUPABASE_DB_PASSWORD.
npm run verify passed.
npm run build passed.
Production surfaces loaded.
```

Vercel environment variables were checked and did not contain direct Postgres DB URLs or `SUPABASE_DB_PASSWORD`; no Vercel DB-password update was needed.

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

1. Continue `/imports/supreme` UX/model cleanup under issue #6.
2. Resolve the remaining Supreme import page-query blocker as a targeted identity/data-boundary cleanup, not an automatic cross-local merge.
3. Continue Data API grant habit from issue #7.
4. Scan pages/components for hardcoded Knights-specific terminology that should use the local-org terminology seam. This should preserve “council” for Knights local orgs, but remove assumptions that council is the generic product noun.
5. Rebaseline Supabase migrations when ready so replay/shadow DB stays less brittle.
6. Continue threading pure helper seams into broad action files where safe, especially custom-list contact/claim/revoke helpers.

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
- local-unit terminology

Supreme import RPC cutover is complete:
- apply_supreme_import_row now starts with p_local_unit_id uuid.
- The old p_council_id RPC signature is gone.
- people.council_id remains only as Knights legacy compatibility/routing.

Current Supreme import page-query blocker:
- One active/unmerged St. Mary's Council member remains in people.council_id but has no active local_unit_people link.
- local_unit_id = 4a59e6d2-8376-4c64-b278-b2fa42ea96db
- person_id = 7171d2f6-8067-40bf-9d09-987d3b80fced
- Both 20260514000000 and 20260514001500 backfills were applied.
- Further investigation showed this is a cross-wired Sydney Fernandez identity/data-boundary issue, not a simple missing-link issue.
- Do not repair by blindly adding St. Mary's local_unit_people.
- Do not repair by blindly merging Sydney rows across local units.
- missing_from_member_records rows are not by themselves a blocker because the importer must continue seeing nonmember conversion candidates.

Product privacy rule:
- A human can be a member of more than one local org.
- Contact/profile details may intentionally differ by local org.
- Do not automatically merge people/member records across local units just because they look like the same human.
- Preserve the privacy wall between local org records.

Live DB access matrix verifier exists at:
- scripts/verify-db-access-matrix.sql

Latest live DB access matrix result:
- sample_count = 5
- all failure counts = 0
- detail queries returned no rows

The Supabase DB password has been rotated and verified. Vercel did not need a DB-password env update.

Local-unit terminology rule:
- “Council” is valid Knights local-org terminology.
- “Conference” can be valid SVDP-style local-org terminology.
- The TODO is to scan hardcoded Knights-specific terminology and move it to the local-org noun seam where it is generic product UI.

Next recommended engineering task: inspect and design a targeted cleanup for the Sydney cross-wired local-org records, then continue /imports/supreme page-query cleanup.
Work in owl mode: slow, dependency-aware, audit-first, small patches, verify after each seam.
```
