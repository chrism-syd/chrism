alter table public.person_profile_change_requests
  add column if not exists decision_notice_cleared_at timestamptz null;
