-- ============================================================================
-- D10 · Dashboard read functions (rewritten)
--
-- The first three run as the CALLER (security invoker, the default), so RLS
-- from D8 decides which companies' rows are summed. A company user gets their
-- own numbers; admin and regulator get every non-demo company.
--
-- They read daily_totals, which ingest keeps up to date using the CATALOGUE
-- weight (products.unit_weight_g). Weights are stored in grams and returned
-- in kg with 3 decimals.
--
-- get_public_stats() is SECURITY DEFINER for the logged-out website:
-- national aggregates only, never one company's numbers, never demo data.
--
-- Names and parameters match docs/CONTRACTS.md §8: p_from, p_to (inclusive,
-- IST calendar dates).
-- ============================================================================

-- Indian financial year label for a date: 2026-05-10 -> '2026-27'
create or replace function public.fy_label(p_day date)
returns text
language sql
immutable
set search_path = ''
as $$
  select y::text || '-' || lpad(((y + 1) % 100)::text, 2, '0')
  from (select extract(year from p_day)::int
               - case when extract(month from p_day) < 4 then 1 else 0 end as y) t
$$;

-- ---------------------------------------------------------------------------
-- 1. KPIs: one row per EPR category (always all 4, even with no scans)
--    target_kg is the full financial-year target of the FY containing p_from.
-- ---------------------------------------------------------------------------
create or replace function public.get_kpis_by_category(p_from date, p_to date)
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
    where d.day between p_from and p_to
      and not c.is_demo
    group by d.category
  ),
  tgt as (
    select t.category, sum(t.target_kg) as kg
    from public.targets t
    join public.companies c on c.id = t.company_id
    where t.financial_year = public.fy_label(p_from)
      and not c.is_demo
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

-- ---------------------------------------------------------------------------
-- 2. Monthly trend: kg per month per category
-- ---------------------------------------------------------------------------
create or replace function public.get_monthly_trend(p_from date, p_to date)
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
  where d.day between p_from and p_to
    and not c.is_demo
  group by 1, 2
  order by 1, 2
$$;

-- ---------------------------------------------------------------------------
-- 3. Bin list with the latest trust score (written by the AI job) and the
--    number of open alerts. trust_score is null until the AI has scored it.
-- ---------------------------------------------------------------------------
create or replace function public.get_bin_list()
returns table (
  bin_id         text,
  company_id     uuid,
  city           text,
  status         public.bin_status,
  last_seen      timestamptz,
  last_sequence  bigint,
  trust_score    integer,
  trust_reasons  jsonb,
  score_day      date,
  open_alerts    bigint,
  is_demo        boolean
)
language sql
stable
set search_path = ''
as $$
  select
    b.id, b.company_id, b.city, b.status, b.last_seen, b.last_sequence,
    s.score, s.reasons, s.day,
    (select count(*) from public.alerts a where a.bin_id = b.id and a.closed_at is null),
    b.is_demo
  from public.bins b
  left join lateral (
    select x.score, x.reasons, x.day
    from public.bin_scores x
    where x.bin_id = b.id
    order by x.day desc
    limit 1
  ) s on true
  order by b.city, b.id
$$;

-- ---------------------------------------------------------------------------
-- 4. National stats for the public website
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
    where not c.is_demo
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

-- ---------------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------------
revoke all on function public.get_kpis_by_category(date, date) from public, anon;
revoke all on function public.get_monthly_trend(date, date)    from public, anon;
revoke all on function public.get_bin_list()                   from public, anon;
grant execute on function public.get_kpis_by_category(date, date) to authenticated;
grant execute on function public.get_monthly_trend(date, date)    to authenticated;
grant execute on function public.get_bin_list()                   to authenticated;

revoke all on function public.get_public_stats() from public;
grant execute on function public.get_public_stats() to anon, authenticated;
grant execute on function public.fy_label(date) to anon, authenticated, service_role;
