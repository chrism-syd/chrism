begin;

create table if not exists public.local_unit_public_contact_profiles (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  display_email text,
  location_name text,
  location_address text,
  location_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null,
  constraint local_unit_public_contact_profiles_local_unit_unique unique (local_unit_id),
  constraint local_unit_public_contact_profiles_display_email_not_blank check (display_email is null or length(btrim(display_email)) > 0),
  constraint local_unit_public_contact_profiles_location_name_not_blank check (location_name is null or length(btrim(location_name)) > 0),
  constraint local_unit_public_contact_profiles_location_address_not_blank check (location_address is null or length(btrim(location_address)) > 0),
  constraint local_unit_public_contact_profiles_location_url_not_blank check (location_url is null or length(btrim(location_url)) > 0),
  constraint local_unit_public_contact_profiles_location_url_http check (location_url is null or location_url ~* '^https?://')
);

create index if not exists local_unit_public_contact_profiles_local_unit_id_idx
  on public.local_unit_public_contact_profiles (local_unit_id);

drop trigger if exists local_unit_public_contact_profiles_set_updated_at on public.local_unit_public_contact_profiles;
create trigger local_unit_public_contact_profiles_set_updated_at
before update on public.local_unit_public_contact_profiles
for each row
execute function public.set_updated_at();

commit;
