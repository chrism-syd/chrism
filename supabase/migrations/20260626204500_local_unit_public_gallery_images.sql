begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'local-unit-public-gallery',
  'local-unit-public-gallery',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.local_unit_public_gallery_images (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  storage_bucket text not null default 'local-unit-public-gallery',
  storage_path text not null,
  title text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null,
  constraint local_unit_public_gallery_images_storage_path_not_blank check (length(btrim(storage_path)) > 0),
  constraint local_unit_public_gallery_images_sort_order_nonnegative check (sort_order >= 0),
  constraint local_unit_public_gallery_images_title_not_blank check (title is null or length(btrim(title)) > 0),
  constraint local_unit_public_gallery_images_storage_path_unique unique (storage_bucket, storage_path)
);

create index if not exists local_unit_public_gallery_images_local_unit_id_idx
  on public.local_unit_public_gallery_images (local_unit_id);

create index if not exists local_unit_public_gallery_images_active_sort_idx
  on public.local_unit_public_gallery_images (local_unit_id, sort_order, created_at)
  where is_active = true;

drop trigger if exists local_unit_public_gallery_images_set_updated_at on public.local_unit_public_gallery_images;
create trigger local_unit_public_gallery_images_set_updated_at
before update on public.local_unit_public_gallery_images
for each row
execute function public.set_updated_at();

create or replace function public.enforce_local_unit_public_gallery_images_active_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_active_count integer;
begin
  if new.is_active then
    select count(*)
    into v_active_count
    from public.local_unit_public_gallery_images
    where local_unit_id = new.local_unit_id
      and is_active = true
      and id <> new.id;

    if v_active_count >= 12 then
      raise exception 'A local unit can have at most 12 active public gallery images.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists local_unit_public_gallery_images_active_limit on public.local_unit_public_gallery_images;
create trigger local_unit_public_gallery_images_active_limit
before insert or update of local_unit_id, is_active on public.local_unit_public_gallery_images
for each row
execute function public.enforce_local_unit_public_gallery_images_active_limit();

commit;
