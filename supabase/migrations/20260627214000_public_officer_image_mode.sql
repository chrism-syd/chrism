begin;

alter table public.local_unit_public_officers
add column if not exists public_image_mode text not null default 'auto';

alter table public.local_unit_public_officers
drop constraint if exists local_unit_public_officers_public_image_mode_check;

alter table public.local_unit_public_officers
add constraint local_unit_public_officers_public_image_mode_check
check (public_image_mode in ('auto', 'none'));

commit;
