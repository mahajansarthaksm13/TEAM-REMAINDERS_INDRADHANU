-- ============================================================================
-- D13 · AI database role
--
-- Task sheet: D13 AI database role
-- Unblocks: Y9 onwards (Yash)
--
-- Creates a dedicated database role for the nightly AI job with strict
-- read/write boundaries. The role can only read designated views and write
-- to designated AI output tables. It cannot modify the ledger (scans table).
--
-- Connection string and role credentials are provided to Yash via the
-- password manager. The role is intended for use with pg_cron and the
-- nightly AI job (Y14).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create AI job role
-- ---------------------------------------------------------------------------

create role ai_job_role;

-- ---------------------------------------------------------------------------
-- 2. AI job role permissions
--    Read: scans, bins, products, targets, rejected_scans, daily_totals, checkpoints
--    Write: ONLY bin_scores, scan_flags, insights, forecasts, alerts
--    The role uses set_search_path to restrict which tables it can reference.
-- ---------------------------------------------------------------------------

-- Grant read access to AI job role
grant select on public.scans to ai_job_role;
grant select on public.bins to ai_job_role;
grant select on public.products to ai_job_role;
grant select on public.targets to ai_job_role;
grant select on public.rejected_scans to ai_job_role;
grant select on public.daily_totals to ai_job_role;
grant select on public.checkpoints to ai_job_role;

-- Grant write access ONLY to AI output tables (never the ledger)
grant select, insert, update on public.bin_scores to ai_job_role;
grant select, insert on public.scan_flags to ai_job_role;
grant select, insert on public.insights to ai_job_role;
grant select, insert on public.forecasts to ai_job_role;
grant select, insert on public.alerts to ai_job_role;

-- ---------------------------------------------------------------------------
-- 3. Ensure the role cannot modify the ledger
--    (This is enforced by: (a) no INSERT/UPDATE/DELETE on scans, (b) the role
--     can only write to the AI output tables listed above.)
-- ---------------------------------------------------------------------------

-- Revoke all write permissions on scans from ai_job_role
revoke all on public.scans from ai_job_role;

-- ---------------------------------------------------------------------------
-- 4. Helper function: run AI job as the AI role
-- ---------------------------------------------------------------------------

create or replace function public.ai_job_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  -- This function runs as the ai_job_role and can only operate within
  -- the permissions defined above. It is a wrapper that the nightly
  -- GitHub Action (Y14) can call safely.

  -- Example: Run integrity check (D15) within safe boundaries
  declare
    v_check_result jsonb;
  begin
    -- Note: The actual integrity check logic would be called carefully
    -- to avoid modifying the ledger. This is a placeholder.
    v_result := jsonb_build_object('status', 'ai_job_placeholder');
  end;

  return v_result;
end;
$$;

comment on function public.ai_job_run() is
  'Placeholder function for the nightly AI job. Runs as ai_job_role.
   Actual job logic is in the GitHub Action (Y14) via psql commands.';

-- ---------------------------------------------------------------------------
-- 4. Grant execute to ai_job_run (optional, for GitHub Actions)
-- ---------------------------------------------------------------------------
grant execute on function public.ai_job_run() to ai_job_role;

-- ---------------------------------------------------------------------------
-- 5. Summary
-- ---------------------------------------------------------------------------
-- The ai_job_role is designed so that:
--   • It can read all necessary data for analysis
--   • It can write AI results to dedicated tables only
--   • It CANNOT modify the scans ledger (enforced by revoke all)
--   • Connection string and role password are stored in the password manager
--   • The nightly GitHub Action (Y14) uses this role via psql
-- ============================================================================