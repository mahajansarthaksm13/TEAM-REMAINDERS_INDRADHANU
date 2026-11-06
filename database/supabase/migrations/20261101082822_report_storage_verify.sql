-- ============================================================================
-- D16 + Y16 · Reports: snapshot, creation, PDF attachment, public verify,
--             private storage bucket (rewritten)
--
-- A report is pinned to ONE checkpoint day. It includes exactly the scans that:
--   * belong to the company and category
--   * were scanned within [period_start, period_end] (IST dates)
--   * entered the ledger before the end of the checkpoint day (IST)
--   * are not weight_ok = false   (null = bin has no load cell, still counted)
--   * are not from a demo bin
-- Totals use the catalogue weight. The fingerprint is
--   sha256( chain_hash1 || ',' || chain_hash2 || ... )  in insertion order
-- (sha256 of the empty string when there are no scans).
--
-- Because the scan set is pinned to a checkpoint, re-running the snapshot later
-- gives the same fingerprint, unless the ledger was tampered with.
--
-- Flow used by the web app (A14):
--   1. create_report(category, from, to)        -> report row (as the user)
--   2. render PDF from that row, sha256 it, upload with the service role to
--      reports/<company_id>/<report_id>.pdf
--   3. attach_report_pdf(report_id, path, pdf_sha256)  (as the user)
--   4. QR on the PDF opens /verify/<report_id>, which calls verify_report()
-- ============================================================================

alter table public.reports
  add column if not exists scan_count         bigint,
  add column if not exists qr_kg              numeric(12, 3),
  add column if not exists barcode_kg         numeric(12, 3),
  add column if not exists under_review_count bigint,
  add column if not exists checkpoint_hash    text,
  add column if not exists pdf_sha256         text,
  add column if not exists created_by         uuid references public.profiles (user_id) on delete set null;

-- ---------------------------------------------------------------------------
-- 1. Internal: which scans a report includes (single source of truth)
-- ---------------------------------------------------------------------------
create or replace function public._report_scan_ids(
  p_company_id     uuid,
  p_category       public.epr_category,
  p_from           date,
  p_to             date,
  p_checkpoint_day date
)
returns table (scan_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.scans s
  join public.bins b on b.id = s.bin_id
  where s.company_id = p_company_id
    and s.category = p_category
    and (s.scanned_at at time zone 'Asia/Kolkata')::date between p_from and p_to
    and s.received_at < ((p_checkpoint_day + 1)::timestamp at time zone 'Asia/Kolkata')
    and s.weight_ok is not false
    and not b.is_demo
$$;

-- ---------------------------------------------------------------------------
-- 2. Internal: the numbers and fingerprint for that scan set
-- ---------------------------------------------------------------------------
create or replace function public._report_snapshot(
  p_company_id     uuid,
  p_category       public.epr_category,
  p_from           date,
  p_to             date,
  p_checkpoint_day date
)
returns table (
  scan_count         bigint,
  qr_kg              numeric,
  barcode_kg         numeric,
  fingerprint        text,
  checkpoint_day     date,
  checkpoint_hash    text,
  under_review_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cp_hash text;
begin
  select c.hash into v_cp_hash from public.checkpoints c where c.day = p_checkpoint_day;
  if not found then
    raise exception 'no checkpoint exists for %', p_checkpoint_day using errcode = 'P0002';
  end if;

  return query
  with inc as (
    select s.id, s.chain_hash, s.insertion_order, s.code_type, p.unit_weight_g
    from public._report_scan_ids(p_company_id, p_category, p_from, p_to, p_checkpoint_day) ids
    join public.scans s    on s.id = ids.scan_id
    join public.products p on p.id = s.product_id
  )
  select
    count(*)::bigint,
    round(coalesce(sum(inc.unit_weight_g) filter (where inc.code_type = 'qr'), 0) / 1000.0, 3),
    round(coalesce(sum(inc.unit_weight_g) filter (where inc.code_type = 'barcode'), 0) / 1000.0, 3),
    encode(sha256(convert_to(coalesce(string_agg(inc.chain_hash, ',' order by inc.insertion_order), ''), 'UTF8')), 'hex'),
    p_checkpoint_day,
    v_cp_hash,
    (select count(distinct f.scan_id) from public.scan_flags f where f.scan_id in (select inc2.id from inc inc2))::bigint
  from inc;
end;
$$;

revoke all on function public._report_scan_ids(uuid, public.epr_category, date, date, date) from public, anon, authenticated;
revoke all on function public._report_snapshot(uuid, public.epr_category, date, date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Preview for a company user (latest checkpoint), contract name
-- ---------------------------------------------------------------------------
create or replace function public.get_report_snapshot(
  p_category public.epr_category,
  p_from     date,
  p_to       date
)
returns table (
  scan_count bigint, qr_kg numeric, barcode_kg numeric, fingerprint text,
  checkpoint_day date, checkpoint_hash text, under_review_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cp date;
begin
  if public.my_role() is distinct from 'company' then
    raise exception 'only company users can preview reports' using errcode = '42501';
  end if;
  select max(day) into v_cp from public.checkpoints;
  if v_cp is null then
    raise exception 'no checkpoint has been made yet' using errcode = 'P0002';
  end if;
  return query
  select * from public._report_snapshot(public.my_company(), p_category, p_from, p_to, v_cp);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Create the report row. The database computes the fingerprint; nobody can
--    store one it did not compute (reports has no insert policy).
-- ---------------------------------------------------------------------------
create or replace function public.create_report(
  p_category public.epr_category,
  p_from     date,
  p_to       date
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cp   date;
  v_snap record;
  v_row  public.reports;
begin
  if public.my_role() is distinct from 'company' then
    raise exception 'only company users can create reports' using errcode = '42501';
  end if;
  if p_to < p_from then
    raise exception 'period end is before period start' using errcode = '22023';
  end if;

  select max(day) into v_cp from public.checkpoints;
  if v_cp is null then
    raise exception 'no checkpoint has been made yet' using errcode = 'P0002';
  end if;

  select * into v_snap
  from public._report_snapshot(public.my_company(), p_category, p_from, p_to, v_cp);

  insert into public.reports (
    company_id, category, period_start, period_end, fingerprint, checkpoint_day,
    checkpoint_hash, scan_count, qr_kg, barcode_kg, under_review_count, created_by
  ) values (
    public.my_company(), p_category, p_from, p_to, v_snap.fingerprint, v_cp,
    v_snap.checkpoint_hash, v_snap.scan_count, v_snap.qr_kg, v_snap.barcode_kg,
    v_snap.under_review_count, (select auth.uid())
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Attach the uploaded PDF, once
-- ---------------------------------------------------------------------------
create or replace function public.attach_report_pdf(
  p_report_id    uuid,
  p_storage_path text,
  p_pdf_sha256   text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_pdf_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'pdf_sha256 must be 64 lowercase hex characters' using errcode = '22023';
  end if;

  update public.reports r
     set storage_path = p_storage_path,
         pdf_sha256   = p_pdf_sha256
   where r.id = p_report_id
     and r.company_id = public.my_company()
     and r.pdf_sha256 is null
     and p_storage_path = r.company_id::text || '/' || r.id::text || '.pdf';

  if not found then
    raise exception 'report not found, not yours, path wrong, or PDF already attached'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Public verification (QR on the PDF). Recomputes everything from the
--    ledger. match is true ONLY if the recomputed fingerprint equals the
--    stored one. Returns 20 sample scans with the data a browser needs to
--    re-check each Ed25519 signature itself.
-- ---------------------------------------------------------------------------
create or replace function public.verify_report(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r       public.reports;
  v_snap  record;
  v_name  text;
  v_samp  jsonb;
begin
  select * into r from public.reports where id = p_report_id;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select * into v_snap
  from public._report_snapshot(r.company_id, r.category, r.period_start, r.period_end, r.checkpoint_day);

  select c.name into v_name from public.companies c where c.id = r.company_id;

  select coalesce(jsonb_agg(x order by x->>'scanned_at'), '[]'::jsonb) into v_samp
  from (
    select jsonb_build_object(
             'scan_id',     s.id,
             'bin_id',      s.bin_id,
             'scanned_at',  s.scanned_at,
             'record_text', s.record_text,
             'signature',   s.signature,
             'public_key',  b.public_key,
             'chain_hash',  s.chain_hash
           ) as x
    from public._report_scan_ids(r.company_id, r.category, r.period_start, r.period_end, r.checkpoint_day) ids
    join public.scans s on s.id = ids.scan_id
    join public.bins  b on b.id = s.bin_id
    order by md5(s.id::text || p_report_id::text)   -- stable pseudo-random sample
    limit 20
  ) t;

  return jsonb_build_object(
    'found',                  true,
    'match',                  v_snap.fingerprint = r.fingerprint,
    'report_id',              r.id,
    'company',                v_name,
    'category',               r.category,
    'period_start',           r.period_start,
    'period_end',             r.period_end,
    'stored_fingerprint',     r.fingerprint,
    'recomputed_fingerprint', v_snap.fingerprint,
    'checkpoint_day',         r.checkpoint_day,
    'checkpoint_hash',        v_snap.checkpoint_hash,
    'scan_count',             v_snap.scan_count,
    'qr_kg',                  v_snap.qr_kg,
    'barcode_kg',             v_snap.barcode_kg,
    'under_review_count',     v_snap.under_review_count,
    'pdf_sha256',             r.pdf_sha256,
    'samples',                v_samp
  );
end;
$$;

revoke all on function public.get_report_snapshot(public.epr_category, date, date) from public, anon;
revoke all on function public.create_report(public.epr_category, date, date)       from public, anon;
revoke all on function public.attach_report_pdf(uuid, text, text)                  from public, anon;
revoke all on function public.verify_report(uuid)                                  from public;
grant execute on function public.get_report_snapshot(public.epr_category, date, date) to authenticated;
grant execute on function public.create_report(public.epr_category, date, date)       to authenticated;
grant execute on function public.attach_report_pdf(uuid, text, text)                  to authenticated;
grant execute on function public.verify_report(uuid)                                  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Private storage bucket. Files live at reports/<company_id>/<report_id>.pdf
--    Uploads use the service role (server route). Users can read only folders
--    of companies they can see.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create policy reports_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reports'
    and public.can_see_company(public.try_uuid((storage.foldername(name))[1]))
  );
