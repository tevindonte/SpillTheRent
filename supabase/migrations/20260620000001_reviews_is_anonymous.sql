-- Ensure reviews.is_anonymous exists (idempotent; already added in earlier migrations).
alter table public.reviews
  add column if not exists is_anonymous boolean default true;

-- Align nullability/default with prior migrations when column already existed as nullable.
alter table public.reviews
  alter column is_anonymous set default true;

update public.reviews
set is_anonymous = true
where is_anonymous is null;

alter table public.reviews
  alter column is_anonymous set not null;
