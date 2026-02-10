-- Allow system admins to insert feedbacks when acting on a clinic

drop policy if exists "hr_feedbacks_insert" on public.hr_feedbacks;

create policy "hr_feedbacks_insert"
on public.hr_feedbacks
for insert
to authenticated
with check (
  (
    public.is_clinic_member(clinic_id)
    and created_by = auth.uid()
  )
  or (
    exists (
      select 1
      from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
    and created_by = auth.uid()
  )
);
