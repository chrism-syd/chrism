alter table public.person_contact_change_log
  alter column council_id drop not null;

comment on column public.person_contact_change_log.council_id is
  'Nullable for profile/contact changes made by organization-scoped external admins who do not belong to a local council.';
