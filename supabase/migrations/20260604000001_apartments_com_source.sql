-- Allow Apartments.com pipeline imports.

alter table public.complexes
  add column if not exists source text;

comment on column public.complexes.source is
  'Origin of the row (e.g. pluto, apartments_com, user submission).';

alter table public.reviews drop constraint if exists reviews_source_check;

alter table public.reviews
  add constraint reviews_source_check
  check (source in ('google', 'reddit', 'user', 'apartments_com'));
