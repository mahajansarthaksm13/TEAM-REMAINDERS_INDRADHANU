-- ============================================================================
-- D3 · Append-only ledger tests
-- Run with: npx supabase test db
--
-- These are the first database tests in the repo. They prove that the ledger
-- accepts new scans and refuses every attempt to change one.
-- ============================================================================

begin;

set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- ---------------------------------------------------------------------------
-- Fixtures (rolled back at the end)
-- ---------------------------------------------------------------------------

insert into public.companies (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Test Company');

insert into public.bins (id, company_id, city, public_key, chain_head)
values (
  'VB-PUN-0001',
  '11111111-1111-1111-1111-111111111111',
  'Pune',
  'dGVzdC1wdWJsaWMta2V5',
  repeat('0', 64)
);

-- ---------------------------------------------------------------------------
-- 1. A well-formed scan is accepted
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.scans (
      bin_id, company_id, sequence, scanned_at, code_type, code, weight_g,
      record_text, signature, record_hash, prev_chain_hash, chain_hash
    ) values (
      'VB-PUN-0001',
      '11111111-1111-1111-1111-111111111111',
      1,
      '2026-10-25T10:30:05Z',
      'qr',
      'VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596',
      184,
      'v1|VB-PUN-0001|1|2026-10-25T10:30:05Z|qr|VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596|184',
      'c2lnbmF0dXJl',
      repeat('a', 64),
      repeat('0', 64),
      repeat('b', 64)
    )
  $$,
  'a valid scan is inserted'
);

-- ---------------------------------------------------------------------------
-- 2-4. Every mutation is refused with restrict_violation (SQLSTATE 23001)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.scans set weight_g = 999 $$,
  '23001', null,
  'UPDATE on scans is refused'
);

select throws_ok(
  $$ delete from public.scans $$,
  '23001', null,
  'DELETE on scans is refused'
);

-- CASCADE is used deliberately: a plain TRUNCATE is already stopped by the
-- foreign key from scan_flags, so it would never reach our trigger and the test
-- would be asserting the wrong defence. CASCADE bypasses that and proves the
-- trigger itself works.
select throws_ok(
  $$ truncate public.scans cascade $$,
  '23001', null,
  'TRUNCATE on scans is refused by the ledger trigger'
);

-- ---------------------------------------------------------------------------
-- 5. The privileges are gone too, not just the trigger
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'public.scans', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.scans', 'DELETE')
  and not has_table_privilege('authenticated', 'public.scans', 'INSERT'),
  'authenticated has no write privilege on scans'
);

select * from finish();

rollback;
