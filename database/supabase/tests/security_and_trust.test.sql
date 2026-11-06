-- ============================================================================
-- D7–D16 tests: roles and RLS, QR issuing, AI role, chain verification,
-- checkpoints, reports, realtime topics, and the D5 fixes.
-- Run with: npx supabase test db
-- ============================================================================

begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(38);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner, no JWT)
-- ---------------------------------------------------------------------------
insert into public.companies (id, name) values
  ('a0000000-0000-4000-8000-000000000001', 'Company A'),
  ('b0000000-0000-4000-8000-000000000002', 'Company B');

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@test'),
  ('20000000-0000-4000-8000-000000000002', 'b@test'),
  ('30000000-0000-4000-8000-000000000003', 'auditor@test'),
  ('40000000-0000-4000-8000-000000000004', 'regulator@test'),
  ('50000000-0000-4000-8000-000000000005', 'admin@test');

insert into public.profiles (user_id, role, company_id) values
  ('10000000-0000-4000-8000-000000000001', 'company',   'a0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'company',   'b0000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003', 'auditor',   null),
  ('40000000-0000-4000-8000-000000000004', 'regulator', null),
  ('50000000-0000-4000-8000-000000000005', 'admin',     null);

insert into public.auditor_assignments (auditor_id, company_id) values
  ('30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001');

insert into public.products (id, company_id, product_code, name, barcode, category, unit_weight_g, approved) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'P0101', 'A bottle', '8901234500011', 'cat1_rigid', 24, true),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'P0201', 'B pouch',  '8901234500028', 'cat2_flexible', 6, true);

insert into public.bins (id, company_id, city, public_key, chain_head, created_at) values
  ('VB-PUN-0101', 'a0000000-0000-4000-8000-000000000001', 'PUN', 'pkA', repeat('0', 64), now() - interval '3 days'),
  ('VB-MUM-0201', 'b0000000-0000-4000-8000-000000000002', 'MUM', 'pkB', repeat('0', 64), now() - interval '3 days');

-- Two scans for A, one for B, all two days ago (so they sit before yesterday's checkpoint)
create temp table t_ts as
select to_char((now() - interval '2 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ts1,
       to_char((now() - interval '2 days' + interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ts2;

select public.ingest_scan('v1|VB-PUN-0101|1|' || ts1 || '|barcode|8901234500011|24', 'sig', now() - interval '2 days') from t_ts;
select public.ingest_scan('v1|VB-PUN-0101|2|' || ts2 || '|barcode|8901234500011|23', 'sig', now() - interval '2 days') from t_ts;
select public.ingest_scan('v1|VB-MUM-0201|1|' || ts1 || '|barcode|8901234500028|6',  'sig', now() - interval '2 days') from t_ts;

select is((select count(*) from public.scans)::int, 3, 'fixture: three scans ingested');

-- helper to act as a user
create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- RLS: who sees what
-- ---------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*) from public.scans)::int, 2, 'company A sees only its 2 scans');
select is((select count(*) from public.bins)::int, 1, 'company A sees only its bin');
select is((select count(*) from public.companies)::int, 1, 'company A sees only itself');
select is((select collected_kg from public.get_kpis_by_category(current_date - 30, current_date) where category = 'cat1_rigid'),
          0.048, 'KPIs for A: 2 x 24 g catalogue weight = 0.048 kg');
select is((select count(*) from public.get_bin_list())::int, 1, 'get_bin_list returns only A''s bin');
select is((select ok from public.verify_chain('VB-PUN-0101')), true, 'A can verify its own chain');
select is((select reason from public.verify_chain('VB-MUM-0201')), 'unknown_bin', 'A cannot see B''s bin');
select ok(public.can_join_topic('company:a0000000-0000-4000-8000-000000000001'), 'A may join its company channel');
select ok(not public.can_join_topic('company:b0000000-0000-4000-8000-000000000002'), 'A may NOT join B''s channel');
select ok(not public.can_join_topic('company:not-a-uuid'), 'junk topic is refused, not an error');
select ok(public.can_join_topic('demo'), 'anyone may join demo');
select throws_ok($$ insert into public.scans (bin_id, company_id, sequence, scanned_at, code_type, code, weight_g, record_text, signature, record_hash, prev_chain_hash, chain_hash)
                   values ('VB-PUN-0101','a0000000-0000-4000-8000-000000000001',99,now(),'barcode','1',1,'x','x',repeat('0',64),repeat('0',64),repeat('0',64)) $$,
                 '42501', null, 'a logged-in user cannot insert into the ledger');
reset role;

select pg_temp.act_as('20000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*) from public.scans)::int, 1, 'company B sees only its 1 scan');
reset role;

select pg_temp.act_as('30000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*) from public.scans)::int, 2, 'auditor sees only the assigned company (A)');
reset role;

select pg_temp.act_as('40000000-0000-4000-8000-000000000004');
set local role authenticated;
select is((select count(*) from public.scans)::int, 3, 'regulator sees every scan');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select count(*) from public.checkpoints)::int, 0, 'anon can read checkpoints (none yet)');
select throws_ok($$ select count(*) from public.scans $$, '42501', null, 'anon cannot read scans at all');
select ok((select total_scans from public.get_public_stats()) = 3, 'anon gets national stats');
reset role;

-- ---------------------------------------------------------------------------
-- Products and QR issuing
-- ---------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
set local role authenticated;
insert into public.products (company_id, name, barcode, category, unit_weight_g, approved)
values ('a0000000-0000-4000-8000-000000000001', 'New A product', '8901234500035', 'cat3_multilayer', 9, true);
select is((select approved from public.products where name = 'New A product'), false, 'new product is forced to approved = false');
select ok((select product_code from public.products where name = 'New A product') ~ '^P[0-9]{4}$', 'product code issued by the database');
select throws_ok($$ update public.products set approved = true where name = 'New A product' $$, '42501', null, 'company cannot approve its own product');
select is((select count(*) from public.issue_qr_codes('a1000000-0000-4000-8000-000000000001', 5))::int, 5, 'company issues 5 codes for its approved product');
select ok((select bool_and(qr_payload ~ '^VBQ1\.P0101\.[0-9a-f]{32}$') from public.issue_qr_codes('a1000000-0000-4000-8000-000000000001', 3)), 'payload format VBQ1.<code>.<32 hex>');
select throws_ok($$ select * from public.issue_qr_codes('b1000000-0000-4000-8000-000000000001', 1) $$, '42501', null, 'cannot issue codes for another company''s product');
reset role;

select pg_temp.act_as('50000000-0000-4000-8000-000000000005');
set local role authenticated;
update public.products set approved = true where name = 'New A product';
select is((select approved from public.products where name = 'New A product'), true, 'admin approves a product');
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- D5 fixes
-- ---------------------------------------------------------------------------
-- A's QR code scanned in B's bin: rejected and NOT burned
create temp table t_qr as select serial from public.qr_codes limit 1;
select is((select public.ingest_scan('v1|VB-MUM-0201|2|' || (select ts2 from t_ts) || '|qr|VBQ1.P0101.' || serial || '|24', 'sig', now() - interval '2 days')->>'reason' from t_qr),
          'qr_unknown', 'QR of another company is rejected');
select is((select redeemed_at from public.qr_codes where serial = (select serial from t_qr)), null, 'rejected QR scan does not burn the code');
select is((public.ingest_scan('v1|VB-PUN-0101|3|2026-13-45T99:00:00Z|barcode|8901234500011|24', 'sig'))->>'reason', 'bad_format', 'impossible date is bad_format, not a crash');
select is((public.ingest_scan('v1|VB-PUN-0101|3|' || (select ts2 from t_ts) || '|qr2|x|24', 'sig'))->>'reason', 'bad_format', 'unknown code_type is bad_format, not a crash');

-- ---------------------------------------------------------------------------
-- AI role
-- ---------------------------------------------------------------------------
-- (test-only: let the AI role call pgTAP's assertion functions)
grant usage on schema extensions to ai_job_role;
-- (test-only: on Supabase, postgres is not a superuser; PG16+ needs SET on the membership to switch role. Rolled back with the test.)
grant ai_job_role to postgres with set true;
set local role ai_job_role;
select is((select count(*) from public.scans)::int, 3, 'AI role reads every scan');
select lives_ok($$ insert into public.bin_scores (bin_id, day, score, reasons, scans_considered) values ('VB-PUN-0101', current_date, 90, '[]', 2) $$, 'AI role writes bin scores');
select throws_ok($$ insert into public.scans (bin_id, company_id, sequence, scanned_at, code_type, code, weight_g, record_text, signature, record_hash, prev_chain_hash, chain_hash)
                   values ('VB-PUN-0101','a0000000-0000-4000-8000-000000000001',99,now(),'barcode','1',1,'x','x',repeat('0',64),repeat('0',64),repeat('0',64)) $$,
                 '42501', null, 'AI role cannot write the ledger');
reset role;

-- ---------------------------------------------------------------------------
-- Checkpoint + report + verify
-- ---------------------------------------------------------------------------
select public.make_checkpoint();
select is((select hash from public.make_checkpoint()), (select hash from public.checkpoints order by day desc limit 1), 'checkpoint is idempotent');

select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
set local role authenticated;
create temp table t_rep as select * from public.create_report('cat1_rigid', current_date - 30, current_date);
select is((select scan_count from t_rep)::int, 2, 'report includes A''s 2 checkpointed scans');
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('test.report_id', (select id::text from t_rep), true);

set local role anon;
select is((public.verify_report(current_setting('test.report_id')::uuid))->>'match', 'true', 'untouched report verifies as a match');
reset role;

-- Tamper: edit one weight as the table owner (the "insider" scenario)
alter table public.scans disable trigger scans_no_update_delete;
update public.scans set weight_g = 240 where bin_id = 'VB-PUN-0101' and sequence = 1;
alter table public.scans enable trigger scans_no_update_delete;
select is((select reason from public.verify_chain('VB-PUN-0101')), 'columns_differ_from_signed_text', 'verify_chain catches an edited weight');

update public.reports set fingerprint = repeat('a', 64) where id = (select id from t_rep);
set local role anon;
select is((public.verify_report(current_setting('test.report_id')::uuid))->>'match', 'false', 'altered fingerprint verifies as a MISMATCH');
reset role;

select * from finish();
rollback;
