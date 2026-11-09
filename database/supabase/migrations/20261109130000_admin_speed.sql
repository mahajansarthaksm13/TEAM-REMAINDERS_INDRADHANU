-- ============================================================================
-- Admin speed (web A19, follows 20261109090000_admin_controls)
--
--  * can_see_company runs once per row of every RLS-protected read. The archive
--    check added in admin_controls called my_role() a second time per row, which
--    doubled the cost of every dashboard read. Same rules, one role lookup per
--    row: admins and regulators return early; the archive check runs only for
--    roles that can see a company at all.
--  * admin_scan_counts(): the Manage page's signed-scan counts per company, bin
--    and product in one grouped call, instead of paging daily totals through RLS
--    and one count per product.
--
-- Tests: supabase/tests/admin_speed.test.sql
-- ============================================================================

create or replace function public.can_see_company(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.my_role();
begin
  if v_role = 'admin' then
    return true;                       -- admins see everything, archived included
  end if;
  if not coalesce(case v_role
            when 'regulator' then true
            when 'company'   then p_company_id = public.my_company()
            when 'auditor'   then exists (
              select 1 from public.auditor_assignments a
              where a.auditor_id = (select auth.uid()) and a.company_id = p_company_id)
            else false
          end, false) then
    return false;
  end if;
  -- archived companies are visible to admins only
  return not exists (select 1 from public.companies c where c.id = p_company_id and c.archived_at is not null);
end;
$$;

create or replace function public.admin_scan_counts()
returns table (kind text, id text, scans bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'only an admin can list scan counts' using errcode = '42501';
  end if;
  return query
    select 'company', s.company_id::text, count(*) from public.scans s group by s.company_id
    union all
    select 'bin', s.bin_id, count(*) from public.scans s group by s.bin_id
    union all
    select 'product', s.product_id::text, count(*) from public.scans s where s.product_id is not null group by s.product_id;
end;
$$;

comment on function public.admin_scan_counts() is
  'Admin only. Signed scans per company, bin and product, for the Manage page. Records with no scans are absent.';

revoke all on function public.admin_scan_counts() from public, anon;
grant execute on function public.admin_scan_counts() to authenticated;
