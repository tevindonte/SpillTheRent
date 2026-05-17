-- Review votes and comments

create table if not exists public.review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  anonymous_token text,
  vote text not null
    constraint review_votes_vote_check
    check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  constraint review_votes_user_or_token
    check (user_id is not null or anonymous_token is not null)
);

create unique index if not exists review_votes_review_user_idx
  on public.review_votes (review_id, user_id)
  where user_id is not null;

create unique index if not exists review_votes_review_token_idx
  on public.review_votes (review_id, anonymous_token)
  where anonymous_token is not null;

create index if not exists review_votes_review_id_idx on public.review_votes (review_id);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  parent_id uuid references public.review_comments (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  is_anonymous boolean not null default true,
  content text not null,
  created_at timestamptz not null default now(),
  constraint review_comments_content_min_length
    check (char_length(trim(content)) >= 10)
);

create index if not exists review_comments_review_id_idx on public.review_comments (review_id);
create index if not exists review_comments_parent_id_idx on public.review_comments (parent_id);

alter table public.review_votes enable row level security;
alter table public.review_comments enable row level security;

create policy "review_votes_select_public"
  on public.review_votes for select
  to anon, authenticated
  using (true);

create policy "review_votes_insert_public"
  on public.review_votes for insert
  to anon, authenticated
  with check (true);

create policy "review_votes_delete_own"
  on public.review_votes for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "review_comments_select_public"
  on public.review_comments for select
  to anon, authenticated
  using (true);

create policy "review_comments_insert_public"
  on public.review_comments for insert
  to anon, authenticated
  with check (true);

create policy "review_comments_delete_own"
  on public.review_comments for delete
  to authenticated
  using (auth.uid() = user_id);
