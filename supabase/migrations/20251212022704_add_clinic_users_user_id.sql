-- 1) Adicionar user_id (liga membership ao auth.users)
alter table public.clinic_users
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) Índices úteis
create index if not exists clinic_users_user_id_idx on public.clinic_users(user_id);
create index if not exists clinic_users_clinic_id_idx on public.clinic_users(clinic_id);

-- 3) Evitar duplicidade: mesmo user na mesma clínica uma vez só
create unique index if not exists clinic_users_unique_membership
  on public.clinic_users (clinic_id, user_id)
  where user_id is not null;

-- 0) Dropar policies que dependem das funções (para conseguir recriar)
drop policy if exists revenue_procedures_sel on public.revenue_procedures;
drop policy if exists revenue_procedures_all on public.revenue_procedures;

-- 4) Funções utilitárias (para RLS e chsupabase db pushecagens)
create or replace function public.current_clinic_id()
returns uuid stable language sql as $$
  select clinic_id
  from public.clinic_users
  where user_id = auth.uid() and ativo = true
  order by created_at desc
  limit 1;
$$;

-- IMPORTANTÍSSIMO: manter o nome do parâmetro como já existe no banco: p_clinic_id
create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean stable language sql as $$
  select exists(
    select 1
    from public.clinic_users cu
    where cu.clinic_id = p_clinic_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
  );
$$;

create or replace function public.is_clinic_admin(p_clinic_id uuid)
returns boolean stable language sql as $$
  select exists(
    select 1
    from public.clinic_users cu
    where cu.clinic_id = p_clinic_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
      and cu.role in ('owner','admin')
  );
$$;

-- 5) RLS na clinic_users: o usuário vê apenas suas memberships
alter table public.clinic_users enable row level security;

drop policy if exists "clinic_users_select_own" on public.clinic_users;
create policy "clinic_users_select_own"
on public.clinic_users
for select
to authenticated
using (user_id = auth.uid());

-- Admin/Owner podem gerenciar usuários da própria clínica (CRUD)
drop policy if exists "clinic_users_admin_manage" on public.clinic_users;
create policy "clinic_users_admin_manage"
on public.clinic_users
for all
to authenticated
using (public.is_clinic_admin(clinic_id))
with check (public.is_clinic_admin(clinic_id));