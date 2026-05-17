-- User submissions: verified flag, review anonymity, expanded red flags, enrichment queue.

alter table public.complexes
  add column if not exists verified boolean not null default true;

comment on column public.complexes.verified is
  'false = user-submitted, pending verification; true = PLUTO or confirmed';

alter table public.reviews
  add column if not exists is_anonymous boolean not null default true;

alter table public.reviews drop constraint if exists reviews_red_flags_check;

alter table public.reviews
  add constraint reviews_red_flags_check
  check (
    red_flags <@ array[
      'mold', 'roaches', 'maintenance', 'deposit', 'noise', 'safety',
      'flooding', 'heat_ac'
    ]::text[]
  );

create table if not exists public.enrichment_queue (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  status text not null default 'pending'
    constraint enrichment_queue_status_check
    check (status in ('pending', 'processing', 'done', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists enrichment_queue_status_idx
  on public.enrichment_queue (status);

create unique index if not exists enrichment_queue_complex_id_idx
  on public.enrichment_queue (complex_id);

alter table public.enrichment_queue enable row level security;

-- Existing PLUTO rows stay verified (default true on add column).
