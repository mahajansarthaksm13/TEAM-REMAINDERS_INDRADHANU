# Continuous Integration (CI) Guide

This document describes the automated pull request checks configured in `.github/workflows/` and how to run each check locally before pushing.

---

## 1. Overview of Workflows

| Workflow | Trigger Paths | What it Tests | Reviewer |
|---|---|---|---|
| **`ci-web`** | `web/**` | Node 20 LTS: `npm ci`, ESLint, `tsc --noEmit`, Next.js build | Sarthak |
| **`ci-database`** | `database/**` | Supabase CLI: `supabase start`, `db reset` (migrations from scratch), `test db` | Durgesh |
| **`ci-ai`** | `ai/**`, `simulator/**`, `data/**`, `ruff.toml`, `pytest.ini` | Python 3.12: `ruff check .`, `pytest`, `validate_mock.py` | Durgesh |

Every workflow:
- Pins external GitHub Actions to their major release tags (`v4`, `v5`, `v1`).
- Restricts security permissions to read-only (`permissions: contents: read`).
- Defines concurrency cancellation so pushing new commits automatically cancels previous runs on the same branch.

---

## 2. Running Checks Locally

### A. AI, Simulator, and Data Checks (`ci-ai`)
Run from the repository root inside your Python virtual environment:
```bash
# 1. Run linter
ruff check .

# 2. Run unit tests
pytest

# 3. Validate mock dataset
python data/validate_mock.py
```

### B. Web App Checks (`ci-web`)
Run from inside the `web/` directory:
```bash
cd web

# 1. Install dependencies
npm ci

# 2. Run ESLint
npm run lint

# 3. TypeScript type check
npx tsc --noEmit

# 4. Next.js production build
npm run build
```

### C. Database Checks (`ci-database`)
Requires Docker and Supabase CLI installed. Run from inside `database/`:
```bash
cd database

# 1. Start local Supabase
supabase start

# 2. Reset and apply all migrations
supabase db reset

# 3. Run database tests
supabase test db

# 4. Stop local Supabase
supabase stop
```

---

## 3. Deploy to production (`deploy-prod`, Y19)

`deploy-prod` is **manual only**: Actions → deploy-prod → Run workflow. It runs in the `production` environment. Give that environment a required reviewer, so every prod deploy is approved by a second person.

Steps:
1. Fails at once, naming each missing secret, if any production secret is not set.
2. `supabase link` to the prod project, then `supabase db push`.
3. `supabase functions deploy ingest heartbeat`.
4. `ops/smoke_test.py`: one signed scan from the prod **demo** bin, plus checks that a checkpoint exists, that `verify_report` answers, and (when `PROD_WEB_URL` is set) that `/` and `/simulator` load.

The smoke test refuses to send anything from a bin that is not flagged `is_demo`.

**First deploy only:** tick `first_deploy`. That pushes the seed (the demo bin and demo catalogue) and skips the checkpoint check, because the first checkpoint is made at 00:05 IST. Never tick it again: the seed would try to insert the same rows twice.

Secrets on the `production` environment:

| Secret | Used for |
|---|---|
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD` | link, db push, functions deploy |
| `SUPABASE_PROD_URL`, `SUPABASE_PROD_PUBLISHABLE_KEY`, `SUPABASE_PROD_SERVICE_ROLE_KEY` | smoke test |
| `DEMO_BIN_PRIVATE_KEY` | smoke test (the same value Vercel uses) |

Optional repository variable: `PROD_WEB_URL`.

Run the smoke test locally against any stack:
```bash
PYTHONPATH=simulator:ops SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... DEMO_BIN_PRIVATE_KEY=... python ops/smoke_test.py
```
