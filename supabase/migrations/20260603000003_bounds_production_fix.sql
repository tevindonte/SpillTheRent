-- Idempotent production fix for /api/complexes/bounds 500 errors.
-- Safe to run even if 20260603000001 / 000002 already applied.

alter table public.complexes
  add column if not exists neighborhood text,
  add column if not exists cached_median_rent numeric,
  add column if not exists cached_review_count integer not null default 0,
  add column if not exists cached_community_score numeric,
  add column if not exists cached_signal_count integer not null default 0;

do $$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complexes_in_bounds'
  loop
    execute format('drop function if exists public.complexes_in_bounds(%s)', r.args);
  end loop;
end $$;

create or replace function public.complexes_in_bounds(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
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
  google_rating double precision,
  google_review_count integer,
  street_view_url text,
  lat double precision,
  lng double precision,
  hpd_open_violations integer,
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
        p_borough_area = 'lic'
        and c.borough = 'Queens'
        and c.neighborhood ilike '%long island city%'
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
