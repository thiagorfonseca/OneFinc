drop policy if exists "clinic_invites_select_self" on public.clinic_invites;
create policy "clinic_invites_select_self"
on public.clinic_invites
for select
to authenticated
using (lower(email) = lower((auth.jwt() ->> 'email')));

drop policy if exists "clinic_invites_delete_self" on public.clinic_invites;
create policy "clinic_invites_delete_self"
on public.clinic_invites
for delete
to authenticated
using (lower(email) = lower((auth.jwt() ->> 'email')));
