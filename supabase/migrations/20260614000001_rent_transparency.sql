-- Unit number on rent reports + helper for neighborhood rent banner.
-- PostGIS lives in extensions schema on Supabase.

create extension if not exists postgis with schema extensions;

alter table public.pricing_history
  add column if not exists unit_number text;

comment on column public.pricing_history.unit_number is
  'Optional apartment/unit label from tenant rent reports (e.g. 4B).';

-- Nearest complex with a neighborhood label (for map center reverse lookup).
create or replace function public.complex_neighborhood_near(
  p_lng double precision,
  p_lat double precision
)
returns table (
  neighborhood text,
  complex_id uuid,
  distance_m double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.neighborhood,
    c.id as complex_id,
    st_distance(
      c.coordinates,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m
  from public.complexes c
  where c.neighborhood is not null
    and trim(c.neighborhood) <> ''
    and c.coordinates is not null
  order by st_distance(
    c.coordinates,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  limit 1;
$$;

grant execute on function public.complex_neighborhood_near(double precision, double precision)
  to anon, authenticated, service_role;
