begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'people-portraits',
  'people-portraits',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.local_unit_public_officers (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  person_officer_term_id uuid not null references public.person_officer_terms(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  display_name_override text null,
  public_title_override text null,
  public_email text null,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  photo_storage_bucket text null,
  photo_storage_path text null,
  photo_zoom numeric(5,2) not null default 1,
  photo_position_x numeric(5,2) not null default 50,
  photo_position_y numeric(5,2) not null default 50,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null,
  constraint local_unit_public_officers_display_name_not_blank check (display_name_override is null or length(btrim(display_name_override)) > 0),
  constraint local_unit_public_officers_public_title_not_blank check (public_title_override is null or length(btrim(public_title_override)) > 0),
  constraint local_unit_public_officers_public_email_not_blank check (public_email is null or length(btrim(public_email)) > 0),
  constraint local_unit_public_officers_sort_order_nonnegative check (sort_order >= 0),
  constraint local_unit_public_officers_photo_pair check (
    (photo_storage_bucket is null and photo_storage_path is null)
    or (photo_storage_bucket is not null and photo_storage_path is not null and length(btrim(photo_storage_bucket)) > 0 and length(btrim(photo_storage_path)) > 0)
  ),
  constraint local_unit_public_officers_photo_zoom_range check (photo_zoom >= 1 and photo_zoom <= 3),
  constraint local_unit_public_officers_photo_position_x_range check (photo_position_x >= 0 and photo_position_x <= 100),
  constraint local_unit_public_officers_photo_position_y_range check (photo_position_y >= 0 and photo_position_y <= 100),
  constraint local_unit_public_officers_term_unique unique (local_unit_id, person_officer_term_id)
);

create index if not exists local_unit_public_officers_local_unit_id_idx
  on public.local_unit_public_officers (local_unit_id);

create index if not exists local_unit_public_officers_person_id_idx
  on public.local_unit_public_officers (person_id);

create index if not exists local_unit_public_officers_public_sort_idx
  on public.local_unit_public_officers (local_unit_id, sort_order, created_at)
  where is_public = true;

create index if not exists local_unit_public_officers_photo_storage_idx
  on public.local_unit_public_officers (photo_storage_bucket, photo_storage_path)
  where photo_storage_path is not null;

drop trigger if exists local_unit_public_officers_set_updated_at on public.local_unit_public_officers;
create trigger local_unit_public_officers_set_updated_at
before update on public.local_unit_public_officers
for each row
execute function public.set_updated_at();

commit;
