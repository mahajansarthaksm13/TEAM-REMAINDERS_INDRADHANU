-- ============================================================================
-- D13 · AI database role (rewritten)
--
-- ai_job_role is a NOLOGIN group role that holds the permissions. The actual
-- login user is created by hand, once per project, in the SQL editor, with a
-- password from the password manager (never in git):
--
--   create role ai_job login password '<from password manager>' in role ai_job_role;
--
-- GitHub Actions runners have no IPv6, so AI_DATABASE_URL must use the
-- Supabase connection POOLER (Session mode), with user  ai_job.<project_ref>
--   postgresql://ai_job.<project_ref>:<password>@<pooler-host>:5432/postgres
--
-- RLS is on for every table, so grants alone are not enough: the role also
-- needs policies, otherwise every SELECT returns zero rows.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_job_role') then
    create role ai_job_role nologin;
  end if;
end
$$;

grant usage on schema public to ai_job_role;

-- Read
grant select on public.scans, public.bins, public.products, public.targets,
                public.rejected_scans, public.daily_totals, public.checkpoints,
                public.companies
  to ai_job_role;

create policy ai_read_scans          on public.scans          for select to ai_job_role using (true);
create policy ai_read_bins           on public.bins           for select to ai_job_role using (true);
create policy ai_read_products       on public.products       for select to ai_job_role using (true);
create policy ai_read_targets        on public.targets        for select to ai_job_role using (true);
create policy ai_read_rejected       on public.rejected_scans for select to ai_job_role using (true);
create policy ai_read_daily_totals   on public.daily_totals   for select to ai_job_role using (true);
create policy ai_read_checkpoints    on public.checkpoints    for select to ai_job_role using (true);
create policy ai_read_companies      on public.companies      for select to ai_job_role using (true);

-- Write: only the AI output tables (upserts need update; weekly insight
-- regeneration needs delete)
grant select, insert, update         on public.bin_scores to ai_job_role;
grant select, insert, update         on public.scan_flags to ai_job_role;
grant select, insert, update, delete on public.insights   to ai_job_role;
grant select, insert, update         on public.forecasts  to ai_job_role;
grant select, insert, update         on public.alerts     to ai_job_role;

create policy ai_write_bin_scores on public.bin_scores for all to ai_job_role using (true) with check (true);
create policy ai_write_scan_flags on public.scan_flags for all to ai_job_role using (true) with check (true);
create policy ai_write_insights   on public.insights   for all to ai_job_role using (true) with check (true);
create policy ai_write_forecasts  on public.forecasts  for all to ai_job_role using (true) with check (true);
create policy ai_write_alerts     on public.alerts     for all to ai_job_role using (true) with check (true);

-- Never the ledger. (D3 triggers block UPDATE/DELETE for everyone anyway.)
revoke insert, update, delete, truncate on public.scans from ai_job_role;
