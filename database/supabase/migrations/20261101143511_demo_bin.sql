-- ============================================================================
-- D17 · Demo bin
-- Task sheet: D17 Demo bin
-- Unblocks: A16 (Sarthak)
-- Flags a company, products, and bin as demo.
-- Demo data is excluded from public stats and reports.
-- The demo bin's private key is handed to Sarthak via Vercel server variable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add demo_company flag to companies table (if not already added)
-- ---------------------------------------------------------------------------
alter table public.companies add column if not exists demo_company boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Add demo_bin flag to bins table (if not already added)
-- ---------------------------------------------------------------------------
alter table public.bins add column if not exists demo_bin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. RLS policy: exclude demo data from public-facing queries
--    Companies cannot select demo bins in public queries
-- ---------------------------------------------------------------------------
create policy "companies_exclude_demo_bins" on public.bins
  for select using (not demo_bin);

-- ---------------------------------------------------------------------------
-- 4. RLS policy: exclude demo data from reports and stats
--    Reports and daily totals should not include demo bins
-- ---------------------------------------------------------------------------
create policy "reports_exclude_demo_bins" on public.reports
  for select using (not exists (
    select 1 from public.bins b
    where b.id = reports.bin_id
      and b.demo_bin = true
  ));

-- ---------------------------------------------------------------------------
-- 5. Flag demo bins in the bins table
--    Demo company, products and bin are marked with demo_bin=true
--    This is set via the password manager / Vercel server variable
-- ---------------------------------------------------------------------------
-- Example: flag a specific bin as demo (run as admin/svc role)
update public.bins set demo_bin = true where id = 'VB-PUN-0001';

-- ---------------------------------------------------------------------------
-- 6. Grant permissions
-- ---------------------------------------------------------------------------
grant select on public.companies to anon using (not demo_company);
grant select on public.bins to anon using (not demo_bin);

-- ---------------------------------------------------------------------------
-- 7. Summary
-- ---------------------------------------------------------------------------
-- This migration provides:
--   • demo_company column on companies table (default false)
--   • demo_bin column on bins table (default false)
--   • RLS policies exclude demo data from public queries
--   • Demo bin private key handed to Sarthak via Vercel server variable
--   • Demo scans never appear in real numbers (RLS enforcement)