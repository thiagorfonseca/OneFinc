alter table public.schedule_external_blocks
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists meeting_url text,
  add column if not exists attendees jsonb,
  add column if not exists html_link text;
