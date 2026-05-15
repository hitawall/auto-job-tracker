create type job_source as enum (
  'greenhouse', 'lever', 'ashby', 'workable', 'remoteok', 'hn', 'linkedin', 'portal'
);

create type remote_mode as enum ('remote', 'hybrid', 'onsite', 'unknown');

create type job_status as enum (
  'new', 'seen', 'dismissed', 'saved', 'applied', 'interviewing', 'offer', 'rejected'
);

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  source        job_source not null,
  source_job_id text not null,
  title         text not null,
  company       text not null,
  location      text,
  remote        remote_mode not null default 'unknown',
  posted_at     timestamptz,
  url           text not null,
  description_md text,
  raw_payload   jsonb not null default '{}',
  fetched_at    timestamptz not null default now(),
  unique (source, source_job_id)
);

-- authenticated users can read all jobs; only service role can insert/update
alter table public.jobs enable row level security;
create policy "jobs: read all authenticated" on public.jobs
  for select using (auth.role() = 'authenticated');

create index jobs_posted_at_idx on public.jobs (posted_at desc);
create index jobs_source_idx     on public.jobs (source);

-- per-user match decisions
create table public.job_matches (
  user_id    uuid not null references auth.users(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  matched_at timestamptz not null default now(),
  score      numeric,
  reason     jsonb,
  status     job_status not null default 'new',
  applied_at timestamptz,
  notes      text,
  primary key (user_id, job_id)
);

alter table public.job_matches enable row level security;
create policy "job_matches: select own" on public.job_matches
  for select using (auth.uid() = user_id);
create policy "job_matches: insert own" on public.job_matches
  for insert with check (auth.uid() = user_id);
create policy "job_matches: update own" on public.job_matches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index job_matches_user_status_idx on public.job_matches (user_id, status);
