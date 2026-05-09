# Permissions and Access - May 9 MVP Live + Security Hardened

## Current direction

Access remains local-unit-first.

```text
local_unit_id = operational scope and ownership truth
council_id    = public-facing / compatibility / routing where needed
people        = product noun
```

This update extends the Apr 27 permissions note. The Apr 27 note remains directionally correct, especially around local-unit-first scope, people-first semantics, and the warning not to create member-backed rows for external admin contacts.

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

The conceptual model is people-first and local-unit-first, but some access plumbing still depends on:

```text
member_record_id
legacy_people_id
council_id compatibility paths
```

This means access behavior can be correct while the model remains semantically transitional underneath.

## Identity-aware permission direction

`lib/auth/permissions.ts` remains core infrastructure.

Direction:

- expand across identity-linked `personIds`
- resolve access sources
- collapse back to the active/selected local unit
- expose `availableContexts` for switchers and `/me` org display
- filter zero-capability contexts so revoked/stale access does not appear as a real org

Do not make feature-specific pages invent their own permission oracle unless there is no shared helper.

## Area access

Area-level capabilities are granted through effective area access.

Relevant area codes:

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

## Organization admins feed v_effective_area_access

Apr 27 fixed the critical gap where active org admins with `organization_admin_assignments` but no `user_unit_relationships` could not appear in canonical area-access helpers.

Migration:

```text
supabase/migrations/20260427223000_include_org_admins_in_effective_area_access.sql
```

The view includes active `organization_admin_assignments` through:

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

`claims` was intentionally not included in that MVP migration unless future policy changes.

## Zero-capability contexts are filtered

Post-Apr 27, Nathan had revoked St. Martin admin access. The app blocked St. Martin pages correctly, but `/me` still showed the St. Martin logo because a zero-capability access context leaked into display state.

Fix:

```text
supabase/migrations/20260507143000_filter_empty_admin_package_access.sql
f753feb Filter empty effective access contexts
```

Current behavior:

- revoked admin assignments do not appear as visible `/me` org cards
- zero-capability contexts are filtered out
- Nathan's `/me` shows only St. Patrick's after St. Martin revoke
- St. Martin pages remain inaccessible

## Resource access and custom lists

Resource access is used for per-resource sharing, especially custom lists.

Previous transitional reality:

```text
custom_list_access exists for compatibility/direct share rows
resource_access_grants exists for canonical resource access
v_effective_resource_access resolves effective access
```

May 2026 update:

- custom-list ownership is now local-unit-only
- `custom_lists.council_id` is forced null / no longer scope truth
- custom-list reads on member detail use `local_unit_id` only
- local-unit ownership moat is enforced in DB

Key migration:

```text
supabase/migrations/20260505234500_custom_lists_local_unit_moat.sql
```

Relevant commits:

```text
e180116 Cut custom list council scope bridge
b3a2c7d Scope member custom lists by local unit only
1bdffa1 Enforce local-unit ownership for custom lists
```

Custom-list share/revoke behavior is still a known area for future identity-aware cleanup. Be careful with multi-org users and grouped identity payloads.

## External admin contact rule

External admin contacts are valid people/admin identities, but they are not local member-backed participants by default.

Expected state:

```text
people: yes
organization_admin_assignments: yes
member_records: no
user_unit_relationships: no
```

UI consequences:

```text
should not appear in /members
/members/[id] redirects to /me/council/admins/[id]
/members/[id]/edit redirects to /me/council/admins/[id]
```

Manual admin invite acceptance should not provision member-backed local access rows unless the person is also a real local member through a separate path.

## Real local member + admin coexistence rule

A real local member may also hold:

```text
manual admin access
officer-derived admin access
```

This must not remove them from:

```text
local member directory
officer assignment lookup
normal member detail/edit surfaces
```

A person being an admin does not by itself mean they should disappear from member-driven UI.

## Officer-derived access currentness rule

Officer-derived admin is distinct from manual assignment. It is derived from current/open qualifying officer terms.

Important roles include Grand Knight, Financial Secretary, and any other role the app treats as automatic-admin.

If officer-derived admin appears wrong, inspect:

```text
person_officer_terms
service_start_year
service_end_year
manual_end_effective_date
helper semantics in lib/members/officer-roles.ts
```

Do not blindly assume older currentness semantics. Inspect the current helper and actual row values.

## Switchers and contexts

### User-menu switcher

The user-menu org/context switcher is visible for normal multi-context users, not only dev mode users.

This does not grant access. It only exposes contexts already built by the permission system.

### Section-level switchers

Section pages should use canonical area access rather than custom local queries where possible.

Known fixed behavior:

- `/custom-lists` uses canonical area access for manageable local units.
- `/members` dedupes switcher options by `local_unit_id`.
- `/me` organization cards use `permissions.availableContexts`.

## Preferred names

Preferred-name save behavior supports admin-only profiles:

```text
If active local member record exists:
  save to member_records.preferred_display_name

If no active local member record exists:
  save to people.nickname
```

This prevents ghost success where Supabase updates zero `member_records` rows and the UI claims the name saved.

## Custom-list claims vs contact logging

Contact logging and claiming are independent.

Current behavior:

```text
Logging contact updates last_contact_at and last_contact_by_person_id.
Logging contact does not set claimed_by_person_id.
Logging contact does not set claimed_at.
Logging contact does not steal another user's claim.
Logging contact does not create a claim hold.
```

## Security hardening of access views

The following public views were retired because they were wrappers/audit scaffolding rather than necessary browser-facing APIs:

```text
v_auth_effective_area_access
v_auth_effective_resource_access
v_auth_effective_admin_package_access
v_parallel_admin_package_audit
v_parallel_event_assignment_audit
v_parallel_custom_list_access_audit
```

The following operational views remain and are hardened with `security_invoker=true`:

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

Migration:

```text
supabase/migrations/20260507233000_secure_public_views.sql
```

## Security hardening of RPC/function access

Public execution was revoked from flagged SECURITY DEFINER internals:

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
supabase/migrations/20260507234500_revoke_public_security_definer_rpc.sql
```

Function search paths were pinned:

```text
supabase/migrations/20260508000000_set_function_search_paths.sql
```

## RLS INFO notices

Supabase still reports many INFO-level `RLS Enabled No Policy` notices. This is not urgent.

Interpretation:

```text
RLS enabled + no policies = anon/authenticated browser roles are locked out.
```

Do not add broad policies just to silence INFO notices.

Only add policies when a table intentionally needs direct browser/client access.

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

## Known permission/access issues still to inspect

- Remaining council-era helpers and RLS policies need audit over time.
- Audit/drop remaining app compatibility helpers:
  ```text
  app.create_prospect
  app.create_volunteer_only
  app.current_council_id
  ```
- Import/restore/reactivation flows need review against external-admin vs local-member rules.
- DB/server guardrails should continue preventing future single-concrete-row multi-org leakage.
- Some route targets and helper seams may still assume raw `person_id` is always a member-detail route.
- `council_admin_assignments` is still compatibility residue and should not be expanded.
- `lib/auth/permissions.ts` still deserves deeper refactor.

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

## MVP verification status at May 9 handoff

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
create prospect passed
archive/restore passed
/security-definer view errors cleared
/public security-definer RPC warnings cleared
/function search path warnings cleared
pg_trgm moved out of public
Supabase warnings only: leaked password protection disabled, parked due Free plan/magic-link-first auth
```
