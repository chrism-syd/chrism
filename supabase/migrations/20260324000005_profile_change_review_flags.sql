alter table public.person_profile_change_requests
  add column if not exists email_change_requested boolean not null default false,
  add column if not exists cell_phone_change_requested boolean not null default false,
  add column if not exists home_phone_change_requested boolean not null default false;
