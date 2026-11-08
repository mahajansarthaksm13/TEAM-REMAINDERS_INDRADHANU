-- ============================================================================
-- Admin controls (web A19)
--
-- Admins decide what exists on the platform and what is visible.
--
--  * archived_at on companies, products and bins: hide and restore without losing history.
--    An archived company is visible to admins only (can_see_company), so it drops out of
--    every dashboard, report and RLS-scoped read for everyone else, and public national
--    totals leave it out. Archived products and bins stay readable as history; the web app
--    keeps them out of active lists and pickers.
--  * Admin write policies: companies (insert, update, delete), products (delete),
--    bins (update, delete), profiles (update, delete), auditor_assignments (insert, delete).
--  * Evidence is never deleted. scans reference companies, products and bins ON DELETE
--    RESTRICT and are append-only, so anything with a signed scan can only be archived.
--    The demo company and demo bins cannot be deleted, and an admin cannot edit or delete
--    their own profile (no self lock-out).
--
-- Tests: supabase/tests/admin_controls.test.sql
-- ============================================================================

alter table public.companies add column if not exists archived_at timestamptz;
alter table public.products  add column if not exists archived_at timestamptz;
alter table public.bins      add column if not exists archived_at timestamptz;

comment on column public.companies.archived_at is 'Set by an admin to hide the company from everyone but admins. Null = visible.';
comment on column public.products.archived_at  is 'Set by an admin to retire the product from active lists. History stays readable.';
comment on column public.bins.archived_at      is 'Set by an admin to retire the bin from active lists and public counts. History stays readable.';

-- ---------------------------------------------------------------------------
-- Visibility: archived companies are seen by admins only.
-- Same rules as before, plus the archive check for every non-admin role.
-- ---------------------------------------------------------------------------
create or replace function public.can_see_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (case public.my_role()
      when 'admin'     then true
      when 'regulator' then true
      when 'company'   then p_company_id = public.my_company()
      when 'auditor'   then exists (
        select 1
        from public.auditor_assignments a
        where a.auditor_id = (select auth.uid())
          and a.company_id = p_company_id
      )
    end)
    and (
      public.my_role() = 'admin'
      or not exists (select 1 from public.companies c where c.id = p_company_id and c.archived_at is not null)
    ),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- Public national totals leave out archived companies and archived bins.
-- Same shape and rules as before (demo excluded).
-- ---------------------------------------------------------------------------
create or replace function public.get_public_stats()
returns table (total_kg numeric, total_scans bigint, active_bins bigint, cities bigint, by_category jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select d.category, sum(d.weight_g) as grams, sum(d.scan_count) as n
    from public.daily_totals d
    join public.companies c on c.id = d.company_id
    join public.bins b      on b.id = d.bin_id
    where not c.is_demo and not b.is_demo
      and c.archived_at is null and b.archived_at is null
    group by d.category
  )
  select
    round(coalesce(sum(t.grams), 0) / 1000.0, 3),
    coalesce(sum(t.n), 0)::bigint,
    (select count(*) from public.bins b join public.companies c on c.id = b.company_id
      where b.status = 'active' and not b.is_demo and b.archived_at is null and c.archived_at is null),
    (select count(distinct b.city) from public.bins b join public.companies c on c.id = b.company_id
      where not b.is_demo and b.archived_at is null and c.archived_at is null),
    coalesce(jsonb_object_agg(t.category, round(t.grams / 1000.0, 3))
               filter (where t.category is not null), '{}'::jsonb)
  from t
$$;

-- ---------------------------------------------------------------------------
-- Admin write policies
-- ---------------------------------------------------------------------------
create policy companies_admin_insert on public.companies
  for insert to authenticated with check (public.my_role() = 'admin');
create policy companies_admin_update on public.companies
  for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy companies_admin_delete on public.companies
  for delete to authenticated using (public.my_role() = 'admin' and not is_demo);

create policy products_admin_delete on public.products
  for delete to authenticated using (public.my_role() = 'admin');

create policy bins_admin_update on public.bins
  for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy bins_admin_delete on public.bins
  for delete to authenticated using (public.my_role() = 'admin' and not is_demo);

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin' and user_id <> (select auth.uid()))
  with check (public.my_role() = 'admin' and user_id <> (select auth.uid()));
create policy profiles_admin_delete on public.profiles
  for delete to authenticated using (public.my_role() = 'admin' and user_id <> (select auth.uid()));

create policy auditor_assignments_admin_insert on public.auditor_assignments
  for insert to authenticated with check (public.my_role() = 'admin');
create policy auditor_assignments_admin_delete on public.auditor_assignments
  for delete to authenticated using (public.my_role() = 'admin');
