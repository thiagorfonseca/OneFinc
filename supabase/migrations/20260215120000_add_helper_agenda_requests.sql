alter table public.clinics
  add column if not exists helper_agenda_quota int not null default 0;

create table if not exists public.clinic_helper_agenda_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete set null,
  preferred_start_at timestamptz not null,
  preferred_end_at timestamptz null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  handled_by uuid null references auth.users(id),
  handled_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (
    preferred_end_at is null
    or preferred_end_at > preferred_start_at
  )
);

create index if not exists clinic_helper_agenda_requests_clinic_idx
  on public.clinic_helper_agenda_requests(clinic_id, created_at desc);

create index if not exists clinic_helper_agenda_requests_status_idx
  on public.clinic_helper_agenda_requests(status);

create trigger clinic_helper_agenda_requests_set_updated_at
before update on public.clinic_helper_agenda_requests
for each row execute procedure public.handle_updated_at();

alter table public.clinic_helper_agenda_requests enable row level security;

drop policy if exists "clinic_helper_agenda_requests_internal_all" on public.clinic_helper_agenda_requests;
create policy "clinic_helper_agenda_requests_internal_all"
  on public.clinic_helper_agenda_requests
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "clinic_helper_agenda_requests_clinic_select" on public.clinic_helper_agenda_requests;
create policy "clinic_helper_agenda_requests_clinic_select"
  on public.clinic_helper_agenda_requests
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create or replace function public.request_helper_agenda(
  p_clinic_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_quota int;
  v_used int;
  v_request_id uuid;
begin
  if not (public.is_clinic_member(p_clinic_id) or public.is_system_admin()) then
    raise exception 'Clínica inválida';
  end if;

  select coalesce(helper_agenda_quota, 0)
    into v_quota
    from public.clinics
    where id = p_clinic_id;

  select count(*)
    into v_used
    from public.clinic_helper_agenda_requests
    where clinic_id = p_clinic_id
      and status in ('pending', 'confirmed');

  if v_quota <= v_used then
    raise exception 'Limite de agendas helpers atingido';
  end if;

  insert into public.clinic_helper_agenda_requests (
    clinic_id,
    requested_by,
    preferred_start_at,
    preferred_end_at,
    reason
  )
  values (
    p_clinic_id,
    auth.uid(),
    p_start_at,
    p_end_at,
    p_reason
  )
  returning id into v_request_id;

  insert into public.notifications (target, clinic_id, type, payload)
  values (
    'one_doctor',
    p_clinic_id,
    'helper_agenda_requested',
    jsonb_build_object(
      'request_id', v_request_id,
      'clinic_id', p_clinic_id,
      'requested_by', auth.uid(),
      'preferred_start_at', p_start_at,
      'preferred_end_at', p_end_at,
      'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.request_helper_agenda(uuid, timestamptz, timestamptz, text) to authenticated;
