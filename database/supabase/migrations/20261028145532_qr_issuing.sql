-- ============================================================================
-- D11 · QR issuing function (rewritten)
--
-- Called from the web app (A11) by a logged-in COMPANY user:
--   select * from public.issue_qr_codes('<product uuid>', 500);
--
-- Rules:
--   * caller is a company user and owns the product
--   * product is approved
--   * quantity 1..10000
-- Returns one row per code: qr_serial (32 hex chars, 128 random bits) and
-- qr_payload (VBQ1.<product_code>.<serial>, exactly what is printed as QR).
-- ============================================================================

create or replace function public.issue_qr_codes(
  p_product_id uuid,
  p_quantity   integer
)
returns table (qr_serial text, qr_payload text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_batch   uuid;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then
    raise exception 'quantity must be between 1 and 10000' using errcode = '22023';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  -- coalesce: a caller with no profile gives null, which must mean "no"
  if not coalesce(public.my_role() = 'company'
                  and v_product.company_id = public.my_company(), false) then
    raise exception 'you can only issue codes for your own products' using errcode = '42501';
  end if;

  if not v_product.approved then
    raise exception 'product is not approved yet' using errcode = 'P0001';
  end if;

  insert into public.qr_batches (product_id, quantity, created_by)
  values (p_product_id, p_quantity, (select auth.uid()))
  returning id into v_batch;

  return query
  with ins as (
    insert into public.qr_codes (serial, batch_id, product_id)
    select encode(extensions.gen_random_bytes(16), 'hex'), v_batch, p_product_id
    from generate_series(1, p_quantity)
    returning serial
  )
  select ins.serial, 'VBQ1.' || v_product.product_code || '.' || ins.serial
  from ins;
end;
$$;

revoke all on function public.issue_qr_codes(uuid, integer) from public, anon;
grant execute on function public.issue_qr_codes(uuid, integer) to authenticated;
