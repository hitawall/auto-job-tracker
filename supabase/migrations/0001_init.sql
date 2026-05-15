-- =============================================================================
-- 0001_init.sql  --  profiles table, RLS, and auto-create trigger
-- =============================================================================

-- Profiles extend auth.users with app-specific fields.
-- The trigger below auto-inserts a row on every new signup.
create table public.profiles (
  user_id          uuid        primary key references auth.users(id) on delete cascade,
  full_name        text,
  whatsapp_e164    text,         -- E.164 format: +14155552671
  telegram_chat_id text,
  timezone         text        not null default 'UTC',
  alert_quiet_hours jsonb      not null default '{"start":"22:00","end":"08:00"}',
  created_at       timestamptz not null default now()
);

-- Row-Level Security: each user can only touch their own profile row.
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Automatically create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
