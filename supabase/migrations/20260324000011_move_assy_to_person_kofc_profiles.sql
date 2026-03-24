begin;

alter table public.person_kofc_profiles
  add column if not exists assembly_number text;

comment on column public.person_kofc_profiles.assembly_number is
  'Knights of Columbus assembly number for members who belong to a 4th degree assembly.';

commit;
