-- Evita recursão em policies ao consultar schedule_events via schedule_event_attendees.

create or replace function public.is_event_consultant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.schedule_events se
    where se.id = p_event_id
      and se.consultant_id = auth.uid()
  );
$$;

alter table public.schedule_event_attendees enable row level security;

drop policy if exists "schedule_event_attendees_consultant_manage" on public.schedule_event_attendees;
create policy "schedule_event_attendees_consultant_manage"
  on public.schedule_event_attendees
  for all
  to authenticated
  using (public.is_event_consultant(event_id))
  with check (public.is_event_consultant(event_id));
