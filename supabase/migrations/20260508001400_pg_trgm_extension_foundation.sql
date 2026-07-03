begin;

-- Ensure pg_trgm exists before the following migration moves it into the
-- extensions schema for Supabase security-advisor compliance.

create schema if not exists extensions;

create extension if not exists pg_trgm with schema extensions;

grant usage on schema extensions to anon;
grant usage on schema extensions to authenticated;
grant usage on schema extensions to service_role;

commit;
