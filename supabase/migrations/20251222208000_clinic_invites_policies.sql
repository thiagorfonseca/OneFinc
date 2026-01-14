alter table public.clinic_invites enable row level security;

drop policy if exists "clinic_invites_manage" on public.clinic_invites;
create policy "clinic_invites_manage"
on public.clinic_invites
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
