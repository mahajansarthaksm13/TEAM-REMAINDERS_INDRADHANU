-- ============================================================================
-- D15 · Chain verification (rewritten)
--
--   select * from public.verify_chain('VB-PUN-0001');
--   -> ok | scans_checked | failing_scan | reason
--
-- Walks one bin's scans in insertion order and checks, for each scan:
--   1. record_hash  = sha256(record_text)                 'record_hash_mismatch'
--   2. the columns equal the fields of the signed text    'columns_differ_from_signed_text'
--   3. prev_chain_hash = the previous scan's chain_hash   'prev_hash_mismatch'
--   4. chain_hash = sha256(prev_chain_hash || ':' || record_hash)
--                                                         'chain_hash_mismatch'
-- and finally that bins.chain_head equals the last chain hash, which catches a
-- deleted LAST scan                                       'chain_head_mismatch'
--
-- Ed25519 signatures cannot be checked in Postgres; the AI job (Y11) checks
-- those in Python. Together they catch any edit made without the bin's key.
--
-- Runs as the caller, so RLS applies: auditors can verify the bins they may
-- see; the AI role and service role can verify every bin.
-- ============================================================================

create or replace function public.verify_chain(p_bin_id text)
returns table (ok boolean, scans_checked bigint, failing_scan uuid, reason text)
language plpgsql
stable
set search_path = ''
as $$
declare
  r       public.scans%rowtype;
  f       text[];
  v_prev  text := repeat('0', 64);
  v_n     bigint := 0;
  v_head  text;
begin
  select b.chain_head into v_head from public.bins b where b.id = p_bin_id;
  if not found then
    return query select false, 0::bigint, null::uuid, 'unknown_bin'::text;
    return;
  end if;

  for r in
    select * from public.scans s where s.bin_id = p_bin_id order by s.insertion_order
  loop
    v_n := v_n + 1;

    if encode(sha256(convert_to(r.record_text, 'UTF8')), 'hex') <> r.record_hash then
      return query select false, v_n, r.id, 'record_hash_mismatch'::text;
      return;
    end if;

    f := string_to_array(r.record_text, '|');
    if coalesce(array_length(f, 1), 0) <> 7
       or f[1] <> 'v1'
       or f[2] <> r.bin_id
       or f[3] <> r.sequence::text
       or f[4] <> to_char(r.scanned_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
       or f[5] <> r.code_type::text
       or f[6] <> r.code
       or f[7] <> r.weight_g::text
    then
      return query select false, v_n, r.id, 'columns_differ_from_signed_text'::text;
      return;
    end if;

    if r.prev_chain_hash <> v_prev then
      return query select false, v_n, r.id, 'prev_hash_mismatch'::text;
      return;
    end if;

    if encode(sha256(convert_to(v_prev || ':' || r.record_hash, 'UTF8')), 'hex') <> r.chain_hash then
      return query select false, v_n, r.id, 'chain_hash_mismatch'::text;
      return;
    end if;

    v_prev := r.chain_hash;
  end loop;

  if v_head <> v_prev then
    return query select false, v_n, null::uuid, 'chain_head_mismatch'::text;
    return;
  end if;

  return query select true, v_n, null::uuid, null::text;
end;
$$;

revoke all on function public.verify_chain(text) from public, anon;
grant execute on function public.verify_chain(text) to authenticated, service_role, ai_job_role;
