-- SpillTheRent core schema: complexes, reviews, units, pricing_history
-- Requires: 20240516000000_enable_postgis.sql

-- ---------------------------------------------------------------------------
-- complexes
-- ---------------------------------------------------------------------------
create table public.complexes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  borough text,
  zip text,
  units integer,
  building_class text,
  portal_type text not null default 'unknown'
    constraint complexes_portal_type_check
    check (portal_type in ('entrata', 'yardi', 'rentcafe', 'realpage', 'unknown')),
  portal_url text,
  google_place_id text,
  google_rating double precision,
  google_review_count integer,
  coordinates geography(point, 4326),
  created_at timestamptz not null default now()
);

create index complexes_coordinates_idx
  on public.complexes using gist (coordinates);

create index complexes_borough_idx on public.complexes (borough);
create index complexes_zip_idx on public.complexes (zip);
create unique index complexes_google_place_id_idx
  on public.complexes (google_place_id)
  where google_place_id is not null;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  source text not null
    constraint reviews_source_check
    check (source in ('google', 'reddit', 'user')),
  rating double precision,
  review_text text,
  review_date timestamptz,
  red_flags text[] not null default '{}'
    constraint reviews_red_flags_check
    check (
      red_flags <@ array[
        'mold', 'roaches', 'maintenance', 'deposit', 'noise', 'safety'
      ]::text[]
    ),
  sentiment_score double precision,
  created_at timestamptz not null default now()
);

create index reviews_complex_id_idx on public.reviews (complex_id);
create index reviews_source_idx on public.reviews (source);
create index reviews_review_date_idx on public.reviews (review_date desc);

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------
create table public.units (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  bedrooms integer,
  bathrooms double precision,
  rent integer,
  available_date date,
  amenities text[] not null default '{}',
  scraped_at timestamptz
);

create index units_complex_id_idx on public.units (complex_id);
create index units_bedrooms_rent_idx on public.units (bedrooms, rent);

-- ---------------------------------------------------------------------------
-- pricing_history
-- ---------------------------------------------------------------------------
create table public.pricing_history (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  rent integer,
  bedrooms integer,
  recorded_at timestamptz not null default now()
);

create index pricing_history_complex_id_idx on public.pricing_history (complex_id);
create index pricing_history_recorded_at_idx on public.pricing_history (recorded_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.complexes enable row level security;
alter table public.reviews enable row level security;
alter table public.units enable row level security;
alter table public.pricing_history enable row level security;

-- No policies yet: anon/authenticated clients cannot read or write until you add
-- policies (or use the service role key in trusted server/pipeline code only).
