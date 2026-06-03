-- Nearest building lookup for geo UGC prompt
-- PostGIS lives in extensions schema on Supabase.

create extension if not exists postgis with schema extensions;

create or replace function public.complexes_nearest(
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 3
)
returns table (
  id uuid,
  name text,
  address text,
  borough text,
  neighborhood text,
  lat double precision,
  lng double precision,
  distance_m double precision
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
    c.neighborhood,
    st_y(c.coordinates::geometry) as lat,
    st_x(c.coordinates::geometry) as lng,
    st_distance(
      c.coordinates,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m
  from public.complexes c
  where c.coordinates is not null
  order by st_distance(
    c.coordinates,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  limit greatest(1, least(p_limit, 10));
$$;

grant execute on function public.complexes_nearest(double precision, double precision, integer)
  to anon, authenticated;
