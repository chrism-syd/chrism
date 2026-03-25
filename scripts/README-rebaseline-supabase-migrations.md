# Rebaseline Supabase migrations so `db pull` works again

This bundle fixes the underlying problem that blocked `supabase db pull` in the repo: the existing migration chain is not replayable from zero.

Why this approach:
- Supabase applies migrations sequentially when you run `supabase db reset`, and replay failures usually mean later migrations depend on objects that are missing from earlier ones. citeturn211631search2
- `supabase migration list` compares local files to the remote history table by timestamp only, and `migration repair` is the supported way to rewrite remote migration history without re-running SQL. citeturn211631search0turn211631search5
- Supabase also has `migration squash`, but its docs warn that data manipulation statements are omitted from a squashed schema migration. That is why this rebaseline keeps the known event-message seed as a separate post-baseline migration. citeturn211631search0

## What the scripts do

### `scripts/rebaseline-supabase-migrations.sh`
This script:

1. archives every existing file in `supabase/migrations/`
2. creates a new baseline migration from `supabase/schema.sql`
3. recreates the `grant_app_schema_to_service_role` migration as a post-baseline file
4. recreates the `event_message_types` seed as a post-baseline file

It expects that you already generated a fresh schema snapshot with:

```bash
npx supabase db dump --linked --schema public -f supabase/schema.sql
```

### `scripts/repair-supabase-migration-history-after-rebaseline.sh`
This script:

1. marks the archived migration versions as `reverted` in the remote history table
2. marks the new baseline/grant/seed versions as `applied`

This updates migration history only. It does not re-run the SQL against the remote database. citeturn211631search5turn211631search0

## Recommended execution order

From the repo root:

```bash
chmod +x scripts/rebaseline-supabase-migrations.sh
chmod +x scripts/repair-supabase-migration-history-after-rebaseline.sh

./scripts/rebaseline-supabase-migrations.sh .
./scripts/repair-supabase-migration-history-after-rebaseline.sh
```

Then verify:

```bash
npx supabase migration list --linked
npx supabase db reset
```

If `db reset` succeeds, the migration chain is replayable again. That is the real proof that the baseline fix worked. citeturn211631search2

## After verification

Once `db reset` passes, rerun your mirror flow. `db pull` should stop tripping over the missing-base-schema issue because the repo now has a replayable migration chain. `db dump` and `gen types` remain your live-schema mirrors either way. citeturn211631search3turn211631search1

## What to commit

Commit:
- the new files in `supabase/migrations/`
- the archive directory under `supabase/migrations_legacy/`
- the two scripts

Do not delete `supabase/schema.sql`. It remains the human-readable live schema snapshot.
