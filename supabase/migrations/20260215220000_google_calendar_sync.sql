alter table public.profiles
  add column if not exists google_calendar_link text,
  add column if not exists google_calendar_id text,
  add column if not exists google_connected boolean not null default false;

create table if not exists public.google_oauth_tokens (
  consultor_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expiry_date timestamptz null,
  scope text null,
  updated_at timestamptz default now()
);

create trigger google_oauth_tokens_set_updated_at
before update on public.google_oauth_tokens
for each row execute procedure public.handle_updated_at();

alter table public.google_oauth_tokens enable row level security;

drop policy if exists "google_oauth_tokens_block_all" on public.google_oauth_tokens;
create policy "google_oauth_tokens_block_all"
  on public.google_oauth_tokens
  for all
  using (false)
  with check (false);

create table if not exists public.calendar_sync_state (
  consultor_id uuid primary key references auth.users(id) on delete cascade,
  google_calendar_id text null,
  sync_token text null,
  channel_id text null,
  resource_id text null,
  channel_expiration timestamptz null,
  updated_at timestamptz default now()
);

create trigger calendar_sync_state_set_updated_at
before update on public.calendar_sync_state
for each row execute procedure public.handle_updated_at();

alter table public.calendar_sync_state enable row level security;

drop policy if exists "calendar_sync_state_block_all" on public.calendar_sync_state;
create policy "calendar_sync_state_block_all"
  on public.calendar_sync_state
  for all
  using (false)
  with check (false);

create table if not exists public.schedule_external_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  consultant_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  summary text null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  google_event_id text not null,
  google_updated timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_at > start_at)
);

create unique index if not exists schedule_external_blocks_google_event_key
  on public.schedule_external_blocks(google_event_id);

create index if not exists schedule_external_blocks_consultant_start_idx
  on public.schedule_external_blocks(consultant_id, start_at);

create trigger schedule_external_blocks_set_updated_at
before update on public.schedule_external_blocks
for each row execute procedure public.handle_updated_at();

alter table public.schedule_external_blocks enable row level security;

drop policy if exists "schedule_external_blocks_admin_select" on public.schedule_external_blocks;
create policy "schedule_external_blocks_admin_select"
  on public.schedule_external_blocks
  for select
  to authenticated
  using (public.is_system_admin());

alter table public.schedule_events
  add column if not exists google_event_id text,
  add column if not exists google_etag text,
  add column if not exists google_calendar_id text,
  add column if not exists external_origin text;

create index if not exists schedule_events_google_event_idx
  on public.schedule_events(google_event_id);
