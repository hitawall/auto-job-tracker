create table public.preferences (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  job_titles       text[]    not null default '{}',
  locations        text[]    not null default '{}',
  remote_modes     text[]    not null default '{}',
  min_salary_usd   int,
  keywords_must    text[]    not null default '{}',
  keywords_block   text[]    not null default '{}',
  seniority        text[]    not null default '{}',
  updated_at       timestamptz not null default now()
);

alter table public.preferences enable row level security;
create policy "preferences: select own" on public.preferences
  for select using (auth.uid() = user_id);
create policy "preferences: insert own" on public.preferences
  for insert with check (auth.uid() = user_id);
create policy "preferences: update own" on public.preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- idempotency guard for alert delivery
create table public.alerts_sent (
  user_id  uuid not null references auth.users(id) on delete cascade,
  job_id   uuid not null references public.jobs(id) on delete cascade,
  channel  text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, job_id, channel)
);

alter table public.alerts_sent enable row level security;
create policy "alerts_sent: select own" on public.alerts_sent
  for select using (auth.uid() = user_id);
