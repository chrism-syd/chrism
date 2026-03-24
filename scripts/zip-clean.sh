#!/bin/bash
set -e

PROJECT_DIR="."
ZIP_NAME="../Chrism.zip"

find "$PROJECT_DIR" -name ".DS_Store" -delete

COPYFILE_DISABLE=1 zip -r "$ZIP_NAME" "$PROJECT_DIR" \
  -x "*.DS_Store" \
  -x "__MACOSX/*" \
  -x "*/node_modules/*" \
  -x "*/.next/*" \
  -x "*/.git/*" \
  -x "*/.vscode/*" \
  -x "*/supabase/.temp/*" \
  -x "*/Archive.zip" \
  -x "*/Archive 2.zip"

echo "Created $ZIP_NAME"