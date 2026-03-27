alter table public.organization_claim_requests
  add column if not exists requester_notice_dismissed_at timestamp with time zone null,
  add column if not exists requester_notice_dismissed_by_auth_user_id uuid null;
