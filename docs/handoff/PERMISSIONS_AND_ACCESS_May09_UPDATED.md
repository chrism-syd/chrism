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
- historical Grand Knight does not grant officer-derived admin
- lasting honorifics appear on `/members`, `/members/[id]`, and `/members/[id]/officers`

If officer-derived admin appears wrong, inspect:

```text
person_officer_terms
service_start_year
service_end_year
manual_end_effective_date
lib/members/officer-roles.ts
```

## RSVP / volunteer permission-adjacent behavior

RSVP and volunteer semantics were corrected in this phase.

Rule:

```text
All volunteers can count toward attendance/RSVPs.
Not all RSVPs are volunteers.
```

Current behavior:

- `event_person_rsvp_attendees.is_volunteer` records volunteer intent.
- RSVP-only attendees do not show in volunteer roster.
- Volunteer roster and event volunteer count use `is_volunteer`.
- Admins can remove RSVP responses separately from volunteers.

This is not purely visual. Future permissions/data changes must preserve the distinction.

## Switchers and contexts

### User-menu switcher

The user-menu org/context switcher is visible for normal multi-context users, not only dev-mode users. It does not grant access; it exposes contexts built by the permission system.

### Section-level switchers

Section pages should use canonical area access rather than custom local queries where possible.

Known behavior:

- `/custom-lists` uses canonical area access for manageable local units.
- `/members` dedupes switcher options by `local_unit_id`.
- `/me` organization cards use `permissions.availableContexts`.
- `/account/context` and `/account/parallel-area-context` are POST-only route handlers; direct browser GET returns 405 and is expected.

## Preferred names

Preferred-name save behavior supports admin-only profiles:

```text
If active local member record exists:
  save to member_records.preferred_display_name

If no active local member record exists:
  save to people.nickname
```

This prevents ghost success where Supabase updates zero `member_records` rows and the UI claims the name saved.

## Security hardening of access views

Retired wrapper/audit views:

```text
v_auth_effective_area_access
v_auth_effective_resource_access
v_auth_effective_admin_package_access
v_parallel_admin_package_audit
v_parallel_event_assignment_audit
v_parallel_custom_list_access_audit
```

Operational views remain hardened with `security_invoker=true`:

```text
v_effective_area_access
v_effective_resource_access
v_effective_admin_package_access
v_effective_event_management_access
event_person_rsvp_summary
event_council_rsvp_rollups
event_host_summary
```

Direct browser-role grants were revoked where appropriate; server-side/service-role access remains.

## Data API grants habit

Supabase is changing default Data API exposure behavior for new public tables. Chrism already has at least one intentionally locked table (`legacy_fossil_resolutions`) with no `anon`/`authenticated` grants.

Future migration rule:

```text
Internal/server-only table: no browser grants; document intentional lockout.
App/client table: explicit grants to authenticated plus RLS policies.
Public table: anon grants only if intentionally public.
Service-role Data API use: explicit service_role grants where needed.
```

GitHub issue:

```text
#7 Migration habit: make Data API grants explicit for new public tables
```

## RLS INFO notices

Supabase still reports INFO-level `RLS Enabled No Policy` notices. This is not urgent.

Interpretation:

```text
RLS enabled + no policies = anon/authenticated browser roles are locked out.
```

Do not add broad policies just to silence INFO notices.

## Dirty-data warning

Permission bugs can be mimicked by stale test rows in transitional tables.

Before assuming live logic failure, inspect:

```text
member_records
user_unit_relationships
person_officer_terms
organization_admin_assignments
person_identity_links
custom_list_access
resource_access_grants
```

## Known permission/access work still to inspect

- Compatibility helper audit:
  ```text
  app.current_council_id
  app.create_prospect
  app.create_volunteer_only
  ```
- Import/restore/reactivation flows need UX/model cleanup despite the RLS cut.
- DB/server guardrails should continue preventing future single-concrete-row multi-org leakage.
- Some route targets and helper seams may still assume raw `person_id` is always a member-detail route.
- `council_admin_assignments` remains compatibility residue and should not be expanded.
- `lib/auth/permissions.ts` still deserves deeper refactor.
- Area/resource grants still depend too much on `member_record_id`.

## Practical rules for future helpers

When changing access behavior:

- prefer local-unit-first scope
- preserve people-first semantics
- use hidden identity only for matching/auth as needed
- collapse local experiences back to one authoritative local-unit people source
- do not let `council_id`, `legacy_people_id`, or `member_records` reassert conceptual authority accidentally
- do not exclude a real local member from member UI merely because they also has admin access
- do not provision `member_records` / `user_unit_relationships` for external admin invite acceptance
- use canonical area/resource access helpers wherever possible
- verify with SQL when data shape matters
- avoid broad grants/policies to silence advisor output
- smoke test after any DB access change

## MVP verification status at this handoff

```text
production live at chrism.app
manual admin invite works
multi-org admin access works
section-level org switching works
/members scoped correctly
/custom-lists scoped correctly
/me/council scoped correctly
/me shows accessible org logos and filters revoked zero-access contexts
preferred name works for admin-only profiles
custom-list sharing/interactions work
events smoke passed
RSVP vs volunteer behavior smoke passed
officer currentness and Past Grand Knight smoke passed
/imports/supreme loads after RLS cut
create prospect passed earlier
archive/restore passed earlier
current_council_id RLS policy count = 0
Supabase warnings only: leaked password protection disabled, parked due Free plan/magic-link-first auth
