#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ZIP_NAME="$PROJECT_DIR/../Chrism.zip"

find "$PROJECT_DIR" -name ".DS_Store" -delete

COPYFILE_DISABLE=1 zip -r "$ZIP_NAME" "$PROJECT_DIR" \
  -x "*.DS_Store" \
  -x "__MACOSX/*" \
  -x "*/.env.local" \
  -x "*/node_modules/*" \
  -x "*/.next/*" \
  -x "*/.git/*" \
  -x "*/.vscode/*" \
  -x "*/supabase/.temp/*" \
  -x "*/Archive.zip" \
  -x "*/Archive 2.zip"

echo "Created $ZIP_NAME"