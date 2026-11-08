-- ============================================================================
-- Tests for 20261109120000_company_erasure.sql
-- Run with: npx supabase test db
-- An admin can erase a whole company, scans included, only through
-- erase_company(), and every erasure is logged. The ledger stays append-only
-- for everything else.
-- ============================================================================

begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
--   A: has a scan, a user, a product, a bin   K: has a scan (must survive)
--   X: demo company
-- ---------------------------------------------------------------------------
insert into public.companies (id, name, is_demo) values
  ('a8000000-0000-4000-8000-00000000000a', 'Erase Test   A', false),
  ('c8000000-0000-4000-8000-00000000000c', 'Erase Test Keep', false),
  ('e8000000-0000-4000-8000-00000000000e', 'Erase Test Demo', true);

insert into auth.users (id, email) values
  ('18000000-0000-4000-8000-000000000001', 'erase-admin@test'),
  ('28000000-0000-4000-8000-000000000002', 'erase-company-a@test'),
  ('38000000-0000-4000-8000-000000000003', 'erase-regulator@test'),
  ('48000000-0000-4000-8000-000000000004', 'erase-company-k@test');

insert into public.profiles (user_id, role, company_id) values
  ('18000000-0000-4000-8000-000000000001', 'admin',     null),
  ('28000000-0000-4000-8000-000000000002', 'company',   'a8000000-0000-4000-8000-00000000000a'),
  ('38000000-0000-4000-8000-000000000003', 'regulator', null),
  ('48000000-0000-4000-8000-000000000004', 'company',   'c8000000-0000-4000-8000-00000000000c');

insert into public.products (id, company_id, product_code, name, barcode, category, unit_weight_g, approved) values
  ('a8100000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-00000000000a', 'P8101', 'A scanned', '8908888800011', 'cat1_rigid', 24, true),
  ('c8100000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-00000000000c', 'P8401', 'K scanned', '8908888800035', 'cat1_rigid', 40, true);

insert into public.bins (id, company_id, city, public_key, chain_head, is_demo, created_at) values
  ('VB-PUN-8101', 'a8000000-0000-4000-8000-00000000000a', 'PUN', 'pk', repeat('0', 64), false, now() - interval '3 days'),
  ('VB-MUM-8401', 'c8000000-0000-4000-8000-00000000000c', 'MUM', 'pk', repeat('0', 64), false, now() - interval '3 days');

create temp table t_ts as
select to_char((now() - interval '2 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ts;
select public.ingest_scan('v1|VB-PUN-8101|1|' || ts || '|barcode|8908888800011|24', 'sig', now() - interval '2 days') from t_ts;
select public.ingest_scan('v1|VB-MUM-8401|1|' || ts || '|barcode|8908888800035|40', 'sig', now() - interval '2 days') from t_ts;

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- 1. The ledger is still append-only outside erase_company()
-- ---------------------------------------------------------------------------
select throws_ok($$ delete from public.scans where company_id = 'a8000000-0000-4000-8000-00000000000a' $$, '23001', null,
                 'even the table owner cannot delete scans directly');
select throws_ok($$ select set_config('veribin.erasing_company', 'c8000000-0000-4000-8000-00000000000c', true);
                    delete from public.scans where company_id = 'a8000000-0000-4000-8000-00000000000a' $$, '23001', null,
                 'the erase setting for one company does not unlock another company''s scans');
select set_config('veribin.erasing_company', '', true);
select throws_ok($$ update public.scans set weight_g = 1 where company_id = 'a8000000-0000-4000-8000-00000000000a' $$, '23001', null,
                 'scans can never be edited');

-- ---------------------------------------------------------------------------
-- 2. Who may erase, and the safety checks
-- ---------------------------------------------------------------------------
select pg_temp.act_as('28000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$ select public.erase_company('a8000000-0000-4000-8000-00000000000a', 'Erase Test A', 'Company asked to leave') $$, '42501', null,
                 'a company user cannot erase');
select throws_ok($$ delete from public.scans where company_id = 'a8000000-0000-4000-8000-00000000000a' $$, '42501', null,
                 'API roles have no DELETE on scans at all');
reset role;

select pg_temp.act_as('38000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$ select public.erase_company('a8000000-0000-4000-8000-00000000000a', 'Erase Test A', 'Company asked to leave') $$, '42501', null,
                 'a regulator cannot erase');
reset role;

select pg_temp.act_as('18000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$ select public.erase_company('e8000000-0000-4000-8000-00000000000e', 'Erase Test Demo', 'Company asked to leave') $$, '42501', null,
                 'the demo company cannot be erased');
select throws_ok($$ select public.erase_company('a8000000-0000-4000-8000-00000000000a', 'Erase Test B', 'Company asked to leave') $$, '22023', null,
                 'the typed name must match');
select throws_ok($$ select public.erase_company('a8000000-0000-4000-8000-00000000000a', 'Erase Test A', 'too short') $$, '22023', null,
                 'a reason of at least 10 characters is required');
select throws_ok($$ select public.erase_company('f8000000-0000-4000-8000-00000000000f', 'Nobody', 'Company asked to leave') $$, 'P0002', null,
                 'an unknown company is reported as not found');

-- ---------------------------------------------------------------------------
-- 3. A successful erase (name typed with different spacing still matches)
-- ---------------------------------------------------------------------------
select is((public.erase_company('a8000000-0000-4000-8000-00000000000a', '  Erase Test A ', 'Company left the EPR scheme'))->>'scans', '1',
          'admin erases the company and gets the scan count back');
reset role;

select is((select count(*) from public.companies where id = 'a8000000-0000-4000-8000-00000000000a')::int, 0, 'the company is gone');
select is((select count(*) from public.scans where company_id = 'a8000000-0000-4000-8000-00000000000a')::int, 0, 'its scans are gone');
select is((select count(*) from public.bins where id = 'VB-PUN-8101')::int, 0, 'its bins are gone');
select is((select count(*) from public.products where company_id = 'a8000000-0000-4000-8000-00000000000a')::int, 0, 'its products are gone');
select is((select count(*) from auth.users where id = '28000000-0000-4000-8000-000000000002')::int, 0, 'its users can no longer sign in');
select is((select count(*) from public.scans where company_id = 'c8000000-0000-4000-8000-00000000000c')::int, 1,
          'other companies keep their scans');
select is((select bin_ids from public.erasures where company_id = 'a8000000-0000-4000-8000-00000000000a'), array['VB-PUN-8101'],
          'the erasure is logged with the bins whose chains were removed');

-- ---------------------------------------------------------------------------
-- 4. The log is append-only, private, and public in outline
-- ---------------------------------------------------------------------------
select throws_ok($$ delete from public.erasures $$, '23001', null, 'the erasure log cannot be deleted');
select throws_ok($$ update public.erasures set reason = 'changed my mind' $$, '23001', null, 'the erasure log cannot be edited');

select pg_temp.act_as('48000000-0000-4000-8000-000000000004');
set local role authenticated;
select is((select count(*) from public.erasures)::int, 0, 'a company user cannot read the erasure log');
reset role;

set local role anon;
select is((select count(*) from public.get_public_erasures() where company_name = 'Erase Test   A')::int, 1,
          'anyone can see that an erasure happened (what and when, not why or who)');
reset role;

select * from finish();
rollback;
