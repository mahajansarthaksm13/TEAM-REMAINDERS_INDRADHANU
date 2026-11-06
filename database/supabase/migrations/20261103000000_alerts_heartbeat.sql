-- ============================================================================
-- D12 · Alerts and heartbeat
--
-- record_heartbeat(bin_id): called by the heartbeat Edge Function AFTER it has
--   verified the bin's Ed25519 signature on the text  hb1|<bin_id>|<sent_at>
--   Updates last_seen and closes the bin's open offline alert.
--
-- mark_offline_bins(): run by pg_cron every 10 minutes. Opens ONE bin_offline
--   alert per active, non-demo bin silent for 30+ minutes. Never duplicates an
--   open alert. (ingest_scan also closes the alert when a scan arrives.)
-- ============================================================================

create or replace function public.record_heartbeat(p_bin_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bins
     set last_seen = greatest(coalesce(last_seen, now()), now())
   where id = p_bin_id and status = 'active';

  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'unknown_or_inactive_bin');
  end if;

  update public.alerts
     set closed_at = now()
   where bin_id = p_bin_id and kind = 'bin_offline' and closed_at is null;

  return jsonb_build_object('status', 'ok');
end;
$$;

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
                to_char(coalesce(b.last_seen, b.created_at) at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'))
  from public.bins b
  where b.status = 'active'
    and not b.is_demo
    and coalesce(b.last_seen, b.created_at) < now() - interval '30 minutes'
    and not exists (
      select 1 from public.alerts a
      where a.bin_id = b.id and a.kind = 'bin_offline' and a.closed_at is null
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.record_heartbeat(text) from public, anon, authenticated;
revoke all on function public.mark_offline_bins()     from public, anon, authenticated;
grant execute on function public.record_heartbeat(text) to service_role;
grant execute on function public.mark_offline_bins()     to service_role;

select cron.schedule('veribin-offline-bins', '*/10 * * * *', $$select public.mark_offline_bins()$$);
