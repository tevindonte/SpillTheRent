-- Mapbox Vector Tiles for complexes (id, score, hpd, median_rent only).
-- Used by GET /api/complexes/mvt/{z}/{x}/{y}

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
  mvtgeom as (
    select
      c.id::text as id,
      coalesce(c.cached_community_score, c.google_rating)::float as score,
      coalesce(c.hpd_open_violations, 0)::int as hpd,
      coalesce(c.cached_median_rent, 0)::float as median_rent,
      st_asmvtgeom(
        c.coordinates::geometry,
        t.geom,
        4096,
        64,
        true
      ) as geom
    from public.complexes c
    cross join tile t
    where c.coordinates is not null
      and c.coordinates::geometry && t.geom
      and st_intersects(c.coordinates::geometry, t.geom)
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

grant execute on function public.log_building_event(uuid, text, text, text, jsonb)
  to service_role;

grant execute on function public.complexes_mvt_tile(
  integer,
  integer,
  integer,
  text,
  boolean,
  boolean,
  double precision
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
