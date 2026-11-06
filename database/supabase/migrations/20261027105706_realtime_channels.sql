-- ============================================================================
-- D9 · Realtime channels (rewritten)
--
-- Supabase Realtime does not have "create channel" commands. A channel exists
-- as soon as someone joins it. Who may join a PRIVATE channel is decided by
-- RLS policies on realtime.messages, using realtime.topic() (the channel name).
--
-- Channels (contract §9):
--   company:<company_id>  private. Joined by users who can see that company.
--   demo                  private too, but readable by anyone (anon included).
--
-- Every channel is private, so in the Supabase dashboard for dev AND prod:
--   Project Settings -> Realtime -> turn OFF "Allow public access".
-- The ingest Edge Function sends every broadcast with "private": true.
-- Nobody gets an INSERT policy, so browsers cannot broadcast fake scans;
-- only the service role (Edge Function) can send.
-- ============================================================================

create or replace function public.can_join_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_topic = 'demo' then
    return true;
  end if;

  if p_topic like 'company:%' then
    -- try_uuid returns null for junk, and can_see_company(null) is false
    return public.can_see_company(public.try_uuid(substr(p_topic, 9)));
  end if;

  return false;
end;
$$;

revoke all on function public.can_join_topic(text) from public;
grant execute on function public.can_join_topic(text) to anon, authenticated, service_role;

create policy veribin_channels_authenticated_read on realtime.messages
  for select to authenticated
  using (public.can_join_topic((select realtime.topic())));

create policy veribin_demo_anon_read on realtime.messages
  for select to anon
  using ((select realtime.topic()) = 'demo');
