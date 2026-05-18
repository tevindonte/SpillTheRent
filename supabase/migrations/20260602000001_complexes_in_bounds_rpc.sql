-- Fast viewport query: GIST index on coordinates via && envelope (no per-tile fan-out).

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
  is_rent_stabilized boolean
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
    c.is_rent_stabilized
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

comment on function public.complexes_in_bounds is
  'Map viewport buildings. Uses GIST on coordinates; avoids complexes_map_summary subqueries.';

grant execute on function public.complexes_in_bounds to anon, authenticated;
