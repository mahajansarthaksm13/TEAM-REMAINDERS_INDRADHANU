# VeriBin Repair Runbook (v2)

**Repo:** `mahajansarthaksm13/TEAM-REMAINDERS_INDRADHANU`
**Starting point:** `main` at commit `e9791de`
**Package:** `veribin-fix-package.zip`
**Result:** one branch `fix/full-repair` with exactly 5 commits, one pull request, green CI, then the first deploy to the dev project.

This version replaces the earlier `DURGESH-RUNBOOK.md`. The earlier attempt went wrong because an agent copied files by hand in the wrong folder. This time **every stage is a script** that copies exactly the right files, checks its own work, and refuses to commit anything wrong. The agent's job is to run the scripts in order and stop if one fails, not to copy files itself.

The whole flow was dry-run on a fresh clone of `main` before this package was made. Stages 0–5 and 7 ran green: 67 database tests passed, 60 Python tests passed (10 live tests skipped, as expected), and the pre-push checks passed. Stage 6 needs the Supabase Edge runtime, so its parts were tested separately: simulator → ingest → chain verification → AI job → tamper detection.

---

## Part A: the human does this before starting Claude Code

### A1. Tools on your PC

You need:

- **Git for Windows** (includes Git Bash)
- **Python 3.12** (3.11 also works)
- **Node.js 20 or newer**
- **Docker Desktop**, installed and running

During the Python install on Windows, tick **"Add python.exe to PATH"**.

### A2. Make sure no old repair branch exists

In Git Bash, inside any clone of the repo:

```bash
git fetch --prune
git branch -a | grep fix/full-repair
```

If anything is printed, delete it:

```bash
git branch -D fix/full-repair                 # local copy, if any
git push origin --delete fix/full-repair      # GitHub copy, if any
```

Also ask Durgesh and Yash **not to push anything** until this repair is merged.

### A3. Folder layout

The repo and the package must sit **side by side** in the same parent folder. The package must **never** go inside the repo.

```text
<any parent folder>/
├── <your repo folder>/      ← a normal clone of TEAM-REMAINDERS_INDRADHANU (any folder name)
└── fix/                     ← the extracted veribin-fix-package.zip
```

If you don't have a clean clone yet:

```bash
cd "<parent folder>"
git clone https://github.com/mahajansarthaksm13/TEAM-REMAINDERS_INDRADHANU
```

Extract the package, in Git Bash from the parent folder:

```bash
python -m zipfile -e "<path to>/veribin-fix-package.zip" fix
ls -a fix        # must show: .github  ai  database  docs  fix-tools  ruff.toml  simulator
```

### A4. Before you start

- Start **Docker Desktop** and wait until it says *Running*.
- If the folders are inside **OneDrive**, pause syncing: OneDrive icon → Settings → Pause syncing. OneDrive locks files while they're being created, which breaks the install and the database steps.
- Close VS Code or any other program that has the repo open.

### A5. Start Claude Code in the repo root

Open **Git Bash** (not PowerShell):

```bash
cd "<parent folder>/<your repo folder>"
claude
```

Keep the normal permission prompts **on**. Don't start it with any "skip permissions" option. You approve each command, and the scripts are the only commands it should need.

Then paste the prompt from Part B.

---

## Part B: the prompt for Claude Code (copy everything inside the block)

```text
You are applying a tested repair package to this git repository (TEAM-REMAINDERS_INDRADHANU, the VeriBin project).

WHERE THINGS ARE
- The repository is the CURRENT folder (its name does not matter).
- The repair package is in ../fix (a folder named "fix" next to this repo).
- Your instructions are in ../fix/docs/REPAIR-RUNBOOK.md, Part C. Read Part C fully before running anything.

HOW TO WORK
- The repair is done ONLY by running the stage scripts in ../fix/fix-tools/, in this exact order:
  stage0_setup.sh, stage1_ci.sh, stage2_keys.sh, stage3_data.sh, stage4_database.sh,
  stage5_sim_ai.sh, stage6_e2e.sh, stage7_prepush.sh
- Run each one from the repo root with Git Bash:  bash ../fix/fix-tools/<script>
- Every script ends with "STAGE n COMPLETE" when it succeeds, or "[FAIL] ... STOPPED" when it fails.
- After each script, report: the stage name, every [OK]/[SKIP]/[FAIL] line, and the commit line if there is one. If it succeeded, run the next script.

HARD RULES
1. Do NOT copy, edit, create, move or delete any file yourself. The scripts do all of that. You only run the scripts and the read-only commands allowed in Part C.
2. Never edit any file in ../fix, and never edit any file in the repo to make a check pass.
3. If a script prints [FAIL]: STOP. Show me the full output. Explain in plain words what the message means and which Part C "if it fails" fix applies. Do NOT apply the fix yourself unless that fix is a command listed in Part C AND I say "do it".
4. Never run: git init, git push (of any kind) before I type "push", git push --force, git reset --hard, git rebase, git commit (the scripts commit), supabase link, supabase db push, supabase functions deploy.
5. Never print the contents of any file in simulator/keys/.
6. Use Git Bash only. Never PowerShell or cmd.

FINISH
After stage7_prepush.sh prints "ALL PRE-PUSH CHECKS PASSED", show me its full output and WAIT.
Only when I type "push", run exactly:  git push -u origin fix/full-repair
Then give me the pull request text from Part D1 of the runbook, filled in with the real numbers from the stage outputs.
```

---

## Part C: stage by stage (what the agent runs)

Every command runs from the **repo root** in **Git Bash**. Each script:

- checks it's in the right repo (GitHub remote, `e9791de` in history, run from the repo root);
- checks it's on branch `fix/full-repair` (from Stage 1 on);
- copies exactly the right files from `../fix` and compares them byte for byte;
- refuses to commit PDFs, zips, keys, `.env` files, `package.json` files or anything under `fix/`;
- refuses to commit if the 4 original migrations were touched;
- skips itself with `[SKIP]` if its commit already exists, so re-running a finished stage is harmless.

### Stage 0: setup

```bash
bash ../fix/fix-tools/stage0_setup.sh
```

**What it does:**

- checks Git, Python 3.11+, Node, npx and Docker (running);
- checks the package is next to the repo (not inside it);
- checks this is the right repo with a clean working tree;
- refuses to continue if any `fix/full-repair` branch already exists;
- updates `main` and creates `fix/full-repair` from it;
- creates `.venv` and installs the Python packages.

If you're already on `fix/full-repair`, it only refreshes `.venv` and prints `STAGE 0 COMPLETE (resumed)`.

**Success:** `STAGE 0 COMPLETE`. A line ` M .gitignore` may appear; that's expected and is committed in Stage 2.

**If it fails:**

| Message | Meaning and fix (the human does it) |
|---|---|
| `Docker Desktop is not running` | Start Docker Desktop, wait for *Running*, re-run Stage 0. |
| `Node.js 20+ not found` / `Python 3.11+ not found` | Install it (A1), reopen Git Bash, re-run. |
| `package file missing` | The package isn't at `../fix`. Redo A3. |
| `must be OUTSIDE the repo` | `fix` was extracted inside the repo. Delete it there and extract next to the repo. |
| `remote is not …` / `not in this branch's history` | Claude Code was opened in the wrong folder. Exit, `cd` to the real clone, start again. |
| `working tree is not clean` | Uncommitted changes exist. Commit or stash them yourself (`git stash`), then re-run. |
| `a branch fix/full-repair already exists` | Run the two delete commands it prints (A2), then re-run. |
| `main is now …, not e9791de` (a WARN, not a FAIL) | Someone changed `main`. STOP and ask Sarthak before continuing. |
| `pip install failed` | Usually no internet or a proxy. Fix the connection and re-run. |

### Stage 1: CI workflows

```bash
bash ../fix/fix-tools/stage1_ci.sh
```

**What it does:** replaces the 4 broken workflows, adds `nightly-ai.yml`, deletes `ai-job.yml`, updates `ruff.toml` (to skip notebooks), and adds `docs/FIX-PLAN.md` and `docs/REPAIR-RUNBOOK.md`.

**Success:** `committed … fix(ci): …` and `STAGE 1 COMPLETE`.

### Stage 2: keys

```bash
bash ../fix/fix-tools/stage2_keys.sh
```

**What it does:**

- removes the leaked `sim_state.json` (it held a private key in the public repo) and the stray `data/sim_labels.csv`;
- creates fresh Ed25519 keys for all 10 bins: 6 mock bins, the test bins VB-PUN-0900/0901/0902, and the demo bin VB-PUN-9999-DEMO;
- checks every private key is git-ignored and commits only the public keys.

**Success:** `STAGE 2 COMPLETE` and an **ACTION FOR YOU** message. The human then copies two key files into the password manager:

- `simulator/keys/VB-PUN-0900.key` → GitHub secret `TEST_BIN_PRIVATE_KEY`
- `simulator/keys/VB-PUN-9999-DEMO.key` → Vercel server-only variable

The agent must not open or print them.

**If it fails with** `is NOT git-ignored` or `key or state files are tracked`: STOP. Don't continue; tell Sarthak. A key must never be committed.

### Stage 3: mock data

```bash
bash ../fix/fix-tools/stage3_data.sh
```

**What it does:** changes the mock product and rejected-scan IDs to real UUIDs (`p…` → `e…`, `r…` → `f…`), regenerates the CSVs and validates them.

**Success:** `mock data regenerated and validated` and `STAGE 3 COMPLETE`.

### Stage 4: database (the important one)

```bash
bash ../fix/fix-tools/stage4_database.sh
```

**What it does:**

- copies 11 corrected or new migrations and deletes 2 broken ones;
- checks there are exactly 15 migrations and that the 4 original ones are untouched;
- copies the 3 test files, the fixed `ingest` function, the new `heartbeat` function and 2 scripts;
- patches `config.toml` (sign-ups off, heartbeat without login);
- builds `seed.sql` from the mock data and keys, and saves `TEST_QR_SERIAL` to `../fix/TEST_QR_SERIAL.txt`, outside the repo;
- starts local Supabase, rebuilds the database from empty (`db reset`) and runs every database test.

**Success:** `Files=3, Tests=67`, `Result: PASS`, `67 / 67 database tests pass` and `STAGE 4 COMPLETE`. Then an **ACTION FOR YOU**: save the printed `TEST_QR_SERIAL` value in the password manager.

The first `supabase start` downloads Docker images and can take 5–15 minutes. That's normal; wait.

**If it fails:**

| Message | Meaning and fix |
|---|---|
| `supabase start failed` | Docker isn't running, or ports are busy. The human runs `cd database && npx supabase stop --no-backup && cd ..`, makes sure Docker is running, and re-runs Stage 4. |
| `build_seed.py failed` / `MISSING public keys` | Stage 2 didn't finish. Check `git log --oneline main..HEAD` shows the `fix(security)` commit. |
| `db reset failed` / `printed an error` | STOP. Send the printed error to Sarthak. Don't edit any migration. |
| `expected Files=3, Tests=67` | STOP. Send the output to Sarthak. |
| `differs from package` / `protected migration … changed` | Something edited a file. Run `git checkout -- database/` and re-run Stage 4. |

### Stage 5: simulator and AI

```bash
bash ../fix/fix-tools/stage5_sim_ai.sh
```

**What it does:**

- replaces the simulator (the old one sent a format ingest rejects);
- adds the 10 real ingest tests and removes the fake ones;
- replaces the AI package: the old one detected fraud by reading the answer labels, the new one reads and writes the database;
- keeps `thresholds.json`;
- runs exactly what CI runs: `ruff check .`, `pytest` and the mock-data check.

**Success:** `ruff: All checks passed`, `pytest: 60 passed, 10 skipped`, `STAGE 5 COMPLETE`. The 10 skipped tests are the live ingest tests, which need a running server and run in Stage 6.

**If it fails with** `pytest failed` or `ruff found problems`: STOP and send the output to Sarthak. Don't edit code to make it pass.

### Stage 6: end-to-end test on your PC (commits nothing)

```bash
bash ../fix/fix-tools/stage6_e2e.sh
```

**What it does:**

- starts the Edge Functions locally (logs go to `../fix/logs/`);
- sends 5 live scans (all must be accepted);
- runs fraud mode (everything accepted except exactly one replay, rejected as `duplicate_sequence`);
- runs the 10 live ingest tests;
- creates a local-only `ai_job` login, runs the nightly AI job, and checks the detector caught the planted fraud.

**Success:** `5 / 5 live scans accepted`, `replay rejected as duplicate_sequence`, `10 / 10 live ingest tests pass`, `AI job completed`, `detector caught planted fraud` and `STAGE 6 COMPLETE`.

**If it fails:**

| Message | Meaning and fix |
|---|---|
| `ingest function did not come up` | Read `../fix/logs/functions.log`. Usually Docker is still busy: wait 1 minute and re-run Stage 6. |
| `expected 5 accepted scans` showing `bad_signature` | Keys and seed don't match. The human runs `cd database && npx supabase db reset && cd ..`, then re-runs Stage 6. |
| `expected 5 accepted scans` showing `barcode_cooldown` | Stage 6 was re-run within 30 seconds. Wait a minute and re-run. |
| `live ingest tests failed` | STOP and send `../fix/logs/live-tests.log` to Sarthak. |
| `AI run did not score bins` | STOP and send `../fix/logs/ai-run.log` to Sarthak. |

Re-running Stage 6 is safe; it never commits.

### Stage 7: pre-push checks

```bash
bash ../fix/fix-tools/stage7_prepush.sh
```

**What it checks:**

- the working tree is clean;
- the branch shares history with `main`;
- there are **exactly 5 commits**;
- the deleted files are **exactly** these 9: `ai-job.yml`, `test_features.py`, `test_integrity.py`, `features.py`, `sim_labels.csv`, the 2 bad migrations, `test_ingest.py` and `sim_state.json`;
- no forbidden files were added, no key material is present, and the 4 original migrations are unchanged.

**Success:** `ALL PRE-PUSH CHECKS PASSED.` The agent then **waits** for the human to type `push`.

**Push** (only after the human types `push`):

```bash
git push -u origin fix/full-repair
```

---

## Part D: the human does this after the push

### D1. Open the pull request

On GitHub, choose **Compare & pull request** for `fix/full-repair`.

**Title:** `Full repair: CI, keys, mock data, database D5–D16, simulator, AI pipeline`

**Body** (Claude Code fills in the numbers):

```markdown
Applies veribin-fix-package.zip using docs/REPAIR-RUNBOOK.md (stage scripts).

## Proof it runs (local)
- Stage 4: `supabase db reset` from empty, `supabase test db` → Files=3, Tests=67, Result: PASS
- Stage 5: `ruff check .` → All checks passed; `pytest` → 60 passed, 10 skipped; mock data valid
- Stage 6: 5/5 live scans accepted; replay rejected (duplicate_sequence); live ingest suite 10/10; AI job scored bins; detector caught planted fraud
- Stage 7: 5 commits, merge-base e9791de, only the 9 planned deletions, no forbidden files, original migrations untouched

## What changed
- CI: workflows fixed (`steps.` typo), nightly AI job, notebooks excluded from lint
- Security: leaked simulator key removed; fresh keys for all 10 bins (private keys never committed)
- Data: mock products/rejected scans now use valid UUIDs
- Database: D7–D16 rebuilt, 4 D5 ingest bugs fixed, D12 heartbeat added, real seed, 67 tests
- Simulator: contract v1 format, 10 real ingest tests
- AI: scoring from scan behaviour (not labels), reads/writes the database, number-checked narration
```

### D2. Wait for CI, then merge

All three checks must be green:

- `Migrations from scratch + database tests`
- `Ruff, pytest, mock data check`
- `Lint, type-check, build` (shows *skipped*, because there's no `web/` yet; that counts as passing)

The ruleset needs 1 approval, and GitHub doesn't let you approve your own PR. Ask Durgesh or Yash to click **Approve**, then **Squash and merge**.

### D3. First deploy to the dev project (once, by hand)

From the repo root, after `git checkout main && git pull`:

```bash
cd database
npx supabase login
npx supabase link --project-ref <veribin-dev ref>      # asks for the dev database password
npx supabase db push --include-seed                     # ONLY this first time
npx supabase functions deploy ingest heartbeat
cd ..
```

**Never use `--include-seed` again.** After this, the `deploy-dev` workflow pushes new migrations on every merge.

**Test users on dev.** Get the service role key from the dev project's **Settings → API Keys**, and choose a test password to store in the password manager:

```bash
source .venv/Scripts/activate
SUPABASE_URL=https://<dev-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<dev service role key> \
TEST_USER_PASSWORD=<from password manager> \
python database/scripts/create_test_users.py
```

It prints 6 users.

**AI login on dev.** In the dev **SQL Editor**, run this; it's never committed:

```sql
create role ai_job login password '<new strong password>' in role ai_job_role;
```

Then build `AI_DATABASE_URL` from **Connect → Session pooler**, with the user set to `ai_job.<dev-ref>`:

```text
postgresql://ai_job.<dev-ref>:<password>@<pooler-host>:5432/postgres
```

**Dev dashboard checks:**

- **Table Editor → bins:** 10 rows.
- **Integrations → Cron:** 2 jobs.
- **Settings → Realtime:** "Allow public access" is **off**.
- **Authentication:** new sign-ups are **off**.

### D4. GitHub secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase account → Access Tokens |
| `SUPABASE_DEV_PROJECT_REF` / `SUPABASE_DEV_DB_PASSWORD` | dev project ref and database password |
| `INGEST_URL_DEV` | `https://<dev-ref>.supabase.co/functions/v1/ingest` |
| `TEST_BIN_PRIVATE_KEY` | contents of `simulator/keys/VB-PUN-0900.key` |
| `TEST_QR_SERIAL` | from `../fix/TEST_QR_SERIAL.txt` |
| `AI_DATABASE_URL` | the pooler string from D3 |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Google AI Studio key, and an exact model id listed there (never "latest") |

### D5. Final checks

1. In **Actions → deploy-dev**, click **Run workflow**. It must be green; it runs the 10 live ingest tests against dev.
2. In **Actions → nightly-ai**, click **Run workflow**. It must be green, and its log shows `scored N bins`.

When both are green, **the repair is complete.** Resume OneDrive syncing and tell the team they can push again. Yash's old branches `ai/Y9-package` and `ai/Y18-chain-verify-test` should be closed without merging; Y18 is redone on top of the new code (see `docs/FIX-PLAN.md`, Y5).

---

## Part E: troubleshooting the environment

| Problem | Fix |
|---|---|
| `bash: python: command not found` | Reinstall Python with "Add to PATH", reopen Git Bash. |
| `npx` asks "Ok to proceed? (y)" | Answer `y`. The scripts pass `--yes`, but a first-run npm prompt can still appear. |
| Any "Permission denied" / "resource busy" | OneDrive or antivirus is locking files. Pause OneDrive, close editors, re-run the same stage. |
| A stage failed halfway | Fix the cause, then re-run **the same** stage. Finished stages print `[SKIP]`. |
| You closed Claude Code partway | Reopen it in the repo root and say: *"Resume the repair: run ../fix/fix-tools/stage0_setup.sh (it detects the resume), then continue with the first stage that is not [SKIP], following ../fix/docs/REPAIR-RUNBOOK.md Part C and the same rules as before."* |
| You want to start completely over | `git checkout main && git branch -D fix/full-repair`, then start again from Stage 0. (Only possible if you haven't pushed; if you have, also run `git push origin --delete fix/full-repair`.) |
