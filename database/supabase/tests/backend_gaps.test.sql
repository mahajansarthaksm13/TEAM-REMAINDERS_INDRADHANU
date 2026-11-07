-- ============================================================================
-- Tests for 20261108090000_backend_gaps.sql
-- Run with: npx supabase test db
-- ============================================================================

begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner, no JWT)
-- ---------------------------------------------------------------------------
insert into public.companies (id, name) values
  ('a0000000-0000-4000-8000-000000000001', 'Company A'),
  ('b0000000-0000-4000-8000-000000000002', 'Company B');

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@test'),
  ('40000000-0000-4000-8000-000000000004', 'regulator@test');

insert into public.profiles (user_id, role, company_id) values
  ('10000000-0000-4000-8000-000000000001', 'company',   'a0000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004', 'regulator', null);

insert into public.products (id, company_id, product_code, name, barcode, category, unit_weight_g, approved) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'P0101', 'A bottle', '8901234500011', 'cat1_rigid', 24, true),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'P0201', 'B bottle', '8901234500028', 'cat1_rigid', 50, true);

insert into public.bins (id, company_id, city, public_key, chain_head, is_demo, created_at) values
  ('VB-PUN-0101', 'a0000000-0000-4000-8000-000000000001', 'PUN', 'pk', repeat('0', 64), false, now() - interval '3 days'),
  ('VB-PUN-0102', 'a0000000-0000-4000-8000-000000000001', 'PUN', 'pk', repeat('0', 64), true,  now() - interval '3 days'),
  ('VB-MUM-0201', 'b0000000-0000-4000-8000-000000000002', 'MUM', 'pk', repeat('0', 64), false, now() - interval '3 days'),
  ('VB-NAG-0301', 'b0000000-0000-4000-8000-000000000002', 'NAG', 'pk', repeat('0', 64), false, now() - interval '3 days');

create temp table t_ts as
select to_char((now() - interval '2 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ts;

-- A: one scan on a normal bin, one on a demo (test) bin. B: one scan.
select public.ingest_scan('v1|VB-PUN-0101|1|' || ts || '|barcode|8901234500011|24', 'sig', now() - interval '2 days') from t_ts;
select public.ingest_scan('v1|VB-PUN-0102|1|' || ts || '|barcode|8901234500011|24', 'sig', now() - interval '2 days') from t_ts;
select public.ingest_scan('v1|VB-MUM-0201|1|' || ts || '|barcode|8901234500028|50', 'sig', now() - interval '2 days') from t_ts;
select public.make_checkpoint();

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- 1. issue_qr_codes returns the batch id (the web app pages qr_codes by it)
-- ---------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
set local role authenticated;
create temp table t_codes as select * from public.issue_qr_codes('a1000000-0000-4000-8000-000000000001', 4);
select is((select count(distinct batch_id) from t_codes)::int, 1, 'every row of one call carries the same batch_id');
select is((select quantity from public.qr_batches where id = (select batch_id from t_codes limit 1)), 4, 'batch_id points at the new qr_batches row');
select is((select count(*) from public.qr_codes where batch_id = (select batch_id from t_codes limit 1))::int, 4, 'the company can page the batch''s codes from qr_codes');
select ok((select bool_and(qr_payload = 'VBQ1.P0101.' || qr_serial) from t_codes), 'payload is still VBQ1.<code>.<serial>');

-- ---------------------------------------------------------------------------
-- 2. No empty reports
-- ---------------------------------------------------------------------------
select throws_ok($$ select * from public.create_report('cat4_compostable', current_date - 30, current_date) $$,
                 'P0002', 'no checkpointed scans in this period', 'empty period is refused, nothing stored');
select is((select count(*) from public.reports)::int, 0, 'no report row was written');
select is((select scan_count from public.create_report('cat1_rigid', current_date - 30, current_date))::int, 1,
          'a real period still works and skips the demo bin''s scan');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Company scope on the read functions, demo bins excluded
-- ---------------------------------------------------------------------------
select pg_temp.act_as('40000000-0000-4000-8000-000000000004');
set local role authenticated;
select is((select collected_kg from public.get_kpis_by_category(current_date - 30, current_date) where category = 'cat1_rigid'),
          0.074, 'regulator, all companies: 24 g (A) + 50 g (B); A''s demo-bin scan not counted');
select is((select collected_kg from public.get_kpis_by_category(current_date - 30, current_date, 'b0000000-0000-4000-8000-000000000002') where category = 'cat1_rigid'),
          0.050, 'regulator scoped to B sees only B');
select is((select sum(collected_kg) from public.get_monthly_trend(current_date - 30, current_date, 'a0000000-0000-4000-8000-000000000001')),
          0.024, 'trend scoped to A, demo bin excluded');
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 4. Offline alerts only for bins that have reported before
-- ---------------------------------------------------------------------------
select public.mark_offline_bins();
select is((select array_agg(bin_id order by bin_id) from public.alerts where kind = 'bin_offline' and closed_at is null),
          array['VB-MUM-0201', 'VB-PUN-0101'],
          'quiet bins that reported get an alert; never-seen and demo bins do not');
select is(public.mark_offline_bins(), 0, 'running again does not duplicate open alerts');

select * from finish();
rollback;
