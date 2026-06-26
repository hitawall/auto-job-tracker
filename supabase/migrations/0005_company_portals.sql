create table public.company_portals (
  id           uuid        primary key default gen_random_uuid(),
  company_name text        not null,
  career_url   text        not null,
  ats_type     text,
  ats_slug     text,
  is_active    boolean     not null default true,
  added_by     uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.company_portals enable row level security;

create policy "portals: read all authenticated"
  on public.company_portals for select
  using (auth.role() = 'authenticated');

create policy "portals: insert own"
  on public.company_portals for insert
  with check (auth.uid() = added_by);

create policy "portals: update own"
  on public.company_portals for update
  using (auth.uid() = added_by)
  with check (auth.uid() = added_by);

create policy "portals: delete own"
  on public.company_portals for delete
  using (auth.uid() = added_by);
