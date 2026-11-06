-- ============================================================================
-- D7 · Auth and roles (rewritten)
--
-- profiles and auditor_assignments already exist (created in D2), so this
-- migration does NOT create them again. It adds:
--   * the helper functions every RLS policy uses (D8, D9, D16)
--   * a guard so only admins can approve products
--   * a sequence that hands out product codes (P0001, P0002, ...)
--
-- Identity always comes from auth.uid(), the user id inside the Supabase JWT.
-- Nothing here reads app.current_user_id: Supabase never sets that.
--
-- Sign-ups are switched off in config.toml ([auth] enable_signup = false) and
-- in the dashboard for dev and prod. Test users are created with
-- database/scripts/create_test_users.py, never in a migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helpers. SECURITY DEFINER so they can read profiles without tripping
--    profiles' own RLS (which would otherwise recurse).
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = (select auth.uid())
$$;

create or replace function public.my_company()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id from public.profiles p where p.user_id = (select auth.uid())
$$;

-- Turns any text into a uuid, or null if it is not one. Used where a uuid is
-- taken from a channel name or a storage folder, so bad input never crashes.
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- The single rule behind every "who sees which company" policy.
create or replace function public.can_see_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case public.my_role()
      when 'admin'     then true
      when 'regulator' then true
      when 'company'   then p_company_id = public.my_company()
      when 'auditor'   then exists (
        select 1
        from public.auditor_assignments a
        where a.auditor_id = (select auth.uid())
          and a.company_id = p_company_id
      )
    end,
    false
  )
$$;

revoke all on function public.my_role()               from public, anon;
revoke all on function public.my_company()            from public, anon;
revoke all on function public.can_see_company(uuid)   from public, anon;
grant execute on function public.my_role()             to authenticated, service_role;
grant execute on function public.my_company()          to authenticated, service_role;
grant execute on function public.can_see_company(uuid) to authenticated, service_role;
grant execute on function public.try_uuid(text)        to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Product codes are issued by the database, not typed by users
-- ---------------------------------------------------------------------------

create sequence if not exists public.product_code_seq start 1;

alter table public.products
  alter column product_code
  set default 'P' || lpad(nextval('public.product_code_seq')::text, 4, '0');

-- ---------------------------------------------------------------------------
-- 3. Only admins approve products. Calls without a logged-in user
--    (service role, migrations, seed) are trusted.
-- ---------------------------------------------------------------------------

create or replace function public.products_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.my_role() = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;                       -- every new product waits for an admin
    return new;
  end if;

  if new.approved is distinct from old.approved then
    raise exception 'Only an admin can change product approval'
      using errcode = '42501';
  end if;

  -- Once approved, the fields that decide EPR totals are frozen.
  if old.approved and (new.product_code, new.barcode, new.category, new.unit_weight_g, new.company_id)
                is distinct from
                      (old.product_code, old.barcode, old.category, old.unit_weight_g, old.company_id) then
    raise exception 'An approved product cannot change code, barcode, category, weight or owner'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists products_guard on public.products;
create trigger products_guard
  before insert or update on public.products
  for each row execute function public.products_guard();
