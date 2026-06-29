begin;

alter table public.people
  add column if not exists profile_image_storage_bucket text null,
  add column if not exists profile_image_storage_path text null,
  add column if not exists profile_image_alt_text text null,
  add column if not exists profile_image_zoom numeric(5,2) not null default 1,
  add column if not exists profile_image_position_x numeric(5,2) not null default 50,
  add column if not exists profile_image_position_y numeric(5,2) not null default 50,
  add column if not exists profile_image_uploaded_at timestamp with time zone null,
  add column if not exists profile_image_uploaded_by_auth_user_id uuid null;

alter table public.people
  drop constraint if exists people_profile_image_pair,
  add constraint people_profile_image_pair check (
    (profile_image_storage_bucket is null and profile_image_storage_path is null)
    or (
      profile_image_storage_bucket is not null
      and profile_image_storage_path is not null
      and length(btrim(profile_image_storage_bucket)) > 0
      and length(btrim(profile_image_storage_path)) > 0
    )
  ),
  drop constraint if exists people_profile_image_alt_text_not_blank,
  add constraint people_profile_image_alt_text_not_blank check (
    profile_image_alt_text is null or length(btrim(profile_image_alt_text)) > 0
  ),
  drop constraint if exists people_profile_image_zoom_range,
  add constraint people_profile_image_zoom_range check (profile_image_zoom >= 1 and profile_image_zoom <= 3),
  drop constraint if exists people_profile_image_position_x_range,
  add constraint people_profile_image_position_x_range check (profile_image_position_x >= 0 and profile_image_position_x <= 100),
  drop constraint if exists people_profile_image_position_y_range,
  add constraint people_profile_image_position_y_range check (profile_image_position_y >= 0 and profile_image_position_y <= 100);

create index if not exists people_profile_image_storage_idx
  on public.people (profile_image_storage_bucket, profile_image_storage_path)
  where profile_image_storage_path is not null;

comment on column public.people.profile_image_storage_bucket is 'Optional private storage bucket for this person profile image. Not publicized in the UI by default.';
comment on column public.people.profile_image_storage_path is 'Optional private storage path for this person profile image. Intended path: local-units/{localUnitId}/people/{personId}/profile/{uuid}.{ext}.';
comment on column public.people.profile_image_alt_text is 'Optional alt text for this person profile image.';
comment on column public.people.profile_image_zoom is 'Optional portrait crop zoom metadata used by shared portrait rendering.';
comment on column public.people.profile_image_position_x is 'Optional portrait crop horizontal focus percentage from 0 to 100.';
comment on column public.people.profile_image_position_y is 'Optional portrait crop vertical focus percentage from 0 to 100.';
comment on column public.people.profile_image_uploaded_at is 'Timestamp for the most recent profile image upload.';
comment on column public.people.profile_image_uploaded_by_auth_user_id is 'Auth user who uploaded or last replaced this profile image.';

commit;
