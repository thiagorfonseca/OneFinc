drop policy if exists "content_files_insert" on storage.objects;
drop policy if exists "content_files_update" on storage.objects;
drop policy if exists "content_files_delete" on storage.objects;
drop policy if exists "content_files_select" on storage.objects;

create policy "content_files_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'content-files'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_files_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'content-files'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  bucket_id = 'content-files'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_files_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'content-files'
  and exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_files_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'content-files');
