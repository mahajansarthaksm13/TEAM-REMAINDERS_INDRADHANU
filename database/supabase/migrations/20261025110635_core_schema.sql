-- ============================================================================
-- D2 · Core schema
-- VeriBin · Team REMAINDERS
--
-- Source of truth: docs/CONTRACTS.md (DRAFT v0.1)
-- Every table, enum, constraint and index below mirrors that document.
-- If this file and the contract disagree, the contract wins and this file is
-- fixed by a new migration.
--
-- Notes
--  * Weights are whole grams (integer). Never floats.
--  * All times are timestamptz (UTC inside). Display is IST.
--  * Row-Level Security is enabled on every table here with NO policies, which
--    means deny-all for anon/authenticated. D8 adds the policies. Doing it this
--    way means the tables are never briefly world-readable in dev.
--    (service_role bypasses RLS, so ingest keeps working.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- EPR plastic categories. Wording pending confirmation against CPCB (contract §2).
create type public.epr_category as enum (
  'cat1_rigid',
  'cat2_flexible',
  'cat3_multilayer',
  'cat4_compostable'
);

create type public.bin_status as enum ('active', 'revoked');

create type public.scan_code_type as enum ('qr', 'barcode');

create type public.user_role as enum ('company', 'auditor', 'regulator', 'admin');

create type public.alert_kind as enum (
  'bin_offline',
  'sequence_gap',
  'anomaly',
  'target_at_risk',
  'chain_break'
);

create type public.flag_severity as enum ('low', 'medium', 'high');

-- ---------------------------------------------------------------------------
-- Companies, users, auditors
-- ---------------------------------------------------------------------------

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  is_demo     boolean     not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.companies is
  'Brand owners / producers. is_demo companies are excluded from public stats and reports.';

-- One row per auth user. role + company_id drive every RLS policy in D8.
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  company_id  uuid references public.companies (id) on delete set null,
  full_name   text,
  created_at  timestamptz not null default now(),

  -- A company user must belong to a company; an auditor is linked via
  -- auditor_assignments; admin and regulator are not tied to one company.
  constraint profiles_company_required check (
    (role = 'company' and company_id is not null)
    or (role <> 'company')
  )
);

create table public.auditor_assignments (
  auditor_id  uuid not null references public.profiles (user_id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (auditor_id, company_id)
);

-- ---------------------------------------------------------------------------
-- Catalogue: products, QR batches, one-time QR codes
-- ---------------------------------------------------------------------------

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  product_code   text not null unique,
  name           text not null,
  barcode        text,
  category       public.epr_category not null,
  unit_weight_g  integer not null,
  approved       boolean not null default false,
  created_at     timestamptz not null default now(),

  constraint products_code_format   check (product_code ~ '^P[0-9]{4}$'),
  constraint products_barcode_format check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  constraint products_weight_positive check (unit_weight_g > 0)
);

comment on column public.products.approved is
  'Only admins set this. Only approved products may be scanned or have QR codes issued.';

create table public.qr_batches (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null,
  created_by  uuid references public.profiles (user_id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint qr_batches_quantity_range check (quantity between 1 and 10000)
);

-- One-time codes. serial is the 32-hex tail of the payload VBQ1.<product_code>.<serial>.
create table public.qr_codes (
  serial       text primary key,
  batch_id     uuid not null references public.qr_batches (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  redeemed_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint qr_codes_serial_format check (serial ~ '^[0-9a-f]{32}$')
);

comment on column public.qr_codes.redeemed_at is
  'Set exactly once, atomically, by the ingest function. A redeemed code can never be reused.';

-- ---------------------------------------------------------------------------
-- Bins
-- ---------------------------------------------------------------------------

create table public.bins (
  id             text primary key,
  company_id     uuid not null references public.companies (id) on delete cascade,
  city           text not null,
  public_key     text not null,
  status         public.bin_status not null default 'active',
  last_sequence  bigint not null default 0,
  chain_head     text not null,
  last_seen      timestamptz,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),

  constraint bins_id_format check (id ~ '^VB-[A-Z]{3}-[0-9]{4}(-DEMO)?$'),
  constraint bins_chain_head_format check (chain_head ~ '^[0-9a-f]{64}$')
);

comment on column public.bins.chain_head is
  'Hash of the last accepted scan on this bin''s chain. Genesis value is 64 zeros.';
comment on column public.bins.last_sequence is
  'Highest sequence accepted. Used to detect replays and gaps.';
comment on column public.bins.public_key is
  'Ed25519 public key, base64. The private key never leaves the device.';

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------

create table public.scans (
  id                uuid primary key default gen_random_uuid(),
  bin_id            text not null references public.bins (id) on delete restrict,
  company_id        uuid not null references public.companies (id) on delete restrict,
  product_id        uuid references public.products (id) on delete restrict,
  category          public.epr_category,
  sequence          bigint not null,
  scanned_at        timestamptz not null,
  received_at       timestamptz not null default now(),
  code_type         public.scan_code_type not null,
  code              text not null,
  weight_g          integer not null,
  record_text       text not null,
  signature         text not null,
  record_hash       text not null,
  prev_chain_hash   text not null,
  chain_hash        text not null,
  insertion_order   bigint generated always as identity,

  constraint scans_sequence_unique unique (bin_id, sequence),
  constraint scans_sequence_positive check (sequence > 0),
  constraint scans_weight_range check (weight_g between 0 and 5000),
  constraint scans_record_hash_format check (record_hash ~ '^[0-9a-f]{64}$'),
  constraint scans_prev_hash_format check (prev_chain_hash ~ '^[0-9a-f]{64}$'),
  constraint scans_chain_hash_format check (chain_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.scans is
  'The ledger. Append-only: D3 blocks UPDATE, DELETE and TRUNCATE for every role. Corrections are new rows.';

create index scans_company_time_idx on public.scans (company_id, scanned_at desc);
create index scans_bin_order_idx    on public.scans (bin_id, insertion_order);
create index scans_product_idx      on public.scans (product_id);
create index scans_company_cat_time_idx on public.scans (company_id, category, scanned_at desc);

create table public.rejected_scans (
  id           uuid primary key default gen_random_uuid(),
  bin_id       text,
  record_text  text,
  reason       text not null,
  received_at  timestamptz not null default now()
);

comment on table public.rejected_scans is
  'Every refused scan with its reason code. Shown on the dashboard as the data-quality line.';

create index rejected_scans_bin_time_idx on public.rejected_scans (bin_id, received_at desc);
create index rejected_scans_reason_idx   on public.rejected_scans (reason);

-- ---------------------------------------------------------------------------
-- Pre-calculated totals and targets
-- ---------------------------------------------------------------------------

create table public.daily_totals (
  day         date not null,
  company_id  uuid not null references public.companies (id) on delete cascade,
  category    public.epr_category not null,
  bin_id      text not null references public.bins (id) on delete cascade,
  scan_count  integer not null default 0,
  weight_g    bigint  not null default 0,
  primary key (day, company_id, category, bin_id)
);

comment on table public.daily_totals is
  'Running totals maintained by the ingest function. The dashboard reads these, not raw scans.';

create index daily_totals_company_day_idx on public.daily_totals (company_id, day desc);

create table public.targets (
  company_id      uuid not null references public.companies (id) on delete cascade,
  financial_year  text not null,
  category        public.epr_category not null,
  target_kg       numeric(12, 3) not null,
  primary key (company_id, financial_year, category),

  constraint targets_fy_format check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint targets_positive check (target_kg > 0)
);

comment on column public.targets.financial_year is
  'Indian financial year label, April-March, e.g. 2026-27 means 2026-04-01 to 2027-03-31.';

-- ---------------------------------------------------------------------------
-- AI output tables (written only by the AI role, see D13)
-- ---------------------------------------------------------------------------

create table public.scan_flags (
  scan_id     uuid not null references public.scans (id) on delete cascade,
  reason      text not null,
  severity    public.flag_severity not null,
  created_at  timestamptz not null default now(),
  primary key (scan_id, reason)
);

create table public.bin_scores (
  bin_id            text not null references public.bins (id) on delete cascade,
  day               date not null,
  score             integer not null,
  reasons           jsonb not null default '[]'::jsonb,
  scans_considered  integer not null default 0,
  created_at        timestamptz not null default now(),
  primary key (bin_id, day),

  constraint bin_scores_range check (score between 0 and 100)
);

comment on column public.bin_scores.reasons is
  'Array of {code, points, detail} objects. A score without reasons is not acceptable.';

create table public.insights (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  week_start   date not null,
  kind         text not null,
  payload      jsonb not null default '{}'::jsonb,
  sentence     text,
  scan_filter  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on column public.insights.sentence is
  'Written by Gemini from pre-computed numbers only, and checked. Falls back to a template.';
comment on column public.insights.scan_filter is
  'The exact filter that opens the scans behind this card. Every insight must be traceable.';

create index insights_company_week_idx on public.insights (company_id, week_start desc);

create table public.forecasts (
  company_id      uuid not null references public.companies (id) on delete cascade,
  category        public.epr_category not null,
  financial_year  text not null,
  as_of           date not null,
  projected_kg    numeric(12, 3) not null,
  low_kg          numeric(12, 3) not null,
  high_kg         numeric(12, 3) not null,
  created_at      timestamptz not null default now(),
  primary key (company_id, category, financial_year, as_of)
);

-- ---------------------------------------------------------------------------
-- Alerts, checkpoints, reports
-- ---------------------------------------------------------------------------

create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  kind        public.alert_kind not null,
  bin_id      text references public.bins (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete cascade,
  message     text not null,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz
);

create index alerts_open_idx on public.alerts (company_id, opened_at desc)
  where closed_at is null;

-- One row per night. The hash of all bin chain heads, chained to yesterday.
create table public.checkpoints (
  day            date primary key,
  hash           text not null,
  previous_hash  text,
  created_at     timestamptz not null default now(),

  constraint checkpoints_hash_format check (hash ~ '^[0-9a-f]{64}$'),
  constraint checkpoints_prev_format check (previous_hash is null or previous_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.checkpoints is
  'Public by design. Published to the veribin-checkpoints repo so history cannot be quietly rewritten.';

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  category        public.epr_category not null,
  period_start    date not null,
  period_end      date not null,
  fingerprint     text not null,
  checkpoint_day  date references public.checkpoints (day),
  storage_path    text,
  created_at      timestamptz not null default now(),

  constraint reports_fingerprint_format check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint reports_period_order check (period_end >= period_start)
);

-- ---------------------------------------------------------------------------
-- Row-Level Security: enabled everywhere, deny-all until D8 adds policies
-- ---------------------------------------------------------------------------

alter table public.companies            enable row level security;
alter table public.profiles             enable row level security;
alter table public.auditor_assignments  enable row level security;
alter table public.products             enable row level security;
alter table public.qr_batches           enable row level security;
alter table public.qr_codes             enable row level security;
alter table public.bins                 enable row level security;
alter table public.scans                enable row level security;
alter table public.rejected_scans       enable row level security;
alter table public.daily_totals         enable row level security;
alter table public.targets              enable row level security;
alter table public.scan_flags           enable row level security;
alter table public.bin_scores           enable row level security;
alter table public.insights             enable row level security;
alter table public.forecasts            enable row level security;
alter table public.alerts               enable row level security;
alter table public.checkpoints          enable row level security;
alter table public.reports              enable row level security;
