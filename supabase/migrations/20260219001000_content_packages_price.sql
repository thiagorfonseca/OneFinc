alter table public.content_packages
  add column if not exists price_cents integer;
