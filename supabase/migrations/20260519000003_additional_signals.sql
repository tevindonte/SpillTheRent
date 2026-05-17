-- Bedbug, DOB permits, OATH violations, HP actions (housing court)

-- ---------------------------------------------------------------------------
-- complexes extensions
-- ---------------------------------------------------------------------------
alter table public.complexes
  add column if not exists has_bedbug_history boolean not null default false;

alter table public.complexes
  add column if not exists bedbug_last_reported_year integer;

alter table public.complexes
  add column if not exists bedbug_report_count integer not null default 0;

alter table public.complexes
  add column if not exists has_active_construction boolean not null default false;

alter table public.complexes
  add column if not exists active_permit_count integer not null default 0;

alter table public.complexes
  add column if not exists oath_violation_count integer not null default 0;

alter table public.complexes
  add column if not exists hp_action_count integer not null default 0;

alter table public.complexes
  add column if not exists hp_action_last_year integer;

-- ---------------------------------------------------------------------------
-- bedbug_reports
-- ---------------------------------------------------------------------------
create table if not exists public.bedbug_reports (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text not null,
  building_id text,
  infested_unit_count integer not null default 0,
  eradicated_unit_count integer not null default 0,
  filing_year integer not null,
  created_at timestamptz not null default now(),
  constraint bedbug_reports_unique_report unique (address, filing_year)
);

create index if not exists bedbug_reports_complex_id_idx on public.bedbug_reports (complex_id);
create index if not exists bedbug_reports_address_idx on public.bedbug_reports (address);

-- ---------------------------------------------------------------------------
-- dob_permits
-- ---------------------------------------------------------------------------
create table if not exists public.dob_permits (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text not null,
  permit_type text not null,
  permit_status text not null,
  filing_date timestamptz,
  expiration_date timestamptz,
  job_description text,
  created_at timestamptz not null default now()
);

create index if not exists dob_permits_complex_id_idx on public.dob_permits (complex_id);
create index if not exists dob_permits_address_idx on public.dob_permits (address);

-- ---------------------------------------------------------------------------
-- oath_violations
-- ---------------------------------------------------------------------------
create table if not exists public.oath_violations (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text not null,
  violation_description text,
  issue_date timestamptz,
  penalty_amount numeric,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists oath_violations_complex_id_idx on public.oath_violations (complex_id);
create index if not exists oath_violations_address_idx on public.oath_violations (address);

-- ---------------------------------------------------------------------------
-- hp_actions
-- ---------------------------------------------------------------------------
create table if not exists public.hp_actions (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text not null,
  case_number text not null,
  filing_date timestamptz,
  case_status text,
  created_at timestamptz not null default now(),
  constraint hp_actions_unique_case unique (address, case_number)
);

create index if not exists hp_actions_complex_id_idx on public.hp_actions (complex_id);
create index if not exists hp_actions_address_idx on public.hp_actions (address);

-- ---------------------------------------------------------------------------
-- RLS — public read
-- ---------------------------------------------------------------------------
alter table public.bedbug_reports enable row level security;
alter table public.dob_permits enable row level security;
alter table public.oath_violations enable row level security;
alter table public.hp_actions enable row level security;

create policy "bedbug_reports_select_public"
  on public.bedbug_reports for select to anon, authenticated using (true);

create policy "dob_permits_select_public"
  on public.dob_permits for select to anon, authenticated using (true);

create policy "oath_violations_select_public"
  on public.oath_violations for select to anon, authenticated using (true);

create policy "hp_actions_select_public"
  on public.hp_actions for select to anon, authenticated using (true);
