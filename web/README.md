# `web/` — VeriBin website and dashboard

Next.js 16 (App Router) · Tailwind v4 · shadcn/ui (Radix) · `@supabase/ssr` · recharts · pdf-lib · qrcode.
Design: *Moss Ledger* (`docs` design brief). Owner: Sarthak.

## Run locally

1. Start the backend from `database/`: `npx supabase start` (Docker must be running).
2. `cp .env.example .env.local` and fill it from `npx supabase status -o env`
   (`API_URL`, `PUBLISHABLE_KEY`, `SERVICE_ROLE_KEY`).
3. Create the test logins (repo root, after the seed):
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TEST_USER_PASSWORD=... python database/scripts/create_test_users.py`
   Logins: `company1@veribin.test` … `company3@`, `auditor@` (assigned to company 1), `regulator@`, `admin@`.
4. Put some signed scans in the ledger with the simulator (`simulator/`), then let checkpoints run
   (or `select public.make_checkpoint('<day>')` locally).
5. `npm install` then `npm run dev` → http://localhost:3000

The folder path on Windows may contain `&`, which breaks npm's `.bin` shims, so the scripts call Node directly.

## Where things come from

| Screen | Backend |
|---|---|
| Login, roles | Supabase Auth + `profiles` (A6) |
| Live Data | `get_kpis_by_category`, `get_monthly_trend` (optional `p_company_id`), `get_bin_list`, `scans`; realtime `company:<id>` private channel (A8) |
| Scans, scan detail | `scans` + `products`, `bins`, `scan_flags`; Ed25519 checked in the browser (A9) |
| AI Insights | `insights`, `forecasts`, `targets`, `bin_scores` (A13) |
| Reports | `get_report_snapshot` → `create_report` → PDF → service-role upload → `attach_report_pdf` (A14) |
| `/verify/<report_id>` | `verify_report` with the publishable key; 20 sample signatures re-checked in the browser (A15) |
| Bins, Targets, Catalogue, QR | `get_bin_list`, `verify_chain`, `bin_scores`, `products`, `issue_qr_codes` + `qr_codes` paged by `batch_id` (A11) |
| Alerts bell | `alerts`; companies and admins close them (A12) |
| How it works simulator | `/api/demo/scan` signs with `DEMO_BIN_PRIVATE_KEY` and posts to the ingest Edge Function; page listens on private `demo` (A16) |
| Live Data (public), Checkpoints | `get_public_stats`, `checkpoints` (anon) |

Regenerate types after any migration: `npx supabase gen types typescript --local > ../web/lib/database.types.ts` (from `database/`).

## Checks

`npm run lint` · `npm run typecheck` · `npm run build` — the same three CI runs (`ci-web`).
