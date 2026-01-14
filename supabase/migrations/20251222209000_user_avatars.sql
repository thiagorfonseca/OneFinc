alter table public.clinic_users
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', true)
on conflict (id) do nothing;

drop policy if exists "user_avatars_select" on storage.objects;
drop policy if exists "user_avatars_insert" on storage.objects;
drop policy if exists "user_avatars_update" on storage.objects;
drop policy if exists "user_avatars_delete" on storage.objects;

create policy "user_avatars_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'user-avatars');

create policy "user_avatars_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-avatars'
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text)
    or (
      (storage.foldername(name))[1] = 'clinics'
      and (storage.foldername(name))[2] is not null
      and public.is_clinic_admin((storage.foldername(name))[2]::uuid)
    )
  )
);

create policy "user_avatars_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-avatars'
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text)
    or (
      (storage.foldername(name))[1] = 'clinics'
      and (storage.foldername(name))[2] is not null
      and public.is_clinic_admin((storage.foldername(name))[2]::uuid)
    )
  )
)
with check (
  bucket_id = 'user-avatars'
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text)
    or (
      (storage.foldername(name))[1] = 'clinics'
      and (storage.foldername(name))[2] is not null
      and public.is_clinic_admin((storage.foldername(name))[2]::uuid)
    )
  )
);

create policy "user_avatars_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-avatars'
  and (
    ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text)
    or (
      (storage.foldername(name))[1] = 'clinics'
      and (storage.foldername(name))[2] is not null
      and public.is_clinic_admin((storage.foldername(name))[2]::uuid)
    )
  )
);
