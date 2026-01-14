create table if not exists public.content_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  pages text[] default '{}'::text[],
  created_at timestamptz default now()
);

create table if not exists public.content_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.content_packages(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.clinic_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  package_id uuid not null references public.content_packages(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists content_package_items_unique
on public.content_package_items (package_id, content_id);

create unique index if not exists clinic_packages_unique
on public.clinic_packages (clinic_id, package_id);

alter table public.content_packages enable row level security;
alter table public.content_package_items enable row level security;
alter table public.clinic_packages enable row level security;

create policy "content_packages_select"
on public.content_packages
for select
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
  or exists (
    select 1
    from public.clinic_packages cp
    where cp.package_id = content_packages.id
      and cp.clinic_id = public.current_clinic_id()
  )
);

create policy "content_packages_manage"
on public.content_packages
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_package_items_select"
on public.content_package_items
for select
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
  or exists (
    select 1
    from public.clinic_packages cp
    where cp.package_id = content_package_items.package_id
      and cp.clinic_id = public.current_clinic_id()
  )
);

create policy "content_package_items_manage"
on public.content_package_items
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "clinic_packages_select"
on public.clinic_packages
for select
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
  or clinic_id = public.current_clinic_id()
);

create policy "clinic_packages_manage"
on public.clinic_packages
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);
