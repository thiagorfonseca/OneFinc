create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('course', 'training')),
  title text,
  description text,
  thumbnail_url text,
  banner_url text,
  published boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.content_modules (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  title text,
  order_index integer default 1,
  created_at timestamptz default now()
);

create table if not exists public.content_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.content_modules(id) on delete cascade,
  title text,
  description text,
  panda_video_id text,
  panda_video_url text,
  order_index integer default 1,
  published boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.content_lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.content_lessons(id) on delete cascade,
  file_name text,
  file_url text,
  created_at timestamptz default now()
);

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content_items(id) on delete cascade,
  module_id uuid references public.content_modules(id) on delete set null,
  lesson_id uuid references public.content_lessons(id) on delete set null,
  student_user_id uuid references auth.users(id) on delete set null,
  content text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

drop trigger if exists user_notes_set_updated_at on public.user_notes;
create trigger user_notes_set_updated_at
before update on public.user_notes
for each row execute procedure public.handle_updated_at();

alter table public.content_items enable row level security;
alter table public.content_modules enable row level security;
alter table public.content_lessons enable row level security;
alter table public.content_lesson_files enable row level security;
alter table public.content_comments enable row level security;
alter table public.user_notes enable row level security;

drop policy if exists "content_items_select" on public.content_items;
drop policy if exists "content_items_write" on public.content_items;
drop policy if exists "content_modules_select" on public.content_modules;
drop policy if exists "content_modules_write" on public.content_modules;
drop policy if exists "content_lessons_select" on public.content_lessons;
drop policy if exists "content_lessons_write" on public.content_lessons;
drop policy if exists "content_lesson_files_select" on public.content_lesson_files;
drop policy if exists "content_lesson_files_write" on public.content_lesson_files;
drop policy if exists "content_comments_select" on public.content_comments;
drop policy if exists "content_comments_write" on public.content_comments;
drop policy if exists "user_notes_select" on public.user_notes;
drop policy if exists "user_notes_insert" on public.user_notes;
drop policy if exists "user_notes_update" on public.user_notes;
drop policy if exists "user_notes_delete" on public.user_notes;

create policy "content_items_select"
on public.content_items
for select
to authenticated
using (
  published = true
  or exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_items_write"
on public.content_items
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_modules_select"
on public.content_modules
for select
to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    where ci.id = content_modules.content_id
      and ci.published = true
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_modules_write"
on public.content_modules
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_lessons_select"
on public.content_lessons
for select
to authenticated
using (
  (
    content_lessons.published = true
    and exists (
      select 1
      from public.content_modules cm
      join public.content_items ci on ci.id = cm.content_id
      where cm.id = content_lessons.module_id
        and ci.published = true
    )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_lessons_write"
on public.content_lessons
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_lesson_files_select"
on public.content_lesson_files
for select
to authenticated
using (
  exists (
    select 1
    from public.content_lessons cl
    join public.content_modules cm on cm.id = cl.module_id
    join public.content_items ci on ci.id = cm.content_id
    where cl.id = content_lesson_files.lesson_id
      and ci.published = true
      and cl.published = true
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_lesson_files_write"
on public.content_lesson_files
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_comments_select"
on public.content_comments
for select
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "content_comments_write"
on public.content_comments
for all
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.app_current_user cu
    where cu.role in ('system_owner', 'super_admin')
  )
);

create policy "user_notes_select"
on public.user_notes
for select
to authenticated
using (user_id = auth.uid());

create policy "user_notes_insert"
on public.user_notes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_notes_update"
on public.user_notes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_notes_delete"
on public.user_notes
for delete
to authenticated
using (user_id = auth.uid());
