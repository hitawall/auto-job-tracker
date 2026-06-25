-- Extend job_source enum for JobSpy sites
alter type job_source add value if not exists 'indeed';
alter type job_source add value if not exists 'glassdoor';
alter type job_source add value if not exists 'zip_recruiter';
alter type job_source add value if not exists 'google';

-- User preferences (1 row per user, matches @repo/types Preference schema)
create table public.preferences (
  user_id            uuid        primary key references auth.users(id) on delete cascade,
  job_titles         text[]      not null default '{}',
  locations          text[]      not null default '{}',
  remote_modes       text[]      not null default '{}',
  min_salary_usd     int,
  keywords_must      text[]      not null default '{}',
  keywords_block     text[]      not null default '{}',
  seniority          text[]      not null default '{}',
  alert_email        boolean     not null default true,
  last_alert_sent_at timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.preferences enable row level security;

create policy "preferences: select own"
  on public.preferences for select
  using (auth.uid() = user_id);

create policy "preferences: insert own"
  on public.preferences for insert
  with check (auth.uid() = user_id);

create policy "preferences: update own"
  on public.preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
