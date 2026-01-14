drop policy if exists "content_comments_select_clinic" on public.content_comments;
create policy "content_comments_select_clinic"
on public.content_comments
for select
to authenticated
using (
  (
    exists (
      select 1
      from public.content_items ci
      where ci.id = content_comments.content_id
        and ci.published = true
    )
    and exists (
      select 1
      from public.profiles p
      join public.app_current_user cu on cu.user_id = auth.uid()
      where p.id = content_comments.student_user_id
        and p.clinic_id = cu.clinic_id
    )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);
