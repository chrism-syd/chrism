alter table public.events
  add column if not exists volunteer_deadline_at timestamp with time zone;

alter table public.events
  drop constraint if exists events_volunteer_deadline_check;

alter table public.events
  add constraint events_volunteer_deadline_check
  check ((volunteer_deadline_at is null) or (volunteer_deadline_at <= starts_at));

alter table public.event_archives
  add column if not exists volunteer_deadline_at timestamp with time zone;
