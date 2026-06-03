-- DHCR upload queue + review flags

-- ---------------------------------------------------------------------------
-- DHCR rent history uploads (Phase A: store PDF, manual/OCR later)
-- ---------------------------------------------------------------------------
create table if not exists public.dhcr_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  complex_id uuid references public.complexes (id) on delete set null,
  storage_path text not null,
  file_name text,
  status text not null default 'pending'
    constraint dhcr_submissions_status_check
    check (status in ('pending', 'processing', 'parsed', 'failed')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dhcr_submissions_user_id_idx
  on public.dhcr_submissions (user_id, created_at desc);

alter table public.dhcr_submissions enable row level security;

create policy dhcr_submissions_select_own on public.dhcr_submissions
  for select to authenticated
  using (auth.uid() = user_id);

create policy dhcr_submissions_insert_own on public.dhcr_submissions
  for insert to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Review flags (moderation queue lite)
-- ---------------------------------------------------------------------------
create table if not exists public.review_flags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_user_id uuid references public.profiles (id) on delete set null,
  reason text not null
    constraint review_flags_reason_check
    check (reason in ('spam', 'fake', 'harassment', 'off_topic', 'other')),
  details text,
  created_at timestamptz not null default now()
);

create unique index if not exists review_flags_one_per_user
  on public.review_flags (review_id, reporter_user_id)
  where reporter_user_id is not null;

alter table public.review_flags enable row level security;

create policy review_flags_insert_auth on public.review_flags
  for insert to authenticated
  with check (auth.uid() = reporter_user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for DHCR PDFs (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dhcr-uploads',
  'dhcr-uploads',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

create policy dhcr_uploads_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dhcr-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy dhcr_uploads_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dhcr-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
