# VeriBin Fix Plan (November 2026)

Team REMAINDERS · applies to `main` as of commit `e9791de`

This plan fixes every error found in the full review of 3 November 2026 and gets the project back on the task sheet. It is written so that a person **or an AI coding agent** can follow it without guessing. Each member has a section with numbered steps. Every step says which files to change, what to run, and how to know it worked.

The corrected files come in `veribin-fix-package.zip`, laid out exactly like the repo. "Copy from the package" means: take the file at the same path inside the zip and put it at that path in the repo, replacing what is there.

---

## 0. Rules for whoever does the work (human or agent)

1. **Work on a branch, never on `main`.** Branch names are given in each section.
2. **Run the check before you push.** Every step ends with a "Done when". If that check does not pass on your own machine, do not push.
3. **Do not change files outside your section** unless the step says so. If something outside your area looks wrong, write it in the PR description instead.
4. **Do not invent replacements.** If a step says "copy from the package", copy it exactly. Do not rewrite it in your own style or "improve" it in the same PR.
5. **Never put a secret in git.** That includes private keys, passwords, API keys and connection strings. They go in the password manager, GitHub Actions secrets, or Vercel environment variables only.
6. **Never return success without checking.** No placeholder that says ✓, `true`, `OK` or "100%" unless the code actually computed it.

### What has already been verified

The package was tested on a real Postgres 16 before it was handed over:

| Check | Result |
|---|---|
| All 15 migrations applied from an empty database, then `seed.sql` | all applied, no errors |
| Database tests (existing 29 + new 38) | 67 / 67 pass |
| Simulator output → `ingest_scan` → `verify_chain` | 24 accepted, replay rejected as `duplicate_sequence`, chain OK |
| Nightly AI job against that database | scores, flags and alerts written |
| Planted fraud found by flags | 22 of 23 (the miss is the first scan of a burst, which has no earlier scan to compare with) |
| One weight edited directly in the database | `verify_chain` names that scan; the AI job stops with a `chain_break` alert |
| Report verify, untouched vs. altered | ✓ match vs. ✗ mismatch |
| `ruff check .`, `pytest`, `validate_mock.py` | all pass |

---

## 1. Order of work and merging

| Order | Who | Branch | Depends on |
|---|---|---|---|
| 1 | Sarthak | (settings only) | nothing |
| 2 | Yash | `ci/fix-workflows` | 1 |
| 3 | Yash | `sim/fix-keys-and-seed-inputs` | nothing |
| 4 | Durgesh | `be/fix-database` | 2 and 3 merged |
| 5 | Yash | `sim/fix-simulator` | 4 merged |
| 6 | Yash | `ai/fix-pipeline` | 4 merged |
| 7 | Sarthak | `docs/contract-v1.0` | 4 merged |
| 8 | Yash + Durgesh | (dev deploy) | 4, 5 merged and the dev project exists |
| 9 | Sarthak | `web/A1-scaffold` and onwards | can start right away (mock data) |

Each PR is merged only when CI is green and one other member has approved it after **running it locally**, not just reading it.

---

## 2. Sarthak Mahajan (repo owner, web)

### S1. Turn on the guardrails (GitHub settings, no code)

1. In the repo, go to **Settings → Rules → Rulesets**, choose **New branch ruleset** and name it `protect-main`.
2. Set **Enforcement status** to *Active* and **Target branches** to *Include default branch*.
3. Tick these rules:
   - *Restrict deletions*
   - *Block force pushes*
   - *Require a pull request before merging*, with *Required approvals* set to 1
   - *Require status checks to pass*, with *Require branches to be up to date before merging* ticked. Add these check names: `Migrations from scratch + database tests`, `Ruff, pytest, mock data check`, `Lint, type-check, build`. They only show up in the search box after each workflow has run once, so come back and add them after Yash's step Y1.
4. Leave the **Bypass list empty**. Nobody, including you, can push straight to `main`.
5. In **Settings → General → Pull Requests**, allow only *squash merging* and tick *Automatically delete head branches*.

**Done when:** pushing a commit straight to `main` from any account is refused.

### S2. Create the cloud projects

1. In Supabase, create two projects named `veribin-dev` and `veribin-prod`. Choose region **Mumbai (ap-south-1)**.
2. For each project:
   - Go to **Settings → Realtime** and turn **OFF** "Allow public access". Every channel is private (D9).
   - Go to **Authentication → Sign In / Providers** and turn **OFF** "Allow new users to sign up". Email login stays on.
3. Invite Durgesh and Yash to the Supabase organization.
4. In Vercel, import the GitHub repo, set **Root Directory** to `web`, and leave the framework on auto-detect.
5. Store both database passwords, both project refs and the service role keys in the shared password manager.

**Done when:** both projects exist with Realtime public access off and sign-ups off, and teammates can open them.

### S3. GitHub Actions secrets

Go to **Settings → Secrets and variables → Actions** and add these:

| Secret | Value comes from |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | your Supabase account → Access Tokens |
| `SUPABASE_DEV_PROJECT_REF` | the dev project's ref (the id in its URL) |
| `SUPABASE_DEV_DB_PASSWORD` | the dev database password |
| `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD` | the same for prod |
| `INGEST_URL_DEV` | `https://<dev-ref>.supabase.co/functions/v1/ingest` |
| `TEST_BIN_PRIVATE_KEY` | Yash, from `simulator/keys/VB-PUN-0900.key` |
| `TEST_QR_SERIAL` | printed by `build_seed.py` (Durgesh step D4) |
| `AI_DATABASE_URL` | Durgesh step D8 |
| `GEMINI_API_KEY` | Yash |
| `GEMINI_MODEL` | Yash: an exact model id currently listed in Google AI Studio |
| `CHECKPOINT_REPO_TOKEN` | Yash, step Y17 |

### S4. Update the contract (branch `docs/contract-v1.0`, after Durgesh's PR is merged)

Edit `docs/CONTRACTS.md`:

1. Change the title to `VeriBin Contracts (v1.0, signed)`. Replace the sign-off line with the three names and the date, once all three agree.
2. **§6 Ingest:** replace the weight DECISION sentence with this text:

   > `weight_g = 0` means the bin has no load cell: the scan is accepted and `weight_ok` is null. `weight_g` above 5000 is rejected with `weight_out_of_range`. A measured weight more than max(3 g, 30%) away from the catalogue weight is accepted with `weight_ok = false`; reports exclude it and the AI flags it. All totals use the catalogue weight (`products.unit_weight_g`), never the measured weight.

3. **§7 Tables:** add these columns.
   - `scans.weight_ok` and `bins.allow_backfill`
   - On `reports`: `scan_count`, `qr_kg`, `barcode_kg`, `under_review_count`, `checkpoint_hash`, `pdf_sha256`, `created_by`
4. **§8 Read functions:** replace the list with this one.

   ```text
   get_kpis_by_category(p_from date, p_to date)
       -> category, collected_kg, scan_count, target_kg, gap_kg, progress_pct
   get_monthly_trend(p_from date, p_to date)  -> month, category, collected_kg, scan_count
   get_bin_list()  -> bin_id, company_id, city, status, last_seen, last_sequence,
                      trust_score, trust_reasons, score_day, open_alerts, is_demo
   get_public_stats()  (anon)  -> total_kg, total_scans, active_bins, cities, by_category
   issue_qr_codes(p_product_id uuid, p_quantity int)  -> qr_serial, qr_payload
   get_report_snapshot(p_category, p_from, p_to)       (company users, preview)
   create_report(p_category, p_from, p_to)             -> the new reports row
   attach_report_pdf(p_report_id, p_storage_path, p_pdf_sha256)
   verify_report(p_report_id uuid)  (anon)             -> jsonb
   verify_chain(p_bin_id text)  -> ok, scans_checked, failing_scan, reason
   make_checkpoint(p_day date default yesterday IST)   (service role, cron 00:05 IST)
   ```

5. **§9 Realtime:** say that *both* `company:<id>` and `demo` are private channels. Clients join with `{ config: { private: true } }`. The website demo page joins `demo` with the publishable (anon) key.
6. **New §11 Checkpoint format:** copy the header comment of `database/supabase/migrations/20261029151347_daily_checkpoint.sql`, which defines `heads`, `payload` and `hash`. Auditors need it to recompute a checkpoint themselves.
7. **New §12 Report fingerprint:** copy the "includes exactly the scans that" list and the fingerprint rule from the header of `20261101082822_report_storage_verify.sql`.
8. **Visibility:** bins and bin scores are visible per company (same rule as scans), not to every logged-in user.

**Done when:** all three have approved the PR.

### S5. Web work (A1 onwards)

Start A1–A5 now on Yash's mock CSVs. The task sheet's instructions still hold, with these changes for when you connect to the real backend:

| Task | What changed |
|---|---|
| A6 | Roles come from `profiles.role`. Test logins are `company1@veribin.test`, `company2@…`, `company3@…`, `auditor@…`, `regulator@…`, `admin@…`; the password is in the password manager. |
| A7 | Call the §8 functions with `supabase.rpc('get_kpis_by_category', { p_from, p_to })`. Values are already in kg. |
| A8 | `supabase.channel('company:' + companyId, { config: { private: true } }).on('broadcast', { event: 'scan' }, …).subscribe()`. Call `supabase.realtime.setAuth()` with the user's access token before subscribing. |
| A9 | "Verify in browser": the scan row has `record_text` and `signature`, and the bin has `public_key` (all base64). Use WebCrypto `crypto.subtle.verify({ name: 'Ed25519' }, …)`; fall back to the `@noble/ed25519` package where the browser lacks Ed25519. |
| A11 | New products get their code from the database (leave `product_code` empty). They always start as not approved. Only an admin can approve. `issue_qr_codes` returns `qr_serial` and `qr_payload`; print `qr_payload` as the QR. |
| A12 | Companies can close their own alerts: `update alerts set closed_at = now()`. |
| A13 | Trust score is null until the AI has scored a bin; show "Not enough data". The detector accuracy card reads `insights` where `kind = 'detector_accuracy'`. |
| A14 | Use the `create_report` → render PDF → sha256 → upload with the service role to `reports/<company_id>/<report_id>.pdf` → `attach_report_pdf` flow. Never compute the fingerprint in the web app. |
| A15 | `/verify/<report_id>` calls `verify_report` with the anon key. Show ✓ only when the response has `match: true`. Re-check each of the 20 sample signatures in the browser. |
| A16 | The demo bin is `VB-PUN-9999-DEMO`. The server route signs with the demo private key (server-only environment variable). The page joins the private `demo` channel with the anon key. |

---

## 3. Durgesh Gatkal (database)

Branch: `be/fix-database`. Start only after Yash's Y1 (CI) and Y2 (keys and seed inputs) are merged.

### D1. Replace the broken migrations

None of these migrations have ever been applied to a real Supabase project, so replacing the files is safe.

1. **Copy from the package**, overwriting the existing files:

   ```text
   database/supabase/migrations/20261027105329_auth_roles.sql
   database/supabase/migrations/20261027105413_rls_policies.sql
   database/supabase/migrations/20261027105706_realtime_channels.sql
   database/supabase/migrations/20261028143145_dashboard_read_functions.sql
   database/supabase/migrations/20261028145532_qr_issuing.sql
   database/supabase/migrations/20261029151059_ai_role.sql
   database/supabase/migrations/20261029151347_daily_checkpoint.sql
   database/supabase/migrations/20261029151529_chain_verification.sql
   database/supabase/migrations/20261101082822_report_storage_verify.sql
   ```

2. **Copy from the package** (new files):

   ```text
   database/supabase/migrations/20261025120000_ingest_fixes.sql    (4 D5 bugs + is_demo)
   database/supabase/migrations/20261103000000_alerts_heartbeat.sql (D12)
   ```

3. **Delete** these two files:

   ```text
   database/supabase/migrations/20261101143511_demo_bin.sql
   database/supabase/migrations/20261101145533_production_security.sql
   ```

   Demo data now comes from the seed. The D18 file's claim of "100% tamper detection" was never measured, so it must go.

4. **Do not edit** the four original files `20261025110635`, `20261025110807`, `20261025112131` and `20261025113756`. The fixes for them live in `20261025120000_ingest_fixes.sql`.

### D2. Tests

1. **Copy from the package**, overwriting:

   ```text
   database/supabase/tests/append_only_ledger.test.sql
   database/supabase/tests/ingest_scan.test.sql
   ```

   The only change is the fixture names (`VB-PUN-000x` → `VB-TST-000x`, `P0007/P0008` → `P8007/P8008`). The seed now contains `VB-PUN-0001` and `P0007`, and the old names collided with it.

2. **Copy from the package** (new): `database/supabase/tests/security_and_trust.test.sql` (38 tests).

### D3. Edge Functions and config

1. **Copy from the package:** `database/supabase/functions/ingest/index.ts`. The only change: broadcasts are sent with `private: true`, and demo-bin scans go to the `demo` topic.
2. **Copy from the package** (new): `database/supabase/functions/heartbeat/index.ts`.
3. In `database/supabase/config.toml`:
   - Under `[auth]`, set `enable_signup = false`.
   - Under `[auth.email]`, set `enable_signup = false`.
   - Add this at the end:

     ```toml
     [functions.heartbeat]
     # A bin cannot log in. Identity is the Ed25519 signature, checked in the function.
     verify_jwt = false
     ```

### D4. Seed (task D4, which is finally unblocked)

1. **Copy from the package** (new): `database/scripts/build_seed.py` and `database/scripts/create_test_users.py`.
2. Make sure Yash's step Y2 is merged. `data/bin_public_keys.csv` must contain `VB-PUN-0900` and `VB-PUN-9999-DEMO`.
3. Run from the repo root:

   ```bash
   python database/scripts/build_seed.py
   ```

   It writes `database/supabase/seed.sql` and prints `TEST_BARCODE=…` and `TEST_QR_SERIAL=…`. Put the serial in the password manager and give it to Sarthak for the `TEST_QR_SERIAL` secret. If it prints `MISSING public keys`, stop and ask Yash.
4. Commit the generated `seed.sql`. Never edit it by hand; re-run the script instead.

### D5. Check everything locally

Run from `database/`:

```bash
npx supabase start
npx supabase db reset          # all migrations + seed, from scratch
npx supabase test db           # must print: All tests successful. Files=3, Tests=67
```

Then create the test users and check one login works:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<from `npx supabase status`> \
TEST_USER_PASSWORD=<choose one, store in password manager> \
python ../database/scripts/create_test_users.py
```

**Done when:** `db reset` gives no errors, 67 tests pass, and `create_test_users.py` prints 6 users. Open the PR with that output pasted in it. Yash reviews it.

### D6. Regenerate TypeScript types for the web app (same PR)

```bash
npx supabase gen types typescript --local > ../web/src/lib/database.types.ts
```

If `web/` does not exist yet, skip this. Sarthak runs it after A1.

### D7. First deploy to dev (together with Yash, after the PR is merged)

Run from `database/`:

```bash
npx supabase link --project-ref <dev-ref>
npx supabase db push --include-seed          # first time ONLY: includes the seed
npx supabase functions deploy ingest heartbeat
SUPABASE_URL=https://<dev-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<dev service key> \
TEST_USER_PASSWORD=<password manager> python ../database/scripts/create_test_users.py
```

After this first time, the `deploy-dev` workflow pushes new migrations by itself. Do not use `--include-seed` again: it would try to insert the same rows twice.

**Done when:** in the dev dashboard, `select count(*) from bins` returns 10, and the 2 cron jobs appear under **Integrations → Cron**.

### D8. AI login for the nightly job (dev, then prod)

In the dev project's SQL editor, run this. The password comes from the password manager, and this statement never goes in git:

```sql
create role ai_job login password '<new strong password>' in role ai_job_role;
```

Then build the connection string from **Connect → Session pooler** and replace the user with `ai_job.<project-ref>`:

```text
postgresql://ai_job.<dev-ref>:<password>@<pooler-host>:5432/postgres
```

Store it as `AI_DATABASE_URL`. It has to be the pooler string, because GitHub runners cannot reach the direct (IPv6-only) address.

**Done when:** Yash's manual run of `nightly-ai` connects and prints `loaded … scans`.

### D9. Production (task D18, in the final week)

1. Run the `deploy-prod` workflow (Yash builds it in Y19). For the first time, do `db push --include-seed` by hand **without** the dev-only parts: in prod, remove the QR batches and test bins from the seed, or use a prod seed with only real companies.
2. In prod, set `allow_backfill = false` on every bin.
3. Go through the security checklist and tick each item in the PR:
   - Run Supabase **Advisors → Security** and fix every error.
   - Make sure no service role key appears in the web build (search `.next` for `service_role`).
   - Run `git log -p | grep -i "private"`; it must find no key material.
   - Turn on MFA for admin accounts.
   - Confirm the `reports` bucket is private.

---

## 4. Yash Vaidya (CI, simulator, AI)

### Y1. Fix CI (branch `ci/fix-workflows`, first PR of all)

1. **Copy from the package**, replacing what is there:

   ```text
   .github/workflows/ci-database.yml
   .github/workflows/ci-ai.yml
   .github/workflows/ci-web.yml
   .github/workflows/deploy-dev.yml
   ```

2. **Copy from the package** (new): `.github/workflows/nightly-ai.yml`.
3. **Delete** `.github/workflows/ai-job.yml`. It only ran `pytest`; `nightly-ai.yml` replaces it.
4. **Copy from the package:** `ruff.toml`. It adds `extend-exclude = ["*.ipynb"]`, so the notebook is not linted.

What changed and why:

- The old files used `steps:check-…`, which is invalid. The correct form is `steps.check-…`. That bug meant the checks never actually ran.
- The checks now run on every PR, so they can be marked required.
- The CLI version is pinned to `2.122.0` instead of `latest`.
- `deploy-dev` now really links the dev project, pushes migrations, deploys both functions and runs the live ingest tests.

**Done when:** the PR shows all three checks. `ci-database` and `ci-web` will show as skipped (nothing in their folders changed), which counts as passed. Then ask Sarthak to add them as required checks (step S1).

### Y2. Keys and seed inputs (branch `sim/fix-keys-and-seed-inputs`)

1. **Remove the committed private key and the stray run output from git:**

   ```bash
   git rm simulator/veribin_sim/sim_state.json data/sim_labels.csv
   ```

   Add `simulator/veribin_sim/sim_state.json` to `.gitignore` (`simulator/state/` and `simulator/keys/` are already there). That key was public, so never use it again.
2. Generate the missing keys:

   ```bash
   PYTHONPATH=simulator python simulator/keygen.py --bin-id VB-PUN-9999-DEMO
   ```

   If `simulator/keys/VB-PUN-0900.key` is not on your machine, regenerate it with `--force` and update the `TEST_BIN_PRIVATE_KEY` secret. Commit the updated `data/bin_public_keys.csv`, which contains public keys only.
3. Put the contents of `simulator/keys/VB-PUN-9999-DEMO.key` in the password manager. Sarthak needs it as a server-only Vercel variable (A16).
4. **Fix the mock data** in `data/generate_mock.py`, then regenerate:
   - Product ids must be real UUIDs. `p0000001-0000-…` is not a UUID, because `p` is not a hex digit. Use the same pattern as the company ids, for example `e0000001-0000-4000-8000-000000000001`, and update every reference in `scans.csv`.
   - `bins.csv` must not contain `PLACEHOLDER`. Fill `public_key` with the key that actually signed that bin's mock scans, and add a check in `validate_mock.py` that every mock signature verifies (today 0 of 2000 do).

   ```bash
   python data/generate_mock.py && python data/validate_mock.py
   ```

**Done when:** `validate_mock.py` passes, including the new signature check, and `git ls-files | grep -E "sim_state|\.key$"` prints nothing.

### Y3. Simulator (branch `sim/fix-simulator`, after Durgesh's PR is merged)

1. **Copy from the package:** `simulator/veribin_sim/cli.py`. It replaces the old one, which used a 5-field format, sent hex signatures, used the wrong JSON field names and the bin id `BIN-001`.
2. **Delete** `simulator/tests/test_ingest.py`. It never contacted the server, so it proved nothing.
3. **Copy from the package** (new): `simulator/tests/test_ingest_live.py`, the 10 real ingest cases.
4. Check against your local Supabase (Durgesh's branch with `npx supabase start` and `npx supabase functions serve`):

   ```bash
   export INGEST_URL=http://127.0.0.1:54321/functions/v1/ingest
   PYTHONPATH=simulator python -m veribin_sim.cli --bin VB-PUN-0001 --mode live --count 5 --delay 1
   PYTHONPATH=simulator python -m veribin_sim.cli --bin VB-PUN-0001 --mode fraud
   TEST_BIN_PRIVATE_KEY=$(cat simulator/keys/VB-PUN-0900.key) TEST_QR_SERIAL=<from build_seed.py> \
     pytest simulator/tests/test_ingest_live.py -v
   ```

**Done when:** live mode prints `accepted` for each scan; fraud mode prints `accepted` everywhere except one `duplicate_sequence` (the replay); and all 10 live tests pass.

### Y4. AI pipeline (branch `ai/fix-pipeline`, after Durgesh's PR is merged)

1. **Delete** these files:

   ```text
   ai/veribin_ai/features.py      (it counted fraud using the answer labels)
   ai/tests/test_features.py
   ai/tests/test_integrity.py
   ```

2. **Copy from the package**, replacing or adding:

   ```text
   ai/requirements.txt              (google-genai, not google-generativeai)
   ai/veribin_ai/db.py              new: reads/writes with the ai_job login
   ai/veribin_ai/scoring.py         new: measures + trust score, ported from the Y4 notebook
   ai/veribin_ai/integrity.py       base64 keys, uses verify_chain
   ai/veribin_ai/trends.py          insight cards + FY forecast with low/high range
   ai/veribin_ai/narration.py       google-genai, rejects invented numbers, template fallback
   ai/veribin_ai/run.py             new: the single nightly entry point
   ai/veribin_ai/evaluation.py      compares flags with simulator labels
   ai/tests/test_scoring.py
   ai/tests/test_narration.py
   ai/tests/test_trends.py
   ai/tests/test_evaluation.py
   ```

3. Keep `ai/veribin_ai/thresholds.json` and the Y4 notebook unchanged. `scoring.py` reads the thresholds file.
4. Check locally:

   ```bash
   pip install -r ai/requirements.txt
   ruff check . && pytest
   # against local Supabase, after creating the ai_job login as in Durgesh D8 (use your local db):
   AI_DATABASE_URL=postgresql://ai_job:<pw>@127.0.0.1:54322/postgres PYTHONPATH=ai python -m veribin_ai.run
   PYTHONPATH=ai python -m veribin_ai.evaluation simulator/state/labels.csv
   ```

**Done when:** `pytest` reports 60 passed and 10 skipped (the skips are the live tests without `INGEST_URL`); `run` prints `scored N bins…`; `evaluation` prints caught and missed counts per fraud type.

### Y5. Remaining tasks (Y17–Y19), same as the task sheet, with these exact details

- **Y17, publish checkpoints.** Create the public repo `veribin-checkpoints` and a fine-grained token with *Contents: write* on that repo only (`CHECKPOINT_REPO_TOKEN`). Add a workflow at `30 18 * * *` (00:30 IST, after the 00:05 checkpoint). It reads `select day, hash, previous_hash from checkpoints order by day desc limit 1` using `AI_DATABASE_URL`, writes `checkpoints/<day>.json`, and commits it to that repo.
- **Y18, tamper demo.** Use `alter table public.scans disable trigger scans_no_update_delete;`, change one `weight_g`, enable the trigger again, then run `select * from verify_chain('<bin>')`. It must name that scan with `columns_differ_from_signed_text`. Only do this on a throwaway demo bin in dev, then delete that bin's data by resetting dev (`supabase db reset --linked` is destructive: agree with the team first).
- **Y19, deploy-prod.** Copy `deploy-dev.yml`, trigger it with `workflow_dispatch` only, use the `SUPABASE_PROD_*` secrets, and replace the test suite with a smoke test (one simulator scan to a prod test bin, expecting `accepted`).

---

## 5. Final end-to-end check (all three, every Friday)

Run this on dev. Every line must pass before the week counts as done.

| # | Check | Pass when |
|---|---|---|
| 1 | `deploy-dev` workflow on the latest `main` | green |
| 2 | Simulator `--mode live --count 20` on `VB-PUN-0001` | 20 × accepted |
| 3 | Dashboard (company1 login) | the 20 scans appear live within ~1 s |
| 4 | Simulator `--mode fraud`, then run `nightly-ai` manually | `VB-PUN-0001` gets a low trust score and an anomaly alert |
| 5 | company2 login | sees none of company1's data |
| 6 | auditor login | sees company1 only |
| 7 | Next day: report for company1 | downloads; its QR opened on a phone shows ✓ Match |
| 8 | `veribin-checkpoints` repo | has yesterday's file |
| 9 | Stop the simulator for 40 minutes | exactly one `bin_offline` alert appears |

---

## 6. Common mistakes to avoid

- **Editing a migration after it has been pushed to dev.** From now on, any change is a *new* migration file. The "replace" in Durgesh's D1 is allowed only because none of those files ever reached a real project.
- **Running `db push --include-seed` twice.** The second run fails on duplicate rows.
- **Calling `ingest_scan` or `make_checkpoint` from the web app.** Those are service-role only. The web app uses the §8 functions.
- **Putting `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable.** Anything `NEXT_PUBLIC_` is visible to every visitor.
- **Using `latest` for any version** (CLI, Gemini model, npm packages). Always pin.
- **Marking a task done before it is merged with green CI.**
