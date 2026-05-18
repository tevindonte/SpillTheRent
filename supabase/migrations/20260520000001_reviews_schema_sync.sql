-- Idempotent sync for production DBs that skipped earlier migrations.
-- Run in Supabase SQL editor if reviews API errors on missing columns.

alter table public.reviews
  add column if not exists is_anonymous boolean not null default true;

alter table public.reviews
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

alter table public.reviews
  add column if not exists rent_amount integer;

alter table public.reviews
  add column if not exists bedrooms text;

alter table public.reviews
  add column if not exists red_flag_other text;
