begin;

-- Preserve any lingering membership numbers that may still live in the old alias
-- before removing the duplicate column.
update public.organization_memberships
set membership_number = member_number
where membership_number is null
  and member_number is not null;

comment on column public.organization_memberships.membership_number is
  'Canonical Knights of Columbus membership number imported from Supreme and stored on the membership record.';

-- Remove the legacy duplicate alias now that membership_number is the sole source of truth.
alter table public.organization_memberships
  drop column if exists member_number;

-- Remove stale org-level ASSY storage.
-- Assembly membership is person-specific and now lives on public.person_kofc_profiles.assembly_number.
alter table public.organization_kofc_profiles
  drop column if exists assembly_number;

commit;
