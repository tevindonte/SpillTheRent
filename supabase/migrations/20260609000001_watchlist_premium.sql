-- Lease Shield: premium watchlist (email alerts, higher save limit)

alter table public.profiles
  add column if not exists watchlist_premium_until timestamptz;

comment on column public.profiles.watchlist_premium_until is
  'When set and in the future, user has premium watchlist (unlimited saves + alert emails).';
