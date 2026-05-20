-- Production safety migration for organization reporting-year defaults.
--
-- The volunteer-hours page reads organizations.org_type_code to default Knights
-- organizations to a July 1 fraternal year. This column existed in app-code
-- assumptions but was missing in production until manually added.

begin;

alter table public.organizations
add column if not exists org_type_code text;

update public.organizations
set org_type_code = 'knights_of_columbus'
where org_type_code is null;

commit;
