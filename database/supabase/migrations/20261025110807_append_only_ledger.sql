-- ============================================================================
-- D3 · Append-only ledger
--
-- The ledger is the product. If a scan can be edited, every number on the
-- dashboard and every report is worthless, so this is enforced by the database
-- itself and not by application code.
--
-- Two independent defences:
--   1. Triggers that refuse UPDATE, DELETE and TRUNCATE on public.scans.
--   2. Privileges revoked from every API role, including service_role.
--
-- TRUNCATE needs its own statement-level trigger because it never fires row
-- triggers and OLD is not available in it.
--
-- Escape hatch for the tamper demo (D15 / Y18): a table owner can do
--   alter table public.scans disable trigger scans_no_update_delete;
-- which is exactly the "someone with full database access edited a record"
-- scenario the chain verification is designed to catch. No API role can do this.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Block row-level changes
-- ---------------------------------------------------------------------------

create or replace function public.scans_block_row_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'public.scans is append-only: % is not allowed (scan id %)',
    tg_op, old.id
    using errcode = 'restrict_violation',
          hint = 'Corrections must be inserted as new scans, never applied to existing ones.';
end;
$$;

comment on function public.scans_block_row_mutation() is
  'Refuses UPDATE and DELETE on the ledger. See D3.';

create trigger scans_no_update_delete
  before update or delete on public.scans
  for each row
  execute function public.scans_block_row_mutation();

-- ---------------------------------------------------------------------------
-- 2. Block TRUNCATE
-- ---------------------------------------------------------------------------

create or replace function public.scans_block_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'public.scans is append-only: TRUNCATE is not allowed'
    using errcode = 'restrict_violation',
          hint = 'The ledger can only grow. Use a new scan to correct a record.';
end;
$$;

comment on function public.scans_block_truncate() is
  'Refuses TRUNCATE on the ledger. TRUNCATE never fires row-level triggers.';

create trigger scans_no_truncate
  before truncate on public.scans
  for each statement
  execute function public.scans_block_truncate();

-- ---------------------------------------------------------------------------
-- 3. Privileges
--
-- Edit and delete are removed from every role, including service_role.
-- INSERT is left on service_role for now because the ingest function (D5) does
-- not exist yet. When D5 lands it becomes SECURITY DEFINER, and the follow-up
-- migration revokes INSERT from service_role too, so the only writer is the
-- ingest function itself.
-- ---------------------------------------------------------------------------

revoke update, delete, truncate on public.scans from public;
revoke update, delete, truncate on public.scans from anon, authenticated, service_role;

-- No logged-in user may insert into the ledger (D8 states the same rule in RLS).
revoke insert on public.scans from public, anon, authenticated;
