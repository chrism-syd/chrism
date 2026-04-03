alter table public.events
  alter column ends_at drop not null;

alter table public.events
  drop constraint if exists events_time_check;

alter table public.events
  add constraint events_time_check
  check ((ends_at is null) or (ends_at >= starts_at));


alter table public.event_archives
  add column if not exists needs_volunteers boolean not null default false;
