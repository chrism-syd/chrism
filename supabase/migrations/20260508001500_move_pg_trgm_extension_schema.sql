-- Move pg_trgm out of public to clear Supabase extension-in-public warning.
--
-- Pre-checks run before this migration:
--   - pg_trgm dependencies were extension-owned objects only.
--   - no application indexes using gin_trgm_ops/gist_trgm_ops/trgm patterns were found.
--
-- The extension is kept available through the dedicated extensions schema.

begin;

create schema if not exists extensions;

alter extension pg_trgm set schema extensions;

grant usage on schema extensions to anon;
grant usage on schema extensions to authenticated;
grant usage on schema extensions to service_role;

commit;
