begin;

alter table public.events
  add column if not exists needs_volunteers boolean not null default false;

commit;