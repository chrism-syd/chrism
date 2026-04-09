alter table public.person_profile_change_requests
  add column if not exists proposed_first_name text,
  add column if not exists proposed_last_name text;

comment on column public.person_profile_change_requests.proposed_first_name is
  'Requested first name change submitted by the linked user for admin review.';

comment on column public.person_profile_change_requests.proposed_last_name is
  'Requested last name change submitted by the linked user for admin review.';
