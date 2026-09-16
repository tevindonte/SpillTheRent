-- MVT + map summary: HPD score / bedbug fallbacks for unscored buildings.

create extension if not exists postgis with schema extensions;

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
      coalesce(c.cached_community_score, c.google_rating)::float as score,
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

-- Expose has_bedbug_history on map summary for marker coloring.
drop view if exists public.complexes_map_summary;

create view public.complexes_map_summary
with (security_invoker = true)
as
select
  c.id,
  c.name,
  c.address,
  c.borough,
  c.neighborhood,
  c.zip,
  c.units,
  c.google_rating,
  c.google_review_count,
  c.street_view_url,
  st_y(c.coordinates::geometry) as lat,
  st_x(c.coordinates::geometry) as lng,
  coalesce(
    c.cached_median_rent::integer,
    (
      select percentile_cont(0.5) within group (order by ph.rent)::integer
      from public.pricing_history ph
      where ph.complex_id = c.id and ph.rent is not null
    )
  ) as median_rent,
  coalesce(c.cached_review_count, (
    select count(*)::integer from public.reviews r where r.complex_id = c.id
  )) as review_count,
  c.cached_median_rent,
  c.cached_review_count,
  c.cached_community_score,
  c.cached_signal_count,
  c.hpd_open_violations,
  c.hpd_violation_score,
  c.has_bedbug_history,
  c.is_rent_stabilized,
  c.stabilized_units,
  c.landlord_id,
  c.verified
from public.complexes c
where c.coordinates is not null;

grant select on public.complexes_map_summary to anon, authenticated;

-- Bounds RPC: include HPD score + bedbug for GeoJSON / bounds clients.
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

create function public.complexes_in_bounds(
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
