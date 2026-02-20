-- Reforça a visibilidade de agendamentos apenas para clínicas participantes.
-- Garante que clínicas não participantes não consigam ler eventos ou attendees.

alter table public.schedule_events enable row level security;
alter table public.schedule_event_attendees enable row level security;

drop policy if exists "schedule_events_clinic_select" on public.schedule_events;
create policy "schedule_events_clinic_select"
  on public.schedule_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_event_attendees sea
      where sea.event_id = schedule_events.id
        and public.is_clinic_member(sea.clinic_id)
    )
  );

drop policy if exists "schedule_event_attendees_clinic_select" on public.schedule_event_attendees;
create policy "schedule_event_attendees_clinic_select"
  on public.schedule_event_attendees
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));
