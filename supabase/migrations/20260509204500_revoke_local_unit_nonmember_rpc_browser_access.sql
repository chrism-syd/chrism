-- Revoke browser-role execution from local-unit-first nonmember creation helpers.
--
-- These helpers are the modern implementation path, but current app code uses
-- server/service-role flows rather than direct browser RPC execution.
--
-- Keep service_role access. Remove PUBLIC/anon/authenticated execution.

revoke execute on function app.create_prospect_for_local_unit(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function app.create_volunteer_only_for_local_unit(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function app.create_prospect_for_local_unit(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

grant execute on function app.create_volunteer_only_for_local_unit(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
