create policy "content_packages_public_select"
on public.content_packages
for select
to anon
using (show_on_public = true);
