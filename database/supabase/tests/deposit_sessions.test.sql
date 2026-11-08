-- ============================================================================
-- Tests for 20261110090000_deposit_sessions.sql
-- Run with: npx supabase test db
-- A QR scan only opens the bin and creates a PENDING entry. A deposit counts
-- only after the database's deposit policy says so and the real ledger
-- (ingest_scan) accepts the signed record. Pending and rejected attempts never
-- become scans.
-- ============================================================================

begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- ---------------------------------------------------------------------------
-- Fixtures: a demo company + demo bin, and a real company + real bin
-- ---------------------------------------------------------------------------
insert into public.companies (id, name, is_demo) values
  ('d5000000-0000-4000-8000-00000000000d', 'Session Test Demo', true),
  ('c5000000-0000-4000-8000-00000000000c', 'Session Test Real', false);

insert into public.products (id, company_id, product_code, name, barcode, category, unit_weight_g, approved) values
  ('d5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-00000000000d', 'P5501', 'Demo jar', '8905555500011', 'cat1_rigid', 24, true),
  ('c5100000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-00000000000c', 'P5502', 'Real jar', '8905555500028', 'cat1_rigid', 30, true),
  ('d5100000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-00000000000d', 'P5503', 'Unapproved demo', '8905555500035', 'cat1_rigid', 10, false);

insert into public.bins (id, company_id, city, public_key, chain_head, is_demo) values
  ('VB-PUN-5501-DEMO', 'd5000000-0000-4000-8000-00000000000d', 'PUN', 'pk', repeat('0', 64), true),
  ('VB-PUN-5502',      'c5000000-0000-4000-8000-00000000000c', 'PUN', 'pk', repeat('0', 64), false);

insert into public.qr_batches (id, product_id, quantity) values
  ('e5000000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001', 4),
  ('e5000000-0000-4000-8000-000000000002', 'c5100000-0000-4000-8000-000000000001', 1),
  ('e5000000-0000-4000-8000-000000000003', 'd5100000-0000-4000-8000-000000000002', 1);
insert into public.qr_codes (serial, batch_id, product_id) values
  (repeat('a', 32), 'e5000000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001'),
  (repeat('b', 32), 'e5000000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001'),
  (repeat('c', 32), 'e5000000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001'),
  (repeat('d', 32), 'e5000000-0000-4000-8000-000000000002', 'c5100000-0000-4000-8000-000000000001'),
  (repeat('e', 32), 'e5000000-0000-4000-8000-000000000003', 'd5100000-0000-4000-8000-000000000002'),
  (repeat('f', 32), 'e5000000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001');
update public.qr_codes set redeemed_at = now() where serial = repeat('f', 32);

create temp table t_s (name text primary key, id uuid);

-- ---------------------------------------------------------------------------
-- 1. Opening: only registered, unused, approved codes of the bin's company
-- ---------------------------------------------------------------------------
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('9', 32))->>'reason', 'qr_unknown',
          'an unregistered code keeps the lid shut');
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'not a code')->>'reason', 'qr_unknown',
          'a malformed code keeps the lid shut');
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('f', 32))->>'reason', 'qr_already_used',
          'a code that was already deposited keeps the lid shut');
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5502.' || repeat('d', 32))->>'reason', 'qr_unknown',
          'another company''s code does not open this bin');
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5503.' || repeat('e', 32))->>'reason', 'qr_unknown',
          'an unapproved product''s code does not open the bin');
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5502.' || repeat('a', 32))->>'reason', 'qr_unknown',
          'the product code in the payload must match the serial''s product');
select is(public.open_deposit_session('VB-PUN-5502', 'VBQ1.P5502.' || repeat('d', 32))->>'reason', 'not_a_demo_bin',
          'the simulator can only open demo bins');
select is(public.open_deposit_session('VB-XXX-0000', 'VBQ1.P5501.' || repeat('a', 32))->>'reason', 'unknown_bin',
          'an unknown bin is refused');
select is((select count(*) from public.deposit_sessions where bin_id = 'VB-PUN-5501-DEMO')::int, 0,
          'refused scans create no entry at all');

insert into t_s select 'A', (public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('a', 32))->>'session_id')::uuid;
select isnt((select id from t_s where name = 'A'), null, 'a registered code opens the bin and returns a session');
select is((select status from public.deposit_sessions where id = (select id from t_s where name = 'A')), 'pending',
          'the entry starts as pending');
select is((select redeemed_at from public.qr_codes where serial = repeat('a', 32)), null,
          'opening does not use up the code; only the ledger does');
select is(public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('a', 32))->>'reason', 'session_open',
          'the same code cannot open a second pending session');
select is((public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('a', 32)))->'product'->>'name', null,
          'a refused open reveals no product details');

-- ---------------------------------------------------------------------------
-- 2. The deposit policy (decided in the database, not the browser)
-- ---------------------------------------------------------------------------
insert into t_s select 'C', (public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('b', 32))->>'session_id')::uuid;
select is(public.decide_deposit((select id from t_s where name = 'C'), false, 0)->>'reason', 'no_deposit',
          'camera saw nothing and the weight did not change: rejected, nothing counted');
select is((select status from public.deposit_sessions where id = (select id from t_s where name = 'C')), 'rejected',
          'the no-deposit entry is stored as rejected');
select is(public.decide_deposit((select id from t_s where name = 'C'), true, 24)->>'decision', 'already_decided',
          'a decided entry cannot be decided again');
select is((select redeemed_at from public.qr_codes where serial = repeat('b', 32)), null,
          'a rejected deposit leaves the code unused');

insert into t_s select 'W', (public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('b', 32))->>'session_id')::uuid;
select is(public.decide_deposit((select id from t_s where name = 'W'), false, 30)->>'reason', 'camera_not_confirmed',
          'weight changed but the camera saw nothing: rejected');

insert into t_s select 'Z', (public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('b', 32))->>'session_id')::uuid;
select is(public.decide_deposit((select id from t_s where name = 'Z'), true, 0)->>'reason', 'weight_not_confirmed',
          'camera saw an item but the scale did not move: rejected');

select is(public.decide_deposit((select id from t_s where name = 'A'), true, 24)->>'decision', 'submit',
          'camera saw the item and the scale moved: send it to the ledger');
select is(public.decide_deposit((select id from t_s where name = 'A'), true, 24)->>'decision', 'already_decided',
          'the same entry cannot be submitted twice');

-- ---------------------------------------------------------------------------
-- 3. Recording the ledger's answer
-- ---------------------------------------------------------------------------
insert into public.scans (id, bin_id, company_id, product_id, category, sequence, scanned_at, code_type, code, weight_g,
                          record_text, signature, record_hash, prev_chain_hash, chain_hash, weight_ok)
values ('a5000000-0000-4000-8000-0000000000a1', 'VB-PUN-5501-DEMO', 'd5000000-0000-4000-8000-00000000000d',
        'd5100000-0000-4000-8000-000000000001', 'cat1_rigid', 1, now(), 'qr', 'VBQ1.P5501.' || repeat('a', 32), 24,
        'v1|test', 'sig', repeat('1', 64), repeat('0', 64), repeat('2', 64), true);

select is(public.record_deposit_result((select id from t_s where name = 'A'),
            '{"status":"accepted","scan_id":"a5000000-0000-4000-8000-0000000000a1","weight_ok":true}')->>'status', 'approved',
          'an accepted scan with the right weight is approved');
select is((select scan_id from public.deposit_sessions where id = (select id from t_s where name = 'A')),
          'a5000000-0000-4000-8000-0000000000a1'::uuid, 'the approved entry links to its ledger record');
select is(public.record_deposit_result((select id from t_s where name = 'A'),
            '{"status":"rejected","reason":"qr_already_used"}')->>'status', 'approved',
          'a recorded result cannot be overwritten');

insert into t_s select 'E', (public.open_deposit_session('VB-PUN-5501-DEMO', 'VBQ1.P5501.' || repeat('c', 32))->>'session_id')::uuid;
select public.decide_deposit((select id from t_s where name = 'E'), true, 96);
select is(public.record_deposit_result((select id from t_s where name = 'E'),
            '{"status":"accepted","scan_id":"a5000000-0000-4000-8000-0000000000a1","weight_ok":false}')->>'reason', 'result_mismatch',
          'a result pointing at another entry''s scan is refused');

-- ---------------------------------------------------------------------------
-- 4. Demo codes and catalogue, and nobody else can call any of this
-- ---------------------------------------------------------------------------
select is((select count(*) from public.issue_demo_qr('d5100000-0000-4000-8000-000000000001', 3))::int, 3,
          'fresh demo codes can be minted (reset never deletes anything)');
select throws_ok($$ select * from public.issue_demo_qr('c5100000-0000-4000-8000-000000000001', 1) $$, '42501', null,
                 'codes can only be minted for demo products');

set local role authenticated;
select throws_ok($$ select public.open_deposit_session('VB-PUN-5501-DEMO', 'x') $$, '42501', null,
                 'logged-in users cannot call the bin protocol directly');
select throws_ok($$ select count(*) from public.deposit_sessions $$, '42501', null,
                 'logged-in users cannot read deposit sessions');
reset role;
set local role anon;
select throws_ok($$ select public.decide_deposit(gen_random_uuid(), true, 1) $$, '42501', null,
                 'visitors cannot decide deposits');
reset role;

select * from finish();
rollback;
