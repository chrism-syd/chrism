-- Imported Supreme roster rows may legitimately arrive without email/phone.
-- Manual/non-import records must still have at least one contact method.

alter table public.people
  drop constraint if exists people_contact_required_for_non_import;

alter table public.people
  add constraint people_contact_required_for_non_import
  check (
    created_source_code = 'supreme_import'
    or coalesce(
      nullif(btrim(email), ''),
      nullif(btrim(cell_phone), ''),
      nullif(btrim(home_phone), ''),
      nullif(btrim(other_phone), '')
    ) is not null
  );
