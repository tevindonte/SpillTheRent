-- First-party anonymous visitor tracking (no third-party analytics).

create table if not exists public.site_visitors (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visit_days integer not null default 1,
  last_path text,
  constraint site_visitors_visit_days_check check (visit_days >= 1)
);

create index if not exists site_visitors_last_seen_at_idx
  on public.site_visitors (last_seen_at desc);

create index if not exists site_visitors_first_seen_at_idx
  on public.site_visitors (first_seen_at desc);

alter table public.site_visitors enable row level security;
-- No public policies: only service-role API routes may read/write.

comment on table public.site_visitors is
  'Anonymous first-party visitor ids (localStorage UUID). No PII, no third-party trackers.';

notify pgrst, 'reload schema';
