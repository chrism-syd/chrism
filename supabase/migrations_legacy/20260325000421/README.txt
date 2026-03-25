These migrations were archived by scripts/rebaseline-supabase-migrations.sh.

Why:
- The old chain was not replayable from zero, which blocked 'supabase db pull' and 'supabase db reset'.
- The new baseline migration mirrors supabase/schema.sql.
- The grant migration and event-message seed migration were recreated as post-baseline follow-ups.

Next:
1. Review the new files in supabase/migrations.
2. Run scripts/repair-supabase-migration-history-after-rebaseline.sh ./supabase/migrations_legacy/20260325000421
3. Verify with:
   npx supabase migration list --linked
   npx supabase db reset
