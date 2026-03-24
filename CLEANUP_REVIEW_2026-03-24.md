# Chrism cleanup review

Date: 2026-03-24

## What was cleaned

### Repo hygiene
- removed `__MACOSX/` archive junk
- removed `.DS_Store` files
- removed nested `Archive.zip`
- removed `supabase/.temp/` local CLI state
- removed `tsconfig.tsbuildinfo`
- removed empty `src/` directory that only contained Finder junk

### Dead or duplicate files removed
- `app/components/super-admin-actions.ts`
- `app/components/super-admin-actions.tsx`
- `app/me/profile-contact-section.tsx`
- `app/custom-lists/create-custom-list-card.tsx`

### Code fixes
- fixed `app/app-header.tsx` to match the current `UserMenu` API by passing a real `links` array
- fixed `app/custom-lists/page.tsx` to use the current `MembersList` component API instead of stale props
- removed two unused destructures in `app/custom-lists/actions.ts`
- tightened ignore rules in `.gitignore`
- added explicit ignore coverage in `eslint.config.mjs` for archive junk and Supabase temp files

## Validation
- `./node_modules/.bin/tsc --noEmit` ✅
- `./node_modules/.bin/eslint app lib scripts types next.config.ts postcss.config.mjs proxy.ts eslint.config.mjs` ✅
- `npm run build` could not be completed in this environment because Next tried to download SWC from npm and the container blocks that registry call

## Notes on scope
No schema migrations or runtime behavior changes were made in this cleanup pass. This was a stabilization and hygiene pass aimed at:
- removing junk and stale files
- fixing type drift between shared components and pages
- getting static validation clean again

## Recommended next work after cleanup
1. design and stage the safer encryption pattern before real member imports
   - encrypted value columns for PII
   - normalized hash columns for exact-match search and duplicate detection
2. do the database relationship and dependency hardening pass
   - foreign keys
   - uniqueness rules
   - transaction-wrapped import/apply flows
3. harden the Supreme import review/apply workflow
4. add validation and confirmation around member-submitted profile/contact changes
