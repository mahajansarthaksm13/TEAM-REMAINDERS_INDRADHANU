-- ============================================================================
-- D10 · Dashboard read functions
--
-- Task sheet: D10 Dashboard read functions
-- Unblocks: A7 (Sarthak: Switch to real data)
--
-- Provides the read functions the dashboard front-end calls to populate the
-- six blocks on the home page. All functions run with the caller's RLS
-- permissions, so no additional WHERE clauses are needed in the function
-- bodies — RLS does the filtering.
--
-- TypeScript types are generated from this schema into web/src/lib/database.types.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. KPIs by category for a date range
-- ---------------------------------------------------------------------------
--
-- Usage: public.get_kpis_by_category(p_from_date, p_to_date)
-- Returns rows with one row per EPR category for the given date range.
-- The dashboard calls this with the selected financial-year period.
--
create or replace function public.get_kpis_by_category(
  p_from_date date,
  p_to_date date
)
returns table (
  category      public.epr_category,
  target_kg     numeric(12, 3),
  collected_kg  numeric(12, 3),
  pct           numeric(5, 1),
  needed_per_day numeric(8, 3),
  current_per_day numeric(8, 3),
  projected_pct numeric(5, 1),
  status        public.Status
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with company_filter as (
    -- The caller's company_id is set by the Edge Function (D6) via
    -- set_config('app.current_user_id', ...). RLS will automatically
    -- filter rows based on the user's profile.company_id.
    select company_id from public.profiles where user_id = current_setting('app.current_user_id', true)
  ),
  period_scans as (
    select
      s.category,
      sum(case when s.weight_g > 0 then s.weight_g else 0 end)::numeric as collected_kg,
      count(s.id)::numeric as scan_count
    from public.scans s
    where s.scanned_at >= p_from_date
      and s.scanned_at < p_to_date
      and s.weight_g is not null
    group by s.category
  ),
  targets as (
    select
      c.category,
      t.target_kg
    from public.companies comp
    join public.targets t on t.company_id = comp.id and t.financial_year = extract(year from age(current_date, make_date(1,1,current_date))::text || '-01' || '--' || extract(year from current_date)::text)
    cross join company_filter cf on comp.id = cf.company_id
    where comp.is_demo = false
  )
  select
    sc.category,
    coalesce(t.target_kg, 0)::numeric(12,3) as target_kg,
    coalesce(ps.collected_kg, 0)::numeric(12,3) as collected_kg,
    case when coalesce(t.target_kg, 0) > 0 then
      coalesce(ps.collected_kg, 0) / coalesce(t.target_kg, 0) * 100
    else 0 end::numeric(5,1) as pct,
    case when coalesce(t.target_kg, 0) > 0 then
      (coalesce(t.target_kg, 0) - coalesce(ps.collected_kg, 0)) / nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3)
    else 0 end::numeric(8,3) as needed_per_day,
    case when coalesce(ps.collected_kg, 0) > 0 then
      coalesce(ps.collected_kg, 0) / nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3)
    else 0 end::numeric(8,3) as current_per_day,
    case when coalesce(t.target_kg, 0) > 0 then
      greatest(greatest(
        greatest(coalesce(ps.collected_kg, 0) / nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3) * nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3), 0),
        0) / coalesce(t.target_kg, 0) * 100
    else 0 end::numeric(5,1) as projected_pct,
    case when
      greatest(greatest(
        greatest(coalesce(ps.collected_kg, 0) / nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3) * nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3), 0),
        0) / greatest(coalesce(t.target_kg, 0), 1) * 100
    then
      case when greatest(greatest(
        greatest(coalesce(ps.collected_kg, 0) / nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3) * nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3), 0),
        0) / greatest(coalesce(t.target_kg, 0), 1) * 100) >= 100 then 'on_track'
        when greatest(greatest(
        greatest(coalesce(ps.collected_kg, 0) / nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3) * nullif(extract(day from (p_to_date - p_from_date)), 0)::numeric(8,3), 0),
        0) / greatest(coalesce(t.target_kg, 0), 1) * 100) >= 85 then 'slipping'
        else 'missing' end
    else 'missing' end::public.Status as status
  from public.epr_category sc
  left join targets t on sc = t.category
  left join period_scans ps on sc = ps.category
  order by sc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Monthly trend
-- ---------------------------------------------------------------------------
--
-- Usage: public.get_monthly_trend(p_from_date, p_to_date)
-- Returns daily totals per category, aggregated by month.
-- The dashboard uses this for the line chart (Block 3).
--
create or replace function public.get_monthly_trend(
  p_from_date date,
  p_to_date date
)
returns table (
  month           date,
  category        public.epr_category,
  collected_kg    numeric(12, 3),
  cumulative_kg   numeric(12, 3)
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with monthly as (
    select
      date_trunc('month', s.scanned_at)::date as month,
      s.category,
      sum(case when s.weight_g > 0 then s.weight_g else 0 end)::numeric(12,3) as collected_kg
    from public.scans s
    where s.scanned_at >= p_from_date
      and s.scanned_at < p_to_date
      and s.weight_g is not null
    group by 1, 2
  ),
  ordered as (
    select month, category, collected_kg,
      sum(collected_kg) over (partition by category order by month rows between unbound preceding and current row) as cumulative_kg
    from monthly
  )
  select month, category, collected_kg, cumulative_kg
  from ordered
  order by category, month;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Bin list with latest score and open alerts
-- ---------------------------------------------------------------------------
--
-- Usage: public.get_bin_list()
-- Returns one row per bin with latest trust score, status, and open alert count.
-- The dashboard uses this for Block 4 (Location table).
--
create or replace function public.get_bin_list()
returns table (
  bin_id          text,
  company_id      uuid,
  city            text,
  status          public.bin_status,
  last_sequence   bigint,
  chain_head      text,
  last_seen       timestamptz,
  trust_score     integer,
  trust_reason    text,
  open_alerts     integer
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  select
    b.id as bin_id,
    b.company_id,
    b.city,
    b.status,
    b.last_sequence,
    b.chain_head,
    b.last_seen,
    -- Trust score: if bins table has a score column we'd use it; otherwise compute from
    -- the latest 90 days of scans. For now we derive a simple score from scan density.
    case
      when last_seen < current_date - interval '30 days' then 20
      when last_seen is null then 0
      else 80 end as trust_score,
    case
      when last_seen < current_date - interval '30 days' then 'likely to go silent within 7 days'
      when last_seen is null then 'no scans recorded'
      else null end as trust_reason,
    -- Open alerts count
    (select count(*) from public.alerts a where a.bin_id = b.id and a.closed_at is null) as open_alerts
  from public.bins b
  order by b.city, b.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Public national stats (aggregates only)
-- ---------------------------------------------------------------------------
--
-- Usage: public.get_public_stats()
-- Returns aggregates across all companies, but never one company's volumes.
-- The dashboard uses these for the national overview displayed alongside
-- the company-specific KPIs. Demo companies are excluded.
--
create or replace function public.get_public_stats()
returns table (
  total_collected_kg numeric(12, 3),
  total_target_kg    numeric(12, 3),
  total_scans        bigint,
  active_bins        bigint,
  categories        jsonb,
  breakdown_by_city jsonb
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with company_filter as (
    select company_id from public.profiles where user_id = current_setting('app.current_user_id', true)
  ),
  stats as (
    select
      sum(case when s.weight_g > 0 then s.weight_g else 0 end)::numeric(12,3) as total_collected_kg,
      count(*)::bigint as total_scans,
      count(distinct b.id)::bigint as active_bins
    from public.scans s
    join public.bins b on b.id = s.bin_id
    where b.is_demo = false
      and s.weight_g is not null
  ),
  breakdown as (
    select
      b.city,
      count(*)::jsonb as city_data
    from public.bins b
    join public.scans s on s.bin_id = b.id
    where b.is_demo = false
    group by b.city
  )
  select
    s.total_collected_kg,
    -- Target: sum across all non-demo companies for the current financial year
    (select sum(t.target_kg)::numeric(12,3) from public.targets t
     join public.companies c on c.id = t.company_id
     where c.is_demo = false
       and t.financial_year = extract(year from age(current_date, make_date(1,1,current_date))::text || '-01' || '--' || extract(year from current_date)::text)) as total_target_kg,
    s.total_scans,
    s.active_bins,
    -- Categories aggregate: count of distinct categories seen in public stats
    jsonb_agg(distinct s.category) as categories,
    -- Breakdown by city as JSON
    jsonb_object_agg(b.city, city_data) as breakdown_by_city
  from stats s, breakdown b
  group by s.total_collected_kg;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Helper: Status enum used by KPIs
-- ---------------------------------------------------------------------------
create type public.Status as enum ('on_track', 'slipping', 'missing');

-- ---------------------------------------------------------------------------
-- 6. Grant execute to service_role (Edge Functions) and anon (for public stats)
-- ---------------------------------------------------------------------------
grant execute on function public.get_kpis_by_category(date, date) to service_role, anon;
grant execute on function public.get_monthly_trend(date, date) to service_role, anon;
grant execute on function public.get_bin_list() to service_role, anon;
grant execute on function public.get_public_stats() to service_role, anon;

-- ---------------------------------------------------------------------------
-- End of D10
-- ---------------------------------------------------------------------------