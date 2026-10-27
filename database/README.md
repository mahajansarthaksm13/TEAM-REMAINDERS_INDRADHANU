# `database/` — VeriBin backend

Everything that lives **inside Supabase**: schema, ledger rules, ingest, roles and
Row-Level Security, realtime channels, checkpoints and verification.

Owner: **Durgesh** (`@DurgeshGatkal`). Reviewer for anything in here: Durgesh.

The dividing line in this repo: *Durgesh owns everything inside Supabase; Yash owns
everything that talks to Supabase from outside.*

---

## The one rule

> **Every database change is a migration file. Nobody edits tables in the dashboard.**

Not locally, not in `veribin-dev`, not in `veribin-prod`. If a table needs a column,
you write a migration, commit it, and let CI apply it. A change made by hand in the
Supabase Studio is a change that is invisible to the repo, missing from the other two
environments, and impossible for anyone to review.

This applies to the seed file too: seed data is code, not a manual insert.

---

## Prerequisites

- **Docker Desktop** — required for local Supabase. Must be running before `supabase start`.
- **Supabase CLI** — no global install needed, use `npx`:
  ```bash
  npx supabase --version
  ```
  Pin the version in CI. Locally, `2.122.0` is what this was initialised with.

---

## Commands

Run these from **`database/`**, not from the repo root.

```bash
# Start the local stack (Postgres :54322, API :54321, Studio :54323, Inbucket :54324)
npx supabase start

# Stop it
npx supabase stop

# Apply every migration from scratch + seed.sql, then start clean
npx supabase db reset

# Create a new migration (timestamped, applied in order)
npx supabase migration new <snake_case_name>

# Push committed migrations to the linked remote project (dev or prod)
npx supabase db push

# Link this folder to a remote project (once per machine)
npx supabase link --project-ref <project-ref>

# Generate TypeScript types for the web app (commit the output in the same PR)
npx supabase gen types typescript --local > ../web/src/lib/database.types.ts
```

Local connection string: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

---

## Layout

```
database/
└── supabase/
    ├── config.toml          Local stack configuration (committed)
    ├── migrations/          Ordered .sql migrations — the only way to change the schema
    ├── seed.sql             Seed data loaded by `db reset` (companies, products, bins, targets)
    ├── functions/           Edge Functions (Deno/TypeScript) — e.g. ingest
    └── tests/               Database tests, run by `npx supabase test db`
```

`supabase/.temp/` and `supabase/.branches/` are git-ignored. Never commit them.

---

## Migration conventions

- One migration per logical change. Name it after the change: `core_schema`,
  `append_only_ledger`, `rls_policies`.
- Migrations are **append-only once merged**. Never edit a migration that is already
  on `main`; write a new one to correct it.
- Every migration must apply cleanly from an empty database. `npx supabase db reset`
  is the test.
- Schema changes and the regenerated TypeScript types go in the **same pull request**.
- Destructive changes (dropping a column or table) need a review from Sarthak if the
  web app reads it, and from Yash if the AI job reads it.

---

## Environment notes

- Times are stored as `timestamptz` (UTC inside). Everything shown to a user is IST.
- Financial year is **April–March**.
- Weights are **whole grams** (`integer`). Never floats.
- The ledger (`scans`) is append-only at the database level. Corrections are new
  entries, never edits.

See [`docs/CONTRACTS.md`](../docs/CONTRACTS.md) for the signed scan format, identifiers,
table list, function names and channel names. That document is the source of truth;
this README only explains how to work in this folder.
