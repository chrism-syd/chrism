# Mirror live Supabase schema into the repo

## Get your project ref
Use any one of these:

1. Dashboard URL
   - Open your Supabase project in the browser.
   - The URL looks like:
     - `https://supabase.com/dashboard/project/<project-ref>`
   - The `<project-ref>` part is the value you want.

2. Project settings
   - In Supabase Studio, go to:
     - `Settings > General > Project Settings > Reference ID`

3. CLI
   - Run:
     - `npx supabase projects list`
   - Pick the project ref for the project you want.

## One-time setup
```bash
npx supabase login
```

## Run the mirror script
From your repo root:

```bash
PROJECT_REF=abcdefghijklmnopqrst ./scripts/mirror-supabase.sh
```

Or pass it as the first argument:

```bash
./scripts/mirror-supabase.sh abcdefghijklmnopqrst
```

## Optional knobs
Default schema is `public`.

```bash
SUPABASE_SCHEMA=public ./scripts/mirror-supabase.sh abcdefghijklmnopqrst
```

Default migration name is `live_schema_sync`.

```bash
MIGRATION_NAME=remote_schema_sync ./scripts/mirror-supabase.sh abcdefghijklmnopqrst
```

## What it updates
- links the repo to the remote Supabase project
- pulls the remote schema into a migration file
- dumps the live schema to `supabase/schema.sql`
- regenerates `database.types.ts`

## Notes
- Docker must be running.
- Run this from the repo root.
- If your repo has an empty `supabase/migrations` directory, Supabase may ignore `--schema` on the first `db pull`. In that case, run one plain `npx supabase db pull` first, then rerun the script.
