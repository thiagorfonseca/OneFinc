create table if not exists public.system_admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role text not null default 'super_admin' check (role in ('super_admin', 'system_owner')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create unique index if not exists system_admin_invites_email_unique
on public.system_admin_invites (lower(email));

alter table public.system_admin_invites enable row level security;

create policy "system_admin_invites_admin_manage"
on public.system_admin_invites
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

create policy "system_admin_invites_select_self"
on public.system_admin_invites
for select
to authenticated
using (lower(email) = lower((auth.jwt() ->> 'email')));

create policy "system_admin_invites_delete_self"
on public.system_admin_invites
for delete
to authenticated
using (lower(email) = lower((auth.jwt() ->> 'email')));
