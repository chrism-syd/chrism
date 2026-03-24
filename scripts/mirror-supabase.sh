#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${1:-${PROJECT_REF:-}}"
SCHEMA="${SUPABASE_SCHEMA:-public}"
MIGRATION_NAME="${MIGRATION_NAME:-live_schema_sync}"
ROOT_DIR="${ROOT_DIR:-$(pwd)}"

if [[ -z "$PROJECT_REF" ]]; then
  echo "Missing PROJECT_REF."
  echo "Usage: PROJECT_REF=abcdefghijklmnopqrst ./scripts/mirror-supabase.sh"
  echo "   or: ./scripts/mirror-supabase.sh abcdefghijklmnopqrst"
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required. Install Node.js first."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required because Supabase CLI uses containers for db pull/db dump."
  exit 1
fi

cd "$ROOT_DIR"
mkdir -p supabase/reference

if [[ ! -d supabase ]]; then
  echo "No ./supabase directory found in $ROOT_DIR"
  echo "Run this from your repo root, or set ROOT_DIR=/path/to/repo"
  exit 1
fi

echo "[1/4] Linking local repo to Supabase project $PROJECT_REF"
npx supabase link --project-ref "$PROJECT_REF"

echo "[2/4] Pulling remote schema into a migration"
npx supabase db pull "$MIGRATION_NAME" --linked --schema "$SCHEMA" --yes

echo "[3/4] Dumping schema snapshot to supabase/schema.sql"
npx supabase db dump --linked --schema "$SCHEMA" -f supabase/schema.sql

echo "[4/4] Generating database types to database.types.ts"
npx supabase gen types typescript --project-id "$PROJECT_REF" --schema "$SCHEMA" > database.types.ts

cat <<DONE

Mirror complete.

Updated artifacts:
  - supabase/migrations/*.sql
  - supabase/schema.sql
  - database.types.ts

Suggested next commands:
  git status
  git add supabase/migrations supabase/schema.sql database.types.ts
  git commit -m "Mirror live Supabase schema"
DONE
