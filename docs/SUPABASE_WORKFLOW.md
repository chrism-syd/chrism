# Supabase workflow

This document captures the working Supabase process for Chrism.

It is meant to prevent future confusion around migrations, generated types, schema mirrors, and migration history repairs.

## Core rule

Database history and Git history should stay aligned.

When the schema changes, the repo should clearly show:

- the migration that made the change
- any related application code
- regenerated types when needed
- any schema snapshot or reference artifact that was intentionally updated

Do not rely on memory or dashboard-only changes.

## Normal migration workflow

For ordinary schema changes:

1. Create a new migration in `supabase/migrations/`.
2. Apply it to the linked project intentionally.
3. Update application code that depends on the schema.
4. Regenerate types if the app needs updated TypeScript definitions.
5. Commit the migration and related code together when practical.

Use clear migration names. A future maintainer should understand why a migration exists from its filename and SQL body.

## When to use `db push`

Use `supabase db push` when local migrations are the intended source of truth and need to be applied to the linked remote project.

Use this for normal forward migrations.

Before pushing:

- confirm the target Supabase project is correct
- inspect the migration SQL
- ensure the migration is safe for existing data
- commit or prepare to commit the migration with related code

Avoid pushing experimental or dashboard-derived SQL that has not been reviewed.

## When to use `db pull`

Use `supabase db pull` when the remote schema has changes that need to be mirrored back into local migrations.

This is useful after intentional dashboard changes or when reconciling drift.

Be careful: `db pull` depends on migration history being coherent. If the local migration chain is not replayable or remote history does not match local files, pull workflows can become confusing.

## Mirror workflow

The repo includes `scripts/mirror-supabase.sh` to mirror the live Supabase schema into local artifacts.

The script does four things:

1. links the repo to the Supabase project
2. pulls the remote schema into a migration
3. dumps a readable schema snapshot to `supabase/schema.sql`
4. generates TypeScript database types to `database.types.ts`

Usage pattern:

```bash
PROJECT_REF=your-project-ref ./scripts/mirror-supabase.sh
```

or:

```bash
./scripts/mirror-supabase.sh your-project-ref
```

The script expects Node/npm tooling and Docker because the Supabase CLI uses containers for some database operations.

After running it, inspect:

```bash
git status
```

Then commit the intended outputs:

```bash
git add supabase/migrations supabase/schema.sql database.types.ts
git commit -m "Mirror live Supabase schema"
```

## Generated types

`database.types.ts` should match the current schema that the app expects.

Regenerate it after schema changes that affect application queries, inserts, updates, or RPC calls.

The mirror script handles this, but it can also be generated directly with the Supabase CLI when needed.

## Schema snapshots

`supabase/schema.sql` is a human-readable live schema snapshot.

Keep it when it helps review or reconcile schema state.

Do not treat it as a replacement for migrations. Migrations remain the chronological change history.

## Migration history repair

The repo includes repair/rebaseline scripts because the migration chain previously became difficult to replay from zero.

Relevant files:

- `scripts/README-rebaseline-supabase-migrations.md`
- `scripts/rebaseline-supabase-migrations.sh`
- `scripts/repair-supabase-migration-history-after-rebaseline.sh`

Use these only when normal migration history is broken and the team deliberately chooses to rebaseline.

Do not casually rebaseline because it is convenient. Rebaseline work changes how future maintainers understand schema history.

## Rebaseline purpose

A rebaseline is appropriate when:

- old migrations cannot replay cleanly from an empty database
- the remote schema is known to be the correct current truth
- preserving every historical migration as active replay history is less useful than restoring a clean baseline
- the old migrations are archived rather than silently deleted

The previous rebaseline process:

1. dumped the live public schema
2. archived existing migrations
3. created a new baseline migration
4. recreated required post-baseline migrations/seeds
5. repaired remote migration history so Supabase knew which versions were applied or reverted
6. verified the migration chain with `supabase migration list --linked` and `supabase db reset`

## Repair scripts warning

Migration repair updates migration history. It does not re-run old SQL against the remote database.

Use repair only when you understand the current remote state and the intended local migration state.

Before running repair scripts:

- back up important data if needed
- confirm the linked project
- inspect the scripts
- understand which migration versions will be marked reverted or applied

## Verification checklist

After migration or repair work:

```bash
npx supabase migration list --linked
npx supabase db reset
npm run typecheck
npm run verify
```

Use the commands that fit the situation. The important idea is to verify both database replay and application expectations.

## Environment caution

Always confirm the linked Supabase project before applying changes.

A migration pointed at the wrong environment can create a very boring kind of disaster, which is the worst kind because it has no cinematic soundtrack.

## Dashboard changes

Dashboard changes are sometimes practical, but they should not remain invisible.

If a schema change is made in the dashboard:

1. mirror or pull it back into the repo
2. inspect the generated migration
3. update generated types if needed
4. commit the result

The repository should catch up quickly after any intentional dashboard change.

## Application code and migrations

When app code depends on new schema, keep the sequence safe:

1. add migration
2. deploy/apply migration
3. update generated types
4. ship code that uses the new schema

For destructive changes, add compatibility first and remove old structures only after a deliberate cutover.

## Legacy migration principle

Chrism is still carrying compatibility bridges from council-shaped data toward organization-first architecture.

Do not drop old columns, tables, helper functions, or policies simply because new structures exist.

Retire legacy database structures only after:

- application routes no longer read them
- server actions no longer write them
- database helper functions no longer depend on them
- RLS policies no longer rely on them
- equivalent organization-native truth is populated and tested
- a regression pass confirms core flows still work

## What future helpers should remember

- Migrations are product history, not just SQL files.
- Generated types are part of the app contract.
- Schema snapshots are useful mirrors, not substitutes for migrations.
- Rebaseline work should be rare and deliberate.
- GitHub issues should track future database cleanup.
- When uncertain, inspect the current schema and helper functions before removing legacy structures.
