-- User system: profiles, rental history, name suggestions, review/pricing links

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  handle_changed boolean not null default false,
  email text,
  member_since timestamptz not null default now(),
  is_public boolean not null default true
);

create index if not exists profiles_handle_idx on public.profiles (handle);

-- ---------------------------------------------------------------------------
-- rental_history
-- ---------------------------------------------------------------------------
create table if not exists public.rental_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  complex_id uuid not null references public.complexes (id) on delete cascade,
  move_in_year integer not null,
  move_out_year integer,
  monthly_rent integer,
  bedrooms text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists rental_history_user_id_idx on public.rental_history (user_id);
create index if not exists rental_history_complex_id_idx on public.rental_history (complex_id);

-- ---------------------------------------------------------------------------
-- name_change_requests
-- ---------------------------------------------------------------------------
create table if not exists public.name_change_requests (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  suggested_name text not null,
  status text not null default 'pending'
    constraint name_change_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists name_change_requests_complex_id_idx
  on public.name_change_requests (complex_id);

-- ---------------------------------------------------------------------------
-- reviews & pricing_history extensions
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

alter table public.reviews
  add column if not exists rent_amount integer;

alter table public.reviews
  add column if not exists bedrooms text;

alter table public.reviews
  add column if not exists red_flag_other text;

alter table public.reviews drop constraint if exists reviews_red_flags_check;

alter table public.reviews
  add constraint reviews_red_flags_check
  check (
    red_flags <@ array[
      'mold', 'roaches', 'maintenance', 'deposit', 'noise', 'safety',
      'flooding', 'heat_ac', 'other'
    ]::text[]
  );

alter table public.pricing_history
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

alter table public.pricing_history
  add column if not exists is_anonymous boolean not null default true;

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.generate_anon_handle()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := 'anon-' || lower(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.profiles where handle = candidate);
    attempts := attempts + 1;
    if attempts > 20 then
      candidate := 'anon-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, email, member_since)
  values (
    new.id,
    public.generate_anon_handle(),
    new.email,
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rental_history enable row level security;
alter table public.name_change_requests enable row level security;

create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (is_public = true or auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "rental_history_select_public"
  on public.rental_history for select
  to anon, authenticated
  using (is_public = true or auth.uid() = user_id);

create policy "rental_history_insert_own"
  on public.rental_history for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "rental_history_update_own"
  on public.rental_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "rental_history_delete_own"
  on public.rental_history for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "name_change_requests_insert_auth"
  on public.name_change_requests for insert
  to authenticated, anon
  with check (true);

create policy "name_change_requests_select_auth"
  on public.name_change_requests for select
  to authenticated
  using (auth.uid() = user_id or true);

-- Allow authenticated users to insert reviews/pricing with their user_id via API (service role still used for anon)
create policy "reviews_insert_auth"
  on public.reviews for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "pricing_history_insert_auth"
  on public.pricing_history for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());
