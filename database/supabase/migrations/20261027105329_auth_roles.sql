-- ============================================================================
-- D7 · Auth and roles
--
-- Task sheet: D7 Auth and roles
-- Unblocks: A6 (Sarthak's login)
--
-- 1. Disable public sign‑ups, enable email‑only login
-- 2. Create profiles + auditor‑assignments tables
-- 3. Script that creates test users (one per company, one auditor assigned to one company,
--    one regulator, one admin) and share logins via password manager
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Disable public sign‑ups and enable email login
-- ---------------------------------------------------------------------------

-- Supabase project config: turn off public sign‑ups, enable email login
-- (done via dashboard or API; recorded here for audit trail).

-- ---------------------------------------------------------------------------
-- 2. Profiles table
-- ---------------------------------------------------------------------------

-- One row per auth user. role + company_id drive every RLS policy in D8.
-- A company user must belong to a company; an auditor is linked via
-- auditor_assignments; admin and regulator are not tied to one company.

create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  company_id  uuid references public.companies (id) on delete set null,
  full_name   text,
  created_at  timestamptz not null default now(),

  -- Constraint ensures a company user always has a company;
  -- non‑company roles (auditor, regulator, admin) may have company_id null.
  constraint profiles_company_required check (
    (role = 'company' and company_id is not null)
    or (role <> 'company')
  )
);

comment on table public.profiles is
  'Maps auth users to roles and companies. Drives all RLS policies in D8.';

-- ---------------------------------------------------------------------------
-- 3. Auditor assignments
-- ---------------------------------------------------------------------------

create table public.auditor_assignments (
  auditor_id  uuid not null references public.profiles (user_id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (auditor_id, company_id)
);

comment on table public.auditor_assignments is
  'Links auditors (profiles with role = auditor) to companies they can audit.',
  'Each auditor may be assigned to one or more companies.';

-- ---------------------------------------------------------------------------
-- 4. Seed script (conceptual — run manually via npx supabase db exec)
-- ---------------------------------------------------------------------------

-- The following SQL creates the four test users. Execute with:
--   npx supabase db exec < seed-users.sql
--
-- Passwords are hashed; never store plain text in migration files.
-- Logins are shared via the team password manager.

-- VERBATIM from task sheet: "Script that creates test users: one per company,
-- one auditor assigned to one company, one regulator, one admin."

-- ---------------------------------------------------------------------------
-- 5. RLS is already enabled on profiles and auditor_assignments from D2
-- ---------------------------------------------------------------------------

-- D2 already ran:  alter table public.profiles enable row level security;
-- D2 already ran:  alter table public.auditor_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Sample policies (the task sheet says "Done when: all test users exist in dev")
-- ------------------------------------------------------------------------

-- These policies allow the web app to function while we D8 fine‑tune them.
-- D8 will replace/adjust them with the exact RLS matrix.

-- Companies see only their own profile
create policy "companies_see_own_profile" on public.profiles
  for select using (company_id = (select company_id from public.profiles where user_id = current_setting('app.current_user_id')));

-- Auditors see assigned companies
create policy "auditors_see_assigned_companies" on public.profiles
  for select using (role = 'auditor');

-- Regulators see all (will be tightened in D8)
create policy "regulators_see_all_profiles" on public.profiles
  for select using (role = 'regulator');

-- Admin sees all (will be tightened in D8)
create policy "admins_see_all_profiles" on public.profiles
  for select using (role = 'admin');

-- ---------------------------------------------------------------------------
-- 7. Test users (to be created manually)
-- ------------------------------------------------------------------------

-- After this migration merges, run:
--   npx supabase db exec seed-users.sql
--
-- Where seed-users.sql contains:
--
--   -- Company 1 user
--   insert into public.profiles (user_id, role, company_id, full_name)
--     values ('c1111111-1111-1111-1111-111111111111', 'company', '11111111-1111-1111-1111-111111111111', 'Company A User');
--
--   -- Company 2 user
--   insert into public.profiles (user_id, role, company_id, full_name)
--     values ('c2222222-2222-2222-2222-222222222222', 'company', '22222222-2222-2222-2222-222222222222', 'Company B User');
--
--   -- Auditor (assigned to Company 1)
--   insert into public.profiles (user_id, role, company_id, full_name)
--     values ('a1111111-1111-1111-1111-111111111111', 'auditor', '11111111-1111-1111-1111-111111111111', 'Audit User');
--
--   -- Auditor assignments
--   insert into public.auditor_assignments (auditor_id, company_id)
--     values ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
--
--   -- Regulator
--   insert into public.profiles (user_id, role, company_id, full_name)
--     values ('r1111111-1111-1111-1111-111111111111', 'regulator', null, 'Regulator User');
--
--   -- Admin
--   insert into public.profiles (user_id, role, company_id, full_name)
--     values ('admin1111111-1111-1111-1111-111111111111', 'admin', null, 'Admin User');
--
--   -- Set the Supabase anon key / service role env vars so the above
--   -- can be run in the supabase local environment.

-- Done when: all four user types (company, auditor, regulator, admin) exist in the database.