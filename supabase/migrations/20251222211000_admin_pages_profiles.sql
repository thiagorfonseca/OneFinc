alter table public.profiles
  add column if not exists admin_pages text[];

drop function if exists public.list_system_admins();

create or replace function public.list_system_admins()
returns table (
  id uuid,
  full_name text,
  role text,
  email text,
  created_at timestamptz,
  admin_pages text[]
)
language sql
security definer
set search_path = public, auth
as $$
  select p.id, p.full_name, p.role, u.email, p.created_at, p.admin_pages
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role in ('system_owner', 'super_admin')
    and exists (
      select 1
      from public.app_current_user cu
      where cu.role in ('system_owner', 'super_admin')
    );
$$;

grant execute on function public.list_system_admins() to authenticated;
