# Permissions and Access — Apr 14

## Current access model
Access is moving toward **local-unit-first** scope.

The intended direction is:
- `local_unit_id` = operational scope and ownership truth
- `council_id` = public-facing / compatibility / routing where needed

## Core access entities
- `user_unit_relationships`
- `area_access_grants`
- `resource_access_grants`
- `v_effective_area_access`

## Current reality
Even though the conceptual model is moving people-first, some access plumbing still depends on:
- `member_record_id`

This means:
- access behavior can still be correct
- while the data model remains semantically transitional underneath

## Area access
Area-level capabilities are granted through the effective-area-access model.

Examples seen in this transition:
- members / people
- events
- custom_lists
- admins
- local_unit_settings
- claims

## Resource access
Per-resource access is used for cases like:
- custom lists

## People-first permission changes already made
- `local_unit_people` now exists as the local people scoping table
- custom-list directory validation/listing uses `local_unit_people + people`
- hidden identity exists through `person_identities + person_identity_links`
- custom-list detail page became identity-aware for linked-account state

## Important transitional constraints
These are still true:
- `area_access_grants` still reference `member_record_id`
- `resource_access_grants` still reference `member_record_id`
- some functions and policies may still assume member-backed access paths

## Known permission/access issues still to inspect
- custom-list scoping bug where a St. Patrick’s list may appear in St. Martin
- share/revoke custom-list actions may still be exact-person-row-based
- remaining council-era helpers and RLS policies need audit over time

## Practical rule for future helpers
When changing feature behavior:
- prefer local-unit-first scope
- prefer people-first product semantics
- keep transitional grant plumbing only where necessary
- do not let `council_id` or `member_records` reassert conceptual authority accidentally