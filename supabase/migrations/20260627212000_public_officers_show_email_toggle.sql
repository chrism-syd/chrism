begin;

alter table public.local_unit_public_officers
add column if not exists show_public_email boolean not null default false;

commit;
