-- ============================================================================
-- Tests for 20261109090000_admin_controls.sql
-- Run with: npx supabase test db
-- Admins decide what exists and what is visible; signed evidence is never deleted.
-- ============================================================================

begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner, no JWT)
--   A: has a signed scan (evidence)      B: brand new, nothing recorded
--   D: has a signed scan (stays visible) X: demo company
-- ---------------------------------------------------------------------------
insert into public.companies (id, name, is_demo) values
  ('a7000000-0000-4000-8000-00000000000a', 'Admin Test A', false),
  ('b7000000-0000-4000-8000-00000000000b', 'Admin Test B', false),
  ('d7000000-0000-4000-8000-00000000000d', 'Admin Test D', false),
  ('e7000000-0000-4000-8000-00000000000e', 'Admin Test Demo', true);

insert into auth.users (id, email) values
  ('17000000-0000-4000-8000-000000000001', 'admin-test@test'),
  ('27000000-0000-4000-8000-000000000002', 'company-a-test@test'),
  ('37000000-0000-4000-8000-000000000003', 'regulator-test@test'),
  ('47000000-0000-4000-8000-000000000004', 'auditor-test@test');

insert into public.profiles (user_id, role, company_id) values
  ('17000000-0000-4000-8000-000000000001', 'admin',     null),
  ('27000000-0000-4000-8000-000000000002', 'company',   'a7000000-0000-4000-8000-00000000000a'),
  ('37000000-0000-4000-8000-000000000003', 'regulator', null),
  ('47000000-0000-4000-8000-000000000004', 'auditor',   null);

insert into public.products (id, company_id, product_code, name, barcode, category, unit_weight_g, approved) values
  ('a7100000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-00000000000a', 'P7101', 'A scanned', '8907777700011', 'cat1_rigid', 24, true),
  ('a7100000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-00000000000a', 'P7102', 'A unused',  '8907777700028', 'cat1_rigid', 30, false),
  ('d7100000-0000-4000-8000-000000000001', 'd7000000-0000-4000-8000-00000000000d', 'P7401', 'D scanned', '8907777700035', 'cat1_rigid', 40, true);

insert into public.bins (id, company_id, city, public_key, chain_head, is_demo, created_at) values
  ('VB-PUN-7101', 'a7000000-0000-4000-8000-00000000000a', 'PUN', 'pk', repeat('0', 64), false, now() - interval '3 days'),
  ('VB-PUN-7102', 'a7000000-0000-4000-8000-00000000000a', 'PUN', 'pk', repeat('0', 64), false, now() - interval '3 days'),
  ('VB-MUM-7401', 'd7000000-0000-4000-8000-00000000000d', 'MUM', 'pk', repeat('0', 64), false, now() - interval '3 days');

create temp table t_ts as
select to_char((now() - interval '2 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ts;
select public.ingest_scan('v1|VB-PUN-7101|1|' || ts || '|barcode|8907777700011|24', 'sig', now() - interval '2 days') from t_ts;
select public.ingest_scan('v1|VB-MUM-7401|1|' || ts || '|barcode|8907777700035|40', 'sig', now() - interval '2 days') from t_ts;

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
-- rows an UPDATE/DELETE actually touched, as the current role (RLS applies)
create or replace function pg_temp.affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

create temp table t_before as select total_scans from public.get_public_stats();
grant select on t_before to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Admin: add, rename, archive, restore, safe delete
-- ---------------------------------------------------------------------------
select pg_temp.act_as('17000000-0000-4000-8000-000000000001');
set local role authenticated;

select lives_ok($$ insert into public.companies (name) values ('Admin Test New Co') $$, 'admin can add a company');
select is(pg_temp.affected($q$update public.companies set name = 'Admin Test A (renamed)' where id = 'a7000000-0000-4000-8000-00000000000a'$q$), 1,
          'admin can rename a company');
select is(pg_temp.affected($q$update public.companies set archived_at = now() where id = 'a7000000-0000-4000-8000-00000000000a'$q$), 1,
          'admin can archive (hide) a company');
select is((select count(*) from public.companies where id = 'a7000000-0000-4000-8000-00000000000a')::int, 1,
          'admin still sees an archived company, to restore it');
select is(pg_temp.affected($q$delete from public.companies where id = 'b7000000-0000-4000-8000-00000000000b'$q$), 1,
          'admin can delete a company with no signed scans');
select throws_ok($$ delete from public.companies where id = 'd7000000-0000-4000-8000-00000000000d' $$, '23503', null,
                 'a company with signed scans cannot be deleted: evidence is kept');
select throws_ok($$ delete from public.companies where id = 'a7000000-0000-4000-8000-00000000000a' $$, '23514', null,
                 'a company that still has users cannot be deleted until they are removed or moved');
select is(pg_temp.affected($q$delete from public.companies where id = 'e7000000-0000-4000-8000-00000000000e'$q$), 0,
          'the demo company cannot be deleted');

select is(pg_temp.affected($q$delete from public.products where id = 'a7100000-0000-4000-8000-000000000002'$q$), 1,
          'admin can delete a product that was never scanned');
select throws_ok($$ delete from public.products where id = 'a7100000-0000-4000-8000-000000000001' $$, '23503', null,
                 'a product with signed scans cannot be deleted');
select is(pg_temp.affected($q$update public.products set archived_at = now() where id = 'a7100000-0000-4000-8000-000000000001'$q$), 1,
          'admin can archive a product instead');

select is(pg_temp.affected($q$update public.bins set status = 'revoked' where id = 'VB-PUN-7101'$q$), 1,
          'admin can revoke a bin');
select is(pg_temp.affected($q$update public.bins set archived_at = now() where id = 'VB-PUN-7101'$q$), 1,
          'admin can archive a bin');
select is(pg_temp.affected($q$delete from public.bins where id = 'VB-PUN-7102'$q$), 1,
          'admin can delete a bin that never reported');
select throws_ok($$ delete from public.bins where id = 'VB-PUN-7101' $$, '23503', null,
                 'a bin with signed scans cannot be deleted');

select is(pg_temp.affected($q$update public.profiles set role = 'regulator' where user_id = '47000000-0000-4000-8000-000000000004'$q$), 1,
          'admin can change another user''s role');
select is(pg_temp.affected($q$update public.profiles set role = 'company' where user_id = '17000000-0000-4000-8000-000000000001'$q$), 0,
          'admin cannot change their own role (no self lock-out)');
select is(pg_temp.affected($q$delete from public.profiles where user_id = '17000000-0000-4000-8000-000000000001'$q$), 0,
          'admin cannot delete their own profile');
update public.profiles set role = 'auditor' where user_id = '47000000-0000-4000-8000-000000000004';
select lives_ok($$ insert into public.auditor_assignments (auditor_id, company_id) values ('47000000-0000-4000-8000-000000000004', 'd7000000-0000-4000-8000-00000000000d') $$,
                'admin can assign a company to an auditor');
select is(pg_temp.affected($q$delete from public.auditor_assignments where auditor_id = '47000000-0000-4000-8000-000000000004'$q$), 1,
          'admin can remove an auditor assignment');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Archived company is hidden from everyone else, and from public totals
-- ---------------------------------------------------------------------------
select pg_temp.act_as('37000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*) from public.companies where id = 'a7000000-0000-4000-8000-00000000000a')::int, 0,
          'a regulator no longer sees an archived company');
select is((select count(*) from public.companies where id = 'd7000000-0000-4000-8000-00000000000d')::int, 1,
          'other companies stay visible');
select is(pg_temp.affected($q$update public.companies set name = 'nope' where id = 'd7000000-0000-4000-8000-00000000000d'$q$), 0,
          'a regulator cannot edit companies');
reset role;

select pg_temp.act_as('27000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*) from public.scans where company_id = 'a7000000-0000-4000-8000-00000000000a')::int, 0,
          'users of an archived company see none of its data');
reset role;

select is((select total_scans from public.get_public_stats()), (select total_scans - 1 from t_before),
          'public national totals leave out the archived company''s scans');

select * from finish();
rollback;
