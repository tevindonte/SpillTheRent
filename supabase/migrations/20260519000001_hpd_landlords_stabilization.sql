-- HPD violations, landlords, rent stabilization columns

-- ---------------------------------------------------------------------------
-- landlords (before complexes.landlord_id FK)
-- ---------------------------------------------------------------------------
create table if not exists public.landlords (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  raw_names text[] not null default '{}',
  building_count integer not null default 0,
  total_units integer not null default 0,
  avg_google_rating double precision,
  avg_hpd_violations double precision,
  portfolio_score text
    constraint landlords_portfolio_score_check
    check (portfolio_score in ('Excellent', 'Good', 'Fair', 'Poor')),
  created_at timestamptz not null default now()
);

create index if not exists landlords_name_idx on public.landlords (name);

-- ---------------------------------------------------------------------------
-- complexes extensions
-- ---------------------------------------------------------------------------
alter table public.complexes
  add column if not exists ownername text;

alter table public.complexes
  add column if not exists hpd_open_violations integer not null default 0;

alter table public.complexes
  add column if not exists hpd_violation_score text
    constraint complexes_hpd_violation_score_check
    check (
      hpd_violation_score is null
      or hpd_violation_score in ('Clean', 'Minor', 'Moderate', 'Severe')
    );

alter table public.complexes
  add column if not exists landlord_id uuid references public.landlords (id) on delete set null;

alter table public.complexes
  add column if not exists is_rent_stabilized boolean not null default false;

alter table public.complexes
  add column if not exists stabilized_units integer;

alter table public.complexes
  add column if not exists stabilization_year integer;

create index if not exists complexes_landlord_id_idx on public.complexes (landlord_id);
create index if not exists complexes_is_rent_stabilized_idx on public.complexes (is_rent_stabilized);
create index if not exists complexes_hpd_open_violations_idx on public.complexes (hpd_open_violations);

-- ---------------------------------------------------------------------------
-- hpd_violations
-- ---------------------------------------------------------------------------
create table if not exists public.hpd_violations (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text not null,
  violation_class text not null
    constraint hpd_violations_class_check
    check (violation_class in ('A', 'B', 'C')),
  violation_type text not null,
  description text,
  status text not null
    constraint hpd_violations_status_check
    check (status in ('open', 'close')),
  approved_date timestamptz not null,
  closed_date timestamptz,
  created_at timestamptz not null default now(),
  constraint hpd_violations_unique_violation
    unique (address, violation_type, approved_date)
);

create index if not exists hpd_violations_complex_id_idx on public.hpd_violations (complex_id);
create index if not exists hpd_violations_address_idx on public.hpd_violations (address);
create index if not exists hpd_violations_status_idx on public.hpd_violations (status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.landlords enable row level security;
alter table public.hpd_violations enable row level security;

create policy "landlords_select_public"
  on public.landlords for select
  to anon, authenticated
  using (true);

create policy "hpd_violations_select_public"
  on public.hpd_violations for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Map summary view (filters + display fields)
-- ---------------------------------------------------------------------------
create or replace view public.complexes_map_summary
with (security_invoker = true)
as
select
  c.id,
  c.name,
  c.address,
  c.borough,
  c.zip,
  c.units,
  c.google_rating,
  c.google_review_count,
  c.street_view_url,
  st_y(c.coordinates::geometry) as lat,
  st_x(c.coordinates::geometry) as lng,
  (
    select percentile_cont(0.5) within group (order by ph.rent)::integer
    from public.pricing_history ph
    where ph.complex_id = c.id and ph.rent is not null
  ) as median_rent,
  (
    select count(*)::integer
    from public.reviews r
    where r.complex_id = c.id
  ) as review_count,
  c.hpd_open_violations,
  c.hpd_violation_score,
  c.is_rent_stabilized,
  c.stabilized_units,
  c.landlord_id
from public.complexes c
where c.coordinates is not null;

grant select on public.complexes_map_summary to anon, authenticated;
