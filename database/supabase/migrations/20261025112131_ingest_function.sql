-- ============================================================================
-- D5 · Ingest database function
--
-- One transaction, in the order the task sheet specifies. Everything that can
-- reject a scan happens before anything is written, except the rejection log
-- itself. A rejected scan never touches the ledger, daily totals or the bin.
--
-- Contract notes (docs/CONTRACTS.md §4-§6):
--   record  v1|<bin_id>|<sequence>|<scanned_at>|<code_type>|<code>|<weight_g>
--   record_hash = sha256(record bytes)
--   chain_hash  = sha256('<prev_chain_hash>:<record_hash>')
--
-- Three decisions this migration encodes, each of which needs a contract line:
--
--  1. `scans.weight_ok` did not exist in the contract, but D5 must store the
--     catalogue-weight comparison and Y16's report snapshot filters on it.
--     Added here as nullable boolean. NULL means "not measured" (see 3).
--
--  2. A weight outside tolerance does NOT reject the scan. It is accepted with
--     weight_ok = false, because throwing away evidence is worse than flagging
--     it: the AI layer flags it, and reports exclude it. Only physically
--     impossible weights (outside 0-5000 g) are rejected, with
--     `weight_out_of_range`. The contract lists that reason code but not this
--     rule, so it needs confirming.
--
--  3. `weight_g = 0` means "this bin has no load cell". weight_ok becomes NULL
--     and the scan still counts. This keeps v1 honest without a sensor and needs
--     no schema change when the hardware upgrade lands.
--
-- Totals use the CATALOGUE weight (products.unit_weight_g), not the measured
-- weight, because that is the figure the EPR rules are written against and it
-- does not change if a sensor drifts. The measured weight stays in the signed
-- record_text as evidence. This needs a contract line too.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schema additions D5 depends on
-- ---------------------------------------------------------------------------

alter table public.scans
  add column weight_ok boolean;

comment on column public.scans.weight_ok is
  'Measured weight within max(3 g, 30%) of the catalogue weight. NULL when the bin has no sensor (weight_g = 0).';

alter table public.bins
  add column allow_backfill boolean not null default false;

comment on column public.bins.allow_backfill is
  'Dev/demo bins only. Lifts the 7-day age limit so the simulator can backfill history. Never set on production bins.';

create index scans_barcode_cooldown_idx
  on public.scans (bin_id, code, scanned_at desc)
  where code_type = 'barcode';

-- ---------------------------------------------------------------------------
-- Rejection helper
-- Writes the refused record to rejected_scans and returns the summary.
-- SECURITY DEFINER because API roles have no INSERT on rejected_scans.
-- ---------------------------------------------------------------------------

create or replace function public._reject_scan(
  p_bin_id      text,
  p_record      text,
  p_reason      text,
  p_received_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rejected_scans (bin_id, record_text, reason, received_at)
  values (p_bin_id, p_record, p_reason, p_received_at);

  return jsonb_build_object('status', 'rejected', 'reason', p_reason);
end;
$$;

revoke all on function public._reject_scan(text, text, text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The ingest function
-- ---------------------------------------------------------------------------

create or replace function public.ingest_scan(
  p_record      text,
  p_signature   text,
  p_received_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields        text[];
  v_version       text;
  v_bin_id        text;
  v_sequence      bigint;
  v_scanned_at    timestamptz;
  v_code_type     public.scan_code_type;
  v_code          text;
  v_weight_g      integer;
  v_bin           public.bins%rowtype;
  v_product       public.products%rowtype;
  v_serial        text;
  v_qr            public.qr_codes%rowtype;
  v_record_hash   text;
  v_chain_hash    text;
  v_weight_ok     boolean;
  v_tolerance     numeric;
  v_scan_id       uuid;
  v_day           date;
  v_redeemed      integer;
begin
  -- -------------------------------------------------------------------------
  -- 0. Parse and validate the signed text
  -- -------------------------------------------------------------------------
  if p_record is null or p_record = '' then
    return public._reject_scan(null, p_record, 'bad_format', p_received_at);
  end if;

  v_fields := string_to_array(p_record, '|');
  if array_length(v_fields, 1) <> 7 then
    return public._reject_scan(null, p_record, 'bad_format', p_received_at);
  end if;

  v_version    := v_fields[1];
  v_bin_id     := v_fields[2];
  v_code_type  := nullif(v_fields[5], '')::public.scan_code_type;
  v_code       := v_fields[6];

  if v_version <> 'v1'
     or v_bin_id !~ '^VB-[A-Z]{3}-[0-9]{4}(-DEMO)?$'
     or v_fields[3] !~ '^[0-9]{1,19}$'
     or v_fields[4] !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
     or v_code_type is null
     or v_code = ''
     or v_fields[7] !~ '^[0-9]{1,5}$'
  then
    return public._reject_scan(v_bin_id, p_record, 'bad_format', p_received_at);
  end if;

  v_sequence   := v_fields[3]::bigint;
  v_scanned_at := v_fields[4]::timestamptz;
  v_weight_g   := v_fields[7]::integer;

  if v_sequence <= 0 then
    return public._reject_scan(v_bin_id, p_record, 'bad_format', p_received_at);
  end if;

  if v_weight_g > 5000 then
    return public._reject_scan(v_bin_id, p_record, 'weight_out_of_range', p_received_at);
  end if;

  if p_signature is null or p_signature = '' then
    return public._reject_scan(v_bin_id, p_record, 'bad_signature', p_received_at);
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Lock this bin's row. Only this bin's chain serialises; other bins
  --    ingest in parallel.
  -- -------------------------------------------------------------------------
  select * into v_bin from public.bins where id = v_bin_id for update;

  if not found then
    return public._reject_scan(v_bin_id, p_record, 'unknown_bin', p_received_at);
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Bin must be active
  -- -------------------------------------------------------------------------
  if v_bin.status <> 'active' then
    return public._reject_scan(v_bin_id, p_record, 'bin_inactive', p_received_at);
  end if;

  -- -------------------------------------------------------------------------
  -- 3. Time window: not more than 5 minutes ahead, not more than 7 days old
  --    unless this is a backfill-enabled dev/demo bin.
  -- -------------------------------------------------------------------------
  if v_scanned_at > p_received_at + interval '5 minutes' then
    return public._reject_scan(v_bin_id, p_record, 'time_too_far_future', p_received_at);
  end if;

  if v_scanned_at < p_received_at - interval '7 days' and not v_bin.allow_backfill then
    return public._reject_scan(v_bin_id, p_record, 'time_too_old', p_received_at);
  end if;

  -- -------------------------------------------------------------------------
  -- 4. Sequence must be new. Holding the bin lock makes this safe.
  -- -------------------------------------------------------------------------
  if exists (
    select 1 from public.scans s
    where s.bin_id = v_bin_id and s.sequence = v_sequence
  ) then
    return public._reject_scan(v_bin_id, p_record, 'duplicate_sequence', p_received_at);
  end if;

  -- -------------------------------------------------------------------------
  -- 5. Product resolution: one-time QR or barcode cooldown + catalogue lookup
  -- -------------------------------------------------------------------------
  if v_code_type = 'qr' then
    if v_code !~ '^VBQ1\.P[0-9]{4}\.[0-9a-f]{32}$' then
      return public._reject_scan(v_bin_id, p_record, 'qr_unknown', p_received_at);
    end if;

    v_serial := split_part(v_code, '.', 3);

    select * into v_qr from public.qr_codes where serial = v_serial;
    if not found then
      return public._reject_scan(v_bin_id, p_record, 'qr_unknown', p_received_at);
    end if;

    if v_qr.redeemed_at is not null then
      return public._reject_scan(v_bin_id, p_record, 'qr_already_used', p_received_at);
    end if;

    -- Redeem exactly once. The WHERE clause makes this safe under concurrency.
    update public.qr_codes
       set redeemed_at = p_received_at
     where serial = v_serial and redeemed_at is null;
    get diagnostics v_redeemed = row_count;
    if v_redeemed <> 1 then
      return public._reject_scan(v_bin_id, p_record, 'qr_already_used', p_received_at);
    end if;

    select * into v_product from public.products where id = v_qr.product_id;

    -- The payload carries the product code; it must match the catalogue.
    if not found
       or not v_product.approved
       or v_product.company_id <> v_bin.company_id
       or v_product.product_code <> split_part(v_code, '.', 2)
    then
      return public._reject_scan(v_bin_id, p_record, 'qr_unknown', p_received_at);
    end if;

  else
    -- barcode tier
    if v_code !~ '^[0-9]{8,14}$' then
      return public._reject_scan(v_bin_id, p_record, 'bad_format', p_received_at);
    end if;

    -- Symmetric 30-second window. A one-sided window would let a later scan
    -- block an earlier one, which breaks out-of-order sync from a bin's offline
    -- queue.
    if exists (
      select 1 from public.scans s
      where s.bin_id = v_bin_id
        and s.code_type = 'barcode'
        and s.code = v_code
        and s.scanned_at between v_scanned_at - interval '30 seconds'
                              and v_scanned_at + interval '30 seconds'
    ) then
      return public._reject_scan(v_bin_id, p_record, 'barcode_cooldown', p_received_at);
    end if;

    select * into v_product
      from public.products p
     where p.barcode = v_code
       and p.company_id = v_bin.company_id
       and p.approved
     limit 1;

    if not found then
      return public._reject_scan(v_bin_id, p_record, 'unknown_product', p_received_at);
    end if;
  end if;

  -- -------------------------------------------------------------------------
  -- 6. Weight comparison. Out of tolerance is a flag, not a rejection.
  -- -------------------------------------------------------------------------
  if v_weight_g = 0 then
    v_weight_ok := null;                                   -- no load cell
  else
    v_tolerance := greatest(3, 0.30 * v_product.unit_weight_g);
    v_weight_ok := abs(v_weight_g - v_product.unit_weight_g) <= v_tolerance;
  end if;

  -- -------------------------------------------------------------------------
  -- 7. Record hash and chain hash
  -- -------------------------------------------------------------------------
  v_record_hash := encode(sha256(convert_to(p_record, 'UTF8')), 'hex');
  v_chain_hash  := encode(
    sha256(convert_to(v_bin.chain_head || ':' || v_record_hash, 'UTF8')),
    'hex'
  );

  -- -------------------------------------------------------------------------
  -- 8. Insert the scan
  -- -------------------------------------------------------------------------
  insert into public.scans (
    bin_id, company_id, product_id, category, sequence, scanned_at, received_at,
    code_type, code, weight_g, weight_ok, record_text, signature,
    record_hash, prev_chain_hash, chain_hash
  ) values (
    v_bin_id, v_bin.company_id, v_product.id, v_product.category, v_sequence,
    v_scanned_at, p_received_at, v_code_type, v_code, v_weight_g, v_weight_ok,
    p_record, p_signature, v_record_hash, v_bin.chain_head, v_chain_hash
  )
  returning id into v_scan_id;

  -- -------------------------------------------------------------------------
  -- 9. Advance the bin's chain
  -- -------------------------------------------------------------------------
  update public.bins
     set chain_head    = v_chain_hash,
         last_sequence = v_sequence,
         last_seen     = p_received_at
   where id = v_bin_id;

  -- -------------------------------------------------------------------------
  -- 10. Daily totals, using the catalogue weight
  -- -------------------------------------------------------------------------
  v_day := (v_scanned_at at time zone 'Asia/Kolkata')::date;

  insert into public.daily_totals (day, company_id, category, bin_id, scan_count, weight_g)
  values (v_day, v_bin.company_id, v_product.category, v_bin_id, 1, v_product.unit_weight_g)
  on conflict (day, company_id, category, bin_id) do update
     set scan_count = public.daily_totals.scan_count + 1,
         weight_g   = public.daily_totals.weight_g + excluded.weight_g;

  -- -------------------------------------------------------------------------
  -- 11. Sequence gap: accept the scan, but tell a human
  -- -------------------------------------------------------------------------
  if v_bin.last_sequence > 0 and v_sequence > v_bin.last_sequence + 1 then
    insert into public.alerts (kind, bin_id, company_id, message)
    values (
      'sequence_gap',
      v_bin_id,
      v_bin.company_id,
      format('Sequence jumped from %s to %s on %s (%s missing).',
             v_bin.last_sequence, v_sequence, v_bin_id,
             v_sequence - v_bin.last_sequence - 1)
    );
  end if;

  -- -------------------------------------------------------------------------
  -- 12. Summary
  -- -------------------------------------------------------------------------
  return jsonb_build_object(
    'status',     'accepted',
    'scan_id',    v_scan_id,
    'bin_id',     v_bin_id,
    'product_id', v_product.id,
    'sequence',   v_sequence,
    'scanned_at', v_scanned_at,
    'weight_g',   v_weight_g,
    'chain_hash', v_chain_hash,
    'weight_ok',  v_weight_ok,
    'company_id', v_bin.company_id,
    'category',   v_product.category::text
  );
end;
$$;

comment on function public.ingest_scan(text, text, timestamptz) is
  'The only way a scan can enter the ledger. One transaction, all checks, returns accepted or rejected.';

-- Only the service role (i.e. the ingest Edge Function) may call it.
revoke all on function public.ingest_scan(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_scan(text, text, timestamptz) to service_role;

-- The function is SECURITY DEFINER, so no API role needs INSERT on the ledger.
revoke insert on public.scans from service_role;
revoke insert on public.rejected_scans from public, anon, authenticated, service_role;
