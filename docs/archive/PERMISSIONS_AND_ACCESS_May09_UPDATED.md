# Permissions and Access - May 13 Council RLS Sweep Complete

## Current direction

Access remains local-unit-first.

```text
local_unit_id = operational scope and ownership truth
council_id    = public-facing / compatibility / routing where needed
people        = product noun
```

This document supersedes the May 9 permissions note while preserving its core rules. The main May 13 update: no RLS policies now reference `app.current_council_id()`.

Final verification:

```sql
select
  count(*) as remaining_current_council_policy_count
from pg_policies
where coalesce(qual, '') ilike '%current_council_id%'
   or coalesce(with_check, '') ilike '%current_council_id%';
```

Expected/current result:

```text
0
```

## Core access entities

```text
user_unit_relationships
area_access_grants
resource_access_grants
v_effective_area_access
v_effective_resource_access
v_effective_admin_package_access
v_effective_event_management_access
organization_admin_assignments
permissions.ts
access contexts
operations scope selection
```

## Current reality

The conceptual model is people-first and local-unit-first, but some access plumbing still depends on transitional columns or compatibility paths:

```text
member_record_id
legacy_people_id
council_id compatibility paths
```

That is acceptable only as compatibility plumbing. It must not become conceptual authority again.

## May 13 RLS policy state

All RLS policies have been cut off `app.current_council_id()`.

Completed RLS cut domains:

```text
events
organizations / councils / brand_profiles
person_officer_terms
person_designations
person_distinctions
person_contact_change_log
audit_log
person_merges
users
user_access_scopes
user_admin_grants
official_import_batches
official_import_rows
official_member_records
supreme_update_queue
```

Standard bridge pattern now used where a table still has only legacy `council_id`:

```text
legacy council_id
-> local_units.legacy_council_id
-> v_effective_area_access
-> auth.uid() + area/access-level check
```

Person-adjacent bridge pattern:

```text
person_id
-> people.council_id
-> local_units.legacy_council_id
-> v_effective_area_access
```

Important: this does not mean all `council_id` columns are gone. It means RLS policy authority no longer depends on `app.current_council_id()`.

## Area access

Area-level capabilities are granted through effective area access.

Area codes:

```text
members
events
custom_lists
claims
admins
local_unit_settings
```

Access levels:

```text
read_only
edit_manage
manage
interact
```

Do not invent unsupported enum values such as `view` or `edit` in SQL. That caused one failed migration attempt during this phase.

## Organization admins feed v_effective_area_access

Active org admins with `organization_admin_assignments` feed effective area access through:

```text
organization_admin_assignments.organization_id
-> local_units.legacy_organization_id
```

Active org admins receive `manage` access for:

```text
members
events
custom_lists
admins
local_unit_settings
```

`claims` remains intentionally excluded unless future policy changes.

External admin contact rule:

```text
people: yes
organization_admin_assignments: yes
member_records: no
user_unit_relationships: no
```

Do not provision `member_records` or `user_unit_relationships` for external admin invite acceptance unless the person is also a real local member through a separate path.

## External admin invite onboarding and welcome scope

June 15 update: external admin invite acceptance now needs to land the new admin in the correct local-unit context before `/welcome/admin` renders.

Standing rule:

```text
accepted external admin invite
-> resolve invite council/org to matching local_units.id
-> set selected operations local-unit scope
-> redirect to /welcome/admin
-> /welcome/admin renders council/org name and logo from active local unit
```

The welcome page smoke-test override is only a display/testing aid:

```text
/welcome/admin?localUnitId=<local_units.id>
```

Important:

- The query param expects `local_units.id`, not `organizations.id`.
- The query param must not become the real access model.
- The real Grand Knight/admin flow should depend on operations scope set during invite acceptance.
- Loading a local unit for branding/display does not grant member/event/admin access by itself.
- Downstream operational areas must continue using effective permissions and local-unit scope checks.

Current relevant files:

```text
app/admin-invite/actions.ts
app/welcome/admin/page.tsx
app/welcome/welcome-page.tsx
lib/auth/operations-scope-selection.ts
lib/auth/permissions.ts
```

If changing this flow, verify both:

- invite acceptance sets the intended active local-unit scope, and
- `/welcome/admin` displays the intended council/org without widening access.

## Zero-capability contexts

Zero-capability contexts are filtered so revoked/stale admin residue does not appear as a real org on `/me`.

Relevant migration/commit from earlier phase:

```text
supabase/migrations/20260507143000_filter_empty_admin_package_access.sql
f753feb Filter empty effective access contexts
```

Current behavior:

- revoked admin assignments do not appear as visible `/me` org cards
- zero-capability contexts are filtered out
- page access remains blocked for revoked orgs

## Resource access and custom lists

Custom-list ownership is local-unit-only.

Current behavior:

- `custom_lists.council_id` is forced null / no longer scope truth
- custom-list reads on member detail use `local_unit_id` only
- local-unit ownership moat is enforced in DB

Key migration:

```text
supabase/migrations/20260505234500_custom_lists_local_unit_moat.sql
```

Custom-list share/revoke behavior is still a known future identity-aware cleanup area. Be careful with multi-org users and grouped identity payloads.

Contact logging and claiming remain independent:

```text
Logging contact updates last_contact_at and last_contact_by_person_id.
Logging contact does not set claimed_by_person_id.
Logging contact does not set claimed_at.
Logging contact does not steal another user's claim.
Logging contact does not create a claim hold.
```

## Real local member + admin coexistence rule

A real local member may also hold:

```text
manual admin access
officer-derived admin access
```

That must not remove them from:

```text
local member directory
officer assignment lookup
normal member detail/edit surfaces
```

A person being an admin does not by itself mean they should disappear from member-driven UI.

## Officer-derived access currentness rule

Officer-derived admin is distinct from manual assignment. It is derived from current/open qualifying officer terms.

Important currentness rule fixed in this phase:

```text
service_end_year is exclusive with respect to the current fraternal start year.
A 2024-2025 Grand Knight term is active during fraternal start year 2024.
It is past once the 2025-2026 fraternal year begins.
```

Current behavior:

- historical Grand Knight displays as `Past Grand Knight`
- historical Grand Knight does not appear as current Grand Knight
