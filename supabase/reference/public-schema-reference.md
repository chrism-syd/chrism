# Public schema reference

Manual refresh based on applied Knights of Columbus migrations through `20260324_000016`.
This repo snapshot did not include live-generated schema reference files, so this refresh is hand-authored from the implemented migrations and importer behavior.

## Scope

This reference focuses on the public tables and RPC touched by the Supreme import overhaul:

- `public.people`
- `public.organization_memberships`
- `public.person_kofc_profiles`
- `public.organization_kofc_profiles`
- `public.apply_supreme_import_row(...)`

## Current model at a glance

### Shared core person data: `public.people`

Use `people` only for shared person data that is not Knights-specific.

Relevant columns used by the importer:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `council_id` | `uuid` | Owning council |
| `title` | `text` | Core person field |
| `first_name` | `text` | Required by importer |
| `middle_name` | `text` | Optional |
| `last_name` | `text` | Required by importer |
| `suffix` | `text` | Optional |
| `email` | `text` | Encrypted-at-rest by app layer |
| `email_hash` | `text` | Hash for matching/searching |
| `cell_phone` | `text` | Encrypted-at-rest by app layer |
| `cell_phone_hash` | `text` | Hash for matching/searching |
| `home_phone` | `text` | Manual/member flows |
| `other_phone` | `text` | Manual/member flows |
| `address_line_1` | `text` | Encrypted-at-rest by app layer |
| `address_line_1_hash` | `text` | Hash for matching/searching |
| `city` | `text` | Encrypted-at-rest by app layer |
| `city_hash` | `text` | Hash for matching/searching |
| `state_province` | `text` | Encrypted-at-rest by app layer |
| `state_province_hash` | `text` | Hash for matching/searching |
| `postal_code` | `text` | Encrypted-at-rest by app layer |
| `postal_code_hash` | `text` | Hash for matching/searching |
| `birth_date` | `date` | Stored as date, hash-only for privacy |
| `birth_date_hash` | `text` | Hash for matching/searching |
| `pii_key_version` | `text` | App-set version for encrypted fields |
| `council_activity_level_code` | `text` | Importer maps Supreme activity level here |
| `primary_relationship_code` | `text` | Importer sets to `member` |
| `created_source_code` | `text` | Importer uses `supreme_import` |
| `is_provisional_member` | `boolean` | Importer sets `false` |
| `created_by_auth_user_id` | `uuid` | Audit |
| `updated_by_auth_user_id` | `uuid` | Audit |

### Membership-level data: `public.organization_memberships`

Use `organization_memberships` for the council or organization relationship.

Relevant columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `organization_id` | `uuid` | Organization scope |
| `person_id` | `uuid` | Linked person |
| `membership_status_code` | `text` | Importer maps activity level here |
| `membership_number` | `text` | Canonical Supreme member number |
| `is_primary_membership` | `boolean` | Importer uses `true` |
| `source_code` | `text` | Importer uses `supreme_import` |
| `created_by_auth_user_id` | `uuid` | Audit |
| `updated_by_auth_user_id` | `uuid` | Audit |

Current uniqueness guards:

- unique `(organization_id, person_id)`
- unique `(organization_id, membership_number)` where `membership_number is not null`
- partial unique `(organization_id, person_id)` where `is_primary_membership is true`

### Knights-specific person data: `public.person_kofc_profiles`

Use `person_kofc_profiles` for Knights-only attributes tied to a person.

Relevant columns:

| Column | Type | Notes |
| --- | --- | --- |
| `person_id` | `uuid` | Primary/unique link to `people.id` |
| `first_degree_date` | `date` | Knights-specific |
| `second_degree_date` | `date` | Knights-specific |
| `third_degree_date` | `date` | Knights-specific |
| `years_in_service` | `integer` | Knights-specific |
| `member_type` | `text` | Knights-specific |
| `member_class` | `text` | Knights-specific |
| `assembly_number` | `text` | Person-level 4th Degree assembly membership only |

### Knights-specific organization data: `public.organization_kofc_profiles`

Use `organization_kofc_profiles` only for organization-scoped Knights attributes.

Relevant columns:

| Column | Type | Notes |
| --- | --- | --- |
| `organization_id` | `uuid` | Primary/unique link to organization |
| `council_number` | `text` | Council-level identifier |

## Importer behavior

### RPC: `public.apply_supreme_import_row(...)`

The confirmed Supreme import path now writes one row atomically through the RPC function `public.apply_supreme_import_row(...)`.

Behavior:

1. Validates required name fields.
2. Upserts `organization_kofc_profiles.council_number` when supplied.
3. Prefers an existing `organization_memberships.membership_number` match inside the current organization.
4. Updates an existing person when a valid membership-number match exists.
5. Otherwise updates the explicitly matched person for `update_existing`.
6. Otherwise creates a new `people` row for `create_new`.
7. Upserts the membership row.
8. Upserts the person Knights profile when Knights fields are present.
9. Returns JSON with the resolved `person_id` and action (`created` or `updated`).

Atomicity note:
- one row is all-or-nothing
- a bad row should not leave half-written records behind
- a multi-row batch is still row-atomic, not whole-batch atomic

## Contact constraint behavior

`people_contact_required_for_non_import` now allows contact-light rows only when:

- `created_source_code = 'supreme_import'`

Manual and other non-import rows must still have at least one contact method.

## Canonical storage rules

These are the rules the importer and docs now agree on:

- `membership_number` lives on `organization_memberships`
- degree dates, member type, member class, years in service, and `assembly_number` live on `person_kofc_profiles`
- `council_number` lives on `organization_kofc_profiles`
- shared person fields stay on `people`
- `birth_date` remains a shared core field on `people`

## Legacy fields removed from `public.people`

These legacy Knights columns were intentionally removed from `people`:

- `member_number`
- `member_number_hash`
- `supreme_member_type`
- `supreme_member_class`
- `assembly_number`
- `first_degree_date`
- `second_degree_date`
- `third_degree_date`
- `reentry_date`
- `years_of_service`
- `mail_returned_flag`
- `supreme_exempt_flag`

## Legacy fields removed elsewhere

- `organization_memberships.member_number` removed in favor of `membership_number`
- `organization_kofc_profiles.assembly_number` removed because assembly membership is person-specific

## Notes for future work

- If you need a fully exhaustive schema reference for every public table, regenerate from the live Supabase database and use this file as the Knights/importer source of truth for the touched areas.
- This refresh is intended to stop stale references and keep future work aligned with the current importer architecture.
