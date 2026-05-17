-- Expose lat/lng for the map client (avoids geography serialization quirks).
create or replace view public.complexes_map
with (security_invoker = true)
as
select
  id,
  name,
  address,
  borough,
  zip,
  units,
  building_class,
  google_rating,
  google_review_count,
  st_y(coordinates::geometry) as lat,
  st_x(coordinates::geometry) as lng
from public.complexes
where coordinates is not null;

grant select on public.complexes_map to anon, authenticated;
