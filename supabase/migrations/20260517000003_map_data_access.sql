-- Public read for map UI aggregates and detail panel.
create policy "reviews_select_public"
  on public.reviews for select to anon, authenticated using (true);

create policy "pricing_history_select_public"
  on public.pricing_history for select to anon, authenticated using (true);

create or replace view public.complexes_map_summary
with (security_invoker = true)
as
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
  (
    select percentile_cont(0.5) within group (order by ph.rent)::integer
    from public.pricing_history ph
    where ph.complex_id = c.id and ph.rent is not null
  ) as median_rent,
  (
    select count(*)::integer
    from public.reviews r
    where r.complex_id = c.id
  ) as review_count
from public.complexes c
where c.coordinates is not null;

grant select on public.complexes_map_summary to anon, authenticated;
