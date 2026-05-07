-- Custom lists are local-unit owned resources.
-- This intentionally kills the old council_id ownership bridge while keeping
-- the deprecated column present for compatibility until a later schema prune.
--
-- Prelaunch posture:
--   local_unit_id is required.
--   council_id must remain null.
--   access policies/functions should use local_unit_id/resource grants.

begin;

alter table public.custom_lists
  alter column council_id drop not null;

update public.custom_lists
set council_id = null
where council_id is not null;

alter table public.custom_lists
  alter column local_unit_id set not null;

alter table public.custom_lists
  drop constraint if exists custom_lists_council_id_must_be_null;

alter table public.custom_lists
  add constraint custom_lists_council_id_must_be_null
  check (council_id is null) not valid;

alter table public.custom_lists
  validate constraint custom_lists_council_id_must_be_null;

comment on column public.custom_lists.council_id is
  'Deprecated compatibility column. Must remain null; local_unit_id is canonical custom-list owner.';

commit;
