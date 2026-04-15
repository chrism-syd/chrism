# Architecture State — Apr 14

## Core product truth
The app manages **people**, not just members.

A person may be:
- member
- volunteer
- prospect
- or another local human record later

Membership is one state of a person, not the umbrella noun.

## Current architecture layers

### 1. Local org-private people layer
Primary local people concepts:
- `people`
- `local_unit_people`

Meaning:
- `people` rows are local/org-private people records
- `local_unit_people` explicitly scopes a person into a local unit

This is the new people-first local directory spine.

### 2. Access layer
Current access is still largely powered by:
- `user_unit_relationships`
- `area_access_grants`
- `resource_access_grants`
- `v_effective_area_access`

Important note:
- grant tables still attach through `member_record_id`
- this is transitional plumbing, not the long-term product truth

### 3. Transitional local-member plumbing
Still in use:
- `member_records`
- `legacy_people_id`
- `legacy_council_id`

These remain important in current access and migration flows, but they should not define the conceptual product model.

### 4. Hidden cross-org identity layer
Now added:
- `person_identities`
- `person_identity_links`

Meaning:
- one hidden identity can link many org-private `people` rows
- this allows “same real human across multiple local org records” without breaking org privacy

### 5. User principal layer
Current user principal:
- `users`

Important note:
- `users.person_id` is a weak legacy anchor
- it should not be treated as the final human identity truth

## Future truth vs transitional plumbing vs legacy residue

### Future truth
- `local_unit_id` for operational ownership/scope
- `people` as product noun
- `local_unit_people` for local people scoping
- `person_identities` and `person_identity_links` for hidden cross-org identity

### Transitional plumbing
- `member_records`
- `user_unit_relationships`
- `area_access_grants`
- `resource_access_grants`
- `users.person_id`

### Legacy residue
- council-first assumptions
- helpers/policies/views that still treat `council_id` as primary truth
- naming and routes that still say “members” where the scope is actually people

## Important repairs already made
- Event flows were moved to local-unit-first behavior.
- Custom-list directory candidate logic became people-first.
- Active member-record -> archived-people contradictions were repaired.
- Sydney’s two local people rows were linked under one hidden identity.

## Current unresolved seams
- Some app behavior still reasons from exact `person_id` instead of hidden identity.
- Some custom-list action plumbing may still be person-row-only.
- Some UI still uses members-language where people-language is correct.
- Some Supabase functions/policies may still carry council-era truth.