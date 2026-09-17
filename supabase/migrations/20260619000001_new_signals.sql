-- New NYC signal tables + complex count/owner columns; NJ borough filter support.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- complexes extensions
-- ---------------------------------------------------------------------------
alter table public.complexes
  add column if not exists dob_complaint_count integer not null default 0;

alter table public.complexes
  add column if not exists fdny_violation_count integer not null default 0;

alter table public.complexes
  add column if not exists dep_violation_count integer not null default 0;

alter table public.complexes
  add column if not exists lead_paint_violation_count integer not null default 0;

alter table public.complexes
  add column if not exists owner_name_verified text;

alter table public.complexes
  add column if not exists owner_phone text;

alter table public.complexes
  add column if not exists owner_llc text;

alter table public.complexes
  add column if not exists housing_court_case_count integer not null default 0;

-- ---------------------------------------------------------------------------
-- dob_complaints
-- ---------------------------------------------------------------------------
create table if not exists public.dob_complaints (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text not null,
  complaint_category text,
  complaint_description text,
  status text,
  date_entered timestamptz,
  created_at timestamptz not null default now(),
  constraint dob_complaints_unique_key unique (address, complaint_category, date_entered)
);

create index if not exists dob_complaints_complex_id_idx on public.dob_complaints (complex_id);
create index if not exists dob_complaints_address_idx on public.dob_complaints (address);

-- ---------------------------------------------------------------------------
-- fdny_violations
-- ---------------------------------------------------------------------------
create table if not exists public.fdny_violations (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text,
  violation_type text,
  description text,
  issue_date timestamptz,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists fdny_violations_complex_id_idx on public.fdny_violations (complex_id);
create index if not exists fdny_violations_address_idx on public.fdny_violations (address);

-- ---------------------------------------------------------------------------
-- dep_violations
-- ---------------------------------------------------------------------------
create table if not exists public.dep_violations (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text,
  violation_type text,
  description text,
  issue_date timestamptz,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists dep_violations_complex_id_idx on public.dep_violations (complex_id);
create index if not exists dep_violations_address_idx on public.dep_violations (address);

-- ---------------------------------------------------------------------------
-- lead_paint_violations
-- ---------------------------------------------------------------------------
create table if not exists public.lead_paint_violations (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text,
  violation_type text,
  status text,
  approved_date timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lead_paint_violations_complex_id_idx on public.lead_paint_violations (complex_id);
create index if not exists lead_paint_violations_address_idx on public.lead_paint_violations (address);

-- ---------------------------------------------------------------------------
-- housing_court_cases
-- ---------------------------------------------------------------------------
create table if not exists public.housing_court_cases (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text,
  case_type text,
  filing_date timestamptz,
  case_status text,
  respondent text,
  created_at timestamptz not null default now()
);

create index if not exists housing_court_cases_complex_id_idx on public.housing_court_cases (complex_id);
create index if not exists housing_court_cases_address_idx on public.housing_court_cases (address);

-- ---------------------------------------------------------------------------
-- hpd_property_registration
-- ---------------------------------------------------------------------------
create table if not exists public.hpd_property_registration (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete set null,
  address text,
  owner_name text,
  owner_type text,
  business_name text,
  phone text,
  registration_date timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hpd_property_registration_complex_id_idx
  on public.hpd_property_registration (complex_id);
create index if not exists hpd_property_registration_address_idx
  on public.hpd_property_registration (address);

-- ---------------------------------------------------------------------------
-- Expand borough filters to New Jersey (Hudson: Jersey City / Hoboken / etc.)
-- ---------------------------------------------------------------------------
create or replace function public.complexes_mvt_tile(
  z integer,
  x integer,
  y integer,
  p_borough_area text default null,
  p_rent_stabilized_only boolean default false,
  p_has_hpd_violations boolean default false,
  p_min_google_rating double precision default null
)
returns bytea
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with tile as (
    select st_tileenvelope(z, x, y) as geom
  ),
  hood_avg as (
    select
      c.neighborhood,
      avg(c.cached_median_rent)::float as avg_rent
    from public.complexes c
    where c.neighborhood is not null
      and trim(c.neighborhood) <> ''
      and c.cached_median_rent is not null
      and c.cached_median_rent > 0
    group by c.neighborhood
  ),
  mvtgeom as (
    select
      c.id::text as id,
      coalesce(c.cached_community_score, c.google_rating, 0)::float as score,
      coalesce(c.hpd_open_violations, 0)::int as hpd,
      case c.hpd_violation_score
        when 'Severe' then 1
        when 'Moderate' then 2
        when 'Minor' then 3
        when 'Clean' then 4
        else 0
      end::int as hpd_score_num,
      case when c.has_bedbug_history then 1 else 0 end::int as has_bedbug,
      coalesce(c.cached_median_rent, 0)::float as median_rent,
      case
        when c.cached_median_rent is null or c.cached_median_rent <= 0 then 0::float
        when h.avg_rent is null or h.avg_rent <= 0 then 0::float
        else (c.cached_median_rent / h.avg_rent)::float
      end as rent_ratio,
      st_asmvtgeom(
        st_transform(c.coordinates::geometry, 3857),
        t.geom,
        4096,
        64,
        true
      ) as geom
    from public.complexes c
    cross join tile t
    left join hood_avg h on h.neighborhood = c.neighborhood
    where c.coordinates is not null
      and st_transform(c.coordinates::geometry, 3857) && t.geom
      and st_intersects(st_transform(c.coordinates::geometry, 3857), t.geom)
      and (
        p_borough_area is null
        or p_borough_area = 'all'
        or (p_borough_area = 'manhattan' and c.borough = 'Manhattan')
        or (p_borough_area = 'brooklyn' and c.borough = 'Brooklyn')
        or (
          p_borough_area in ('queens', 'lic')
          and c.borough = 'Queens'
        )
        or (
          p_borough_area in ('newjersey', 'nj')
          and (
            c.borough ilike '%jersey city%'
            or c.borough ilike '%hoboken%'
            or c.borough ilike '%hudson%'
            or c.source = 'nj_mod4'
          )
        )
      )
      and (not p_rent_stabilized_only or c.is_rent_stabilized = true)
      and (not p_has_hpd_violations or coalesce(c.hpd_open_violations, 0) > 0)
      and (
        p_min_google_rating is null
        or p_min_google_rating <= 0
        or coalesce(c.google_rating, 0) >= p_min_google_rating
      )
  )
  select coalesce(
    (
      select st_asmvt(m.*, 'complexes', 4096, 'geom')
      from mvtgeom m
      where m.geom is not null
    ),
    ''::bytea
  );
$$;

drop function if exists public.complexes_in_bounds(
  double precision,
  double precision,
  double precision,
  double precision,
  text,
  boolean,
  boolean,
  double precision
);

create function public.complexes_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  p_borough_area text default null,
  p_rent_stabilized_only boolean default false,
  p_has_hpd_violations boolean default false,
  p_min_google_rating double precision default null
)
returns table (
  id uuid,
  name text,
  address text,
  borough text,
  zip text,
  units integer,
  google_rating numeric,
  google_review_count integer,
  street_view_url text,
  lat double precision,
  lng double precision,
  hpd_open_violations integer,
  hpd_violation_score text,
  has_bedbug_history boolean,
  is_rent_stabilized boolean,
  cached_median_rent numeric,
  cached_review_count integer,
  cached_community_score numeric,
  cached_signal_count integer
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
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
    c.hpd_open_violations,
    c.hpd_violation_score,
    c.has_bedbug_history,
    c.is_rent_stabilized,
    c.cached_median_rent,
    c.cached_review_count,
    c.cached_community_score,
    c.cached_signal_count
  from public.complexes c
  where c.coordinates is not null
    and c.coordinates && st_makeenvelope(
      min_lng, min_lat, max_lng, max_lat, 4326
    )::geography
    and (
      p_borough_area is null
      or p_borough_area = 'all'
      or (p_borough_area = 'manhattan' and c.borough = 'Manhattan')
      or (p_borough_area = 'brooklyn' and c.borough = 'Brooklyn')
      or (
        p_borough_area in ('queens', 'lic')
        and c.borough = 'Queens'
      )
      or (
        p_borough_area in ('newjersey', 'nj')
        and (
          c.borough ilike '%jersey city%'
          or c.borough ilike '%hoboken%'
          or c.borough ilike '%hudson%'
          or c.source = 'nj_mod4'
        )
      )
    )
    and (not p_rent_stabilized_only or c.is_rent_stabilized = true)
    and (not p_has_hpd_violations or c.hpd_open_violations > 0)
    and (
      p_min_google_rating is null
      or p_min_google_rating <= 0
      or c.google_rating >= p_min_google_rating
    );
$$;

grant execute on function public.complexes_mvt_tile(
  integer, integer, integer, text, boolean, boolean, double precision
) to anon, authenticated, service_role;

grant execute on function public.complexes_in_bounds(
  double precision,
  double precision,
  double precision,
  double precision,
  text,
  boolean,
  boolean,
  double precision
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
