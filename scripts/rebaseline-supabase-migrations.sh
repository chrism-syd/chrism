#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
SCHEMA_FILE="${ROOT_DIR}/supabase/schema.sql"
MIGRATIONS_DIR="${ROOT_DIR}/supabase/migrations"
LEGACY_ROOT="${ROOT_DIR}/supabase/migrations_legacy"
BASELINE_VERSION="${BASELINE_VERSION:-$(date -u +%Y%m%d%H%M%S)}"

usage() {
  echo "Usage: BASELINE_VERSION=20260324193000 $0 [repo-root]"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "${SCHEMA_FILE}" ]]; then
  echo "Missing ${SCHEMA_FILE}. Run 'supabase db dump --linked --schema public -f supabase/schema.sql' first." >&2
  exit 1
fi

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "Missing ${MIGRATIONS_DIR}." >&2
  exit 1
fi

shopt -s nullglob
migration_files=("${MIGRATIONS_DIR}"/*.sql)
shopt -u nullglob

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No migration files found in ${MIGRATIONS_DIR}." >&2
  exit 1
fi

archive_dir="${LEGACY_ROOT}/${BASELINE_VERSION}"
mkdir -p "${archive_dir}"

echo "[1/4] Archiving existing migrations to ${archive_dir}"
for file in "${migration_files[@]}"; do
  mv "${file}" "${archive_dir}/"
done

baseline_file="${MIGRATIONS_DIR}/${BASELINE_VERSION}_baseline_public_schema.sql"
grant_version=$(printf "%014d" "$((10#${BASELINE_VERSION} + 1))")
grant_file="${MIGRATIONS_DIR}/${grant_version}_grant_app_schema_to_service_role.sql"
seed_version=$(printf "%014d" "$((10#${BASELINE_VERSION} + 2))")
seed_file="${MIGRATIONS_DIR}/${seed_version}_seed_event_message_types.sql"

echo "[2/4] Writing baseline migration ${baseline_file}"
{
  echo "-- Baseline migration generated from supabase/schema.sql."
  echo "-- Created by scripts/rebaseline-supabase-migrations.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")."
  echo "-- This file intentionally mirrors the live public schema snapshot."
  echo
  cat "${SCHEMA_FILE}"
} > "${baseline_file}"

echo "[3/4] Writing app-schema grant migration ${grant_file}"
cat > "${grant_file}" <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'app') THEN
    GRANT USAGE ON SCHEMA app TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO service_role;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA app TO service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA app
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA app
      GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA app
      GRANT EXECUTE ON FUNCTIONS TO service_role;
  END IF;
END
$$;
SQL

echo "[4/4] Writing event-message seed migration ${seed_file}"
cat > "${seed_file}" <<'SQL'
insert into public.event_message_types (code, label, sort_order)
values
  ('volunteer_confirmation', 'Volunteer confirmation', 40),
  ('volunteer_removed', 'Volunteer removed', 50),
  ('volunteer_reminder', 'Volunteer reminder', 60)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order;
SQL

cat > "${archive_dir}/README.txt" <<TXT
These migrations were archived by scripts/rebaseline-supabase-migrations.sh.

Why:
- The old chain was not replayable from zero, which blocked 'supabase db pull' and 'supabase db reset'.
- The new baseline migration mirrors supabase/schema.sql.
- The grant migration and event-message seed migration were recreated as post-baseline follow-ups.

Next:
1. Review the new files in supabase/migrations.
2. Run scripts/repair-supabase-migration-history-after-rebaseline.sh ${archive_dir}
3. Verify with:
   npx supabase migration list --linked
   npx supabase db reset
TXT

echo
echo "Done."
echo "Archived old migrations: ${archive_dir}"
echo "New baseline migration: ${baseline_file}"
echo "New grant migration: ${grant_file}"
echo "New seed migration: ${seed_file}"
echo
echo "Next run:"
echo "  ${ROOT_DIR}/scripts/repair-supabase-migration-history-after-rebaseline.sh ${archive_dir}"
