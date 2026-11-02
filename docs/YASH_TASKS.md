# VeriBin: Yash's Tasks (Y2 to Y19), agent instructions

Team REMAINDERS · PCCoE International Grand Challenge 2026 · Owner of this file: Yash Vaidya (GitHub: Yashvaidya142)

This file tells a coding agent exactly what to build for Member C (simulator, AI layer, automation). Read the whole of sections 1 to 4 before starting any task. Then do **one task at a time**, in the order given in section 5.

---

## 1. Rules for the agent (read first)

1. **Scope.** Only create or edit files in `simulator/`, `ai/`, `data/`, `docs/`, `ops/`, `.github/workflows/`, `.github/scripts/` and the repo-root files named below (`ruff.toml`, `pytest.ini`). **Never edit `web/` or `database/`**, except task Y16, which adds one migration and one test file under `database/` (Durgesh reviews it).
2. **Do not do the GitHub setup.** Yash does these by hand. Do not attempt them, and do not call `gh` to do them:
   - creating issues, labels, the project board
   - branch protection, required checks, merge settings, environments
   - repository or Actions **secrets** and variables
   - creating the `veribin-checkpoints` repo and its token
   - collaborator invites, CODEOWNERS, PR and issue templates (already done in Y1)
   - Gemini API key, Supabase and Vercel accounts
   When a task needs one of these, finish the code and put a line under **"Yash must do by hand"** at the end of your reply.
3. **Git.** For each task: `git checkout main && git pull`, then `git checkout -b <branch>` (branch name is given per task). Commit with the message `[<ID>] <short text>`. **Do not push, do not open PRs, do not merge.** Stop and tell Yash the branch is ready. Never commit to `main`.
4. **Secrets.** Never write a real key, password, token or connection string into any file, log or chat. Read secrets only from environment variables (names in section 3). Private keys live in `simulator/keys/` which is git-ignored. Never print a private key.
5. **Contract is law.** `docs/CONTRACTS.md` defines record format, hashing, IDs, table and column names, reason codes and channel names. Use exact names. If something is missing or contradictory, do not invent: write the question under **"Open questions"** in your reply and pick the simplest option, clearly marked in code with `# DECISION:`.
6. **Evidence is never changed by AI.** Nothing in `ai/` may write to `scans`. The model never does arithmetic (see Y13).
7. **Quality bar for every task:** type hints, docstrings on public functions, `ruff check` clean, `pytest` green, no network calls in unit tests, deterministic (seeded) randomness, a short README section for anything a teammate runs.
8. **Report format** at the end of every task: files created, commands run with results, the task's "Done when" check (pass or fail), open questions, "Yash must do by hand".

---

## 2. Project context (short)

VeriBin is the evidence layer under India's EPR (Extended Producer Responsibility) plastic reporting. A smart bin scans a packet's QR or barcode, weighs it, signs a record with its Ed25519 key and sends it to a cloud ingest function. The record is verified and stored in an append-only, hash-chained ledger in Supabase Postgres. A company dashboard shows scans live, an AI job analyses them read-only, and EPR-format evidence reports are generated from them.

Yash owns everything that talks to Supabase **from outside**: the bin simulator, the Python AI job, the mock data and the GitHub Actions workflows. Durgesh owns everything inside Supabase (`database/`). Sarthak owns the web app (`web/`).

### Team and handoffs

| Person | GitHub | Area |
|---|---|---|
| Yash | Yashvaidya142 | `simulator/`, `ai/`, `data/`, `.github/` |
| Durgesh | DurgeshGatkal | `database/` |
| Sarthak | mahajansarthaksm13 | `web/` |

Who waits on Yash: Y2 unblocks Sarthak A3 and Durgesh D4. Y5 unblocks Durgesh D4. Y11 to Y13 and Y15 unblock Sarthak A13. Y16 unblocks Sarthak A14 and Durgesh D16.

---

## 3. Shared conventions

### 3.1 Target repo layout (create what is missing, never move existing files)

```
.github/
  workflows/            ci-web.yml, ci-database.yml, ci-ai.yml, deploy-dev.yml,
                        deploy-prod.yml, nightly-ai.yml, publish-checkpoint.yml
  scripts/              publish_checkpoint.py
ai/
  veribin_ai/           __init__.py config.py load.py integrity.py features.py scoring.py
                        flags.py trends.py forecast.py narration.py save.py run.py evaluation.py
  notebooks/            Y4_scoring_prototype.ipynb
  tests/
  requirements.txt
data/
  generate_mock.py  validate_mock.py  README.md
  companies.csv products.csv bins.csv scans.csv scans_labels.csv rejected_scans.csv targets.csv
  bin_public_keys.csv                       (public keys only, safe to commit)
docs/
  CONTRACTS.md  REPORT-SPEC.md  TEST_VECTORS.md  E2E_CHECKLIST.md
ops/
  tamper_demo.py  e2e_check.py  load_test.py  smoke_test.py  load_bins.sql
simulator/
  veribin_sim/          __init__.py record.py keys.py client.py modes.py catalogue.py cli.py
  keygen.py  ingest_suite.py
  tests/
  requirements.txt
  keys/                 (git-ignored: private keys)
  state/                (git-ignored: per-bin sequence + chain state)
  labels/               (git-ignored: labels files written by the simulator)
ruff.toml
pytest.ini
```

`pytest.ini`:
```ini
[pytest]
pythonpath = ai simulator
testpaths = ai/tests simulator/tests
```
`ruff.toml`:
```toml
line-length = 100
target-version = "py312"
[lint]
select = ["E", "F", "I", "B", "UP"]
```
Python 3.12. Pin versions in the two `requirements.txt` files (generate them from a working venv with `pip freeze`, keep only direct dependencies).

### 3.2 Environment variables (names only, values are never in git)

| Name | Used by |
|---|---|
| `INGEST_URL` | simulator, ingest suite (dev or prod ingest Edge Function URL) |
| `AI_DATABASE_URL` | AI job, publish-checkpoint script (connection string of the AI database role) |
| `GEMINI_API_KEY` | narration (Y13) |
| `GEMINI_MODEL` | narration, pinned exact model id |
| `TEST_BIN_PRIVATE_KEY` | ingest suite (base64 of the 32 raw private key bytes of the CI test bin) |
| `TEST_BIN_ID` | ingest suite, default `VB-PUN-0900` |
| `TEST_REVOKED_BIN_KEY`, `TEST_BIN2_KEY` | ingest suite (see Y7) |
| `CHECKPOINT_REPO_TOKEN` | publish-checkpoint workflow |
| `TAMPER_DATABASE_URL` | tamper demo, dev only |
Local use: load from a git-ignored `.env` with `python-dotenv`. In CI they come from GitHub Actions secrets that Yash sets.

### 3.3 Contract essentials (restated so you can work offline; `docs/CONTRACTS.md` wins on any difference)

- Financial year April to March, time zone IST (`Asia/Kolkata`). Stored times are `timestamptz`. Weights are whole grams (`weight_g`).
- EPR categories (enum): `cat1_rigid`, `cat2_flexible`, `cat3_multilayer`, `cat4_compostable`.
- Bin ID `VB-<CITY3>-<NNNN>` (cities PUN, MUM, NAG). Product code `P` + 4 digits. QR payload `VBQ1.<product_code>.<32 hex>`. Barcode is 8 to 14 digits.
- **Record text (the signed line):** `v1|<bin_id>|<sequence>|<scanned_at>|<code_type>|<code>|<weight_g>`; `scanned_at` is `YYYY-MM-DDTHH:MM:SSZ` (UTC); `code_type` is `qr` or `barcode`; no spaces, no trailing newline.
- **Signature:** Ed25519 over the exact UTF-8 bytes of the record text, sent as standard base64.
- `record_hash` = SHA-256 of the record text bytes (lowercase hex). `chain_hash` = SHA-256 of the UTF-8 string `<prev_chain_hash>:<record_hash>` (lowercase hex). Genesis `prev_chain_hash` is 64 zeros.
- **Ingest API:** `POST INGEST_URL` with JSON `{"record": "<text>", "signature": "<base64>"}`. Success `200 {"status":"accepted","scan_id":"...","chain_hash":"..."}`. Rejection `4xx {"status":"rejected","reason":"<code>"}`. Reason codes: `bad_method`, `bad_format`, `unknown_bin`, `bin_inactive`, `bad_signature`, `time_too_far_future`, `time_too_old`, `duplicate_sequence`, `qr_already_used`, `qr_unknown`, `barcode_cooldown`, `unknown_product`, `weight_out_of_range`.
- Ingest rules: time window up to 5 minutes in the future and up to 7 days old (a dev-only backfill flag lifts the old limit); a barcode repeats only after a 30 second cooldown; a QR is redeemable once.
- Fraud types (labels): `burst_rescan`, `very_low_weight`, `wrong_category_weight`, `night_burst`, `replay`.

### 3.4 Contract amendment you must follow (Yash is applying it to `docs/CONTRACTS.md` in the Y1 PR)

The earlier draft said ingest rejects weights that are not within 30% of `unit_weight_g`. That would make it impossible for the bin to ever send a suspicious weight, and the AI could never see it. The amended rule:

- **Ingest hard limit:** reject `weight_out_of_range` only if `weight_g < 1` or `weight_g > 5000`.
- **AI soft rule:** a weight outside ±30% of the product's `unit_weight_g` is `WEIGHT_MISMATCH` (flag and trust-score penalty), never a rejection.
- "Weight OK" in the report snapshot (Y16) means within ±30% of `unit_weight_g`.

---

## 4. Order of work and dependencies

| Order | Task | Branch | Needs first | Unblocks |
|---|---|---|---|---|
| 1 | Y2 Mock dataset | `data/Y2-mock-dataset` | contract signed off | A3, D4, Y4 |
| 2 | Y5 Bin key generator | `sim/Y5-keygen` | contract (bin ID format) | D4, Y6, Y7 |
| 3 | Y3 PR check workflows | `ci/Y3-pr-checks` | none | required checks |
| 4 | Y4 Scoring prototype | `ai/Y4-prototype` | Y2 | Y9, Y11 |
| 5 | Y6 Bin simulator | `sim/Y6-simulator` | D6 live ingest (can start against a mock server) | A8, Y15 |
| 6 | Y7 Ingest test suite | `sim/Y7-ingest-tests` | D6, Y5, Y6 | Y8 |
| 7 | Y8 Deploy-to-dev workflow | `ci/Y8-deploy-dev` | Y7 | none |
| 8 | Y9 AI package | `ai/Y9-package` | D13 AI role | Y10 to Y13 |
| 9 | Y10 Integrity check | `ai/Y10-integrity` | D15 | none |
| 10 | Y11 Trust scores and flags | `ai/Y11-scoring-flags` | Y9 | A13 |
| 11 | Y12 Trends and forecast | `ai/Y12-trends-forecast` | Y9 | A13 |
| 12 | Y13 Gemini narration | `ai/Y13-narration` | Y12 | A13 |
| 13 | Y14 Nightly AI workflow | `ci/Y14-nightly-ai` | Y9 | none |
| 14 | Y15 Detector evaluation | `ai/Y15-evaluation` | Y6, Y11 | A13 |
| 15 | Y16 Report snapshot and spec | `ai/Y16-report-snapshot` | D8 helper functions | A14, D16 |
| 16 | Y17 Checkpoint publishing | `ci/Y17-publish-checkpoint` | D14 | none |
| 17 | Y18 Tamper demo, e2e, load | `ops/Y18-tamper-e2e` | everything | none |
| 18 | Y19 Deploy-to-prod workflow | `ci/Y19-deploy-prod` | Y8 | none |

If a dependency from a teammate is not ready, keep building against mock data or a local fake server and say so in your report.

**Y1** (repo setup files) is already done and in PR #1 except the GitHub project board, which Yash does by hand. Nothing in Y1 is left for you.

---

## 5. Tasks

### Y2: Mock dataset
**Branch** `data/Y2-mock-dataset` · **Needs first** signed-off contract · **Unblocks** A3 (Sarthak), D4 (Durgesh), Y4

**Goal.** A reproducible generator that writes the CSVs everybody builds against.

**Steps**
1. Create `data/generate_mock.py` (seed `42`, pure standard library plus `pandas` and `cryptography`). Include small self-contained helpers for record text, SHA-256 `record_hash` and `chain_hash`, exactly as in section 3.3. Sign records with throwaway in-memory Ed25519 keys (mock only, not the real bin keys); write the real signature base64 so the format is valid.
2. Generate:
   - `companies.csv`: 3 companies (columns per contract: `id,name,created_at,is_demo`).
   - `products.csv`: 15 products across all 4 categories (4 / 4 / 4 / 3). Columns: `id,company_id,product_code,name,barcode,category,unit_weight_g,approved,created_at`. Realistic packaging (water bottle 22 g, chip packet 6 g, shampoo sachet 3 g, carry bag 9 g, etc.). Barcodes are valid 13-digit EAN-13 with correct check digit. All `approved = true`.
   - `bins.csv`: 6 bins, 3 cities (PUN, MUM, NAG), 2 per city: `VB-PUN-0001`, `VB-PUN-0002`, `VB-MUM-0001`, `VB-MUM-0002`, `VB-NAG-0001`, `VB-NAG-0002`. Columns: `id,company_id,city,public_key,status,last_sequence,chain_head,last_seen,is_demo`. Leave `public_key` as `PLACEHOLDER` (real keys arrive from Y5 in `data/bin_public_keys.csv`).
   - `targets.csv`: per company, financial year `2026-27`, 4 categories, `target_kg` plausible for the volume generated.
   - `scans.csv`: about 2,000 rows over the 90 days before the generation date, all contract columns (`id,bin_id,company_id,product_id,category,sequence,scanned_at,received_at,code_type,code,weight_g,record_text,signature,record_hash,prev_chain_hash,chain_hash,insertion_order`). Per bin: sequence starts at 1 and has no gaps; `insertion_order` is a global increasing integer; chain hashes link per bin from the genesis 64 zeros.
   - `rejected_scans.csv`: about 60 rows (`id,bin_id,record_text,reason,received_at`) using real reason codes (mostly `barcode_cooldown`, a few `duplicate_sequence`, `qr_already_used`, `unknown_product`).
   - `scans_labels.csv`: `scan_id,is_suspicious,fraud_type`. One row per scan in `scans.csv`; `fraud_type` empty for normal scans.
3. Normal behaviour: daytime weighted (07:00 to 22:00 IST), weight = `unit_weight_g` × uniform(0.92, 1.08) rounded to whole grams, about 60% QR and 40% barcode, gaps between scans on one bin are minutes, not seconds.
4. **Exactly 50 suspicious scans** inside `scans.csv`, 10 per fraud type, concentrated on 2 to 3 "planted" bins (so those bins have clearly bad trust scores while the others stay clean):
   - `burst_rescan`: runs of 5 scans of different barcodes less than 3 seconds apart.
   - `very_low_weight`: weight is 1 to 4 g for products whose unit weight is at least 10 g.
   - `wrong_category_weight`: weight is 3× to 6× the product's unit weight (capped at 5000).
   - `night_burst`: runs of 5 scans between 01:00 and 04:00 IST within 2 minutes.
   - `replay`: scripted repeater, the identical barcode and weight scanned at an exact fixed 60 second interval.
5. Write `data/validate_mock.py` which asserts: row counts, exact column names against the contract table list, 15 products with all 4 categories, 6 bins in 3 cities, about 2,000 scans, exactly 50 `is_suspicious = true` with 10 of each fraud type, sequences gap-free per bin, chain hashes recompute correctly, no weight outside 1..5000, barcodes pass the check digit. Exit code 1 on any failure.
6. Write `data/README.md` describing each file and how to regenerate (`python data/generate_mock.py`).

**Verify:** `python data/generate_mock.py && python data/validate_mock.py` ends with `ALL CHECKS PASSED`; running generate twice gives byte-identical files.
**Done when:** Sarthak and Durgesh can load it without questions (column names exactly match the contract).
**PR title:** `[Y2] Mock dataset`

---

### Y5: Bin key generator
**Branch** `sim/Y5-keygen` · **Unblocks** D4 (Durgesh), Y6, Y7

**Steps**
1. Create `simulator/veribin_sim/record.py` (the canonical, shared helpers, used by Y6, Y7, Y10):
   - `build_record(bin_id, sequence, scanned_at, code_type, code, weight_g) -> str`
   - `sign_record(private_key, record_text) -> str` (base64)
   - `verify_record(public_key_b64, record_text, signature_b64) -> bool`
   - `record_hash(record_text) -> str`, `chain_hash(prev_chain_hash, record_hash) -> str`
   - `GENESIS = "0" * 64`
   Validate inputs against the contract formats and raise `ValueError` on bad input.
2. Create `simulator/veribin_sim/keys.py`: generate an Ed25519 pair; save the private key as the base64 of the 32 raw bytes in `simulator/keys/<bin_id>.key` (file mode restricted where the OS allows); return the public key as base64 of the 32 raw bytes; load helpers.
3. Create `simulator/keygen.py` CLI: `python simulator/keygen.py` generates keys for these bins and **refuses to overwrite an existing key unless `--force`**:
   - the 6 seed bins from Y2 (`VB-PUN-0001`, `VB-PUN-0002`, `VB-MUM-0001`, `VB-MUM-0002`, `VB-NAG-0001`, `VB-NAG-0002`)
   - the CI test bin `VB-PUN-0900`
   - `# DECISION:` two extra test bins for the Y7 suite, `VB-PUN-0901` (to be seeded as revoked) and `VB-PUN-0902` (a second active bin). Durgesh must seed these three test bins; mention this in the report.
   - options `--bin-id X` (single bin) and `--count N --prefix P` for the load-test bins in Y18.
4. The script prints a table `bin_id, public_key` and writes the **public keys only** to `data/bin_public_keys.csv` (`bin_id,public_key`), which is safe to commit. It also prints, for the CI test bin only, a reminder line (not the key) that `TEST_BIN_PRIVATE_KEY` must be stored as a secret by Yash.
5. Create `docs/TEST_VECTORS.md`: one fixed example (a fixed 32-byte seed written in hex, a record text, its base64 signature, `record_hash`, `chain_hash` with the genesis prev hash) generated by your code, so Durgesh's Edge Function (Deno or TypeScript) can verify the same bytes. Also add a test that recomputes these vectors.
6. Tests in `simulator/tests/test_record.py` and `test_keygen.py`: round trip sign and verify, tampered text fails, wrong key fails, hashes match the vectors, keygen refuses to overwrite, no private key ever appears in stdout.
7. Confirm `.gitignore` contains `simulator/keys/` and `simulator/state/`.

**Verify:** `pytest simulator` green; `git status` shows no `.key` files.
**Done when:** Durgesh has all public keys for the seed (`data/bin_public_keys.csv`).
**Yash must do by hand:** send the public keys to Durgesh; store the CI test bin private key (the file `simulator/keys/VB-PUN-0900.key`) as the GitHub secret `TEST_BIN_PRIVATE_KEY` (and the two extra test keys as secrets if the suite needs them); put every private key in the password manager.
**PR title:** `[Y5] Bin key generator and record helpers`

---

### Y3: PR check workflows
**Branch** `ci/Y3-pr-checks`

Create three workflows in `.github/workflows/`. Pin every action to a major version tag, set `permissions: contents: read`, and use a `concurrency` group so a new push cancels the old run.

1. `ci-web.yml`: trigger `pull_request` with `paths: ['web/**']`. Node 20 LTS, `working-directory: web`. Steps: checkout, setup-node with npm cache, `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` (with dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` style env values that are not secrets). If `web/package.json` does not exist yet, the job must pass with a clear "web app not created yet" message, not fail.
2. `ci-database.yml`: trigger `paths: ['database/**']`. Steps: checkout, `supabase/setup-cli@v1`, `supabase start` in `database/`, `supabase db reset` (applies all migrations from scratch), `supabase test db`, then `supabase stop`. Pass with a message if `database/supabase/config.toml` does not exist yet.
3. `ci-ai.yml`: trigger `paths: ['ai/**', 'simulator/**', 'data/**', 'ruff.toml', 'pytest.ini']`. Python 3.12 with pip cache, `pip install -r ai/requirements.txt -r simulator/requirements.txt ruff pytest`, `ruff check .`, `pytest`.
4. Add a short `docs/CI.md`: what each workflow does and how to run the same commands locally.

**Verify:** `ruff check .` and `pytest` pass locally; validate YAML (for example `python -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"`).
**Done when:** all three run on PRs and block merging on failure.
**Yash must do by hand:** mark the three checks as required in branch protection. **Note:** with path-filtered workflows, a required check that is skipped can leave a PR waiting forever; Yash should either make the checks always run (remove `paths` and add a first step that decides whether to do work) or not mark skipped ones required. If asked, implement the "always run, skip steps internally" variant.
**PR title:** `[Y3] PR check workflows`

---

### Y4: Scoring prototype
**Branch** `ai/Y4-prototype` · **Needs first** Y2

**Steps**
1. Create `ai/notebooks/Y4_scoring_prototype.ipynb` that loads the CSVs from `data/` (relative paths, runs top to bottom with "Restart and run all").
2. Compute **per-bin measures** over all scans (and rejected scans):
   - `rescan_share`: share of scans less than 3 s after the previous scan on the same bin
   - `weight_mismatch_share`: share with |weight_g − unit_weight_g| / unit_weight_g > 0.30
   - `very_low_weight_share`: share with weight_g < 0.20 × unit_weight_g
   - `odd_hours_share`: share between 00:00 and 05:00 IST
   - `barcode_share`: share of `code_type = barcode`
   - `rejection_rate`: rejected / (accepted + rejected)
3. **Trust score:** start at 100, subtract one penalty per measure, each with a reason code. Use `penalty = min(cap, slope × max(0, share − free_share) × 100)`. Starting values (to be tuned in step 4):

   | Reason code | Measure | free_share | slope | cap |
   |---|---|---|---|---|
   | `REPEAT_SCANS` | rescan_share | 0.02 | 2.5 | 35 |
   | `WEIGHT_MISMATCH` | weight_mismatch_share | 0.05 | 1.5 | 20 |
   | `VERY_LOW_WEIGHT` | very_low_weight_share | 0.01 | 3.0 | 25 |
   | `ODD_HOURS` | odd_hours_share | 0.05 | 1.0 | 15 |
   | `HIGH_BARCODE_SHARE` | barcode_share | 0.60 | 0.5 | 10 |
   | `HIGH_REJECTIONS` | rejection_rate | 0.05 | 1.5 | 15 |

   Score is clamped to 0..100. A bin with fewer than 20 scans gets `score = null` and the reason `NOT_ENOUGH_DATA`.
4. **Tune against the 50 labels:** compute scan-level flags using the same rules (gap < 3 s, weight < 20% of unit, mismatch > 30%, night 00:00 to 05:00 IST, fixed-interval repeater) and report caught, missed and false alarms per fraud type against `scans_labels.csv`. Adjust thresholds until the planted bins rank lowest with readable reasons and normal bins stay above 80.
5. Export the final values to `ai/veribin_ai/thresholds.json` (used later by Y9 and Y11) and add a markdown cell summarising the results.

**Done when:** planted bins rank lowest with readable reasons.
**PR title:** `[Y4] Scoring prototype notebook`

---

### Y6: Bin simulator
**Branch** `sim/Y6-simulator` · **Needs first** D6 live ingest (until then test against the fake server in step 7) · **Unblocks** A8 (Sarthak), Y15

**Steps**
1. `simulator/veribin_sim/catalogue.py`: load products from `data/products.csv` (columns per contract); helpers to pick a random product for a company and make a QR payload or barcode scan. QR serials come from `--qr-file` (a CSV of issued serials, optional); if absent, only barcode scans are generated and a warning is printed.
2. `simulator/veribin_sim/client.py`: `post_scan(ingest_url, record, signature) -> (status_code, json)` with timeout, retries only on network errors (never on a 4xx), and clear error messages.
3. State per bin in `simulator/state/<bin_id>.json`: `last_sequence`. Key from `simulator/keys/<bin_id>.key`.
4. Per scan: increment sequence, build the record text, sign, **save state**, then post. Never reuse a sequence number, even if the post failed or was rejected (a real bin would not).
5. `simulator/veribin_sim/modes.py` implements four modes, in this order of build:
   - **live:** a scan every few seconds (`--interval 3` default, with jitter), forever or `--count N`. Uses the current time.
   - **offline:** produce 20 signed records into a local queue file without posting, then flush them in order; the server must accept all 20 with correct chaining.
   - **fraud:** a mix of the five fraud types. `burst_rescan`: many different barcodes less than 2 s apart. `very_low_weight`: 1 to 4 g. `wrong_category_weight`: 3× to 6× unit weight (cap 5000). `night_burst`: timestamps between 01:00 and 04:00 IST on a night within the last 7 days (stays inside the ingest time window). `replay`: re-send an old signed record unchanged (expected to be rejected as `duplicate_sequence`). Every non-replay fraud scan must keep a valid signature.
   - **backfill:** `--days 90`, dev only (`--i-am-on-dev` flag required; refuse otherwise), generates historic scans with realistic daytime patterns. Needs the dev-only backfill flag on the server.
6. **Labels file:** every scan written to `simulator/labels/<run_id>.csv` with columns `run_id,bin_id,sequence,scanned_at,is_suspicious,fraud_type,outcome` (`outcome` = `accepted` or the rejection reason). This is what Y15 compares against.
7. CLI `simulator/veribin_sim/cli.py`: `python -m veribin_sim.cli live --bin VB-PUN-0001 --ingest-url $INGEST_URL`, same for `offline`, `fraud`, `backfill`; `--dry-run` prints signed records without posting. Include `--seed` for reproducibility.
8. Tests (no network): a tiny local `http.server` fake ingest in `simulator/tests/` that checks signatures and chaining; test every mode's output, sequence never repeats, labels file correct, dry-run posts nothing.
9. `simulator/README.md`: how to run each mode.

**Done when:** the dev database fills with chained scans in every mode.
**PR title:** `[Y6] Bin simulator`

---

### Y7: Ingest test suite
**Branch** `sim/Y7-ingest-tests` · **Needs first** D6, Y5, Y6

**Steps**
1. `simulator/ingest_suite.py`: runs these **10 cases** against `INGEST_URL`, prints a PASS or FAIL line per case with expected versus actual, and **exits non-zero if any result is unexpected**:
   1. valid scan (barcode) → `accepted`
   2. reused QR → first accepted, second `qr_already_used`
   3. tampered text (change the weight after signing) → `bad_signature`
   4. unknown bin → `unknown_bin`
   5. revoked bin (`VB-PUN-0901`) → `bin_inactive`
   6. replay of an accepted record → `duplicate_sequence`
   7. future time (more than 5 minutes ahead) → `time_too_far_future`
   8. same barcode twice within 30 s → second `barcode_cooldown`
   9. sequence gap (skip a number) → accepted; if `AI_DATABASE_URL` is set, also check that a `sequence_gap` alert was raised; otherwise just report that the alert check was skipped
   10. two bins at once (`VB-PUN-0900` and `VB-PUN-0902`, concurrent threads) → both accepted and each chain intact
2. Each run starts by reading the current last sequence for the test bin from its state file or, if absent, from a `--start-sequence` argument, and updates it as it goes so repeated runs work.
3. QR cases (2) need valid unredeemed QR serials: accept them via `--qr-file` or the env var `TEST_QR_SERIALS`. `# DECISION:` if none are supplied, fail that case with the message "needs QR serials from Durgesh's dev seed" rather than skipping silently. Mention this in the report.
4. Keys: `TEST_BIN_PRIVATE_KEY` for `VB-PUN-0900`, `TEST_REVOKED_BIN_KEY` for `VB-PUN-0901`, `TEST_BIN2_KEY` for `VB-PUN-0902`; fall back to files in `simulator/keys/` when run locally.
5. Unit-test the suite itself against the fake server from Y6 (a fake that returns the expected answers passes; a fake that returns a wrong reason makes the suite exit non-zero).

**Done when:** all 10 pass against dev.
**Yash must do by hand:** add the key secrets in GitHub Actions; ask Durgesh to seed the three test bins and test QR serials.
**PR title:** `[Y7] Ingest test suite`

---

### Y8: Deploy-to-dev workflow
**Branch** `ci/Y8-deploy-dev` · Reviewer Durgesh

Create `.github/workflows/deploy-dev.yml`:
1. Trigger: `push` to `main` with `paths: ['database/**']`, plus `workflow_dispatch`. `concurrency: deploy-dev` with `cancel-in-progress: false`.
2. Steps: checkout, `supabase/setup-cli@v1`, `supabase link --project-ref $SUPABASE_DEV_PROJECT_REF` (working directory `database`), `supabase db push` (uses `SUPABASE_DB_PASSWORD`), deploy every Edge Function (`supabase functions deploy <name>`; the ingest function must be deployed with `--no-verify-jwt` because bins sign instead of logging in; list the function names by reading `database/supabase/functions/`), then set up Python 3.12 and run `python simulator/ingest_suite.py` with `INGEST_URL` from `INGEST_URL_DEV` and the test keys.
3. Secrets used (Yash sets them): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `INGEST_URL_DEV`, `TEST_BIN_PRIVATE_KEY` and the two extra test keys. Map `SUPABASE_DEV_DB_PASSWORD` to the env name the CLI expects.
4. Fail the job if the suite fails.

**Done when:** a merged migration reaches dev automatically and tests run after it.
**PR title:** `[Y8] Deploy-to-dev workflow`

---

### Y9: AI package
**Branch** `ai/Y9-package` · **Needs first** D13 AI role

Create the package `ai/veribin_ai/` with these modules and one entry point `python -m veribin_ai.run` (run from `ai/`):

| Module | Responsibility |
|---|---|
| `config.py` | env vars, thresholds from `thresholds.json`, `--dry-run`, `--company` filters |
| `load.py` | `psycopg` read functions returning pandas DataFrames: scans, bins, products, targets, rejected_scans, daily_totals, checkpoints |
| `integrity.py` | Y10 |
| `features.py` | per-bin measures from Y4 |
| `scoring.py` | trust score with reason codes |
| `flags.py` | scan-level flags |
| `trends.py` | weekly totals and insight cards |
| `forecast.py` | shortfall forecast |
| `narration.py` | Y13 |
| `save.py` | writes only to `bin_scores`, `scan_flags`, `insights`, `forecasts`, `alerts` |

Rules: connect with `AI_DATABASE_URL` only; every write function is allowlisted to the five tables above and unit-tested to raise on any other table name; `run.py` runs the steps in order (integrity → features and scoring → flags → trends → forecast → narration → save), logs a one-line summary per step, exits non-zero on failure, and supports `--dry-run` (no writes). Write unit tests for `features` and `scoring` using small fixed DataFrames (including a bin with 19 scans → `NOT_ENOUGH_DATA`).

**Done when:** the package runs end to end on dev with the AI role.
**PR title:** `[Y9] AI package skeleton`

---

### Y10: Integrity check
**Branch** `ai/Y10-integrity` · **Needs first** D15

1. `integrity.py`: re-verify the Ed25519 signature of every scan since the last run, using each bin's public key (reuse `veribin_sim.record.verify_record`; if import paths are awkward, copy the small function into `ai/` with a test that both agree on `docs/TEST_VECTORS.md`).
2. Call Durgesh's `verify_chain(bin_id)` for every bin; collect the first failing scan and reason per bin.
3. On any break: write an alert of kind `chain_break` (no duplicate open alert for the same bin), and **stop the run with exit code 2** before any scoring.
4. "Since the last run": `# DECISION:` the AI role cannot write to arbitrary tables, so ask Durgesh for a small `ai_run_state` table (or use an `insights` row of kind `integrity_marker`). Until decided, verify the last 48 hours of scans every run and say so in the report.
5. Tests with fake DataFrames: a clean set passes, a one-byte edited record fails signature, a broken `verify_chain` result raises the alert and returns exit code 2.

**Done when:** a tampered test bin triggers the alert.
**PR title:** `[Y10] Integrity check`

---

### Y11: Trust scores and flags
**Branch** `ai/Y11-scoring-flags` · **Unblocks** A13

1. Compute 90-day measures per bin and **one trust score per bin per day**, with reasons, into `bin_scores` (`bin_id, day, score, reasons json, scans_considered`).
2. Score below 60 → alert of kind `anomaly` for that bin (no duplicate open alert).
3. Suspicious scans go to `scan_flags` (`scan_id, reason, severity`) with severity `low`, `medium` or `high`:
   - `REPEAT_SCANS`: scan less than 3 s after the previous one on the bin
   - `VERY_LOW_WEIGHT`: below 20% of unit weight (high)
   - `WEIGHT_MISMATCH`: outside ±30% of unit weight (medium; high above 3×)
   - `ODD_HOURS`: 00:00 to 05:00 IST (low; medium inside a burst)
   - `SCRIPTED_REPEAT`: same code and weight at a fixed interval, at least 5 times in a row (medium)
4. Idempotent: running twice for the same day does not duplicate rows (use upserts or check-then-insert). **The ledger is never touched.**
5. Tests: fixed DataFrames for each flag, idempotence, thresholds loaded from `thresholds.json`.

**Done when:** fraud-mode bins get low scores and flags in dev.
**PR title:** `[Y11] Trust scores and scan flags`

---

### Y12: Trends and forecast
**Branch** `ai/Y12-trends-forecast` · **Unblocks** A13

1. Weekly totals (kg) by company, category and city; week-over-week change.
2. **Top 3 to 5 insight cards per company**, ranked by absolute change, each with `kind`, **pre-formatted numbers as strings** (for example `"1,240 kg"`, `"+18%"`), and a `scan_filter` JSON the web app can use to link to the scans. Written to `insights` (`id, company_id, week_start, kind, payload, sentence, scan_filter`); `sentence` stays empty until Y13.
3. **Forecast** per company and category: `projected = collected_so_far + (8-week daily average × days left in the financial year)`; range `low` and `high` from the spread of the last 8 weekly rates (document the formula in a docstring). Written to `forecasts`.
4. At risk: `# DECISION:` `projected_kg < target_kg` (configurable factor, default 1.0) → alert of kind `target_at_risk` (no duplicate open alert).
5. Financial year helpers (April to March, IST) in one tested function used everywhere.
6. Tests: a fixed dataset with known expected totals and a known projection.

**Done when:** insights and forecasts appear in dev tables.
**PR title:** `[Y12] Trends and forecast`

---

### Y13: Gemini narration
**Branch** `ai/Y13-narration`

1. For each card send **only its pre-formatted strings**; prompt asks for exactly one plain sentence of at most 35 words that uses only the numbers given. Use the `google-genai` SDK.
2. **Pin the model:** read `GEMINI_MODEL` (an exact model id). Look up the current Gemini model names in Google's documentation and choose one stable id; put it in `config.py` as the default with a comment. Do not invent a name.
3. **Validation:** extract every number from the reply (digits, with commas and percent signs normalised); reject the reply if any number is not present in the input strings, if it is over 35 words, if it is empty, or if it contains a newline or markdown. On rejection, or on any API error or timeout, use a deterministic template sentence instead.
4. The model never calculates; the code never asks it to.
5. Tests with a fake client: good reply is used; reply with an extra number falls back; a thrown exception falls back; word limit enforced.

**Done when:** every card has a sentence, and a forced bad reply falls back to the template.
**PR title:** `[Y13] Gemini narration with validation`

---

### Y14: Nightly AI workflow
**Branch** `ci/Y14-nightly-ai`

`.github/workflows/nightly-ai.yml`: `schedule: cron: '0 20 * * *'` (20:00 UTC is 01:30 IST) plus `workflow_dispatch`; `timeout-minutes: 20`; Python 3.12 with pip cache; install `ai/requirements.txt`; run `python -m veribin_ai.run` from `ai/`; secrets `AI_DATABASE_URL` and `GEMINI_API_KEY`, and `GEMINI_MODEL` as a repository variable with a default. Upload the run log as an artifact. Document in `docs/CI.md`.

**Done when:** a scheduled run completes green.
**Yash must do by hand:** set the two secrets; run it manually once and check the dev result tables.
**PR title:** `[Y14] Nightly AI workflow`

---

### Y15: Detector evaluation
**Branch** `ai/Y15-evaluation` · **Unblocks** A13

1. `ai/veribin_ai/evaluation.py` with CLI `python -m veribin_ai.evaluation --labels simulator/labels/<run>.csv`.
2. Join the labels file to `scans` on `(bin_id, sequence)` and to `scan_flags`. Per fraud type report **caught, missed, false alarms** (flags on scans labelled normal), plus overall precision and recall. Replay rows whose outcome is rejected are counted separately as "rejected at ingest", not as missed.
3. Save the result as an `insights` row of kind `detector_accuracy` (payload with the numbers as pre-formatted strings plus raw counts).
4. Tests on small fixed inputs with known counts.

**Procedure for Yash (document in the module docstring):** run the simulator fraud modes on dev, run the AI job, then run this evaluation.
**Done when:** accuracy card data exists for Sarthak's screen.
**PR title:** `[Y15] Detector evaluation`

---

### Y16: Report snapshot function and spec
**Branch** `ai/Y16-report-snapshot` · **Unblocks** A14 (Sarthak), D16 (Durgesh) · Reviewer Durgesh

1. Read `database/` first: find the migration layout and Durgesh's helper function names (for example the "my company" helper from D8). If they do not exist yet, use a clearly marked `# DECISION:` placeholder name and say so.
2. Add one migration `database/supabase/migrations/<timestamp>_report_snapshot.sql` creating `get_report_snapshot(p_category, p_from date, p_to date)`, **security invoker** so row-level security limits it to the caller's company. It includes only scans that are: before the end of the **latest checkpoint day**, in the caller's company, in the requested category, inside the date range (IST days), and with weight OK (within ±30% of `unit_weight_g`).
3. It returns: `qr_kg` and `barcode_kg` (separate tiers), `scan_count`, `fingerprint`, `checkpoint_day`, `checkpoint_hash`, and `under_review_count` (included scans that carry a flag). Fingerprint = SHA-256 hex of the included `chain_hash` values ordered by `insertion_order`, joined with a newline, for example `encode(sha256(convert_to(string_agg(chain_hash, E'\n' ORDER BY insertion_order), 'UTF8')), 'hex')`.
4. Add a database test under `database/supabase/tests/` proving: the function returns the **same fingerprint when run twice**, excludes scans after the latest checkpoint, and respects company isolation.
5. Write `docs/REPORT-SPEC.md` for Sarthak: title **"Collection Evidence Report"**; the EPR fields (note clearly that the exact fields must be checked against the current CPCB format before finalising); totals table (QR tier, barcode tier, total, scan count); fingerprint; checkpoint day and hash; verification QR placement; "under review" count; page layout; the disclaimer that these are evidence-backed supporting records and not CPCB-issued certificates.

**Done when:** the function returns the same fingerprint when run twice.
**PR title:** `[Y16] Report snapshot function and spec`

---

### Y17: Checkpoint publishing
**Branch** `ci/Y17-publish-checkpoint` · **Needs first** D14

1. `.github/scripts/publish_checkpoint.py`: using `AI_DATABASE_URL`, read the most recent row of `checkpoints` (`day, hash, previous_hash`), confirm its `day` is the IST date of the night just ended (fail loudly if not), and write `checkpoints/<YYYY-MM-DD>.json` with `day`, `hash`, `previous_hash`, `published_at`.
2. `.github/workflows/publish-checkpoint.yml`: `cron: '45 18 * * *'` (18:45 UTC is 00:15 IST) plus `workflow_dispatch`. Check out the public repo `veribin-checkpoints` using `CHECKPOINT_REPO_TOKEN`, run the script, commit the dated file as a bot identity, push. Do nothing (success) if the file already exists with identical content.
3. Unit test for the script's day check and file format with a fake row.

**Done when:** a dated checkpoint file appears in the public repo.
**Yash must do by hand:** create the public repo `veribin-checkpoints`, create the fine-grained token with write access to that repo only, set `CHECKPOINT_REPO_TOKEN`, run once manually.
**PR title:** `[Y17] Checkpoint publishing`

---

### Y18: Tamper demo, end-to-end checklist and load test
**Branch** `ops/Y18-tamper-e2e`

1. **`ops/tamper_demo.py`** (dev only): refuses to run unless `TAMPER_DATABASE_URL` is set and `--confirm-dev` is passed, and refuses if the URL's project ref matches the prod ref in `SUPABASE_PROD_PROJECT_REF` when that is set. It operates only on the **throwaway demo bin**. Inside a single transaction: disable the ledger protection (read `database/` migrations from D3 to find the exact mechanism, such as triggers or revoked privileges), change one scan's weight, re-enable the protection, call `verify_chain` for the bin, print the result (it **must name that exact scan**), then **roll back** so nothing persists. Assert that the named scan is the edited one; exit non-zero otherwise.
2. **`docs/E2E_CHECKLIST.md`**: the checklist from the task sheet as tick boxes: live simulator; fraud modes; manual AI run; report generation; QR verify on a phone; auditor and regulator logins; offline alert (stop a simulator and see one alert).
3. **`ops/e2e_check.py`**: automates what can be automated (run the simulator in each mode for a short time, run the AI job, call verify functions, check the result tables) and prints the manual items still to tick.
4. **`ops/load_test.py`**: starts 10 simulators for 10 minutes (threads or processes), each on its own bin, and reports total scans, rejections and any error; exit non-zero on any unexpected error. **`ops/load_bins.sql`**: SQL for Durgesh to create 10 load-test bins flagged `is_demo` on dev. Keys come from `keygen.py --count 10 --prefix VB-PUN-08`.
5. `ops/README.md` with run instructions.

**Done when:** full flow passes twice on prod without manual fixes.
**Yash must do by hand:** the phone QR check, role logins, the two full runs on prod with Durgesh.
**PR title:** `[Y18] Tamper demo, e2e checklist and load test`

---

### Y19: Deploy-to-prod workflow
**Branch** `ci/Y19-deploy-prod`

1. `.github/workflows/deploy-prod.yml`: **`workflow_dispatch` only**, `environment: production`, same steps as `deploy-dev.yml` but with the prod secrets (`SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`), then a smoke test.
2. `ops/smoke_test.py`: sends one signed scan from the prod **demo** bin (flagged demo, so it never appears in real numbers) and expects `accepted`, then checks that the latest checkpoint row exists and that the `verify` endpoint responds. Never use a real bin.
3. Document in `docs/CI.md`.

**Done when:** prod deploys from the Actions button.
**Yash must do by hand:** create the `production` environment with required reviewers, set the prod secrets, switch `AI_DATABASE_URL` to prod (the nightly job also keeps the free tier from pausing), run it with Durgesh in the final week.
**PR title:** `[Y19] Deploy-to-prod workflow`

---

## 6. Prompt Yash can paste to start a task

> Read `docs/YASH_TASKS.md` sections 1 to 4. Then do task **Y2** only, exactly as written. Follow the agent rules (no push, no GitHub setup, no secrets). When finished, give the report in the format from rule 8.

Replace `Y2` with the next task ID each time.

## 7. Everything Yash does by hand (summary)

- Gemini API key and the shared password manager
- Issues, labels, project board, CODEOWNERS and templates (Y1)
- Branch protection, required checks, merge settings, the `production` environment
- All GitHub secrets and variables: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`, `AI_DATABASE_URL`, `GEMINI_API_KEY`, `CHECKPOINT_REPO_TOKEN`, `INGEST_URL_DEV`, `TEST_BIN_PRIVATE_KEY` (plus the two extra test bin keys), `GEMINI_MODEL`
- Creating the public `veribin-checkpoints` repo and its token
- Pushing branches, opening PRs, requesting reviews and merging
- Sending public keys (Y5), the mock data (Y2) and the Y16 spec to teammates
