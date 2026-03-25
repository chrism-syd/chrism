#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="."
ARCHIVE_DIR="${1:-}"

usage() {
  echo "Usage: $0 [archive-dir]"
  echo
  echo "Example:"
  echo "  $0 ./supabase/migrations_legacy/20260324193000"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${ARCHIVE_DIR}" ]]; then
  latest_archive=$(find "${ROOT_DIR}/supabase/migrations_legacy" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1 || true)
  if [[ -z "${latest_archive}" ]]; then
    echo "Could not find a migrations archive dir under supabase/migrations_legacy. Pass it explicitly." >&2
    exit 1
  fi
  ARCHIVE_DIR="${latest_archive}"
fi

if [[ ! -d "${ARCHIVE_DIR}" ]]; then
  echo "Archive dir not found: ${ARCHIVE_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/supabase/migrations" ]]; then
  echo "Missing ${ROOT_DIR}/supabase/migrations" >&2
  exit 1
fi

mapfile -t legacy_versions < <(find "${ARCHIVE_DIR}" -maxdepth 1 -type f -name '*.sql' -print \
  | xargs -I{} basename "{}" \
  | sed -E 's/^([0-9]{14})_.*/\1/' \
  | sort)

mapfile -t current_versions < <(find "${ROOT_DIR}/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print \
  | xargs -I{} basename "{}" \
  | sed -E 's/^([0-9]{14})_.*/\1/' \
  | sort)

if [[ ${#legacy_versions[@]} -eq 0 ]]; then
  echo "No legacy migration files found in ${ARCHIVE_DIR}" >&2
  exit 1
fi

if [[ ${#current_versions[@]} -eq 0 ]]; then
  echo "No current migration files found in ${ROOT_DIR}/supabase/migrations" >&2
  exit 1
fi

echo "[1/2] Marking archived migration versions as reverted in remote history"
for version in "${legacy_versions[@]}"; do
  echo "  reverting ${version}"
  npx supabase migration repair "${version}" --status reverted --linked
done

echo "[2/2] Marking new baseline migration versions as applied in remote history"
for version in "${current_versions[@]}"; do
  echo "  applying ${version}"
  npx supabase migration repair "${version}" --status applied --linked
done

echo
echo "Done."
echo "Verify with:"
echo "  npx supabase migration list --linked"
echo "  npx supabase db reset"
