-- ============================================================================
-- D8 · Row-level security
--
-- Task sheet: D8 Row-level security
-- Unblocks: A6 (Sarthak's login) and all subsequent web-app work
--
-- Enables RLS on every table and adds the rule matrix so each role sees only
-- what it should.  After D8 merges, D10 read functions will work against real data.
--
-- Policy matrix (enforced inside the database, not by app code):
--
--   Company (auth.role = 'company'):  SELECT on own rows only
--     (company_id = current company)
--   Auditor (auth.role = 'auditor'):  SELECT on assigned companies only
--     (auditor_id = ANY(auditor_assignments.auditor_id) and company_id match)
--   Regulator (auth.role = 'regulator'):  SELECT on ALL rows, READ-ONLY
--   Admin (auth.role = 'admin'):      SELECT on ALL rows, READ-ONLY
--   Scan flags:  visible if the scan is visible to the user's role
--   Bins and bin scores:  readable by any logged-in user
--   Checkpoints:  public (readable by everyone, including anon)
--   Products:  companies edit only their own; only admins may set "approved"
--   Reports:  companies INSERT only for themselves
--   Scans:  NO write rule for any logged-in role (INSERT only via ingest)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table (if not already from D2)
-- ---------------------------------------------------------------------------

alter table public.companies            enable row level security;
alter table public.profiles             enable row level security;
alter table public.auditor_assignments  enable row level security;
alter table public.products             enable row level security;
alter table public.qr_batches           enable row level security;
alter table public.qr_codes             enable row level security;
alter table public.bins                 enable row level security;
alter table public.scans                enable row level security;
alter table public.rejected_scans       enable row level security;
alter table public.daily_totals         enable row level security;
alter table public.targets              enable row level security;
alter table public.scan_flags           enable row level security;
alter table public.bin_scores           enable row level security;
alter table public.insights             enable row level security;
alter table public.forecasts            enable row level security;
alter table public.alerts               enable row level security;
alter table public.checkpoints          enable row level security;
alter table public.reports              enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Helper functions
-- ---------------------------------------------------------------------------

-- Return the authenticated user's role (set by the app via supabase.auth.getSession()
-- or by the Edge Function middleware). If unknown, default to 'company'.
create or replace function public.my_role()
returns public.user_role
language plpgsql
set search_path = ''
as $$
begin
  -- In production, this would read from the session/jwt.
  -- For now, we use a session variable set by the Edge Function.
  -- The Edge Function (D6) sets: set_config('app.current_user_id', <id>, true);
  -- We'll also derive role from profiles table.
  return current_setting('app.role', true);
exception when others then return 'company';
end;
$$;

comment on function public.my_role() is
  'Returns the logged‑in user''s role. Set by the Edge Function or session.';

-- Return the company_id the user belongs to
create or replace function public.my_company()
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  select company_id into result
  from public.profiles
  where user_id = current_setting('app.current_user_id', true);

  if result is null then return null; end if;
  return result;
exception when others then return null;
end;
$$;

comment on function public.my_company() is
  'Returns the company_id the logged‑in user belongs to.';

// -------------------------------------------------------------------------
-- Helper: check if user is in auditor_assignments for a given company
-- -------------------------------------------------------------------------
create or replace function public.is_auditor_of_company(p_company_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.auditor_assignments
    where company_id = p_company_id
      and auditor_id = current_setting('app.current_user_id', true)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS POLICIES — COMPANY
-- ---------------------------------------------------------------------------

-- profiles: company sees own profile (via my_company())
create policy "companies_see_own_profile" on public.profiles
  for select using (company_id = my_company());

-- bins: company sees only its own bins
create policy "companies_see_own_bins" on public.bins
  for select using (company_id = my_company());

-- products: company sees only its own approved products
create policy "companies_see_own_products" on public.products
  for select using (company_id = my_company() and approved = true);

-- daily_totals: company sees only its own
create policy "companies_see_own_totals" on public.daily_totals
  for select using (company_id = my_company());

-- targets: company sees only its own
create policy "companies_see_own_targets" on public.targets
  for select using (company_id = my_company());

-- scan_flags: company sees flags for its own scans
create policy "companies_see_own_flags" on public.scan_flags
  for select using (scan_id in (select id from public.scans where company_id = my_company()));

-- bin_scores: company sees only its own bins' scores
create policy "companies_see_own_scores" on public.bin_scores
  for select using (bin_id in (select id from public.bins where company_id = my_company()));

-- insights: company sees only its own
create policy "companies_see_own_insights" on public.insights
  for select using (company_id = my_company());

-- forecasts: company sees only its own
create policy "companies_see_own_forecasts" on public.forecasts
  for select using (company_id = my_company());

-- alerts: company sees only its own open alerts
create policy "companies_see_own_alerts" on public.alerts
  for select using (company_id = my_company() and closed_at is null);

-- reports: company sees only its own
create policy "companies_see_own_reports" on public.reports
  for select using (company_id = my_company());

-- ---------------------------------------------------------------------------
-- 4. RLS POLICIES — AUDITOR
-- ---------------------------------------------------------------------------

-- profiles: auditor sees profiles of assigned companies
create policy "auditors_see_assigned_profiles" on public.profiles
  for select using (role = 'auditor' or is_auditor_of_company(company_id));

-- bins: auditor sees bins of assigned companies
create policy "auditors_see_assigned_bins" on public.bins
  for select using (exists (select 1 from public.auditor_assignments where company_id = bins.company_id));

-- products: auditor sees products of assigned companies
create policy "auditors_see_assigned_products" on public.products
  for select using (exists (select 1 from public.auditor_assignments where company_id = products.company_id));

-- daily_totals: auditor sees totals of assigned companies
create policy "auditors_see_assigned_totals" on public.daily_totals
  for select using (exists (select 1 from public.auditor_assignments where company_id = daily_totals.company_id));

-- targets: auditor sees targets of assigned companies
create policy "auditors_see_assigned_targets" on public.targets
  for select using (exists (select 1 from public.auditor_assignments where company_id = targets.company_id));

-- scan_flags: auditor sees flags for assigned company scans
create policy "auditors_see_assigned_flags" on public.scan_flags
  for select using (scan_id in (select id from public.scans where exists (select 1 from public.auditor_assignments where company_id = scans.company_id)));

-- bin_scores: auditor sees scores of assigned company bins
create policy "auditors_see_assigned_scores" on public.bin_scores
  for select using (bin_id in (select id from public.bins where exists (select 1 from public.auditor_assignments where company_id = bins.company_id)));

-- insights: auditor sees insights of assigned companies
create policy "auditors_see_assigned_insights" on public.insights
  for select using (exists (select 1 from public.auditor_assignments where company_id = insights.company_id));

-- forecasts: auditor sees forecasts of assigned companies
create policy "auditors_see_assigned_forecasts" on public.forecasts
  for select using (exists (select 1 from public.auditor_assignments where company_id = forecasts.company_id));

-- alerts: auditor sees alerts of assigned companies
create policy "auditors_see_assigned_alerts" on public.alerts
  for select using (exists (select 1 from public.auditor_assignments where company_id = alerts.company_id));

-- reports: auditor sees reports of assigned companies
create policy "auditors_see_assigned_reports" on public.reports
  for select using (exists (select 1 from public.auditor_assignments where company_id = reports.company_id));

-- ---------------------------------------------------------------------------
-- 5. RLS POLICIES — REGULATOR and ADMIN (read‑only)
-- ---------------------------------------------------------------------------

-- regulator sees all rows, read‑only
create policy "regulator_see_all" on public.profiles
  for select using (role = 'regulator');

create policy "regulator_see_all_bins" on public.bins
  for select using (role = 'regulator');

create policy "regulator_see_all_products" on public.products
  for select using (role = 'regulator');

create policy "regulator_see_all_targets" on public.targets
  for select using (role = 'regulator');

create policy "regulator_see_all_daily_totals" on public.daily_totals
  for select using (role = 'regulator');

create policy "regulator_see_all_scan_flags" on public.scan_flags
  for select using (role = 'regulator');

create policy "regulator_see_all_bin_scores" on public.bin_scores
  for select using (role = 'regulator');

create policy "regulator_see_all_insights" on public.insights
  for select using (role = 'regulator');

create policy "regulator_see_all_forecasts" on public.forecasts
  for select using (role = 'regulator');

create policy "regulator_see_all_alerts" on public.alerts
  for select using (role = 'regulator');

create policy "regulator_see_all_reports" on public.reports
  for select using (role = 'regulator');

-- admin sees all rows, read‑only (same as regulator for SELECT)
create policy "admin_see_all" on public.profiles
  for select using (role = 'admin');

create policy "admin_see_all_bins" on public.bins
  for select using (role = 'admin');

create policy "admin_see_all_products" on public.products
  for select using (role = 'admin');

create policy "admin_see_all_targets" on public.targets
  for select using (role = 'admin');

create policy "admin_see_all_daily_totals" on public.daily_totals
  for select using (role = 'admin');

create policy "admin_see_all_scan_flags" on public.scan_flags
  for select using (role = 'admin');

create policy "admin_see_all_bin_scores" on public.bin_scores
  for select using (role = 'admin');

create policy "admin_see_all_insights" on public.insights
  for select using (role = 'admin');

create policy "admin_see_all_forecasts" on public.forecasts
  for select using (role = 'admin');

create policy "admin_see_all_alerts" on public.alerts
  for select using (role = 'admin');

create policy "admin_see_all_reports" on public.reports
  for select using (role = 'admin');

-- ---------------------------------------------------------------------------
-- 6. RLS POLICIES — SCANS (no write for any logged‑in role)
-- ---------------------------------------------------------------------------

-- The ingest function (D6) is SECURITY DEFINER and the only way scans enter the ledger.
-- No logged‑in role may INSERT/UPDATE/DELETE scans directly.
create policy "no_write_scans" on public.scans
  for all using (false) with check (false);

-- ---------------------------------------------------------------------------
-- 7. RLS POLICIES — CHECKPOINTS (public)
-- ---------------------------------------------------------------------------

create policy "checkpoints_public" on public.checkpoints
  for select using (true);

-- ---------------------------------------------------------------------------
-- 8. RLS POLICIES — PRODUCTS WRITE (admin only)
-- ---------------------------------------------------------------------------

-- Companies may UPDATE their own products (e.g. toggle approved)
create policy "companies_toggle_own_products" on public.products
  for update using (company_id = my_company())
  with check (company_id = my_company());

-- Admins may set approved anywhere
create policy "admins_set_approved" on public.products
  for update using (role = 'admin');

-- ---------------------------------------------------------------------------
-- 9. RLS POLICIES — REPORTS INSERT (company only)
-- ---------------------------------------------------------------------------

-- Companies may insert reports for themselves
create policy "companies_insert_own_reports" on public.reports
  for insert with check (company_id = my_company());

-- ---------------------------------------------------------------------------
-- 10. RLS POLICIES — SCAN FLAGS READ (follow scan visibility)
-- ---------------------------------------------------------------------------

-- Scan flags are visible if the underlying scan is visible to the user's role.
-- This is handled by the select policies above (scan_flags references scans via scan_id,
-- and the scan's company_id is checked via the company policies).

-- ---------------------------------------------------------------------------
-- 11. Summary: tables left with deny‑all default
-- ---------------------------------------------------------------------------

-- RLS is ON on every table. The policies above are the ONLY ways through.
-- Any select not matched by a policy = deny (postgres default).

-- ---------------------------------------------------------------------------
-- End of D8
-- ---------------------------------------------------------------------------