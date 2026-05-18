-- Denormalized map cache columns + recalculation triggers

alter table public.complexes
  add column if not exists cached_median_rent numeric,
  add column if not exists cached_review_count integer not null default 0,
  add column if not exists cached_community_score numeric,
  add column if not exists cached_signal_count integer not null default 0;

create or replace function public.recalculate_complex_cache(p_complex_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base numeric;
  v_score numeric;
  v_google double precision;
  v_avg_user numeric;
  v_hpd_score text;
  v_has_bedbug boolean;
  v_hp_count integer;
  v_oath_count integer;
  v_has_construction boolean;
begin
  select
    c.google_rating,
    c.hpd_violation_score,
    c.has_bedbug_history,
    c.hp_action_count,
    c.oath_violation_count,
    c.has_active_construction
  into
    v_google,
    v_hpd_score,
    v_has_bedbug,
    v_hp_count,
    v_oath_count,
    v_has_construction
  from public.complexes c
  where c.id = p_complex_id;

  if not found then
    return;
  end if;

  select avg(r.rating)::numeric
  into v_avg_user
  from public.reviews r
  where r.complex_id = p_complex_id
    and r.source = 'user'
    and r.rating is not null;

  if v_avg_user is not null then
    v_base := v_avg_user;
  elsif v_google is not null then
    v_base := v_google::numeric;
  else
    v_base := null;
  end if;

  v_score := v_base;

  if v_score is not null then
    if v_hpd_score = 'Severe' then
      v_score := v_score - 1.0;
    elsif v_hpd_score = 'Moderate' then
      v_score := v_score - 0.5;
    end if;

    if v_has_bedbug then
      v_score := v_score - 0.5;
    end if;

    if coalesce(v_hp_count, 0) >= 3 then
      v_score := v_score - 0.75;
    elsif coalesce(v_hp_count, 0) >= 1 then
      v_score := v_score - 0.25;
    end if;

    if coalesce(v_oath_count, 0) > 0 then
      v_score := v_score - 0.25;
    end if;

    if v_has_construction then
      v_score := v_score - 0.1;
    end if;

    v_score := greatest(1.0, least(5.0, v_score));
  end if;

  update public.complexes c
  set
    cached_median_rent = (
      select percentile_cont(0.5) within group (order by ph.rent)
      from public.pricing_history ph
      where ph.complex_id = p_complex_id
        and ph.rent is not null
    ),
    cached_review_count = (
      select count(*)::integer
      from public.reviews r
      where r.complex_id = p_complex_id
    ),
    cached_community_score = v_score,
    cached_signal_count = (
      coalesce(c.hpd_open_violations, 0)
      + case when c.has_bedbug_history then 1 else 0 end
      + case when c.has_active_construction then 1 else 0 end
      + coalesce(c.hp_action_count, 0)
      + coalesce(c.oath_violation_count, 0)
    )
  where c.id = p_complex_id;
end;
$$;

create or replace function public.backfill_complex_cache()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from public.complexes loop
    perform public.recalculate_complex_cache(r.id);
  end loop;
end;
$$;

create or replace function public.trigger_recalculate_complex_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complex_id uuid;
begin
  v_complex_id := coalesce(new.complex_id, old.complex_id);
  if v_complex_id is not null then
    perform public.recalculate_complex_cache(v_complex_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_recalculate_cache on public.reviews;
create trigger reviews_recalculate_cache
  after insert or update on public.reviews
  for each row
  execute function public.trigger_recalculate_complex_cache();

drop trigger if exists pricing_history_recalculate_cache on public.pricing_history;
create trigger pricing_history_recalculate_cache
  after insert or update on public.pricing_history
  for each row
  execute function public.trigger_recalculate_complex_cache();

-- Extend bounds RPC with cached columns (must DROP — CREATE OR REPLACE cannot change OUT columns)
drop function if exists public.complexes_in_bounds(
  double precision,
  double precision,
  double precision,
  double precision,
  text,
  boolean,
  boolean,
  double precision
);

-- Drop any overload/signature variant of complexes_in_bounds
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

grant execute on function public.complexes_in_bounds to anon, authenticated;
grant execute on function public.recalculate_complex_cache(uuid) to service_role;
grant execute on function public.backfill_complex_cache() to service_role;
