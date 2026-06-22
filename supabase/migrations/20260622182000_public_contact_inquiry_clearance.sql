alter table public.local_unit_public_contact_message_jobs
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by_auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists local_unit_public_contact_message_jobs_clearance_idx
  on public.local_unit_public_contact_message_jobs (local_unit_id, cleared_at, created_at desc);
