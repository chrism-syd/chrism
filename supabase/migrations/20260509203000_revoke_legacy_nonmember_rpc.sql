-- Revoke browser-role execution from legacy council-scoped nonmember creation wrappers.
--
-- These wrappers depend on app.current_council_id() and delegate to the
-- local-unit-first helpers. Current app/lib code no longer calls them.
-- Keep service_role access for emergency/server compatibility, but remove
-- direct anon/authenticated/browser execution.
--
-- Do not revoke app.current_council_id() yet: live RLS policies still depend on it.

revoke execute on function app.create_prospect(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function app.create_volunteer_only(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function app.create_prospect(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

grant execute on function app.create_volunteer_only(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
