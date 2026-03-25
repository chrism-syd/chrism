create table if not exists public.event_archives (
  id uuid primary key default gen_random_uuid(),
  original_event_id uuid,
  council_id uuid not null references public.councils(id) on delete cascade,
  title text not null,
  description text,
  location_name text,
  location_address text,
  starts_at timestamptz,
  ends_at timestamptz,
  status_code text,
  scope_code text,
  event_kind_code text,
  requires_rsvp boolean not null default false,
  rsvp_deadline_at timestamptz,
  reminder_enabled boolean not null default false,
  reminder_scheduled_for timestamptz,
  reminder_days_before integer,
  deleted_at timestamptz not null default now(),
  deleted_by_user_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists event_archives_council_deleted_idx
  on public.event_archives (council_id, deleted_at desc);

insert into public.event_message_types (code, label, sort_order)
values
  ('volunteer_confirmation', 'Volunteer confirmation', 40),
  ('volunteer_removed', 'Volunteer removed', 50),
  ('volunteer_reminder', 'Volunteer reminder', 60)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order;
