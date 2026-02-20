alter table public.profiles
  add column if not exists show_in_team_agenda boolean not null default true;

create or replace function public.list_system_admins()
returns table (
  id uuid,
  full_name text,
  role text,
  email text,
  created_at timestamptz,
  admin_pages text[],
  show_in_team_agenda boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select p.id, p.full_name, p.role, u.email, p.created_at, p.admin_pages, p.show_in_team_agenda
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role in ('system_owner', 'super_admin')
    and exists (
      select 1
      from public.app_current_user cu
      where cu.role in ('system_owner', 'super_admin')
    );
$$;
