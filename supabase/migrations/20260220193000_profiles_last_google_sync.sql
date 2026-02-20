alter table public.profiles
  add column if not exists last_google_sync_at timestamptz;
