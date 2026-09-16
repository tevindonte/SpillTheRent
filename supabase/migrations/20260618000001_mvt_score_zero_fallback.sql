-- Always emit score (0 when unscored) so clients can fall through to hpd_score_num.
-- Idempotent recreate of complexes_mvt_tile (same signature / return type).

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
      -- Always present: 0 means "use HPD / bedbug fallback" on the client.
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

grant execute on function public.complexes_mvt_tile(
  integer, integer, integer, text, boolean, boolean, double precision
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
