-- ============================================================================
-- Backend gaps found while designing the web app (A7, A11, A12, A14)
--
--  1. issue_qr_codes also returns batch_id. PostgREST caps every response at
--     max_rows = 1000, so a 10,000-code batch cannot come back in one call. The
--     web app takes batch_id from the first row and pages through qr_codes
--     (RLS qr_codes_read already allows it). Index added for that read.
--  2. create_report refuses an empty snapshot. Before, a period with no
--     checkpointed scans produced a stored report with scan_count = 0.
--  3. get_kpis_by_category and get_monthly_trend take an optional
--     p_company_id, so admin/regulator/auditor can scope to one company.
--     NULL keeps the old behaviour (every company the caller can see). RLS
--     still applies: passing a company you cannot see returns zeros.
--  4. mark_offline_bins only alerts on bins that have reported at least once.
--     A bin that has never connected is not "offline", and seeded dev bins
--     with no scans were flooding the alerts bell.
--  5. Dashboard and public totals skip demo BINS, not only demo companies,
--     matching the report rule (_report_scan_ids). The CI test bins
--     VB-PUN-0900..0902 belong to a real company and are now seeded is_demo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. QR issuing returns the batch id
-- ---------------------------------------------------------------------------
drop function public.issue_qr_codes(uuid, integer);

create function public.issue_qr_codes(
  p_product_id uuid,
  p_quantity   integer
)
returns table (batch_id uuid, qr_serial text, qr_payload text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_product public.products%rowtype;
  v_batch   uuid;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then
    raise exception 'quantity must be between 1 and 10000' using errcode = '22023';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  -- coalesce: a caller with no profile gives null, which must mean "no"
  if not coalesce(public.my_role() = 'company'
                  and v_product.company_id = public.my_company(), false) then
    raise exception 'you can only issue codes for your own products' using errcode = '42501';
  end if;

  if not v_product.approved then
    raise exception 'product is not approved yet' using errcode = 'P0001';
  end if;

  insert into public.qr_batches (product_id, quantity, created_by)
  values (p_product_id, p_quantity, (select auth.uid()))
  returning id into v_batch;

  return query
  with ins as (
    insert into public.qr_codes (serial, batch_id, product_id)
    select encode(extensions.gen_random_bytes(16), 'hex'), v_batch, p_product_id
    from generate_series(1, p_quantity)
    returning serial
  )
  select v_batch, ins.serial, 'VBQ1.' || v_product.product_code || '.' || ins.serial
  from ins;
end;
$$;

revoke all on function public.issue_qr_codes(uuid, integer) from public, anon;
grant execute on function public.issue_qr_codes(uuid, integer) to authenticated;

create index if not exists qr_codes_batch_idx on public.qr_codes (batch_id);

-- ---------------------------------------------------------------------------
-- 2. No empty reports
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

  if v_snap.scan_count = 0 then
    raise exception 'no checkpointed scans in this period' using errcode = 'P0002',
      hint = 'Scans become reportable after the nightly checkpoint.';
  end if;

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
-- 3. Optional company scope on the dashboard read functions
-- ---------------------------------------------------------------------------
drop function public.get_kpis_by_category(date, date);
drop function public.get_monthly_trend(date, date);

create function public.get_kpis_by_category(p_from date, p_to date, p_company_id uuid default null)
returns table (
  category      public.epr_category,
  collected_kg  numeric,
  scan_count    bigint,
  target_kg     numeric,
  gap_kg        numeric,
  progress_pct  numeric
)
language sql
stable
set search_path = ''
as $$
  with cats as (
    select unnest(enum_range(null::public.epr_category)) as category
  ),
  tot as (
    select d.category, sum(d.weight_g) as grams, sum(d.scan_count) as n
    from public.daily_totals d
    join public.companies c on c.id = d.company_id
    join public.bins b      on b.id = d.bin_id
    where d.day between p_from and p_to
      and not c.is_demo
      and not b.is_demo
      and (p_company_id is null or d.company_id = p_company_id)
    group by d.category
  ),
  tgt as (
    select t.category, sum(t.target_kg) as kg
    from public.targets t
    join public.companies c on c.id = t.company_id
    where t.financial_year = public.fy_label(p_from)
      and not c.is_demo
      and (p_company_id is null or t.company_id = p_company_id)
    group by t.category
  )
  select
    cats.category,
    round(coalesce(tot.grams, 0) / 1000.0, 3)                               as collected_kg,
    coalesce(tot.n, 0)::bigint                                              as scan_count,
    tgt.kg                                                                  as target_kg,
    case when tgt.kg is null then null
         else greatest(tgt.kg - coalesce(tot.grams, 0) / 1000.0, 0) end     as gap_kg,
    case when tgt.kg > 0
         then round(coalesce(tot.grams, 0) / 1000.0 / tgt.kg * 100, 1) end  as progress_pct
  from cats
  left join tot using (category)
  left join tgt using (category)
  order by cats.category
$$;

create function public.get_monthly_trend(p_from date, p_to date, p_company_id uuid default null)
returns table (
  month         date,
  category      public.epr_category,
  collected_kg  numeric,
  scan_count    bigint
)
language sql
stable
set search_path = ''
as $$
  select
    date_trunc('month', d.day)::date,
    d.category,
    round(sum(d.weight_g) / 1000.0, 3),
    sum(d.scan_count)::bigint
  from public.daily_totals d
  join public.companies c on c.id = d.company_id
  join public.bins b      on b.id = d.bin_id
  where d.day between p_from and p_to
    and not c.is_demo
    and not b.is_demo
    and (p_company_id is null or d.company_id = p_company_id)
  group by 1, 2
  order by 1, 2
$$;

revoke all on function public.get_kpis_by_category(date, date, uuid) from public, anon;
revoke all on function public.get_monthly_trend(date, date, uuid)    from public, anon;
grant execute on function public.get_kpis_by_category(date, date, uuid) to authenticated;
grant execute on function public.get_monthly_trend(date, date, uuid)    to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Offline alerts only for bins that have reported before
-- ---------------------------------------------------------------------------
create or replace function public.mark_offline_bins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.alerts (kind, bin_id, company_id, message)
  select 'bin_offline', b.id, b.company_id,
         format('%s has been silent since %s IST.', b.id,
                to_char(b.last_seen at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'))
  from public.bins b
  where b.status = 'active'
    and not b.is_demo
    and b.last_seen is not null
    and b.last_seen < now() - interval '30 minutes'
    and not exists (
      select 1 from public.alerts a
      where a.bin_id = b.id and a.kind = 'bin_offline' and a.closed_at is null
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Public stats skip demo bins too
-- ---------------------------------------------------------------------------
create or replace function public.get_public_stats()
returns table (
  total_kg     numeric,
  total_scans  bigint,
  active_bins  bigint,
  cities       bigint,
  by_category  jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select d.category, sum(d.weight_g) as grams, sum(d.scan_count) as n
    from public.daily_totals d
    join public.companies c on c.id = d.company_id
    join public.bins b      on b.id = d.bin_id
    where not c.is_demo and not b.is_demo
    group by d.category
  )
  select
    round(coalesce(sum(t.grams), 0) / 1000.0, 3),
    coalesce(sum(t.n), 0)::bigint,
    (select count(*) from public.bins b where b.status = 'active' and not b.is_demo),
    (select count(distinct b.city) from public.bins b where not b.is_demo),
    coalesce(jsonb_object_agg(t.category, round(t.grams / 1000.0, 3))
               filter (where t.category is not null), '{}'::jsonb)
  from t
$$;
