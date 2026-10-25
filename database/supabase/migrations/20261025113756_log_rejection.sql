-- ============================================================================
-- D6 · Rejection logging for the Edge Function
--
-- Some rejections happen before the database function is ever called, because
-- the record cannot be trusted yet: the bin is unknown, the signature does not
-- verify, or the text is malformed. Those still have to appear in the
-- data-quality line on the dashboard, so the Edge Function needs a way to write
-- them without holding INSERT on rejected_scans.
--
-- This is a thin, explicitly named wrapper over _reject_scan. service_role only.
-- ============================================================================

create or replace function public.log_rejection(
  p_bin_id text,
  p_record text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._reject_scan(p_bin_id, p_record, p_reason, now());
end;
$$;

comment on function public.log_rejection(text, text, text) is
  'Called by the ingest Edge Function for rejections that happen before ingest_scan. service_role only.';

revoke all on function public.log_rejection(text, text, text) from public, anon, authenticated;
grant execute on function public.log_rejection(text, text, text) to service_role;
