-- Multi-borough support: Brooklyn + Queens (LIC). borough is free-text (no Manhattan-only constraint).

alter table public.complexes
  add column if not exists neighborhood text;

create index if not exists complexes_neighborhood_idx
  on public.complexes (neighborhood);

comment on column public.complexes.borough is
  'Display borough label, e.g. Manhattan, Brooklyn, Queens';

comment on column public.complexes.neighborhood is
  'PLUTO neighborhood name; used to filter Long Island City within Queens';

-- CREATE OR REPLACE cannot insert columns mid-list; drop and recreate.
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
