begin;

alter table public.local_units
  add column if not exists public_email text,
  add column if not exists public_location_name text,
  add column if not exists public_address_line1 text,
  add column if not exists public_address_line2 text,
  add column if not exists public_city text,
  add column if not exists public_region text,
  add column if not exists public_postal_code text,
  add column if not exists public_country text,
  add column if not exists public_location_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_email_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_email_not_blank
      check (public_email is null or length(btrim(public_email)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_location_name_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_location_name_not_blank
      check (public_location_name is null or length(btrim(public_location_name)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_address_line1_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_address_line1_not_blank
      check (public_address_line1 is null or length(btrim(public_address_line1)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_address_line2_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_address_line2_not_blank
      check (public_address_line2 is null or length(btrim(public_address_line2)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_city_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_city_not_blank
      check (public_city is null or length(btrim(public_city)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_region_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_region_not_blank
      check (public_region is null or length(btrim(public_region)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_postal_code_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_postal_code_not_blank
      check (public_postal_code is null or length(btrim(public_postal_code)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_country_not_blank'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_country_not_blank
      check (public_country is null or length(btrim(public_country)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'local_units_public_location_url_http'
      and conrelid = 'public.local_units'::regclass
  ) then
    alter table public.local_units
      add constraint local_units_public_location_url_http
      check (public_location_url is null or public_location_url ~* '^https?://');
  end if;
end $$;

drop table if exists public.local_unit_public_contact_profiles;

commit;
