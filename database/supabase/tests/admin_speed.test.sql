-- ============================================================================
-- Tests for 20261109130000_admin_speed.sql
-- Run with: npx supabase test db
-- can_see_company runs once per row of every RLS-protected read, so it must
-- look the caller's role up once, not twice. The Manage page gets its signed
-- scan counts from one grouped call instead of paging totals per row.
-- ============================================================================

begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
set local track_functions = 'all';   -- count function calls inside this transaction

select plan(9);

insert into public.companies (id, name, is_demo) values
  ('a9000000-0000-4000-8000-00000000000a', 'Speed Test A', false),
  ('b9000000-0000-4000-8000-00000000000b', 'Speed Test B', false);

insert into auth.users (id, email) values
  ('19000000-0000-4000-8000-000000000001', 'speed-admin@test'),
  ('29000000-0000-4000-8000-000000000002', 'speed-company-a@test'),
  ('39000000-0000-4000-8000-000000000003', 'speed-regulator@test');

insert into public.profiles (user_id, role, company_id) values
  ('19000000-0000-4000-8000-000000000001', 'admin',     null),
  ('29000000-0000-4000-8000-000000000002', 'company',   'a9000000-0000-4000-8000-00000000000a'),
  ('39000000-0000-4000-8000-000000000003', 'regulator', null);

insert into public.products (id, company_id, product_code, name, barcode, category, unit_weight_g, approved) values
  ('a9100000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-00000000000a', 'P9101', 'A one', '8909191900011', 'cat1_rigid', 24, true),
  ('a9100000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-00000000000a', 'P9102', 'A two', '8909191900028', 'cat1_rigid', 30, true);

insert into public.bins (id, company_id, city, public_key, chain_head, is_demo, created_at) values
  ('VB-PUN-9101', 'a9000000-0000-4000-8000-00000000000a', 'PUN', 'pk', repeat('0', 64), false, now() - interval '3 days');

create temp table t_ts as
select to_char((now() - interval '2 days' + make_interval(hours => g)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ts, g
from generate_series(1, 3) g;
select public.ingest_scan('v1|VB-PUN-9101|' || g || '|' || ts || '|barcode|' || case when g < 3 then '8909191900011|24' else '8909191900028|30' end,
                          'sig', now() - interval '2 days' + make_interval(hours => g))
from t_ts order by g;

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.role_calls() returns bigint language sql as $$
  select coalesce(pg_stat_get_xact_function_calls('public.my_role'::regproc), 0)
$$;

create temp table t_rows as select count(*)::bigint as n from public.daily_totals;
create temp table t_calls (who text, calls bigint);
grant select, insert on t_rows, t_calls to authenticated;

-- ---------------------------------------------------------------------------
-- 1. One role lookup per row, not two
-- ---------------------------------------------------------------------------
select pg_temp.act_as('19000000-0000-4000-8000-000000000001');
insert into t_calls select 'admin-before', pg_temp.role_calls();
set local role authenticated;
select count(*) from public.daily_totals;
reset role;
insert into t_calls select 'admin-after', pg_temp.role_calls();
select cmp_ok((select calls from t_calls where who = 'admin-after') - (select calls from t_calls where who = 'admin-before'),
              '<=', (select n from t_rows),
              'reading daily totals as an admin looks the role up at most once per row');

select pg_temp.act_as('39000000-0000-4000-8000-000000000003');
insert into t_calls select 'reg-before', pg_temp.role_calls();
set local role authenticated;
select count(*) from public.daily_totals;
reset role;
insert into t_calls select 'reg-after', pg_temp.role_calls();
select cmp_ok((select calls from t_calls where who = 'reg-after') - (select calls from t_calls where who = 'reg-before'),
              '<=', (select n from t_rows),
              'reading daily totals as a regulator looks the role up at most once per row');

-- Same visibility as before
update public.companies set archived_at = now() where id = 'b9000000-0000-4000-8000-00000000000b';
set local role authenticated;
select is((select count(*) from public.companies where id = 'b9000000-0000-4000-8000-00000000000b')::int, 0,
          'a regulator still cannot see an archived company');
reset role;
select pg_temp.act_as('29000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*) from public.companies where id in ('a9000000-0000-4000-8000-00000000000a', 'b9000000-0000-4000-8000-00000000000b'))::int, 1,
          'a company user still sees only their own company');
reset role;

-- ---------------------------------------------------------------------------
-- 2. admin_scan_counts: one grouped call for the Manage page
-- ---------------------------------------------------------------------------
select pg_temp.act_as('29000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$ select * from public.admin_scan_counts() $$, '42501', null, 'only an admin can list scan counts');
reset role;

select pg_temp.act_as('19000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select scans from public.admin_scan_counts() where kind = 'company' and id = 'a9000000-0000-4000-8000-00000000000a'), 3::bigint,
          'signed scans per company');
select is((select scans from public.admin_scan_counts() where kind = 'bin' and id = 'VB-PUN-9101'), 3::bigint,
          'signed scans per bin');
select is((select scans from public.admin_scan_counts() where kind = 'product' and id = 'a9100000-0000-4000-8000-000000000002'), 1::bigint,
          'signed scans per product');
select is((select count(*) from public.admin_scan_counts() where id = 'b9000000-0000-4000-8000-00000000000b')::int, 0,
          'records with no scans are simply absent (count as 0)');
reset role;

select * from finish();
rollback;
