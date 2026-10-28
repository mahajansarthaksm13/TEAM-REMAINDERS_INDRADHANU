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
