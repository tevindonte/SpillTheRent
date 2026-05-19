-- Watchlist, data freshness, cached rent from reviews, map view cache columns.

-- ---------------------------------------------------------------------------
-- Saved buildings (watchlist)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_buildings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  complex_id uuid not null references public.complexes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, complex_id)
);

create index if not exists saved_buildings_complex_id_idx
  on public.saved_buildings (complex_id);

alter table public.saved_buildings enable row level security;

create policy saved_buildings_select_own on public.saved_buildings
  for select to authenticated
  using (auth.uid() = user_id);

create policy saved_buildings_insert_own on public.saved_buildings
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy saved_buildings_delete_own on public.saved_buildings
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Data source freshness (shown in UI)
-- ---------------------------------------------------------------------------
create table if not exists public.data_source_freshness (
  source_key text primary key,
  label text not null,
  last_updated_at timestamptz not null default now()
);

insert into public.data_source_freshness (source_key, label, last_updated_at)
values
  ('hpd', 'HPD violations', now()),
  ('bedbugs', 'Bedbug registry', now()),
  ('oath', 'OATH / illegal hotel', now()),
  ('hp_actions', 'HP actions', now()),
  ('dob', 'DOB permits', now()),
  ('reviews', 'Tenant reviews', now())
on conflict (source_key) do nothing;

alter table public.data_source_freshness enable row level security;

create policy data_source_freshness_public_read on public.data_source_freshness
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Prerequisites (safe if earlier migrations were skipped on production)
-- ---------------------------------------------------------------------------
alter table public.complexes
  add column if not exists cached_median_rent numeric,
  add column if not exists cached_review_count integer not null default 0,
  add column if not exists cached_community_score numeric,
  add column if not exists cached_signal_count integer not null default 0,
  add column if not exists verified boolean not null default true;

comment on column public.complexes.verified is
  'false = user-submitted, pending verification; true = PLUTO or confirmed';

-- ---------------------------------------------------------------------------
-- Median rent: pricing_history + reviews.rent_amount
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

-- Map view: expose cached columns (faster than subqueries per row)
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
  c.is_rent_stabilized,
  c.stabilized_units,
  c.landlord_id,
  c.verified
from public.complexes c
where c.coordinates is not null;

grant select on public.complexes_map_summary to anon, authenticated;
