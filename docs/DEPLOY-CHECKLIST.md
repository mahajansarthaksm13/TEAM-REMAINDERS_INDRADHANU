# Deploy checklist

What must be in place before deploying, and in what order. Nothing here deploys anything by itself. Values never go in git; only the names are listed.

The code is ready:
- CI builds the database from an empty state and runs every database test: `ci-database`, "Migrations from scratch + database tests".
- `next build` passes, including page pre-rendering.

The risks are missing settings, listed below.

## 1. Supabase project (Durgesh)
1. Create the project. Then link and push once **with the seed**, which creates the companies, bins (including the demo bin `VB-PUN-9999-DEMO`) and QR codes:
   ```bash
   cd database
   npx supabase link --project-ref <ref>
   npx supabase db push --include-seed   # first time only; never again
   ```
2. Deploy the Edge Functions: `npx supabase functions deploy ingest heartbeat`. `config.toml` already sets `verify_jwt = false`, because bins sign their records instead of logging in.
3. Check that the demo bin's `public_key` in `bins` matches the key whose private half becomes `DEMO_BIN_PRIVATE_KEY`. If they don't match, every simulator deposit is rejected with `bad_signature`.
4. Later migrations reach dev automatically. On every merge to `main` that touches `database/**`, the `deploy-dev` workflow runs `db push`, deploys the functions and runs the live ingest tests.

## 2. Web app (Vercel, root directory `web`)
Set these in the Vercel project settings. Never prefix the server-only ones with `NEXT_PUBLIC_`.

| Variable | Where it is used | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | every page | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | every page, the realtime feed | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | admin invites, report PDFs, the Manage page (emails), the simulator | yes (server only) |
| `DEMO_BIN_PRIVATE_KEY` | the simulator signs approved demo deposits | yes for `/simulator` (server only) |
| `DEMO_BIN_ID` | the demo bin id | no, default `VB-PUN-9999-DEMO` |
| `INGEST_URL` | where demo deposits are sent | no, default `${SUPABASE_URL}/functions/v1/ingest` |
| `NEXT_PUBLIC_CHECKPOINTS_REPO` | "View on GitHub" links | yes, for example `owner/veribin-checkpoints` |
| `NEXT_PUBLIC_SAMPLE_REPORT_ID` | "Verify a sample report" links | no |

Without the service key or the demo key, the simulator page shows "isn't set up" instead of breaking, and the other pages still work.

**Rate limit.** The simulator routes (`/api/sim/*`) are public. Their rate limit is held in each server process's memory, so on Vercel add a firewall rate-limit rule for `/api/sim/` (Spec B9).

## 3. GitHub Actions secrets (Yash)
| Secret / variable | Workflow |
|---|---|
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD` | `deploy-dev` |
| `INGEST_URL_DEV`, `TEST_BIN_PRIVATE_KEY`, `TEST_QR_SERIAL` | `deploy-dev` (live ingest tests) |
| `AI_DATABASE_URL` | `nightly-ai`, `publish-checkpoint` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | `nightly-ai` (optional: templates are used without them) |
| `CHECKPOINT_REPO_TOKEN` and the repository variable `CHECKPOINT_REPO` | `publish-checkpoint` |

Until these are set, each workflow **skips** with a notice instead of failing.

## 4. Smoke test after deploying
- `/` shows the live ledger panel with numbers, not the example record.
- `/simulator`: "Run complete deposit" ends in **Deposit verified and counted**, and the live feed shows it without a refresh.
- `/checkpoints` lists checkpoints after the first night (00:05 IST).
- Logging in as each role reaches its dashboard; `/app/admin` is admin only.
- `/verify/<report id>` shows **Match** for a generated report.

## Production deploys (Y19)
Production is deployed from the **deploy-prod** workflow (Actions → deploy-prod → Run workflow), in the `production` environment.
- On the first run, tick `first_deploy`. That replaces the manual seed push in step 1.
- Each run ends with `ops/smoke_test.py`, which covers the database half of section 4 automatically.
- Secrets and details: `docs/CI.md`, section 3.

## Not built yet (open issue)
- **Y18 (#19):** the tamper demo, end-to-end and load-test scripts were never built. The website's Simulation Studio covers the judge-facing part of the demo.
