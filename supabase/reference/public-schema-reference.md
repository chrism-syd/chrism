# Supabase Public Schema Reference

Fetched: 2026-05-08T13:45:58.449Z
Source: Supabase REST OpenAPI
Schema: standard public schema
Tables: 122
RPC Functions: 50

This snapshot is generated from the live Supabase REST OpenAPI document.
It reflects the API-visible `public` schema, including columns, types, defaults, primary keys, and foreign-key annotations when exposed.
It does not capture non-public schemas, RLS policies, triggers, indexes, or database functions.

## _archive_council_admin_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | no |  |  |  |
| council_id | uuid | no |  |  |  |
| user_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| grantee_email | text | no |  |  |  |
| is_active | boolean | no |  |  |  |
| notes | text | no |  |  |  |
| created_by_user_id | uuid | no |  |  |  |
| updated_by_user_id | uuid | no |  |  |  |
| created_at | timestamp with time zone | no |  |  |  |
| updated_at | timestamp with time zone | no |  |  |  |

## _archive_custom_list_access

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | no |  |  |  |
| custom_list_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| user_id | uuid | no |  |  |  |
| grantee_email | text | no |  |  |  |
| granted_at | timestamp with time zone | no |  |  |  |
| granted_by_auth_user_id | uuid | no |  |  |  |
| created_at | timestamp with time zone | no |  |  |  |
| updated_at | timestamp with time zone | no |  |  |  |

## _archive_organization_admin_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | no |  |  |  |
| organization_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| user_id | uuid | no |  |  |  |
| grantee_email | text | no |  |  |  |
| is_active | boolean | no |  |  |  |
| created_at | timestamp with time zone | no |  |  |  |
| updated_at | timestamp with time zone | no |  |  |  |
| created_by_user_id | uuid | no |  |  |  |
| updated_by_user_id | uuid | no |  |  |  |
| source_code | text | no |  |  |  |
| organization_claim_request_id | uuid | no |  |  |  |
| grant_notes | text | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| revoked_by_user_id | uuid | no |  |  |  |
| revoked_notes | text | no |  |  |  |

## access_scope_source_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## access_scope_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| description | text | no |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## area_access_grants

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| member_record_id | uuid | yes |  |  | member_records.id |
| area_code | public.member_area_code | yes |  |  |  |
| access_level | public.area_access_level | yes |  |  |  |
| source_code | public.grant_source_code | yes | manual |  |  |
| granted_at | timestamp with time zone | yes | now() |  |  |
| expires_at | timestamp with time zone | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## audit_log

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | bigint | yes |  | PK |  |
| council_id | uuid | no |  |  | councils.id |
| actor_auth_user_id | uuid | no |  |  |  |
| entity_table | text | yes |  |  |  |
| entity_id | uuid | no |  |  |  |
| action_code | text | yes |  |  |  |
| payload | jsonb | yes |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |

## brand_profiles

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| code | text | yes |  |  |  |
| display_name | text | yes |  |  |  |
| logo_storage_bucket | text | yes | organization-assets |  |  |
| logo_storage_path | text | no |  |  |  |
| logo_alt_text | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## catechism_references

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| slug | text | yes |  |  |  |
| reference_code | text | yes |  |  |  |
| title | text | no |  |  |  |
| summary | text | no |  |  |  |
| body_excerpt | text | no |  |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| source_1 | text | no |  |  |  |
| source_2 | text | no |  |  |  |
| workbook_catechism_id | text | no |  |  |  |

## catechism_topics

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| catechism_reference_id | uuid | yes |  | PK | catechism_references.id |
| topic_id | uuid | yes |  | PK | spiritual_topics.id |
| relevance_score | smallint | no |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## council_activity_context_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## council_activity_level_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## council_admin_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| user_id | uuid | no |  |  | users.id |
| person_id | uuid | no |  |  | people.id |
| grantee_email | text | no |  |  |  |
| is_active | boolean | yes | true |  |  |
| notes | text | no |  |  |  |
| created_by_user_id | uuid | no |  |  | users.id |
| updated_by_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## council_reengagement_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## councils

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_number | text | yes |  |  |  |
| name | text | yes |  |  |  |
| timezone | text | yes | America/Toronto |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| organization_id | uuid | yes |  |  | organizations.id |

## custom_list_access

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| custom_list_id | uuid | yes |  |  | custom_lists.id |
| person_id | uuid | no |  |  | people.id |
| user_id | uuid | no |  |  |  |
| grantee_email | text | no |  |  |  |
| granted_at | timestamp with time zone | yes | now() |  |  |
| granted_by_auth_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## custom_list_members

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| custom_list_id | uuid | yes |  |  | custom_lists.id |
| person_id | uuid | yes |  |  | people.id |
| added_at | timestamp with time zone | yes | now() |  |  |
| added_by_auth_user_id | uuid | no |  |  | users.id |
| claimed_by_person_id | uuid | no |  |  | people.id |
| claimed_at | timestamp with time zone | no |  |  |  |
| last_contact_at | timestamp with time zone | no |  |  |  |
| last_contact_by_person_id | uuid | no |  |  | people.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## custom_lists

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | no |  |  | councils.id |
| name | text | yes |  |  |  |
| description | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  | users.id |
| updated_by_auth_user_id | uuid | no |  |  | users.id |
| archived_at | timestamp with time zone | no |  |  |  |
| archived_by_auth_user_id | uuid | no |  |  | users.id |
| local_unit_id | uuid | yes |  |  | local_units.id |

## daily_reading_entries

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| reading_date | date | yes |  |  |  |
| title | text | yes |  |  |  |
| summary | text | no |  |  |  |
| scripture_passage_id | uuid | no |  |  | scripture_passages.id |
| spiritual_content_item_id | uuid | no |  |  | spiritual_content_items.id |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## designation_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## distinction_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## event_archives

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| original_event_id | uuid | no |  |  |  |
| council_id | uuid | yes |  |  | councils.id |
| title | text | yes |  |  |  |
| description | text | no |  |  |  |
| location_name | text | no |  |  |  |
| location_address | text | no |  |  |  |
| starts_at | timestamp with time zone | no |  |  |  |
| ends_at | timestamp with time zone | no |  |  |  |
| status_code | text | no |  |  |  |
| scope_code | text | no |  |  |  |
| event_kind_code | text | no |  |  |  |
| requires_rsvp | boolean | yes | false |  |  |
| rsvp_deadline_at | timestamp with time zone | no |  |  |  |
| reminder_enabled | boolean | yes | false |  |  |
| reminder_scheduled_for | timestamp with time zone | no |  |  |  |
| reminder_days_before | integer | no |  |  |  |
| deleted_at | timestamp with time zone | yes | now() |  |  |
| deleted_by_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| local_unit_id | uuid | no |  |  | local_units.id |
| needs_volunteers | boolean | yes | false |  |  |
| volunteer_deadline_at | timestamp with time zone | no |  |  |  |

## event_assignment_roles

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| precedence | integer | yes | 100 |  |  |

## event_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| member_record_id | uuid | yes |  |  | member_records.id |
| assignment_scope | public.event_assignment_scope_code | yes |  |  |  |
| event_id | uuid | no |  |  | events.id |
| legacy_event_kind_code | text | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |
| role_code | text | no |  |  | event_assignment_roles.code |

## event_council_rsvp_rollups

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| event_id | uuid | no |  | PK |  |
| host_council_id | uuid | no |  |  | councils.id |
| event_invited_council_id | uuid | no |  | PK |  |
| is_host | boolean | no |  |  |  |
| invited_council_type_code | text | no |  |  | event_invited_council_types.code |
| invited_council_id | uuid | no |  |  | councils.id |
| invited_council_name | text | no |  |  |  |
| invited_council_number | text | no |  |  |  |
| invite_email | text | no |  |  |  |
| event_council_rsvp_id | uuid | no |  | PK |  |
| has_responded | boolean | no |  |  |  |
| first_responded_at | timestamp with time zone | no |  |  |  |
| last_responded_at | timestamp with time zone | no |  |  |  |
| volunteer_count | integer | no |  |  |  |

## event_council_rsvps

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_id | uuid | yes |  |  | events.id |
| event_invited_council_id | uuid | yes |  |  | event_invited_councils.id |
| responding_council_name | text | yes |  |  |  |
| responding_council_number | text | no |  |  |  |
| responding_contact_name | text | no |  |  |  |
| responding_contact_email | text | no |  |  |  |
| responding_contact_phone | text | no |  |  |  |
| response_notes | text | no |  |  |  |
| first_responded_at | timestamp with time zone | yes | now() |  |  |
| last_responded_at | timestamp with time zone | yes | now() |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_external_invitees

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_id | uuid | yes |  |  | events.id |
| invitee_name | text | yes |  |  |  |
| invitee_email | text | no |  |  |  |
| invitee_phone | text | no |  |  |  |
| invitee_role_label | text | no |  |  |  |
| notes | text | no |  |  |  |
| sort_order | integer | yes | 0 |  |  |
| created_by_user_id | uuid | no |  |  | users.id |
| updated_by_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_host_summary

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| event_id | uuid | no |  | PK |  |
| host_council_id | uuid | no |  |  | councils.id |
| invited_council_count | integer | no |  |  |  |
| responded_council_count | integer | no |  |  |  |
| total_volunteer_count | integer | no |  |  |  |

## event_invited_council_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 0 |  |  |

## event_invited_councils

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_id | uuid | yes |  |  | events.id |
| invited_council_type_code | text | yes |  |  | event_invited_council_types.code |
| invited_council_id | uuid | no |  |  | councils.id |
| invited_council_name | text | yes |  |  |  |
| invited_council_number | text | no |  |  |  |
| invite_email | text | no |  |  |  |
| invite_contact_name | text | no |  |  |  |
| is_host | boolean | yes | false |  |  |
| rsvp_link_token | text | yes |  |  |  |
| sort_order | integer | yes | 0 |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_message_jobs

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_id | uuid | yes |  |  | events.id |
| event_invited_council_id | uuid | yes |  |  | event_invited_councils.id |
| message_type_code | text | yes |  |  | event_message_types.code |
| status_code | text | yes | pending |  | event_message_status_types.code |
| recipient_email | text | yes |  |  |  |
| recipient_name | text | no |  |  |  |
| subject | text | yes |  |  |  |
| body_text | text | yes |  |  |  |
| body_html | text | no |  |  |  |
| payload_snapshot | jsonb | yes |  |  |  |
| scheduled_for | timestamp with time zone | yes |  |  |  |
| sent_at | timestamp with time zone | no |  |  |  |
| failed_at | timestamp with time zone | no |  |  |  |
| provider_message_id | text | no |  |  |  |
| error_text | text | no |  |  |  |
| created_by_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_message_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 0 |  |  |

## event_message_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 0 |  |  |

## event_person_rsvp_attendees

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_person_rsvp_id | uuid | yes |  |  | event_person_rsvps.id |
| matched_person_id | uuid | no |  |  | people.id |
| attendee_name | text | yes |  |  |  |
| attendee_email | text | no |  |  |  |
| attendee_phone | text | no |  |  |  |
| uses_primary_contact | boolean | yes | false |  |  |
| is_primary | boolean | yes | false |  |  |
| sort_order | integer | yes | 0 |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_person_rsvp_summary

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| event_id | uuid | no |  | PK |  |
| host_council_id | uuid | no |  |  | councils.id |
| active_submission_count | integer | no |  |  |  |
| total_volunteer_count | integer | no |  |  |  |
| last_responded_at | timestamp with time zone | no |  |  |  |

## event_person_rsvps

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_id | uuid | yes |  |  | events.id |
| matched_person_id | uuid | no |  |  | people.id |
| claimed_by_user_id | uuid | no |  |  | users.id |
| primary_name | text | yes |  |  |  |
| primary_email | text | no |  |  |  |
| primary_phone | text | no |  |  |  |
| response_notes | text | no |  |  |  |
| source_code | text | yes | public_link |  |  |
| status_code | text | yes | active |  |  |
| first_responded_at | timestamp with time zone | yes | now() |  |  |
| last_responded_at | timestamp with time zone | yes | now() |  |  |
| claimed_at | timestamp with time zone | no |  |  |  |
| cancelled_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_rsvp_volunteers

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| event_id | uuid | yes |  |  | events.id |
| event_council_rsvp_id | uuid | yes |  |  | event_council_rsvps.id |
| volunteer_name | text | yes |  |  |  |
| volunteer_email | text | no |  |  |  |
| volunteer_phone | text | no |  |  |  |
| volunteer_notes | text | no |  |  |  |
| sort_order | integer | yes | 0 |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## event_scope_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 0 |  |  |

## event_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 0 |  |  |

## events

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| title | text | yes |  |  |  |
| description | text | no |  |  |  |
| location_name | text | no |  |  |  |
| location_address | text | no |  |  |  |
| starts_at | timestamp with time zone | yes |  |  |  |
| ends_at | timestamp with time zone | no |  |  |  |
| display_timezone | text | yes | America/Toronto |  |  |
| status_code | text | yes | scheduled |  | event_status_types.code |
| scope_code | text | yes | home_council_only |  | event_scope_types.code |
| requires_rsvp | boolean | yes | false |  |  |
| rsvp_deadline_at | timestamp with time zone | no |  |  |  |
| reminder_enabled | boolean | yes | false |  |  |
| reminder_scheduled_for | timestamp with time zone | no |  |  |  |
| created_by_user_id | uuid | yes |  |  | users.id |
| updated_by_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| event_kind_code | text | yes | standard |  |  |
| reminder_days_before | integer | no |  |  |  |
| local_unit_id | uuid | no |  |  | local_units.id |
| needs_volunteers | boolean | yes | false |  |  |
| volunteer_deadline_at | timestamp with time zone | no |  |  |  |

## import_st_patricks_7689_members

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| council_number | text | no |  |  |  |
| member_number | text | no |  |  |  |
| title | text | no |  |  |  |
| first_name | text | no |  |  |  |
| middle_name | text | no |  |  |  |
| last_name | text | no |  |  |  |
| suffix | text | no |  |  |  |
| address_line_1 | text | no |  |  |  |
| city | text | no |  |  |  |
| province_state | text | no |  |  |  |
| postal_code | text | no |  |  |  |
| country_code | text | no |  |  |  |
| birth_date | text | no |  |  |  |
| member_type | text | no |  |  |  |
| member_class | text | no |  |  |  |
| first_degree_date | text | no |  |  |  |
| second_degree_date | text | no |  |  |  |
| third_degree_date | text | no |  |  |  |
| reentry_date | text | no |  |  |  |
| years_service | text | no |  |  |  |
| assembly_number | text | no |  |  |  |
| exempt | text | no |  |  |  |

## intake_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| intake_item_id | uuid | yes |  |  | intake_items.id |
| member_record_id | uuid | yes |  |  | member_records.id |
| assigned_at | timestamp with time zone | yes | now() |  |  |
| assigned_by_auth_user_id | uuid | no |  |  |  |
| resolved_at | timestamp with time zone | no |  |  |  |

## intake_items

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| intake_type_id | uuid | yes |  |  | intake_types.id |
| status_code | public.intake_item_status_code | yes | unread |  |  |
| sender_name | text | yes |  |  |  |
| sender_email | text | yes |  |  |  |
| sender_phone | text | no |  |  |  |
| subject | text | no |  |  |  |
| message | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## intake_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| type_code | text | yes |  |  |  |
| display_label | text | yes |  |  |  |
| is_public | boolean | yes | false |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## legacy_fossil_resolutions

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| source_table | text | yes |  |  |  |
| source_row_id | uuid | yes |  |  |  |
| resolution_code | text | yes | ignored_residue |  |  |
| notes | text | no |  |  |  |
| resolved_at | timestamp with time zone | yes | now() |  |  |
| resolved_by_auth_user_id | uuid | no |  |  |  |

## local_role_definitions

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| role_kind | public.role_kind | yes |  |  |  |
| code | text | no |  |  |  |
| label | text | yes |  |  |  |
| precedence | integer | yes | 100 |  |  |
| is_single_seat | boolean | yes | false |  |  |
| is_active | boolean | yes | true |  |  |
| source_template_id | uuid | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## local_unit_custom_fields

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| code | text | no |  |  |  |
| label | text | yes |  |  |  |
| source_template_code | text | no |  |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## local_unit_parish_affiliations

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| parish_local_unit_id | uuid | yes |  |  | local_units.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |

## local_unit_people

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| person_id | uuid | yes |  |  | people.id |
| source_code | text | yes | member_record_backfill |  |  |
| linked_at | timestamp with time zone | yes | now() |  |  |
| ended_at | timestamp with time zone | no |  |  |  |
| linked_by_auth_user_id | uuid | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## local_units

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| organization_family_id | uuid | yes |  |  | organization_families.id |
| official_name | text | yes |  |  |  |
| display_name | text | yes |  |  |  |
| local_unit_kind | public.local_unit_kind | yes |  |  |  |
| status | public.local_unit_status | yes | active |  |  |
| visibility | text | yes | private |  |  |
| timezone | text | no |  |  |  |
| city | text | no |  |  |  |
| province_state | text | no |  |  |  |
| postal_code | text | no |  |  |  |
| country_code | text | no |  |  |  |
| legacy_council_id | uuid | no |  |  | councils.id |
| legacy_organization_id | uuid | no |  |  | organizations.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## member_records

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| member_number | text | no |  |  |  |
| first_name | text | yes |  |  |  |
| middle_name | text | no |  |  |  |
| last_name | text | yes |  |  |  |
| suffix | text | no |  |  |  |
| preferred_display_name | text | no |  |  |  |
| email | text | no |  |  |  |
| phone | text | no |  |  |  |
| address_line_1 | text | no |  |  |  |
| address_line_2 | text | no |  |  |  |
| city | text | no |  |  |  |
| province_state | text | no |  |  |  |
| postal_code | text | no |  |  |  |
| country_code | text | no |  |  |  |
| lifecycle_state | public.member_record_lifecycle_state | yes | active |  |  |
| archived_at | timestamp with time zone | no |  |  |  |
| legacy_people_id | uuid | no |  |  | people.id |
| legacy_council_id | uuid | no |  |  | councils.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## membership_claim_requests

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| requester_user_id | uuid | no |  |  |  |
| requester_name | text | yes |  |  |  |
| requester_email | text | yes |  |  |  |
| requester_phone | text | no |  |  |  |
| member_number | text | no |  |  |  |
| status_code | public.membership_claim_status_code | yes | pending |  |  |
| reviewer_notes | text | no |  |  |  |
| reviewed_by_auth_user_id | uuid | no |  |  |  |
| reviewed_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## migration_review_queue

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| source_table | text | yes |  |  |  |
| source_row_id | uuid | yes |  |  |  |
| review_type | text | yes |  |  |  |
| notes | text | no |  |  |  |
| payload | jsonb | yes |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| resolved_at | timestamp with time zone | no |  |  |  |
| resolved_by_auth_user_id | uuid | no |  |  |  |

## note_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## officer_role_emails

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| office_scope_code | text | yes |  |  |  |
| office_code | text | yes |  |  |  |
| office_rank | integer | no |  |  |  |
| email | text | yes |  |  |  |
| login_enabled | boolean | yes | true |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## official_import_batch_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## official_import_batches

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| uploaded_by_auth_user_id | uuid | no |  |  |  |
| source_filename | text | no |  |  |  |
| storage_object_path | text | no |  |  |  |
| file_sha256 | text | no |  |  |  |
| batch_status_code | text | yes |  |  | official_import_batch_status_types.code |
| row_count | integer | yes | 0 |  |  |
| imported_at | timestamp with time zone | yes | now() |  |  |
| retention_until | timestamp with time zone | yes | (now() + '3 years'::interval) |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## official_import_review_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## official_import_row_action_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## official_import_rows

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| batch_id | uuid | yes |  |  | official_import_batches.id |
| council_id | uuid | yes |  |  | councils.id |
| row_number | integer | no |  |  |  |
| member_number | text | no |  |  |  |
| raw_payload | jsonb | yes |  |  |  |
| matched_person_id | uuid | no |  |  | people.id |
| matched_official_member_record_id | uuid | no |  |  | official_member_records.id |
| proposed_action_code | text | yes |  |  | official_import_row_action_types.code |
| review_status_code | text | yes |  |  | official_import_review_status_types.code |
| proposed_changes | jsonb | yes |  |  |  |
| missing_from_import | boolean | yes | false |  |  |
| reviewed_by_auth_user_id | uuid | no |  |  |  |
| reviewed_at | timestamp with time zone | no |  |  |  |
| applied_at | timestamp with time zone | no |  |  |  |
| review_notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## official_member_records

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| member_number | text | no |  |  |  |
| official_membership_status_code | text | yes |  |  | official_membership_status_types.code |
| raw_member_type | text | no |  |  |  |
| raw_member_class | text | no |  |  |  |
| raw_status_text | text | no |  |  |  |
| raw_payload | jsonb | yes |  |  |  |
| last_imported_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## official_membership_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## organization_admin_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| organization_id | uuid | yes |  |  | organizations.id |
| person_id | uuid | no |  |  | people.id |
| user_id | uuid | no |  |  |  |
| grantee_email | text | no |  |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_user_id | uuid | no |  |  |  |
| updated_by_user_id | uuid | no |  |  |  |
| source_code | text | yes | manual_assignment |  |  |
| organization_claim_request_id | uuid | no |  |  | organization_claim_requests.id |
| grant_notes | text | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| revoked_by_user_id | uuid | no |  |  |  |
| revoked_notes | text | no |  |  |  |

## organization_admin_invitations

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| organization_id | uuid | yes |  |  | organizations.id |
| council_id | uuid | no |  |  | councils.id |
| invited_by_auth_user_id | uuid | no |  |  |  |
| invitee_email | text | yes |  |  |  |
| invitee_name | text | no |  |  |  |
| status_code | text | yes | pending |  |  |
| notes | text | no |  |  |  |
| selector | text | yes |  |  |  |
| token_hash | text | yes |  |  |  |
| expires_at | timestamp with time zone | yes |  |  |  |
| accepted_by_auth_user_id | uuid | no |  |  |  |
| accepted_at | timestamp with time zone | no |  |  |  |
| revoked_by_auth_user_id | uuid | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| revoked_notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |
| accepted_assignment_id | uuid | no |  |  | organization_admin_assignments.id |

## organization_claim_requests

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| organization_id | uuid | no |  |  | organizations.id |
| council_id | uuid | no |  |  | councils.id |
| requested_by_auth_user_id | uuid | no |  |  |  |
| requested_by_person_id | uuid | no |  |  | people.id |
| requester_email | text | no |  |  |  |
| claimant_official_name | text | no |  |  |  |
| claimant_preferred_name | text | no |  |  |  |
| requester_phone | text | no |  |  |  |
| request_notes | text | no |  |  |  |
| status_code | text | yes | pending |  |  |
| review_notes | text | no |  |  |  |
| requested_at | timestamp with time zone | yes | now() |  |  |
| reviewed_at | timestamp with time zone | no |  |  |  |
| reviewed_by_auth_user_id | uuid | no |  |  |  |
| approved_assignment_id | uuid | no |  |  | organization_admin_assignments.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_user_id | uuid | no |  |  |  |
| updated_by_user_id | uuid | no |  |  |  |
| requester_name | text | no |  |  |  |
| requested_council_number | text | no |  |  |  |
| requested_council_name | text | no |  |  |  |
| requested_city | text | no |  |  |  |
| initiated_via_code | text | yes | signed_in_member |  |  |
| request_type_code | text | yes | admin_access |  |  |
| decision_notice_dismissed_at | timestamp with time zone | no |  |  |  |
| requester_notice_dismissed_at | timestamp with time zone | no |  |  |  |
| requester_notice_dismissed_by_auth_user_id | uuid | no |  |  |  |

## organization_families

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| code | text | yes |  |  |  |
| display_name | text | yes |  |  |  |
| terminology_json | jsonb | yes |  |  |  |
| active | boolean | yes | true |  |  |
| legacy_organization_id | uuid | no |  |  | organizations.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## organization_kofc_profiles

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| organization_id | uuid | yes |  | PK | organizations.id |
| council_number | text | yes |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| lookup_city | text | no |  |  |  |
| parish_associations | text[] | no |  |  |  |

## organization_membership_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## organization_memberships

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| organization_id | uuid | yes |  |  | organizations.id |
| person_id | uuid | yes |  |  | people.id |
| membership_status_code | text | yes |  |  | organization_membership_status_types.code |
| is_primary_membership | boolean | yes | false |  |  |
| source_code | text | yes | legacy_backfill |  |  |
| joined_at | date | no |  |  |  |
| ended_at | date | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |
| membership_number | text | no |  |  |  |

## organization_relationship_type_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## organization_relationships

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| from_organization_id | uuid | yes |  |  | organizations.id |
| to_organization_id | uuid | yes |  |  | organizations.id |
| relationship_type_code | text | yes |  |  | organization_relationship_type_types.code |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## organization_type_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## organizations

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| display_name | text | yes |  |  |  |
| organization_type_code | text | yes |  |  | organization_type_types.code |
| logo_storage_bucket | text | yes | organization-assets |  |  |
| logo_storage_path | text | no |  |  |  |
| logo_alt_text | text | no |  |  |  |
| primary_color_hex | text | no |  |  |  |
| secondary_color_hex | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |
| brand_profile_id | uuid | yes |  |  | brand_profiles.id |
| preferred_name | text | no |  |  |  |

## people

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | no |  |  | councils.id |
| title | text | no |  |  |  |
| first_name | text | yes |  |  |  |
| middle_name | text | no |  |  |  |
| last_name | text | yes |  |  |  |
| suffix | text | no |  |  |  |
| name_prefix | text | no |  |  |  |
| nickname | text | no |  |  |  |
| directory_display_name_override | text | no |  |  |  |
| primary_relationship_code | text | yes |  |  | primary_relationship_types.code |
| created_source_code | text | yes |  |  | person_source_types.code |
| is_provisional_member | boolean | yes | false |  |  |
| council_activity_level_code | text | no |  |  | council_activity_level_types.code |
| council_activity_context_code | text | no |  |  | council_activity_context_types.code |
| council_reengagement_status_code | text | no |  |  | council_reengagement_status_types.code |
| prospect_status_code | text | no |  |  | prospect_status_types.code |
| volunteer_context_code | text | no |  |  | volunteer_context_types.code |
| email | text | no |  |  |  |
| cell_phone | text | no |  |  |  |
| home_phone | text | no |  |  |  |
| other_phone | text | no |  |  |  |
| address_line_1 | text | no |  |  |  |
| address_line_2 | text | no |  |  |  |
| city | text | no |  |  |  |
| state_province | text | no |  |  |  |
| postal_code | text | no |  |  |  |
| country_code | text | no |  |  |  |
| merged_into_person_id | uuid | no |  |  | people.id |
| archived_at | timestamp with time zone | no |  |  |  |
| archived_by_auth_user_id | uuid | no |  |  |  |
| archive_reason | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |
| birth_date | date | no |  |  |  |
| pii_key_version | text | no |  |  |  |
| email_hash | text | no |  |  |  |
| cell_phone_hash | text | no |  |  |  |
| home_phone_hash | text | no |  |  |  |
| other_phone_hash | text | no |  |  |  |
| address_line_1_hash | text | no |  |  |  |
| address_line_2_hash | text | no |  |  |  |
| city_hash | text | no |  |  |  |
| state_province_hash | text | no |  |  |  |
| postal_code_hash | text | no |  |  |  |
| country_code_hash | text | no |  |  |  |
| birth_date_hash | text | no |  |  |  |

## person_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| user_id | uuid | yes |  |  | users.id |
| assigned_by_auth_user_id | uuid | no |  |  |  |
| assigned_at | timestamp with time zone | yes | now() |  |  |
| ended_by_auth_user_id | uuid | no |  |  |  |
| ended_at | timestamp with time zone | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |

## person_contact_change_log

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | no |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| changed_by_auth_user_id | uuid | no |  |  |  |
| changed_at | timestamp with time zone | yes | now() |  |  |
| changed_fields | jsonb | yes |  |  |  |
| old_values | jsonb | yes |  |  |  |
| new_values | jsonb | yes |  |  |  |

## person_designations

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| designation_code | text | yes |  |  | designation_types.code |
| fraternal_year | integer | yes |  |  |  |
| appointed_on | date | no |  |  |  |
| vacated_on | date | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |

## person_distinctions

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| distinction_code | text | yes |  |  | distinction_types.code |
| awarded_on | date | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |

## person_identities

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| primary_user_id | uuid | no |  |  | users.id |
| display_name | text | no |  |  |  |
| normalized_email_hash | text | no |  |  |  |
| normalized_phone_hash | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## person_identity_links

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| person_identity_id | uuid | yes |  |  | person_identities.id |
| person_id | uuid | yes |  |  | people.id |
| link_source | text | yes | manual |  |  |
| confidence_code | text | yes | confirmed |  |  |
| linked_at | timestamp with time zone | yes | now() |  |  |
| ended_at | timestamp with time zone | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## person_kofc_profiles

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| person_id | uuid | yes |  | PK | people.id |
| first_degree_date | date | no |  |  |  |
| second_degree_date | date | no |  |  |  |
| third_degree_date | date | no |  |  |  |
| years_in_service | integer | no |  |  |  |
| member_type | text | no |  |  |  |
| member_class | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| assembly_number | text | no |  |  |  |

## person_merges

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| source_person_id | uuid | yes |  |  | people.id |
| target_person_id | uuid | yes |  |  | people.id |
| merged_by_auth_user_id | uuid | yes |  |  |  |
| merged_at | timestamp with time zone | yes | now() |  |  |
| field_resolution | jsonb | yes |  |  |  |
| notes | text | no |  |  |  |

## person_notes

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| note_type_code | text | yes |  |  | note_types.code |
| body | text | yes |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## person_officer_terms

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| office_scope_code | text | yes |  |  |  |
| office_code | text | yes |  |  |  |
| office_label | text | yes |  |  |  |
| office_rank | integer | no |  |  |  |
| service_start_year | integer | yes |  |  |  |
| service_end_year | integer | no |  |  |  |
| notes | text | no |  |  |  |
| created_by_auth_user_id | uuid | no |  |  | users.id |
| updated_by_auth_user_id | uuid | no |  |  | users.id |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| manual_end_effective_date | date | no |  |  |  |
| ended_by_auth_user_id | uuid | no |  |  |  |
| end_reason | text | no |  |  |  |

## person_profile_change_requests

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| person_id | uuid | yes |  |  | people.id |
| requested_by_auth_user_id | uuid | yes |  |  |  |
| requested_at | timestamp with time zone | yes | now() |  |  |
| status_code | text | yes | pending |  |  |
| reviewed_at | timestamp with time zone | no |  |  |  |
| reviewed_by_auth_user_id | uuid | no |  |  |  |
| review_notes | text | no |  |  |  |
| proposed_email | text | no |  |  |  |
| proposed_cell_phone | text | no |  |  |  |
| proposed_home_phone | text | no |  |  |  |
| proposed_preferred_name | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| pii_key_version | text | no |  |  |  |
| proposed_email_hash | text | no |  |  |  |
| proposed_cell_phone_hash | text | no |  |  |  |
| proposed_home_phone_hash | text | no |  |  |  |
| email_change_requested | boolean | yes | false |  |  |
| cell_phone_change_requested | boolean | yes | false |  |  |
| home_phone_change_requested | boolean | yes | false |  |  |
| decision_notice_cleared_at | timestamp with time zone | no |  |  |  |
| proposed_first_name | text | no |  |  |  |
| proposed_last_name | text | no |  |  |  |

## person_source_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## primary_relationship_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## prospect_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## resource_access_grants

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| member_record_id | uuid | yes |  |  | member_records.id |
| resource_type | public.resource_type_code | yes |  |  |  |
| resource_key | text | yes |  |  |  |
| access_level | public.area_access_level | yes |  |  |  |
| source_code | public.grant_source_code | yes | manual |  |  |
| granted_at | timestamp with time zone | yes | now() |  |  |
| expires_at | timestamp with time zone | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## role_assignments

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| member_record_id | uuid | yes |  |  | member_records.id |
| local_role_definition_id | uuid | yes |  |  | local_role_definitions.id |
| start_year | integer | no |  |  |  |
| end_year | integer | no |  |  |  |
| active_override | boolean | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## saint_aliases

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| saint_id | uuid | yes |  |  | saints.id |
| alias | text | yes |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## saint_topics

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| saint_id | uuid | yes |  | PK | saints.id |
| topic_id | uuid | yes |  | PK | spiritual_topics.id |
| relevance_score | smallint | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## saints

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| slug | text | yes |  |  |  |
| canonical_name | text | yes |  |  |  |
| common_name | text | no |  |  |  |
| short_bio | text | no |  |  |  |
| feast_month | smallint | no |  |  |  |
| feast_day | smallint | no |  |  |  |
| era_label | text | no |  |  |  |
| canonization_status | text | no |  |  |  |
| patron_summary | text | no |  |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| source_1 | text | no |  |  |  |
| source_2 | text | no |  |  |  |
| review_status | text | no |  |  |  |
| data_tier | text | no |  |  |  |
| workbook_saint_id | text | no |  |  |  |

## scripture_passages

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| slug | text | yes |  |  |  |
| book | text | yes |  |  |  |
| chapter_start | integer | no |  |  |  |
| verse_start | integer | no |  |  |  |
| chapter_end | integer | no |  |  |  |
| verse_end | integer | no |  |  |  |
| reference_label | text | yes |  |  |  |
| summary | text | no |  |  |  |
| text_excerpt | text | no |  |  |  |
| translation_code | text | no | NRSVCE |  |  |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## scripture_topics

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| scripture_passage_id | uuid | yes |  | PK | scripture_passages.id |
| topic_id | uuid | yes |  | PK | spiritual_topics.id |
| relevance_score | smallint | no |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## spiritual_content_items

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| slug | text | yes |  |  |  |
| title | text | yes |  |  |  |
| content_kind | public.spiritual_content_kind | yes |  |  |  |
| prayer_type | public.prayer_type_code | no |  |  |  |
| summary | text | no |  |  |  |
| body_markdown | text | no |  |  |  |
| body_html | text | no |  |  |  |
| language_code | text | yes | en |  |  |
| territory_code | text | no |  |  |  |
| record_type | text | yes | standalone |  |  |
| authority_level | text | no |  |  |  |
| source_label | text | no |  |  |  |
| source_url | text | no |  |  |  |
| text_status | public.spiritual_text_status_code | yes | draft |  |  |
| sort_order | integer | yes | 0 |  |  |
| is_active | boolean | yes | true |  |  |
| is_published | boolean | yes | false |  |  |
| published_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| variant_label | text | no |  |  |  |
| is_primary_variant | boolean | no |  |  |  |
| source_body | text | no |  |  |  |
| notes | text | no |  |  |  |
| workbook_prayer_id | text | no |  |  |  |

## spiritual_content_relationships

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| parent_content_item_id | uuid | yes |  |  | spiritual_content_items.id |
| child_content_item_id | uuid | yes |  |  | spiritual_content_items.id |
| relationship_kind | public.content_relationship_kind | yes |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## spiritual_content_saints

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| spiritual_content_item_id | uuid | yes |  | PK | spiritual_content_items.id |
| saint_id | uuid | yes |  | PK | saints.id |
| relationship_kind | public.content_saint_relationship_kind | yes | about | PK |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## spiritual_content_scopes

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| spiritual_content_item_id | uuid | yes |  |  | spiritual_content_items.id |
| scope_kind | public.spiritual_scope_kind | yes |  |  |  |
| organization_family_id | uuid | no |  |  | organization_families.id |
| local_unit_id | uuid | no |  |  | local_units.id |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## spiritual_content_topics

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| spiritual_content_item_id | uuid | yes |  | PK | spiritual_content_items.id |
| topic_id | uuid | yes |  | PK | spiritual_topics.id |
| relevance_score | smallint | no |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## spiritual_topic_aliases

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| topic_id | uuid | yes |  |  | spiritual_topics.id |
| alias | text | yes |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## spiritual_topics

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| slug | text | yes |  |  |  |
| name | text | yes |  |  |  |
| topic_group | text | no |  |  |  |
| description | text | no |  |  |  |
| is_active | boolean | yes | true |  |  |
| sort_order | integer | yes | 0 |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| updated_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |
| source_kind | text | no |  |  |  |
| source_ref | text | no |  |  |  |

## supreme_update_queue

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| person_id | uuid | yes |  |  | people.id |
| created_by_auth_user_id | uuid | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| changed_fields | jsonb | yes |  |  |  |
| change_summary | jsonb | yes |  |  |  |
| status_code | text | yes |  |  | supreme_update_status_types.code |
| dismissed_reason | text | no |  |  |  |
| cleared_by_auth_user_id | uuid | no |  |  |  |
| cleared_at | timestamp with time zone | no |  |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## supreme_update_status_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## user_access_scopes

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| user_id | uuid | yes |  |  | users.id |
| scope_code | text | yes |  |  | access_scope_types.code |
| source_type_code | text | yes |  |  | access_scope_source_types.code |
| source_designation_code | text | no |  |  | designation_types.code |
| granted_by_auth_user_id | uuid | no |  |  |  |
| confirmed_at | timestamp with time zone | no |  |  |  |
| starts_at | timestamp with time zone | yes | now() |  |  |
| ends_at | timestamp with time zone | no |  |  |  |
| notes | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |

## user_admin_grants

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| council_id | uuid | yes |  |  | councils.id |
| user_id | uuid | yes |  |  | users.id |
| granted_by_auth_user_id | uuid | no |  |  |  |
| granted_at | timestamp with time zone | yes | now() |  |  |
| revoked_by_auth_user_id | uuid | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| reason | text | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |

## user_saved_saints

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| user_id | uuid | yes |  |  | users.id |
| saint_id | uuid | yes |  |  | saints.id |
| saved_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## user_saved_spiritual_items

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| user_id | uuid | yes |  |  | users.id |
| spiritual_content_item_id | uuid | yes |  |  | spiritual_content_items.id |
| saved_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## user_spiritual_activity

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| user_id | uuid | yes |  |  | users.id |
| activity_code | text | yes |  |  |  |
| spiritual_content_item_id | uuid | no |  |  | spiritual_content_items.id |
| daily_reading_entry_id | uuid | no |  |  | daily_reading_entries.id |
| payload_json | jsonb | yes |  |  |  |
| created_at | timestamp with time zone | yes | timezone('utc'::text, now()) |  |  |

## user_unit_relationships

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes | gen_random_uuid() | PK |  |
| user_id | uuid | yes |  |  |  |
| local_unit_id | uuid | yes |  |  | local_units.id |
| relationship_kind | public.relationship_kind | yes |  |  |  |
| status | public.relationship_status | yes | active |  |  |
| member_record_id | uuid | no |  |  | member_records.id |
| is_primary_parish | boolean | yes | false |  |  |
| activated_at | timestamp with time zone | no |  |  |  |
| ended_at | timestamp with time zone | no |  |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| created_by_auth_user_id | uuid | no |  |  |  |
| updated_by_auth_user_id | uuid | no |  |  |  |

## users

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| id | uuid | yes |  | PK |  |
| council_id | uuid | no |  |  | councils.id |
| person_id | uuid | no |  |  | people.id |
| is_active | boolean | yes | true |  |  |
| created_at | timestamp with time zone | yes | now() |  |  |
| updated_at | timestamp with time zone | yes | now() |  |  |
| is_super_admin | boolean | yes | false |  |  |

## v_auth_effective_admin_package_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| user_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| local_unit_id | uuid | no |  |  |  |
| local_unit_name | text | no |  |  |  |
| can_manage_members | boolean | no |  |  |  |
| can_manage_events | boolean | no |  |  |  |
| can_manage_custom_lists | boolean | no |  |  |  |
| can_manage_claims | boolean | no |  |  |  |
| can_manage_admins | boolean | no |  |  |  |
| can_manage_local_unit_settings | boolean | no |  |  |  |

## v_auth_effective_area_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| area_access_grant_id | uuid | no |  |  |  |
| local_unit_id | uuid | no |  |  |  |
| local_unit_name | text | no |  |  |  |
| member_record_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| user_id | uuid | no |  |  |  |
| area_code | public.member_area_code | no |  |  |  |
| access_level | public.area_access_level | no |  |  |  |
| source_code | public.grant_source_code | no |  |  |  |
| granted_at | timestamp with time zone | no |  |  |  |
| expires_at | timestamp with time zone | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| is_effective | boolean | no |  |  |  |

## v_auth_effective_resource_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| resource_access_grant_id | uuid | no |  | PK |  |
| local_unit_id | uuid | no |  |  | local_units.id |
| local_unit_name | text | no |  |  |  |
| member_record_id | uuid | no |  |  | member_records.id |
| person_id | uuid | no |  |  | people.id |
| user_id | uuid | no |  |  |  |
| resource_type | public.resource_type_code | no |  |  |  |
| resource_key | text | no |  |  |  |
| access_level | public.area_access_level | no |  |  |  |
| source_code | public.grant_source_code | no |  |  |  |
| granted_at | timestamp with time zone | no |  |  |  |
| expires_at | timestamp with time zone | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| is_effective | boolean | no |  |  |  |

## v_effective_admin_package_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| user_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| local_unit_id | uuid | no |  |  |  |
| local_unit_name | text | no |  |  |  |
| can_manage_members | boolean | no |  |  |  |
| can_manage_events | boolean | no |  |  |  |
| can_manage_custom_lists | boolean | no |  |  |  |
| can_manage_claims | boolean | no |  |  |  |
| can_manage_admins | boolean | no |  |  |  |
| can_manage_local_unit_settings | boolean | no |  |  |  |

## v_effective_area_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| area_access_grant_id | uuid | no |  |  |  |
| local_unit_id | uuid | no |  |  |  |
| local_unit_name | text | no |  |  |  |
| member_record_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| user_id | uuid | no |  |  |  |
| area_code | public.member_area_code | no |  |  |  |
| access_level | public.area_access_level | no |  |  |  |
| source_code | public.grant_source_code | no |  |  |  |
| granted_at | timestamp with time zone | no |  |  |  |
| expires_at | timestamp with time zone | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| is_effective | boolean | no |  |  |  |

## v_effective_event_management_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| local_unit_id | uuid | no |  |  |  |
| local_unit_name | text | no |  |  |  |
| event_id | uuid | no |  |  |  |
| member_record_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  |  |
| user_id | uuid | no |  |  |  |
| role_code | text | no |  |  |  |
| is_effective | boolean | no |  |  |  |

## v_effective_resource_access

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| resource_access_grant_id | uuid | no |  | PK |  |
| local_unit_id | uuid | no |  |  | local_units.id |
| local_unit_name | text | no |  |  |  |
| member_record_id | uuid | no |  |  | member_records.id |
| person_id | uuid | no |  |  | people.id |
| user_id | uuid | no |  |  |  |
| resource_type | public.resource_type_code | no |  |  |  |
| resource_key | text | no |  |  |  |
| access_level | public.area_access_level | no |  |  |  |
| source_code | public.grant_source_code | no |  |  |  |
| granted_at | timestamp with time zone | no |  |  |  |
| expires_at | timestamp with time zone | no |  |  |  |
| revoked_at | timestamp with time zone | no |  |  |  |
| is_effective | boolean | no |  |  |  |

## v_parallel_admin_package_audit

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| local_unit_id | uuid | no |  | PK |  |
| local_unit_name | text | no |  |  |  |
| user_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  | people.id |
| has_members_package | boolean | no |  |  |  |
| has_events_package | boolean | no |  |  |  |
| has_custom_lists_package | boolean | no |  |  |  |
| has_claims_package | boolean | no |  |  |  |
| has_admins_package | boolean | no |  |  |  |
| has_local_unit_settings_package | boolean | no |  |  |  |

## v_parallel_custom_list_access_audit

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| custom_list_id | uuid | no |  | PK |  |
| custom_list_name | text | no |  |  |  |
| local_unit_id | uuid | no |  |  | local_units.id |
| local_unit_name | text | no |  |  |  |
| user_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  | people.id |
| has_parallel_resource_access | boolean | no |  |  |  |

## v_parallel_event_assignment_audit

Operations: get

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| event_id | uuid | no |  | PK |  |
| title | text | no |  |  |  |
| local_unit_id | uuid | no |  |  | local_units.id |
| local_unit_name | text | no |  |  |  |
| user_id | uuid | no |  |  |  |
| person_id | uuid | no |  |  | people.id |
| role_code | text | no |  |  |  |
| assignment_scope | public.event_assignment_scope_code | no |  |  |  |

## volunteer_context_types

Operations: delete, get, patch, post

| Column | Type | Required | Default | Key | References |
| --- | --- | --- | --- | --- | --- |
| code | text | yes |  | PK |  |
| label | text | yes |  |  |  |
| sort_order | integer | yes | 100 |  |  |
| is_active | boolean | yes | true |  |  |

## RPC Functions

| Function | Operations |
| --- | --- |
| apply_supreme_import_row | post |
| approve_membership_claim_request_to_admin_package | post |
| archive_local_unit_member_record | post |
| auth_accessible_custom_lists | get, post |
| auth_accessible_local_units_for_area | get, post |
| auth_can_manage_person | get, post |
| auth_can_manage_person_assignments | get, post |
| auth_can_manage_person_notes | get, post |
| auth_has_area_access | get, post |
| auth_has_event_management_access | get, post |
| auth_has_resource_access | get, post |
| auth_manageable_event_ids | get, post |
| backfill_missing_parallel_admin_packages | post |
| backfill_missing_parallel_custom_list_grants | post |
| backfill_missing_parallel_event_managers | post |
| cleanup_parallel_invite_package_subject | post |
| current_user_council_id | get, post |
| ensure_member_record_for_person_local_unit | post |
| ensure_parallel_member_for_user_and_local_unit | post |
| ensure_parallel_membership_for_org_admin_assignment | post |
| ensure_user_unit_relationship_for_user_member | post |
| generate_rsvp_token | post |
| grant_parallel_admin_package_to_user | post |
| grant_parallel_custom_list_access_to_user | post |
| has_area_access | get, post |
| has_event_management_access | get, post |
| has_resource_access | get, post |
| list_accessible_custom_lists_for_user | get, post |
| list_accessible_local_units_for_area | get, post |
| list_manageable_event_ids_for_user | get, post |
| list_super_admin_preview_local_units | get, post |
| parallel_grant_source_rank | get, post |
| reject_membership_claim_request_in_parallel | post |
| restore_local_unit_member_record | post |
| revoke_parallel_admin_package_from_user | post |
| revoke_parallel_custom_list_access_from_user | post |
| revoke_parallel_event_assignment_from_user | post |
| rls_auto_enable | post |
| show_limit | get, post |
| show_trgm | get, post |
| sync_organization_admin_assignment_from_council_admin_assignmen | post |
| sync_parallel_admin_package_from_council_admin_assignment | post |
| sync_parallel_admin_package_from_org_admin_assignment | post |
| sync_parallel_area_grants_from_org_admin_assignment | post |
| upsert_parallel_admin_package_for_member | post |
| upsert_parallel_event_assignment_for_user | post |
| user_belongs_to_council | get, post |
| user_can_access_event | get, post |
| user_can_manage_event | get, post |
| user_is_council_admin | get, post |

