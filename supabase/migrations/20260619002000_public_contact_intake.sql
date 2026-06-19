begin;

create table if not exists public.local_unit_message_routes (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  route_key text not null,
  recipient_person_id uuid null references public.people(id) on delete set null,
  recipient_email text null,
  recipient_label text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null,
  constraint local_unit_message_routes_route_key_not_blank check (length(btrim(route_key)) > 0),
  constraint local_unit_message_routes_recipient_present check (recipient_person_id is not null or length(btrim(coalesce(recipient_email, ''))) > 0)
);

create unique index if not exists local_unit_message_routes_active_route_unique_idx
  on public.local_unit_message_routes (local_unit_id, route_key)
  where is_active = true;

create index if not exists local_unit_message_routes_local_unit_id_idx
  on public.local_unit_message_routes (local_unit_id);

drop trigger if exists local_unit_message_routes_set_updated_at on public.local_unit_message_routes;
create trigger local_unit_message_routes_set_updated_at
before update on public.local_unit_message_routes
for each row
execute function public.set_updated_at();

create table if not exists public.local_unit_public_contact_message_jobs (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  route_key text not null default 'public_contact',
  inquiry_type_code text not null,
  status_code text not null default 'pending',
  recipient_email text not null,
  recipient_label text null,
  reply_to_email text not null,
  submitter_name text not null,
  submitter_phone text null,
  subject text not null,
  body_text text not null,
  payload_snapshot jsonb not null default '{}'::jsonb,
  scheduled_for timestamp with time zone not null default now(),
  sent_at timestamp with time zone null,
  failed_at timestamp with time zone null,
  failure_message text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint local_unit_public_contact_message_jobs_inquiry_type_valid check (
    inquiry_type_code in ('volunteer', 'membership', 'general_question', 'help_request', 'other')
  ),
  constraint local_unit_public_contact_message_jobs_status_valid check (
    status_code in ('pending', 'sent', 'failed', 'cancelled')
  ),
  constraint local_unit_public_contact_message_jobs_recipient_email_not_blank check (length(btrim(recipient_email)) > 0),
  constraint local_unit_public_contact_message_jobs_reply_to_email_not_blank check (length(btrim(reply_to_email)) > 0),
  constraint local_unit_public_contact_message_jobs_submitter_name_not_blank check (length(btrim(submitter_name)) > 0)
);

create index if not exists local_unit_public_contact_message_jobs_local_unit_id_idx
  on public.local_unit_public_contact_message_jobs (local_unit_id);

create index if not exists local_unit_public_contact_message_jobs_pending_idx
  on public.local_unit_public_contact_message_jobs (scheduled_for, created_at)
  where status_code = 'pending';

drop trigger if exists local_unit_public_contact_message_jobs_set_updated_at on public.local_unit_public_contact_message_jobs;
create trigger local_unit_public_contact_message_jobs_set_updated_at
before update on public.local_unit_public_contact_message_jobs
for each row
execute function public.set_updated_at();

commit;
