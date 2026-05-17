-- Street View Static API image URL (or sentinel "NONE" when unavailable).
alter table public.complexes
  add column if not exists street_view_url text;

comment on column public.complexes.street_view_url is
  'Keyless Street View URL (?size=800x500&location=lat,lng), or "NONE" if unavailable';

create index if not exists complexes_street_view_pending_idx
  on public.complexes (id)
  where street_view_url is null and coordinates is not null;
