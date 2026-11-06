-- ============================================================================
-- D14 · Daily checkpoint (rewritten)
--
-- One row per IST day. Recomputable by anyone from the ledger:
--
--   heads   = for every bin created before the cutoff, in bin-id order:
--             "<bin_id>=<chain_hash of its last scan received before the cutoff>"
--             (64 zeros if it had none), joined with "|"
--   payload = "<day>|<previous checkpoint hash>|<heads>"
--   hash    = sha256(payload) as lowercase hex
--
--   cutoff  = midnight IST at the END of <day>
--   previous checkpoint hash = latest earlier checkpoint, or 64 zeros
--
-- Because the hash includes yesterday's hash, the checkpoints form their own
-- chain. Y17 publishes each one to the public veribin-checkpoints repo, so
-- history cannot be quietly rewritten.
--
-- Idempotent: running it twice for the same day returns the existing row and
-- never overwrites it.
-- ============================================================================

create or replace function public.make_checkpoint(p_day date default null)
returns public.checkpoints
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day    date := coalesce(p_day, (now() at time zone 'Asia/Kolkata')::date - 1);
  v_cutoff timestamptz := ((v_day + 1)::timestamp at time zone 'Asia/Kolkata');
  v_prev   text;
  v_heads  text;
  v_row    public.checkpoints;
begin
  select * into v_row from public.checkpoints where day = v_day;
  if found then
    return v_row;
  end if;

  select c.hash into v_prev
  from public.checkpoints c
  where c.day < v_day
  order by c.day desc
  limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64));

  select coalesce(string_agg(b.id || '=' || coalesce(h.chain_hash, repeat('0', 64)), '|' order by b.id), '')
    into v_heads
  from public.bins b
  left join lateral (
    select s.chain_hash
    from public.scans s
    where s.bin_id = b.id and s.received_at < v_cutoff
    order by s.insertion_order desc
    limit 1
  ) h on true
  where b.created_at < v_cutoff;

  insert into public.checkpoints (day, hash, previous_hash)
  values (
    v_day,
    encode(sha256(convert_to(v_day::text || '|' || v_prev || '|' || v_heads, 'UTF8')), 'hex'),
    v_prev
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.make_checkpoint(date) from public, anon, authenticated;
grant execute on function public.make_checkpoint(date) to service_role;

-- pg_cron runs in UTC. 00:05 IST = 18:35 UTC (previous calendar day).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'veribin-daily-checkpoint',
  '35 18 * * *',
  $$select public.make_checkpoint()$$
);
