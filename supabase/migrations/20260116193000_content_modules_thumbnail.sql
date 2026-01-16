alter table public.content_modules
  add column if not exists thumbnail_url text;
