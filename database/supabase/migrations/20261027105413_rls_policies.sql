-- ============================================================================
-- D8 · Row-level security (rewritten)
--
-- RLS was switched on for every table in D2 with no policies (deny-all).
-- This migration adds the only ways through. Every company check goes through
-- public.can_see_company() from D7:
--   company   -> its own company
--   auditor   -> companies in auditor_assignments for that auditor
--   regulator -> every company, read-only
--   admin     -> every company, plus the few admin writes below
--
-- service_role bypasses RLS (ingest, report storage, scripts).
-- The AI role gets its own policies in D13.
--
-- Deliberate choice: bins and bin_scores follow company visibility too, not
-- "any logged-in user". A company has no reason to see a rival's bins and
-- trust scores. (Contract updated to match.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. anon gets nothing except checkpoints. Logged-out pages use the
--    SECURITY DEFINER functions get_public_stats() and verify_report().
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select on public.checkpoints to anon;

-- ---------------------------------------------------------------------------
-- 1. Tables keyed directly by company_id: read if you can see the company
-- ---------------------------------------------------------------------------

create policy companies_read on public.companies
  for select to authenticated using (public.can_see_company(id));

create policy scans_read on public.scans
  for select to authenticated using (public.can_see_company(company_id));

create policy daily_totals_read on public.daily_totals
  for select to authenticated using (public.can_see_company(company_id));

create policy targets_read on public.targets
  for select to authenticated using (public.can_see_company(company_id));

create policy insights_read on public.insights
  for select to authenticated using (public.can_see_company(company_id));

create policy forecasts_read on public.forecasts
  for select to authenticated using (public.can_see_company(company_id));

create policy reports_read on public.reports
  for select to authenticated using (public.can_see_company(company_id));

create policy bins_read on public.bins
  for select to authenticated using (public.can_see_company(company_id));

create policy products_read on public.products
  for select to authenticated using (public.can_see_company(company_id));

-- Alerts without a company (system-wide) are for admin and regulator only.
create policy alerts_read on public.alerts
  for select to authenticated using (
    case when company_id is null then public.my_role() in ('admin', 'regulator')
         else public.can_see_company(company_id) end
  );

-- ---------------------------------------------------------------------------
-- 2. Tables that reach the company through another table
-- ---------------------------------------------------------------------------

create policy scan_flags_read on public.scan_flags
  for select to authenticated using (
    exists (select 1 from public.scans s
            where s.id = scan_flags.scan_id and public.can_see_company(s.company_id))
  );

create policy bin_scores_read on public.bin_scores
  for select to authenticated using (
    exists (select 1 from public.bins b
            where b.id = bin_scores.bin_id and public.can_see_company(b.company_id))
  );

create policy rejected_scans_read on public.rejected_scans
  for select to authenticated using (
    public.my_role() in ('admin', 'regulator')
    or exists (select 1 from public.bins b
               where b.id = rejected_scans.bin_id and public.can_see_company(b.company_id))
  );

create policy qr_batches_read on public.qr_batches
  for select to authenticated using (
    exists (select 1 from public.products p
            where p.id = qr_batches.product_id and public.can_see_company(p.company_id))
  );

create policy qr_codes_read on public.qr_codes
  for select to authenticated using (
    exists (select 1 from public.products p
            where p.id = qr_codes.product_id and public.can_see_company(p.company_id))
  );

-- ---------------------------------------------------------------------------
-- 3. People
-- ---------------------------------------------------------------------------

create policy profiles_read on public.profiles
  for select to authenticated using (
    user_id = (select auth.uid()) or public.my_role() = 'admin'
  );

create policy auditor_assignments_read on public.auditor_assignments
  for select to authenticated using (
    auditor_id = (select auth.uid()) or public.my_role() in ('admin', 'regulator')
  );

-- ---------------------------------------------------------------------------
-- 4. Public
-- ---------------------------------------------------------------------------

create policy checkpoints_read on public.checkpoints
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5. Writes. Everything not listed here is written only by service_role,
--    a SECURITY DEFINER function, or the AI role (D13).
--    scans: NO write policy for anyone. INSERT only via ingest_scan.
-- ---------------------------------------------------------------------------

-- Companies add and edit their own products; products_guard (D7) forces
-- approved = false and freezes approved products.
create policy products_company_insert on public.products
  for insert to authenticated
  with check (public.my_role() = 'company' and company_id = public.my_company());

create policy products_company_update on public.products
  for update to authenticated
  using      (public.my_role() = 'company' and company_id = public.my_company())
  with check (public.my_role() = 'company' and company_id = public.my_company());

-- Admins approve products (A11 approval queue).
create policy products_admin_update on public.products
  for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Admins manage targets.
create policy targets_admin_write on public.targets
  for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Companies and admins close alerts they can see (A12 bell).
create policy alerts_close on public.alerts
  for update to authenticated
  using (public.my_role() in ('company', 'admin') and public.can_see_company(company_id))
  with check (public.my_role() in ('company', 'admin') and public.can_see_company(company_id));

-- reports: no insert policy. Reports are created only by create_report() (D16),
-- so nobody can store a fingerprint the database did not compute.
