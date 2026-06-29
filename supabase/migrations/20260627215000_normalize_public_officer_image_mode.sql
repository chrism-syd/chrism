begin;

update public.local_unit_public_officers
set public_image_mode = 'show_image'
where public_image_mode in ('auto', 'portrait', 'medal') or public_image_mode is null;

alter table public.local_unit_public_officers
alter column public_image_mode set default 'show_image';

alter table public.local_unit_public_officers
drop constraint if exists local_unit_public_officers_public_image_mode_check;

alter table public.local_unit_public_officers
add constraint local_unit_public_officers_public_image_mode_check
check (public_image_mode in ('show_image', 'none'));

commit;
