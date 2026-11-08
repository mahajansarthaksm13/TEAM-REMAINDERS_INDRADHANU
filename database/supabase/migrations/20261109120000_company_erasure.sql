-- ============================================================================
-- Company erasure (web A19, follows 20261109090000_admin_controls)
--
-- Admins can remove a company completely, signed scans included. This is the
-- one exception to the append-only ledger (D3), so it is narrow and logged:
--
--  * public.erase_company() is the only way in. Admin only, never the demo
--    company, the admin must type the company's exact name and give a reason.
--    It runs as the table owner; API roles still have no DELETE on scans.
--  * The scans trigger lets a DELETE through only for the company named in the
--    transaction-local setting veribin.erasing_company, which only this
--    function sets. Every other UPDATE, DELETE and TRUNCATE is still refused.
--  * Every erasure is written to public.erasures, which is itself append-only.
--    Scans never cross companies (a bin belongs to one company), so an erasure
--    removes whole bin chains. Checkpoints already published included those
--    chains; the log records which bins and when, so anyone recomputing an
--    older checkpoint knows what was removed. Reports of other companies keep
--    verifying: each stores its own checkpoint hash.
--
-- Tests: supabase/tests/erase_company.test.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The erasure log (append-only)
-- ---------------------------------------------------------------------------
create table public.erasures (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,          -- no FK: the company is gone
  company_name   text not null,
  bin_ids        text[] not null default '{}',
  scan_count     bigint not null default 0,
  product_count  integer not null default 0,
  user_count     integer not null default 0,
  report_count   integer not null default 0,
  reason         text not null,
  erased_by      uuid,                   -- no FK: survives the admin's own removal later
  erased_at      timestamptz not null default now(),

  constraint erasures_reason_length check (char_length(reason) >= 10)
);

comment on table public.erasures is
  'Every company erasure, written by erase_company(). Append-only. Explains why checkpoints from before erased_at cannot be recomputed from today''s data.';

create or replace function public.erasures_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'public.erasures is append-only: % is not allowed', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger erasures_no_update_delete
  before update or delete on public.erasures
  for each row execute function public.erasures_block_mutation();
create trigger erasures_no_truncate
  before truncate on public.erasures
  for each statement execute function public.erasures_block_mutation();

revoke all on public.erasures from public, anon;
revoke insert, update, delete, truncate on public.erasures from authenticated, service_role;
grant select on public.erasures to authenticated;

alter table public.erasures enable row level security;
create policy erasures_read on public.erasures
  for select to authenticated
  using (public.my_role() in ('admin', 'regulator'));

-- Public view for the checkpoints page: what was removed and when, never why or by whom.
create or replace function public.get_public_erasures()
returns table (erased_at timestamptz, company_name text, bin_ids text[], scan_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.erased_at, e.company_name, e.bin_ids, e.scan_count
  from public.erasures e
  order by e.erased_at desc
$$;

revoke all on function public.get_public_erasures() from public;
grant execute on function public.get_public_erasures() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The ledger trigger: one narrow, logged exception
-- ---------------------------------------------------------------------------
create or replace function public.scans_block_row_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- erase_company() sets this for one company, inside its own transaction only.
  if tg_op = 'DELETE'
     and old.company_id::text = coalesce(current_setting('veribin.erasing_company', true), '') then
    return old;
  end if;
  raise exception
    'public.scans is append-only: % is not allowed (scan id %)',
    tg_op, old.id
    using errcode = 'restrict_violation',
          hint = 'Corrections must be inserted as new scans, never applied to existing ones.';
end;
$$;

comment on function public.scans_block_row_mutation() is
  'Refuses UPDATE and DELETE on the ledger (D3). Only exception: erase_company() deleting one whole company, logged in public.erasures.';

-- ---------------------------------------------------------------------------
-- 3. erase_company: the only way to remove a company that has evidence
-- ---------------------------------------------------------------------------
create or replace function public.erase_company(p_company_id uuid, p_confirm_name text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company  public.companies%rowtype;
  v_bins     text[];
  v_scans    bigint;
  v_products integer;
  v_users    uuid[];
  v_paths    text[];
  v_reason   text := btrim(coalesce(p_reason, ''));
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'only an admin can erase a company' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'company not found' using errcode = 'P0002';
  end if;
  if v_company.is_demo then
    raise exception 'the demo company runs the simulator and cannot be erased' using errcode = '42501';
  end if;
  if regexp_replace(btrim(coalesce(p_confirm_name, '')), '\s+', ' ', 'g')
     is distinct from regexp_replace(btrim(v_company.name), '\s+', ' ', 'g') then
    raise exception 'the typed name does not match the company' using errcode = '22023';
  end if;
  if char_length(v_reason) < 10 then
    raise exception 'give a reason of at least 10 characters' using errcode = '22023';
  end if;

  select coalesce(array_agg(b.id order by b.id), '{}') into v_bins from public.bins b where b.company_id = p_company_id;
  select count(*) into v_scans from public.scans s where s.company_id = p_company_id;
  select count(*) into v_products from public.products p where p.company_id = p_company_id;
  select coalesce(array_agg(p.user_id), '{}') into v_users
    from public.profiles p where p.company_id = p_company_id and p.role = 'company';
  select coalesce(array_agg(r.storage_path) filter (where r.storage_path is not null), '{}') into v_paths
    from public.reports r where r.company_id = p_company_id;

  insert into public.erasures (company_id, company_name, bin_ids, scan_count, product_count, user_count, report_count, reason, erased_by)
  values (p_company_id, v_company.name, v_bins, v_scans, v_products, cardinality(v_users),
          (select count(*) from public.reports r where r.company_id = p_company_id), v_reason, (select auth.uid()));

  perform set_config('veribin.erasing_company', p_company_id::text, true);
  delete from public.scans where company_id = p_company_id;          -- scan_flags cascade
  perform set_config('veribin.erasing_company', '', true);

  delete from auth.users where id = any(v_users);                     -- their profiles cascade
  delete from public.companies where id = p_company_id;               -- bins, products, totals, reports, ... cascade

  return jsonb_build_object(
    'scans', v_scans, 'bins', cardinality(v_bins), 'products', v_products,
    'users', cardinality(v_users), 'report_paths', to_jsonb(v_paths)
  );
end;
$$;

comment on function public.erase_company(uuid, text, text) is
  'Admin only. Removes a company and everything it recorded, scans included, and logs it in public.erasures.';

revoke all on function public.erase_company(uuid, text, text) from public, anon;
grant execute on function public.erase_company(uuid, text, text) to authenticated;
