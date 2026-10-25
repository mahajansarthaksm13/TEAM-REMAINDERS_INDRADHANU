-- ============================================================================
-- D5 · Ingest database function tests
-- Run with: npx supabase test db
--
-- One test per rejection reason, plus the accept paths, the weight flag and the
-- sequence-gap alert. Signature verification is D6's job, so here a signature
-- only has to be present and non-empty.
-- ============================================================================

begin;

set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into public.companies (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Test Company');

insert into public.products
  (id, company_id, product_code, name, barcode, category, unit_weight_g, approved)
values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'P0007', 'Shampoo 180 ml',
   '8901234567890', 'cat1_rigid', 24, true),
  ('33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'P0008', 'Pending product',
   '8901234567891', 'cat3_multilayer', 4, false);

insert into public.qr_batches (id, product_id, quantity)
values ('44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222', 1);

insert into public.qr_codes (serial, batch_id, product_id)
values ('9f2c4e1a7b3d48c6a5e0d1f2b3c4a596',
        '44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222');

insert into public.bins (id, company_id, city, public_key, chain_head, allow_backfill)
values
  ('VB-PUN-0001', '11111111-1111-1111-1111-111111111111', 'Pune', 'pk1', repeat('0', 64), false),
  ('VB-PUN-0002', '11111111-1111-1111-1111-111111111111', 'Pune', 'pk2', repeat('0', 64), true),
  ('VB-PUN-0003', '11111111-1111-1111-1111-111111111111', 'Pune', 'pk3', repeat('0', 64), false);

update public.bins set status = 'revoked' where id = 'VB-PUN-0003';

-- Helper: build a signed-text line exactly as the contract specifies.
create function pg_temp.rec(
  p_bin   text,
  p_seq   bigint,
  p_at    timestamptz,
  p_type  text,
  p_code  text,
  p_w     integer
) returns text language sql immutable as $$
  select format('v1|%s|%s|%s|%s|%s|%s',
    p_bin, p_seq,
    to_char(p_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    p_type, p_code, p_w);
$$;

-- ---------------------------------------------------------------------------
-- Accept paths
-- ---------------------------------------------------------------------------

-- 1. Valid QR scan
select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 1, now(), 'qr',
      'VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596', 25),
    'c2lnbmF0dXJl'
  )->>'status',
  'accepted',
  'valid QR scan is accepted'
);

-- 2. Weight inside tolerance -> weight_ok true
select is(
  (select weight_ok from public.scans where bin_id = 'VB-PUN-0001' and sequence = 1),
  true,
  'weight within max(3 g, 30%) sets weight_ok true'
);

-- 3. Chain advanced from the genesis value
select isnt(
  (select chain_head from public.bins where id = 'VB-PUN-0001'),
  repeat('0', 64),
  'bin chain head advanced after ingest'
);

-- 4. Barcode tier accepted, weight far off -> accepted but flagged
select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 2, now(), 'barcode', '8901234567890', 100),
    'c2lnbmF0dXJl'
  )->>'status',
  'accepted',
  'barcode scan is accepted'
);

select is(
  (select weight_ok from public.scans where bin_id = 'VB-PUN-0001' and sequence = 2),
  false,
  'weight outside tolerance is accepted with weight_ok false, not rejected'
);

-- 5. Daily totals accumulated with the catalogue weight (24 + 24)
select is(
  (select weight_g from public.daily_totals
    where bin_id = 'VB-PUN-0001' and category = 'cat1_rigid'),
  48::bigint,
  'daily totals use the catalogue weight'
);

-- ---------------------------------------------------------------------------
-- Rejections, one per reason
-- ---------------------------------------------------------------------------

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 2, now(), 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'duplicate_sequence',
  'replay of an existing sequence is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 3, now() + interval '10 seconds', 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'barcode_cooldown',
  'same barcode at same bin within 30 s is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 3, now() + interval '60 seconds', 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'status',
  'accepted',
  'same barcode after the 30 s cooldown is accepted'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 4, now(), 'qr',
      'VBQ1.P0007.9f2c4e1a7b3d48c6a5e0d1f2b3c4a596', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'qr_already_used',
  'a one-time QR code cannot be redeemed twice'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 5, now(), 'qr',
      'VBQ1.P0007.00000000000000000000000000000001', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'qr_unknown',
  'an unknown QR serial is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 6, now(), 'barcode', '8901234567891', 4),
    'c2lnbmF0dXJl'
  )->>'reason',
  'unknown_product',
  'a barcode that is not an approved product of this company is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 7, now(), 'barcode', '8901234567890', 6000),
    'c2lnbmF0dXJl'
  )->>'reason',
  'weight_out_of_range',
  'a physically impossible weight is rejected'
);

select is(
  public.ingest_scan(
    'v1|VB-PUN-0001|8|not-a-date|qr|x|24',
    'c2lnbmF0dXJl'
  )->>'reason',
  'bad_format',
  'a malformed record is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 8, now(), 'barcode', '8901234567890', 24),
    ''
  )->>'reason',
  'bad_signature',
  'a record with no signature is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 8, now() + interval '10 minutes', 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'time_too_far_future',
  'a record stamped more than 5 minutes ahead is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 8, now() - interval '8 days', 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'time_too_old',
  'a record older than 7 days is rejected on a normal bin'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-XXX-9999', 1, now(), 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'unknown_bin',
  'an unknown bin is rejected'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0003', 1, now(), 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'reason',
  'bin_inactive',
  'a revoked bin is rejected'
);

-- ---------------------------------------------------------------------------
-- Gap, backfill and no-sensor paths
-- ---------------------------------------------------------------------------

-- Sequence jumps 3 -> 10: accepted, with an alert.
select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 10, now() + interval '120 seconds', 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'status',
  'accepted',
  'a sequence gap is accepted, not rejected'
);

select is(
  (select count(*)::int from public.alerts
    where bin_id = 'VB-PUN-0001' and kind = 'sequence_gap'),
  1,
  'a sequence gap raises exactly one alert'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0002', 1, now() - interval '30 days', 'barcode', '8901234567890', 24),
    'c2lnbmF0dXJl'
  )->>'status',
  'accepted',
  'a backfill-enabled bin accepts old records'
);

select is(
  public.ingest_scan(
    pg_temp.rec('VB-PUN-0001', 11, now() + interval '180 seconds', 'barcode', '8901234567890', 0),
    'c2lnbmF0dXJl'
  )->>'status',
  'accepted',
  'weight 0 (no load cell) is accepted'
);

select is(
  (select weight_ok from public.scans where bin_id = 'VB-PUN-0001' and sequence = 11),
  null::boolean,
  'weight 0 leaves weight_ok NULL rather than claiming a false mismatch'
);

select * from finish();

rollback;
