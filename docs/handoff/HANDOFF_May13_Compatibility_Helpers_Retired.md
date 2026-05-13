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
2. Add/expand tests around recently touched access/model seams:
   ```text
   access matrix
   org-admin assignment -> area access
   RSVP vs volunteer
   officer currentness / Past Grand Knight
   custom-list share/revoke/contact/claim behavior
   ```
3. Continue `/imports/supreme` UX/model cleanup under issue #6.
4. Continue Data API grant habit from issue #7.
5. Rebaseline Supabase migrations when ready so replay/shadow DB stays less brittle.

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

Next recommended engineering task: add/expand tests around the recently hardened access/model seams.
Work in owl mode: slow, dependency-aware, audit-first, small patches, verify after each seam.
```
