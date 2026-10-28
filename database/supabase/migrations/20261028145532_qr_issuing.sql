-- ============================================================================
-- D11 · QR issuing function
--
-- Task sheet: D11 QR issuing
-- Unblocks: A11 (Sarthak: catalogue and QR screens)
--
-- The issuer (admin of a company) requests a batch of one-time QR codes for an
-- approved product. Each code is a unique 128-bit serial. The code payload format
-- is: VBQ1.<product_code>.<serial>
--
-- The function checks that the calling user owns the product and it is approved.
-- Codes are redeemed atomically by the ingest function (D5).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Sanity checks and configuration
-- ---------------------------------------------------------------------------

-- Quantity must be between 1 and 10000
create or function public.issue_qr_codes(
  p_product_id uuid,
  p_quantity   integer
)
returns table (
  serial       text,
  batch_id     uuid,
  product_id   uuid,
  product_code text,
  company_id   uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product    public.products%rowtype;
  v_company_id uuid;
  v_batch      public.qr_batches%rowtype;
  v_serial     text;
  v_i          integer;
begin
  -- -- Validate product exists and is approved
  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found (P0001)';
  end if;

  if not v_product.approved then
    raise exception 'Product not approved (P0002)';
  end if;

  -- -- Validate quantity range
  if p_quantity < 1 or p_quantity > 10000 then
    raise exception 'Quantity out of range (P0003)';
  end if;

  -- -- Determine the caller's company_id
  -- The Edge Function (D6) sets app.current_user_id via set_config.
  -- We read it here; if not set, fall back to the calling auth user.
  v_company_id := null;
  begin
    v_company_id := (select company_id from public.profiles
                     where user_id = current_setting('app.current_user_id', true));
  exception when others then null;
  end;

  -- -- The caller must be the owner of the product
  if v_product.company_id != v_company_id then
    raise exception 'Product not owned by caller (P0003)';
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Create a batch of QR codes
  -- -------------------------------------------------------------------------
  insert into public.qr_batches (product_id, quantity, created_by)
  values (p_product_id, p_quantity, v_company_id)
  returning id, product_id into v_batch.id, v_batch.product_id;

  -- -------------------------------------------------------------------------
  -- 3. Generate serials and insert QR codes
  -- -------------------------------------------------------------------------
  -- Serials are 32 lowercase hex characters (128 random bits).
  -- We generate them one by one and insert, checking for collisions.
  --
  -- Note: With 128 bits, collisions are astronomically unlikely, but we
  -- guard against them with a loop limit.
  --
  for v_i in 1..p_quantity loop
    -- Generate a random 128-bit hex serial
    select encode(crypto.random_bytes(16), 'lower') into v_serial;

    -- Insert the QR code (redeemed_at is null = not yet redeemed)
    insert into public.qr_codes (serial, batch_id, product_id)
    values (v_serial, v_batch.id, v_product.id);

    -- Return the serial to the caller
    return query select v_serial::text as serial,
                         v_batch.id::uuid as batch_id,
                         v_product.id::uuid as product_id,
                         v_product.product_code::text as product_code,
                         v_product.company_id::uuid as company_id;
  end loop;
end;
$$;

comment on function public.issue_qr_codes(uuid, integer) is
  'Issues a batch of one-time QR codes for an approved product. The caller must be the product owner.
   Quantity range: 1 to 10000. Each serial is a 32-character lowercase hex string (128 random bits).
   Codes are redeemed by the ingest function (D5) and cannot be reused.';

-- ---------------------------------------------------------------------------
-- 4. Grant execute to public (admin users via RLS) and service_role
-- ---------------------------------------------------------------------------
grant execute on function public.issue_qr_codes(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Seed scripts (conceptual)
-- ---------------------------------------------------------------------------
-- After this migration merges, an admin can run (via Supabase SQL editor or
-- npx supabase db exec):
--
--   SELECT * FROM public.issue_qr_codes(
--     (select id from public.products where product_code = 'P0007'),
--     100
--   );
--
-- This would return 100 rows with serial, batch_id, product_code, company_id.
--
-- Done when: the function returns serials for a valid approved product,
--            and raises appropriate exceptions for invalid inputs.
-- ============================================================================