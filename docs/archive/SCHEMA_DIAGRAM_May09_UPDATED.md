# Schema Diagram - May 13 Council RLS Sweep Complete

## Legend

```text
[FUTURE] = future truth / target architecture
[TRANSITIONAL] = still in use, but not conceptual north star
[LEGACY] = compatibility residue
[PRIMARY MODERN ADMIN PATH] = preferred modern admin-assignment model
[CANONICAL ACCESS VIEW] = view/function layer pages should prefer for effective access
[HARDENED] = security_invoker / grants tightened / public execution reduced
[RETIRED] = removed after serving transitional purpose
[IMPORTANT MAY 13 UPDATE] = changed materially during the council RLS sweep
```

## Core people and local-unit model

```text
                           +------------------+
                           |      users       |
                           |------------------|
                           | id               |
                           | person_id        |  [TRANSITIONAL weak anchor]
                           | council_id       |  [LEGACY residue]
                           +---------+--------+
                                     |
                                     | primary_user_id
                                     v
                    +----------------------------------+
                    |        person_identities         |  [FUTURE hidden identity]
                    |----------------------------------|
                    | id                               |
                    | primary_user_id                  |
                    | display_name                     |
                    | normalized_email_hash            |
                    | normalized_phone_hash            |
                    +----------------+-----------------+
                                     |
                                     | person_identity_id
                                     v
                    +----------------------------------+
                    |      person_identity_links       |  [FUTURE hidden identity]
                    |----------------------------------|
                    | person_identity_id               |
                    | person_id                        |
                    | link_source                      |
                    | confidence_code                  |
                    | ended_at                         |
                    +----------------+-----------------+
                                     |
                                     | person_id
                                     v
                           +------------------+
                           |      people      |  [FUTURE product noun,
                           |------------------|   org-private physical row]
                           | id               |
                           | council_id       |  [LEGACY compatibility]
                           | archived_at      |
                           | merged_into...   |
                           +--------+---------+
                                    |
                +-------------------+-------------------+
                |                                       |
                | person_id                             | legacy_people_id
                v                                       v
     +--------------------------+          +--------------------------+
     |    local_unit_people     |          |      member_records      |
     |--------------------------|          |--------------------------|
     | local_unit_id            |          | local_unit_id            |
     | person_id                |          | legacy_people_id         |
     | ended_at                 |          | legacy_council_id        |
     +-------------+------------+          | lifecycle_state          |
                   |                       | archived_at              |
                   |                       +-------------+------------+
                   | local_unit_id                       |
                   v                                     |
             +------------------+                       |
             |   local_units    |  [FUTURE scope]      |
             |------------------|                       |
             | id               |                       |
             | legacy_council_id|  [LEGACY bridge]     |
             | legacy_organization_id                   |
             +--------+---------+                       |
                      |                                 |
                      v                                 v
                +-----------+                 +------------------------+
                | councils  |  [LEGACY/public]| user_unit_relationships|
                +-----------+                 |------------------------|
                                              | user_id                |
                                              | local_unit_id          |
                                              | member_record_id       |
                                              | status                 |
                                              +-----------+------------+
                                                          |
                                                          v
                                         +-------------------------------+
                                         |      area_access_grants       |
                                         |      resource_access_grants   |
                                         |-------------------------------|
                                         | member_record_id              |
                                         | local_unit_id                 |
                                         +-------------------------------+
```

Important May 13 update:

```text
people.council_id and users.council_id still exist.
They are compatibility/legacy/public-routing columns, not operational authority.
No RLS policy now uses app.current_council_id().
```

## Admin / officer access layer overlay

```text
+----------------------------------+
| organization_admin_assignments   |  [PRIMARY MODERN ADMIN PATH]
|----------------------------------|
| organization_id                  |
| person_id                        |
| user_id                          |
| grantee_email                    |
| source_code                      |
| is_active                        |
| revoked_at                       |
+----------------+-----------------+
                 |
                 | organization_id
                 v
+----------------------------------+
| local_units                      |
|----------------------------------|
| legacy_organization_id           |
+----------------------------------+

+----------------------------------+
| council_admin_assignments        |  [LEGACY / COMPAT RESIDUE]
|----------------------------------|
| council_id                       |
| person_id                        |
| user_id                          |
| grantee_email                    |
| is_active                        |
+----------------------------------+

+----------------------------------+
| person_officer_terms             |  [CURRENT OFFICER / AUTO-ADMIN]
|----------------------------------|
| council_id                       |  [LEGACY bridge]
| person_id                        |
| office_scope_code                |
| office_code                      |
| office_rank                      |
| service_start_year               |
| service_end_year                 |
| manual_end_effective_date        |
+----------------------------------+
```

Officer currentness rule fixed in this phase:

```text
service_end_year is exclusive against the current KofC fraternal start year.
A 2024-2025 term is past once the 2025-2026 fraternal year begins.
```

Grand Knight lasting honorific behavior:

```text
Historical Grand Knight -> Past Grand Knight
Displays on /members, /members/[id], and /members/[id]/officers
Does not grant officer-derived admin when historical
```

## Effective area access

`v_effective_area_access` is a canonical access view with two conceptual branches:

```text
Branch A: member-backed grants

area_access_grants
  -> member_records
  -> user_unit_relationships
  -> local_units

Branch B: direct organization admin access

organization_admin_assignments
  -> local_units.legacy_organization_id
```

Branch B emits manage access for active org admins for:

```text
members
events
custom_lists
admins
local_unit_settings
```

`claims` is not included in the current org-admin branch unless future policy changes.

Operational views remain hardened:

```text
v_effective_area_access                  [HARDENED security_invoker=true]
v_effective_resource_access              [HARDENED security_invoker=true]
v_effective_admin_package_access         [HARDENED security_invoker=true]
v_effective_event_management_access      [HARDENED security_invoker=true]
```

## May 13 RLS policy bridge pattern

The council-id RLS sweep cut all policies away from `app.current_council_id()`.

Legacy council-scoped table pattern:

```text
some_table.council_id
  -> local_units.legacy_council_id
  -> v_effective_area_access.local_unit_id
  -> access.user_id = auth.uid()
  -> access.is_effective = true
  -> area/access-level check
```

Person-adjacent table pattern:

```text
some_table.person_id
  -> people.id
  -> people.council_id
  -> local_units.legacy_council_id
  -> v_effective_area_access
```

This bridge applies to the RLS policy layer for:

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

Final check:

```text
remaining_current_council_policy_count = 0
```

## Resource access and custom lists

```text
+------------------+        +----------------------+
|   custom_lists   |        |  custom_list_access  | [TRANSITIONAL/direct share]
|------------------|        |----------------------|
| id               |<------>| custom_list_id       |
| local_unit_id    |        | person_id            |
| council_id       | [now   | user_id              |
|                  | forced | grantee_email        |
|                  | null]  +----------------------+
+--------+---------+
         |
         v
+----------------------+
| custom_list_members  |
|----------------------|
| custom_list_id       |
| person_id            |
| claimed_by_person_id |
| last_contact_at      |
| last_contact_by...   |
+----------------------+

+--------------------------+
| resource_access_grants   | [CANONICAL resource access]
|--------------------------|
| local_unit_id            |
| member_record_id         |
| resource_type            |
| resource_key             |
| access_level             |
| revoked_at               |
+--------------------------+
```

Current state:

- `custom_lists.council_id` is no longer operational scope truth.
- Custom-list ownership is local-unit-only.
- Local-unit moat migration enforces/guards this.
- Legacy/direct custom-list access may still exist as compatibility residue.

Key migration:

```text
20260505234500_custom_lists_local_unit_moat.sql
```

## Events and RSVP/volunteer model

```text
+------------------+
|      events      |
|------------------|
| id               |
| local_unit_id    |  [FUTURE operational scope]
| council_id       |  [public/compat bridge]
| title            |
| status_code      |
+------------------+
```

Events local-unit-first action surface remains important:

```text
getCurrentAppContext returns localUnitId
loadOwnedEvent checks local_unit_id first, then council fallback
create/update/delete/duplicate write or check local_unit_id
token/public RSVP remains event-id scoped
```

RSVP/volunteer correction:

```text
+-----------------------------+
| event_person_rsvps          |
|-----------------------------|
| event_id                    |
| primary_name/email/phone    |
| source_code                 |
| status_code                 |
+--------------+--------------+
               |
               v
+-----------------------------+
| event_person_rsvp_attendees |
|-----------------------------|
| event_person_rsvp_id        |
| attendee_name               |
| is_primary                  |
| is_volunteer                | [IMPORTANT]
| sort_order                  |
+-----------------------------+
```

Rule:

```text
All volunteers can count toward attendance/RSVPs.
Not all RSVPs are volunteers.
```

Current event summary/rollup views remain active and hardened:

```text
event_person_rsvp_summary           [HARDENED security_invoker=true]
event_council_rsvp_rollups          [HARDENED security_invoker=true]
event_host_summary                  [HARDENED security_invoker=true]
```

## Supreme import / official member tables

```text
+--------------------------+
| official_import_batches  |
|--------------------------|
| id                       |
| council_id               | [LEGACY bridge]
| uploaded_by_auth_user_id |
| batch_status_code        |
| row_count                |
+-------------+------------+
              |
              | batch_id
              v
+--------------------------+
| official_import_rows     |
|--------------------------|
| id                       |
| batch_id                 |
| council_id               | [LEGACY bridge]
| matched_person_id        |
| proposed_action_code     |
| review_status_code       |
+--------------------------+

+--------------------------+
| official_member_records  |
|--------------------------|
| id                       |
| council_id               | [LEGACY bridge]
| person_id                |
| member_number            |
| official_status_code     |
| raw_payload              |
+--------------------------+

+--------------------------+
| supreme_update_queue     |
|--------------------------|
| id                       |
| council_id               | [LEGACY bridge]
| person_id                |
| changed_fields           |
| status_code              |
+--------------------------+
```

May 13 state:

- RLS no longer uses `app.current_council_id()`.
- Policies bridge through `local_units.legacy_council_id` and effective members/manage access.
- `anon` grants were revoked from these tables in the final RLS cut.
- Broader `/imports/supreme` UX/model cleanup remains open under GitHub issue #6.

Observed row counts before final cut:

```text
official_import_batches = 0
official_import_rows = 0
official_member_records = 0
supreme_update_queue = 1
```

The one queue row was kept.

## External admin contacts

External admin contacts are intentional admin identities but should not automatically receive member-backed local access rows.

Expected shape:

```text
people: yes
organization_admin_assignments: yes
member_records: no
user_unit_relationships: no
```

They should use `/me/council/admins/[id]`, not member surfaces, unless they are also real local members.

## Real local members who are also admins

A real local member may also hold:

```text
manual admin access
officer-derived automatic admin access
```

That should not remove them from:

```text
local member directory
officer selection
member routes
```

So “has admin assignment” is not the same as “not a local member.”

## Retired data-hygiene / diagnostic scaffolding

Retired after MVP stabilization:

```text
/super-admin/data-hygiene
v_parallel_retirement_readiness_live
v_parallel_legacy_gap_report_live
v_legacy_retirement_status
v_parallel_retirement_readiness
v_parallel_resolved_null_user_fossils
v_parallel_null_user_fossils
v_parallel_null_user_fossils_all
v_parallel_event_assignment_redundancy
v_parallel_legacy_gap_report
```

Also retired:

```text
legacy-write observer triggers
cleanup/redundancy/fossil dashboard RPC helpers
```

Migration:

```text
20260507230000_retire_data_hygiene_scaffolding.sql
```

`legacy_fossil_resolutions` remains as a locked internal audit table.

## Retired auth/audit wrapper views

Retired after confirming no policy/function dependency:

```text
v_auth_effective_area_access
v_auth_effective_resource_access
v_auth_effective_admin_package_access
v_parallel_admin_package_audit
v_parallel_event_assignment_audit
v_parallel_custom_list_access_audit
```

Migration:

```text
20260507233000_secure_public_views.sql
```

## SECURITY DEFINER / function hardening

Direct public RPC execution revoked for flagged internals:

```text
archive_local_unit_member_record(...)
restore_local_unit_member_record(...)
list_super_admin_preview_local_units()
rls_auto_enable()
sync_organization_admin_assignment_from_council_admin_assignmen(...)
sync_user_unit_relationship_status_from_member_record()
trg_sync_org_admin_from_council_admin_assignment()
```

Migration:

```text
20260507234500_revoke_public_security_definer_rpc.sql
```

Function search paths pinned:

```text
20260508000000_set_function_search_paths.sql
```

## Extensions

`pg_trgm` moved out of `public` to `extensions`.

Migration:

```text
20260508001500_move_pg_trgm_extension_schema.sql
```

Expected audit:

```sql
select
  e.extname,
  n.nspname as extension_schema
from pg_extension e
join pg_namespace n
  on n.oid = e.extnamespace
where e.extname = 'pg_trgm';
```

Expected:

```text
pg_trgm | extensions
```

## Data API grants habit

Future public table migrations must explicitly decide grants.

```text
Internal/server-only table: no browser grants; document intentional lockout.
App/client table: explicit authenticated grants plus RLS.
Public table: anon grants only when intentionally public.
Service-role Data API use: explicit service_role grants where needed.
```

GitHub issue:

```text
#7 Migration habit: make Data API grants explicit for new public tables
```

## Current transitional notes

- `people` remains the product/domain concept.
- `member_records` remains important but semantically too narrow for the long-term product model.
- `local_unit_people` is the local people scoping spine.
- `person_identities` + `person_identity_links` is the hidden cross-org identity spine.
- `permissions.ts` sits on top of identity-aware and area-access-aware resolution and should be treated as core infrastructure.
- `council_id` still exists where public-facing or compatibility needs remain, but should continue losing authority as primary truth.
- `organization_admin_assignments` is the preferred modern admin path.
- `council_admin_assignments` is still live compatibility residue.
- UI may dedupe or smooth over compatibility paths, but write/revoke/model normalization is still unfinished.
- RLS enabled/no-policy INFO notices are mostly locked-table notices, not urgent warnings.

## Remaining schema/model work

- Rotate Supabase DB password because it appeared in terminal/chat output.
- Audit/drop/restrict compatibility helpers:
  ```text
  app.current_council_id
  app.create_prospect
  app.create_volunteer_only
  ```
- Rebaseline Supabase migrations.
- Continue council-era fallback cleanup.
- Reduce `member_record_id` dependency for area/resource grants over time.
- Continue local-unit people spine adoption.
- Continue hidden identity spine cleanup.
- Keep external admin contacts out of member-backed rows unless they are real local members.
- Continue `/imports/supreme` UX/model cleanup separately from the RLS cut.
