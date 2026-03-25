alter table public.people
  add column if not exists pii_key_version text,
  add column if not exists email_hash text,
  add column if not exists cell_phone_hash text,
  add column if not exists home_phone_hash text,
  add column if not exists other_phone_hash text,
  add column if not exists address_line_1_hash text,
  add column if not exists address_line_2_hash text,
  add column if not exists city_hash text,
  add column if not exists state_province_hash text,
  add column if not exists postal_code_hash text,
  add column if not exists country_code_hash text,
  add column if not exists member_number_hash text,
  add column if not exists birth_date_hash text;

create index if not exists people_email_hash_idx on public.people (email_hash);
create index if not exists people_cell_phone_hash_idx on public.people (cell_phone_hash);
create index if not exists people_member_number_hash_idx on public.people (member_number_hash);
create index if not exists people_birth_date_hash_idx on public.people (birth_date_hash);
create index if not exists people_active_member_lookup_idx
  on public.people (council_id, primary_relationship_code, archived_at, merged_into_person_id);

alter table public.person_profile_change_requests
  add column if not exists pii_key_version text,
  add column if not exists proposed_email_hash text,
  add column if not exists proposed_cell_phone_hash text,
  add column if not exists proposed_home_phone_hash text;

create index if not exists person_profile_change_requests_pending_idx
  on public.person_profile_change_requests (person_id, status_code, requested_at desc);

create unique index if not exists person_profile_change_requests_one_pending_per_person_idx
  on public.person_profile_change_requests (person_id)
  where status_code = 'pending';

create index if not exists official_import_rows_batch_review_idx
  on public.official_import_rows (batch_id, review_status_code, applied_at);
