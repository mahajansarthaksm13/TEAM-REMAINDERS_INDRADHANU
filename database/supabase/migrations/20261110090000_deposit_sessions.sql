-- ============================================================================
-- Deposit sessions: scan opens the bin, the deposit is what counts (web A20)
--
-- Until now a scan was decided in one step (ingest_scan: accepted or
-- rejected). A smart bin works in two:
--
--   1. open_deposit_session  The bin asks "may I open for this code?". A
--      read-only pre-check (same rules and reason codes as ingest_scan) either
--      keeps the lid shut or creates a PENDING entry. The code is NOT used up.
--   2. decide_deposit        The bin reports what its camera and scale saw.
--      The deposit policy lives here, in the database: nothing seen means
--      rejected, and nothing is counted.
--   3. Only a "submit" decision is signed by the bin and sent through the
--      real ingest pipeline (Edge Function -> ingest_scan), which redeems the
--      code, chains the record and broadcasts it. record_deposit_result stores
--      the ledger's answer: approved, review (weight outside tolerance, the
--      existing weight_ok policy) or rejected.
--
-- Pending and rejected attempts live here, never in public.scans, so only a
-- confirmed deposit is ever counted. Every row is marked simulated: today only
-- the web Simulation Studio drives demo bins through this protocol. A real
-- bin would sign its open/decide requests before this is opened to it.
--
-- Everything is service-role only (the web server's simulation adapter).
--
-- Tests: supabase/tests/deposit_sessions.test.sql
-- ============================================================================

create table public.deposit_sessions (
  id           uuid primary key default gen_random_uuid(),
  bin_id       text not null references public.bins (id) on delete cascade,
  code         text not null,
  product_id   uuid not null references public.products (id) on delete cascade,
  status       text not null default 'pending',
  reason       text,
  camera_seen  boolean,
  weight_g     integer,
  scan_id      uuid references public.scans (id) on delete set null,
  simulated    boolean not null default true,
  source       text not null default 'simulator',
  opened_at    timestamptz not null default now(),
  decided_at   timestamptz,
  expires_at   timestamptz not null default now() + interval '90 seconds',

  constraint deposit_sessions_status check (status in ('pending', 'submitting', 'approved', 'review', 'rejected', 'expired')),
  constraint deposit_sessions_weight check (weight_g is null or weight_g between 0 and 5000)
);

comment on table public.deposit_sessions is
  'One row per lid opening. Pending, rejected and expired attempts stay here and are never counted; only approved/review rows link to a ledger scan.';

-- One open lid per code at a time (a second scan of the same code waits).
create unique index deposit_sessions_one_pending_per_code
  on public.deposit_sessions (code) where status in ('pending', 'submitting');
create index deposit_sessions_bin_time_idx on public.deposit_sessions (bin_id, opened_at desc);

alter table public.deposit_sessions enable row level security;   -- no policies: no API access
revoke all on public.deposit_sessions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. May the lid open?
-- ---------------------------------------------------------------------------
create or replace function public.open_deposit_session(p_bin_id text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bin     public.bins%rowtype;
  v_qr      public.qr_codes%rowtype;
  v_product public.products%rowtype;
  v_id      uuid;
  v_expires timestamptz;
begin
  select * into v_bin from public.bins where id = p_bin_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_bin');
  end if;
  if not v_bin.is_demo then
    return jsonb_build_object('ok', false, 'reason', 'not_a_demo_bin');
  end if;
  if v_bin.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'bin_inactive');
  end if;

  -- Same checks and reason codes as ingest_scan's QR tier (ingest_fixes.sql).
  if coalesce(p_code, '') !~ '^VBQ1\.P[0-9]{4}\.[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'reason', 'qr_unknown');
  end if;
  select * into v_qr from public.qr_codes where serial = split_part(p_code, '.', 3);
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'qr_unknown');
  end if;
  if v_qr.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'qr_already_used');
  end if;
  select * into v_product from public.products where id = v_qr.product_id;
  if not found
     or not v_product.approved
     or v_product.company_id <> v_bin.company_id
     or v_product.product_code <> split_part(p_code, '.', 2) then
    return jsonb_build_object('ok', false, 'reason', 'qr_unknown');
  end if;

  -- A lid left open too long times out; then the code may open the bin again.
  update public.deposit_sessions
     set status = 'expired', reason = 'timed_out', decided_at = now()
   where code = p_code and status = 'pending' and expires_at <= now();

  begin
    insert into public.deposit_sessions (bin_id, code, product_id)
    values (p_bin_id, p_code, v_product.id)
    returning id, expires_at into v_id, v_expires;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'session_open');
  end;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_id,
    'opened_at', now(),
    'expires_at', v_expires,
    'product', jsonb_build_object(
      'id', v_product.id, 'code', v_product.product_code, 'name', v_product.name,
      'category', v_product.category, 'unit_weight_g', v_product.unit_weight_g
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The deposit policy: did an item really go in?
-- ---------------------------------------------------------------------------
create or replace function public.decide_deposit(p_session uuid, p_camera_seen boolean, p_weight_g integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s      public.deposit_sessions%rowtype;
  v_reason text;
begin
  if p_camera_seen is null or p_weight_g is null or p_weight_g < 0 or p_weight_g > 5000 then
    raise exception 'camera result and a weight between 0 and 5000 g are required' using errcode = '22023';
  end if;

  select * into v_s from public.deposit_sessions where id = p_session for update;
  if not found then
    raise exception 'deposit session not found' using errcode = 'P0002';
  end if;
  if v_s.status <> 'pending' then
    return jsonb_build_object('decision', 'already_decided', 'status', v_s.status, 'reason', v_s.reason);
  end if;
  if v_s.expires_at <= now() then
    update public.deposit_sessions set status = 'expired', reason = 'timed_out', decided_at = now() where id = p_session;
    return jsonb_build_object('decision', 'rejected', 'status', 'expired', 'reason', 'timed_out');
  end if;

  v_reason := case
    when not p_camera_seen and p_weight_g < 1 then 'no_deposit'
    when not p_camera_seen                    then 'camera_not_confirmed'
    when p_weight_g < 1                       then 'weight_not_confirmed'
  end;

  if v_reason is not null then
    update public.deposit_sessions
       set status = 'rejected', reason = v_reason, camera_seen = p_camera_seen, weight_g = p_weight_g, decided_at = now()
     where id = p_session;
    return jsonb_build_object('decision', 'rejected', 'status', 'rejected', 'reason', v_reason, 'decided_at', now());
  end if;

  update public.deposit_sessions
     set status = 'submitting', camera_seen = p_camera_seen, weight_g = p_weight_g
   where id = p_session;
  return jsonb_build_object('decision', 'submit', 'status', 'submitting', 'bin_id', v_s.bin_id, 'code', v_s.code, 'weight_g', p_weight_g);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Store what the ledger said
-- ---------------------------------------------------------------------------
create or replace function public.record_deposit_result(p_session uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s       public.deposit_sessions%rowtype;
  v_scan_id uuid;
  v_status  text;
  v_reason  text;
begin
  select * into v_s from public.deposit_sessions where id = p_session for update;
  if not found then
    raise exception 'deposit session not found' using errcode = 'P0002';
  end if;
  if v_s.status <> 'submitting' then
    return jsonb_build_object('status', v_s.status, 'reason', v_s.reason, 'scan_id', v_s.scan_id);
  end if;

  if p_result->>'status' = 'accepted' then
    v_scan_id := (p_result->>'scan_id')::uuid;
    -- The scan must be this entry's own deposit: same bin, same code.
    if not exists (select 1 from public.scans s where s.id = v_scan_id and s.bin_id = v_s.bin_id and s.code = v_s.code) then
      v_status := 'rejected'; v_reason := 'result_mismatch'; v_scan_id := null;
    elsif (p_result->>'weight_ok')::boolean is false then
      v_status := 'review';   v_reason := 'weight_mismatch';
    else
      v_status := 'approved'; v_reason := null;
    end if;
  else
    v_status := 'rejected';
    v_reason := coalesce(nullif(p_result->>'reason', ''), 'ingest_failed');
  end if;

  update public.deposit_sessions
     set status = v_status, reason = v_reason, scan_id = v_scan_id, decided_at = now()
   where id = p_session;
  return jsonb_build_object('status', v_status, 'reason', v_reason, 'scan_id', v_scan_id, 'decided_at', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Fresh demo codes (the Studio's "reset": nothing is ever deleted)
-- ---------------------------------------------------------------------------
create or replace function public.issue_demo_qr(p_product_id uuid, p_quantity integer default 1)
returns table (qr_payload text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_product public.products%rowtype;
  v_batch   uuid;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'quantity must be between 1 and 20' using errcode = '22023';
  end if;
  select p.* into v_product
    from public.products p join public.companies c on c.id = p.company_id
   where p.id = p_product_id and c.is_demo and p.approved;
  if not found then
    raise exception 'codes can only be minted for approved demo products' using errcode = '42501';
  end if;

  insert into public.qr_batches (product_id, quantity) values (p_product_id, p_quantity) returning id into v_batch;
  return query
  with ins as (
    insert into public.qr_codes (serial, batch_id, product_id)
    select encode(extensions.gen_random_bytes(16), 'hex'), v_batch, p_product_id
    from generate_series(1, p_quantity)
    returning serial
  )
  select 'VBQ1.' || v_product.product_code || '.' || ins.serial from ins;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The demo catalogue: one product per EPR category, if the demo company
--    exists. Idempotent; seed.sql adds the company (and P9999) on reset.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_demo_catalogue()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.products (company_id, product_code, name, barcode, category, unit_weight_g, approved)
  select c.id, v.code, v.name, v.barcode, v.category::public.epr_category, v.grams, true
  from public.companies c
  cross join (values
    ('P9999', 'Demo bottle',           '8900000099999', 'cat1_rigid',       24),
    ('P9996', 'Demo snack pouch',      '8900000099968', 'cat2_flexible',     8),
    ('P9997', 'Demo shampoo sachet',   '8900000099975', 'cat3_multilayer',   3),
    ('P9998', 'Demo compostable cup',  '8900000099982', 'cat4_compostable', 12)
  ) as v(code, name, barcode, category, grams)
  where c.id = 'd0000000-0000-4000-8000-00000000de00' and c.is_demo
  on conflict (product_code) do nothing
$$;

revoke all on function public.open_deposit_session(text, text)            from public, anon, authenticated;
revoke all on function public.decide_deposit(uuid, boolean, integer)       from public, anon, authenticated;
revoke all on function public.record_deposit_result(uuid, jsonb)           from public, anon, authenticated;
revoke all on function public.issue_demo_qr(uuid, integer)                 from public, anon, authenticated;
revoke all on function public.ensure_demo_catalogue()                      from public, anon, authenticated;
grant execute on function public.open_deposit_session(text, text)          to service_role;
grant execute on function public.decide_deposit(uuid, boolean, integer)    to service_role;
grant execute on function public.record_deposit_result(uuid, jsonb)        to service_role;
grant execute on function public.issue_demo_qr(uuid, integer)              to service_role;
grant execute on function public.ensure_demo_catalogue()                   to service_role;
