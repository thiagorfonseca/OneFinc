-- Permite que consultores vejam/gerenciem os próprios agendamentos e confirmem participação.

alter table public.schedule_events
  add column if not exists consultant_confirm_status text;

alter table public.schedule_events
  add column if not exists consultant_confirmed_at timestamptz;

alter table public.schedule_events
  add column if not exists consultant_confirmed_by uuid references auth.users(id) on delete set null;

update public.schedule_events
set consultant_confirm_status = 'pending'
where consultant_confirm_status is null;

alter table public.schedule_events
  alter column consultant_confirm_status set default 'pending';

alter table public.schedule_events
  alter column consultant_confirm_status set not null;

alter table public.schedule_events
  add constraint schedule_events_consultant_confirm_status_check
  check (consultant_confirm_status in ('pending', 'confirmed', 'declined'));

alter table public.schedule_events enable row level security;

drop policy if exists "schedule_events_consultant_select" on public.schedule_events;
create policy "schedule_events_consultant_select"
  on public.schedule_events
  for select
  to authenticated
  using (consultant_id = auth.uid());

drop policy if exists "schedule_events_consultant_insert" on public.schedule_events;
create policy "schedule_events_consultant_insert"
  on public.schedule_events
  for insert
  to authenticated
  with check (consultant_id = auth.uid());

drop policy if exists "schedule_events_consultant_update" on public.schedule_events;
create policy "schedule_events_consultant_update"
  on public.schedule_events
  for update
  to authenticated
  using (consultant_id = auth.uid())
  with check (consultant_id = auth.uid());

drop policy if exists "schedule_events_consultant_delete" on public.schedule_events;
create policy "schedule_events_consultant_delete"
  on public.schedule_events
  for delete
  to authenticated
  using (consultant_id = auth.uid());

alter table public.schedule_event_attendees enable row level security;

drop policy if exists "schedule_event_attendees_consultant_manage" on public.schedule_event_attendees;
create policy "schedule_event_attendees_consultant_manage"
  on public.schedule_event_attendees
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_events se
      where se.id = schedule_event_attendees.event_id
        and se.consultant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_events se
      where se.id = schedule_event_attendees.event_id
        and se.consultant_id = auth.uid()
    )
  );

alter table public.schedule_change_requests enable row level security;

drop policy if exists "schedule_change_requests_consultant_select" on public.schedule_change_requests;
create policy "schedule_change_requests_consultant_select"
  on public.schedule_change_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_events se
      where se.id = schedule_change_requests.event_id
        and se.consultant_id = auth.uid()
    )
  );

alter table public.schedule_external_blocks enable row level security;

drop policy if exists "schedule_external_blocks_consultant_select" on public.schedule_external_blocks;
create policy "schedule_external_blocks_consultant_select"
  on public.schedule_external_blocks
  for select
  to authenticated
  using (consultant_id = auth.uid());
