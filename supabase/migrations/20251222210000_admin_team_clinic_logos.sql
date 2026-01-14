alter table public.clinics
  add column if not exists logo_url text;

drop policy if exists "user_avatars_system_admin_insert" on storage.objects;
create policy "user_avatars_system_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-avatars'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "user_avatars_system_admin_update" on storage.objects;
create policy "user_avatars_system_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-avatars'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  bucket_id = 'user-avatars'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "user_avatars_system_admin_delete" on storage.objects;
create policy "user_avatars_system_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-avatars'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "profiles_system_admin_update" on public.profiles;
create policy "profiles_system_admin_update"
on public.profiles
for update
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

drop policy if exists "profiles_system_admin_delete" on public.profiles;
create policy "profiles_system_admin_delete"
on public.profiles
for delete
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);
