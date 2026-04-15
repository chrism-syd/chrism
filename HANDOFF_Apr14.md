# Handoff — Apr 14

## Working style for future helpers
- Prefer production-ready files and file replacements over long manual snippets.
- Prefer changed files only, not full repo bundles, unless explicitly requested.
- Keep changes surgical.
- Help Syd checkpoint work with sensible git commits and pushes.
- Keep a running sense of progress toward the larger transition.
- Preserve unresolved seams and TODOs in writing so nothing falls through the cracks.

## Big-picture mission
The long-term transition is away from `council_id` as the primary ownership and access truth.

That does **not** mean deleting every `council_id` immediately.
It means:
- `local_unit_id` becomes the operational ownership/scope truth
- `council_id` remains public-facing / routing / compatibility where still needed
- people and identity logic move off council-era assumptions
- Supabase schema, helpers, views, and policies that still rely on council-first truth need cleanup over time

## What this helper inherited
The codebase had mixed truths:
- legacy `council_id` assumptions
- newer `local_unit_id` pathways
- “members” language where product truth had already become “people”
- user/profile/admin/shared-list mismatches caused by treating local `person_id` as the real human identity
- custom-list sharing and list candidate logic that still leaked member-record assumptions
- event flows that were not consistently local-unit-first

## What was completed in this chat

### Event seam
- Event actions were moved to local-unit-first ownership checks.
- Event detail page was moved to local-unit-first reads.
- Event edit page was moved to local-unit-first reads.
- `council_id` was preserved as compatibility/public-facing anchor where still appropriate.

### People-first local scope
- Added `local_unit_people`.
- Backfilled `local_unit_people` from active `member_records.local_unit_id + legacy_people_id`.
- Added people-first access helper functions.
- Moved custom-list directory candidate logic in `lib/custom-lists.ts` to use `local_unit_people + people`.

### Hidden identity spine
- Added `person_identities`.
- Added `person_identity_links`.
- Backfilled a first safe identity spine from active users where possible.
- Added helper functions:
  - `app.find_person_identity_id(...)`
  - `app.find_person_identity_id_for_user(...)`
  - `app.list_active_people_for_identity(...)`

### Data repair / contradiction cleanup
- Found and repaired cases where active `member_records` pointed at archived `people`.
- Specifically repaired Sydney’s archived-person contradiction so active local records are no longer backed by archived people rows.

### Sydney identity reconciliation
- Manually linked both Sydney local people rows to one hidden `person_identity`.
- This is the first real repair of the original “same human, multiple local rows” problem.

### Custom list identity awareness
- Custom-list detail page was made identity-aware for linked-account / pending-sign-in state.
- A further patch was prepared to collapse duplicate shared-access display rows by hidden identity.

## What is incomplete but started

### Custom-list share display collapse
- The exact next patch is to collapse `sharedAccess` rows by `person_identity_id` first, then by `person_id` fallback.
- This should stop the Share List card from showing two Sydneys for one real human.
- The patch logic was prepared in chat, but may still need to be applied in-file if not already committed.

### Custom-list share/revoke action plumbing
- Display/status is now partially identity-aware.
- Share/revoke actions may still rely on exact `person_id` / `users.person_id` logic.
- This should be reviewed next.

### Custom-list scoping bug
- There is still a reported bug where a St. Patrick’s list can appear in St. Martin.
- This is separate from identity collapse and still needs investigation.

## Immediate next recommended work
1. Finish / verify custom-list shared-access collapse by hidden identity.
2. Investigate custom-list scoping bug across local units.
3. Review share/revoke custom-list actions for identity-aware behavior.
4. Continue migrating person-aware app behavior from exact `person_id` logic to hidden identity logic.
5. Keep moving Supabase helpers/functions/policies away from council-era truth.

## Important architectural truth
The product/domain truth is **people**, not members.

That means:
- a person may be a member, volunteer, prospect, etc.
- “member” is a subtype/state, not the umbrella noun
- `member_records` is currently transitional plumbing, not the correct product-level concept

## Important caution
Do not dedupe people by name.
Do not collapse same-name rows unless hidden identity or another high-confidence signal proves they are the same human.

## Git / workflow expectation
Future helpers should:
- help Syd checkpoint changes with commit messages
- prefer production-ready changed files
- avoid making Syd hand-merge large snippet lists when a full file replacement is possible