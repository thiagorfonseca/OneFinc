create policy "profiles_select_system_admin"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);
