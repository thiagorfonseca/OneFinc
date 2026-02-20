-- Monitoramento de aulas: obrigatoriedade para reuniões + progresso por usuário.

alter table public.content_lessons
  add column if not exists required_for_meeting boolean not null default false,
  add column if not exists meeting_tag text;

create table if not exists public.content_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid null references public.clinics(id) on delete cascade,
  content_id uuid null references public.content_items(id) on delete cascade,
  lesson_id uuid not null references public.content_lessons(id) on delete cascade,
  watched_seconds integer not null default 0,
  duration_seconds integer null,
  watched_percent numeric(5,2) not null default 0,
  last_watched_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists content_lesson_progress_unique
  on public.content_lesson_progress (user_id, lesson_id, clinic_id);

create index if not exists content_lesson_progress_clinic_idx
  on public.content_lesson_progress (clinic_id);

create index if not exists content_lesson_progress_lesson_idx
  on public.content_lesson_progress (lesson_id);

drop trigger if exists content_lesson_progress_set_updated_at on public.content_lesson_progress;
create trigger content_lesson_progress_set_updated_at
before update on public.content_lesson_progress
for each row execute procedure public.handle_updated_at();

alter table public.content_lesson_progress enable row level security;

drop policy if exists "content_lesson_progress_select" on public.content_lesson_progress;
create policy "content_lesson_progress_select"
  on public.content_lesson_progress
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_system_admin()
  );

drop policy if exists "content_lesson_progress_insert" on public.content_lesson_progress;
create policy "content_lesson_progress_insert"
  on public.content_lesson_progress
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_clinic_member(clinic_id)
  );

drop policy if exists "content_lesson_progress_update" on public.content_lesson_progress;
create policy "content_lesson_progress_update"
  on public.content_lesson_progress
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_system_admin())
  with check (
    (user_id = auth.uid() and public.is_clinic_member(clinic_id))
    or public.is_system_admin()
  );

drop policy if exists "content_lesson_progress_delete" on public.content_lesson_progress;
create policy "content_lesson_progress_delete"
  on public.content_lesson_progress
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_system_admin());
