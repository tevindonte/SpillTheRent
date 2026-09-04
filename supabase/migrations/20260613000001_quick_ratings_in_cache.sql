-- Quick ratings: aggregate view, fold into community score, refresh cache on write.

create or replace view public.complex_quick_rating_stats
with (security_invoker = true)
as
select
  m.complex_id,
  avg(m.pests)::numeric as avg_pests,
  avg(m.management)::numeric as avg_management,
  avg(m.heat_hot_water)::numeric as avg_heat,
  avg(m.noise)::numeric as avg_noise,
  count(*)::integer as quick_rating_count,
  avg(
    (
      coalesce(m.pests::numeric, 0)
      + coalesce(m.management::numeric, 0)
      + coalesce(m.heat_hot_water::numeric, 0)
      + coalesce(m.noise::numeric, 0)
    ) / nullif(
      (m.pests is not null)::integer
      + (m.management is not null)::integer
      + (m.heat_hot_water is not null)::integer
      + (m.noise is not null)::integer,
      0
    )
  )::numeric as avg_overall
from public.building_micro_ratings m
group by m.complex_id;

grant select on public.complex_quick_rating_stats to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Community score: blend written reviews + quick ratings (min 3 submissions)
-- ---------------------------------------------------------------------------
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
  v_quick_avg numeric;
  v_quick_count integer;
  v_hpd_score text;
  v_has_bedbug boolean;
  v_hp_count integer;
  v_oath_count integer;
  v_has_construction boolean;
  v_median_rent numeric;
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

  select s.avg_overall, s.quick_rating_count
  into v_quick_avg, v_quick_count
  from public.complex_quick_rating_stats s
  where s.complex_id = p_complex_id;

  v_quick_count := coalesce(v_quick_count, 0);

  if v_avg_user is not null and v_quick_count >= 3 and v_quick_avg is not null then
    v_base := (v_avg_user * 0.6) + (v_quick_avg * 0.4);
  elsif v_avg_user is not null then
    v_base := v_avg_user;
  elsif v_quick_count >= 3 and v_quick_avg is not null then
    v_base := v_quick_avg;
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

  select percentile_cont(0.5) within group (order by rent_val)
  into v_median_rent
  from (
    select ph.rent::numeric as rent_val
    from public.pricing_history ph
    where ph.complex_id = p_complex_id and ph.rent is not null
    union all
    select r.rent_amount::numeric as rent_val
    from public.reviews r
    where r.complex_id = p_complex_id and r.rent_amount is not null
  ) rents;

  update public.complexes c
  set
    cached_median_rent = v_median_rent,
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

grant execute on function public.recalculate_complex_cache(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Refresh cache whenever quick ratings are inserted or updated
-- ---------------------------------------------------------------------------
create or replace function public.trg_micro_rating_recalculate_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_complex_cache(new.complex_id);
  return new;
end;
$$;

drop trigger if exists building_micro_ratings_cache on public.building_micro_ratings;
create trigger building_micro_ratings_cache
  after insert or update on public.building_micro_ratings
  for each row
  execute function public.trg_micro_rating_recalculate_cache();
