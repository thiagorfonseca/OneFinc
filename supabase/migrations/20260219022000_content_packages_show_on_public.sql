alter table if exists public.content_packages
add column if not exists show_on_public boolean;

update public.content_packages
set show_on_public = true
where show_on_public is null;

alter table public.content_packages
alter column show_on_public set default false;

alter table public.content_packages
alter column show_on_public set not null;
