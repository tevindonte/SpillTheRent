-- Activity feed, watchlist alert dispatch, micro-ratings.

-- ---------------------------------------------------------------------------
-- Building activity events (feed + alert source)
-- ---------------------------------------------------------------------------
create table if not exists public.building_events (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  event_type text not null
    constraint building_events_type_check
    check (
      event_type in (
        'review',
        'rent_report',
        'hpd_change',
        'micro_rating'
      )
    ),
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists building_events_created_at_idx
  on public.building_events (created_at desc);

create index if not exists building_events_complex_id_idx
  on public.building_events (complex_id, created_at desc);

alter table public.building_events enable row level security;

create policy building_events_public_read on public.building_events
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Watchlist alert dedupe
-- ---------------------------------------------------------------------------
create table if not exists public.watchlist_alert_sent (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.building_events (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.watchlist_alert_sent enable row level security;

-- ---------------------------------------------------------------------------
-- Quick micro-ratings (cold-start UGC)
-- ---------------------------------------------------------------------------
create table if not exists public.building_micro_ratings (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  pests smallint check (pests between 1 and 5),
  management smallint check (management between 1 and 5),
  heat_hot_water smallint check (heat_hot_water between 1 and 5),
  noise smallint check (noise between 1 and 5),
  created_at timestamptz not null default now(),
  constraint building_micro_ratings_one_per_user
    unique (complex_id, user_id)
);

create index if not exists building_micro_ratings_complex_id_idx
  on public.building_micro_ratings (complex_id);

alter table public.building_micro_ratings enable row level security;

create policy building_micro_ratings_public_read on public.building_micro_ratings
  for select to anon, authenticated
  using (true);

create policy building_micro_ratings_insert_auth on public.building_micro_ratings
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy building_micro_ratings_update_own on public.building_micro_ratings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Event logging helpers
-- ---------------------------------------------------------------------------
create or replace function public.log_building_event(
  p_complex_id uuid,
  p_event_type text,
  p_title text,
  p_summary text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.building_events (complex_id, event_type, title, summary, payload)
  values (p_complex_id, p_event_type, p_title, p_summary, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.trg_reviews_building_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select c.name into v_name from public.complexes c where c.id = new.complex_id;
  perform public.log_building_event(
    new.complex_id,
    'review',
    coalesce(v_name, 'Building') || ': new tenant review',
    case
      when new.rating is not null then 'Rating ' || new.rating::text || '/5'
      else 'New review submitted'
    end,
    jsonb_build_object('review_id', new.id, 'source', new.source, 'rating', new.rating)
  );
  perform public.recalculate_complex_cache(new.complex_id);
  return new;
end;
$$;

drop trigger if exists reviews_building_event on public.reviews;
create trigger reviews_building_event
  after insert on public.reviews
  for each row
  execute function public.trg_reviews_building_event();

create or replace function public.trg_pricing_history_building_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select c.name into v_name from public.complexes c where c.id = new.complex_id;
  perform public.log_building_event(
    new.complex_id,
    'rent_report',
    coalesce(v_name, 'Building') || ': rent reported',
    case
      when new.rent is not null then '$' || new.rent::text || '/mo reported'
      else 'New rent data'
    end,
    jsonb_build_object('rent', new.rent, 'bedrooms', new.bedrooms)
  );
  perform public.recalculate_complex_cache(new.complex_id);
  return new;
end;
$$;

drop trigger if exists pricing_history_building_event on public.pricing_history;
create trigger pricing_history_building_event
  after insert on public.pricing_history
  for each row
  execute function public.trg_pricing_history_building_event();

create or replace function public.trg_complex_hpd_building_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.hpd_open_violations is not distinct from new.hpd_open_violations then
    return new;
  end if;
  perform public.log_building_event(
    new.id,
    'hpd_change',
    new.name || ': HPD violations updated',
    coalesce(new.hpd_open_violations, 0)::text || ' open (was '
      || coalesce(old.hpd_open_violations, 0)::text || ')',
    jsonb_build_object(
      'old', old.hpd_open_violations,
      'new', new.hpd_open_violations,
      'score', new.hpd_violation_score
    )
  );
  return new;
end;
$$;

drop trigger if exists complexes_hpd_building_event on public.complexes;
create trigger complexes_hpd_building_event
  after update of hpd_open_violations on public.complexes
  for each row
  execute function public.trg_complex_hpd_building_event();

create or replace function public.trg_micro_rating_building_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select c.name into v_name from public.complexes c where c.id = new.complex_id;
  perform public.log_building_event(
    new.complex_id,
    'micro_rating',
    coalesce(v_name, 'Building') || ': quick ratings',
    'Pests, management, heat, and noise scored',
    jsonb_build_object('micro_rating_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists building_micro_ratings_event on public.building_micro_ratings;
create trigger building_micro_ratings_event
  after insert on public.building_micro_ratings
  for each row
  execute function public.trg_micro_rating_building_event();

grant select on public.building_events to anon, authenticated;
grant select on public.building_micro_ratings to anon, authenticated;
