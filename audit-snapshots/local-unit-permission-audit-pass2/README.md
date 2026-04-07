Local unit permission audit pass 2

This branch captures the exact checkpoint produced during the council_id to local_unit_id permission audit.

The GitHub connector available in this session can create new files and branches, but it cannot overwrite existing tracked files in-place. Because of that, this checkpoint is stored as a self-contained snapshot bundle on this branch instead of directly modifying the working tree.

Contents:
- replacements.bundle.base64 contains a base64-encoded zip archive of the patched replacement files.
- The zip archive includes these repo paths:
  - app/page.tsx
  - app/custom-lists/page.tsx
  - app/custom-lists/actions.ts
  - lib/auth/acting-context.ts
  - lib/auth/parallel-access-summary.ts
  - lib/custom-lists.ts
  - README_AUDIT_PASS_2.txt

Restore locally:
1. Decode audit-snapshots/local-unit-permission-audit-pass2/replacements.bundle.base64 into a zip file.
2. Unzip it.
3. Copy the extracted files into the repo root, preserving paths.

Intent:
This snapshot is meant to be a clean checkpoint before the deeper lib/auth/permissions.ts refactor.
