create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_clinic_id_idx on public.ai_chat_messages(clinic_id);
create index if not exists ai_chat_messages_user_id_idx on public.ai_chat_messages(user_id);
create index if not exists ai_chat_messages_created_at_idx on public.ai_chat_messages(created_at);

create table if not exists public.ai_chat_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  tool_called text not null,
  sql_executed text,
  result_json jsonb,
  response_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_logs_clinic_id_idx on public.ai_chat_logs(clinic_id);
create index if not exists ai_chat_logs_user_id_idx on public.ai_chat_logs(user_id);
create index if not exists ai_chat_logs_created_at_idx on public.ai_chat_logs(created_at);

alter table public.ai_chat_messages enable row level security;
alter table public.ai_chat_logs enable row level security;

drop policy if exists "ai_chat_messages_select" on public.ai_chat_messages;
create policy "ai_chat_messages_select"
on public.ai_chat_messages
for select
to authenticated
using (
  public.is_clinic_member(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "ai_chat_messages_insert" on public.ai_chat_messages;
create policy "ai_chat_messages_insert"
on public.ai_chat_messages
for insert
to authenticated
with check (
  (public.is_clinic_member(clinic_id) and user_id = auth.uid())
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "ai_chat_logs_select_system_admin" on public.ai_chat_logs;
create policy "ai_chat_logs_select_system_admin"
on public.ai_chat_logs
for select
to authenticated
using (
  exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

create or replace function public.get_receivables_summary(p_clinic_id uuid, p_days integer)
returns table(category text, total numeric, items integer)
language sql
stable
as $$
  with range as (
    select (now() at time zone 'America/Sao_Paulo')::date as start_date,
           ((now() at time zone 'America/Sao_Paulo')::date + (p_days || ' days')::interval)::date as end_date
  )
  select
    coalesce(c.name, 'Sem categoria') as category,
    coalesce(sum(coalesce(r.valor_liquido, r.valor_bruto, r.valor, 0)), 0) as total,
    count(*)::int as items
  from public.revenues r
  left join public.categories c on c.id = r.category_id
  cross join range
  where r.clinic_id = p_clinic_id
    and coalesce(r.data_recebimento, r.data_competencia) >= range.start_date
    and coalesce(r.data_recebimento, r.data_competencia) < range.end_date
  group by 1
  order by total desc;
$$;

create or replace function public.get_payables_summary(p_clinic_id uuid, p_days integer)
returns table(category text, total numeric, items integer)
language sql
stable
as $$
  with range as (
    select (now() at time zone 'America/Sao_Paulo')::date as start_date,
           ((now() at time zone 'America/Sao_Paulo')::date + (p_days || ' days')::interval)::date as end_date
  )
  select
    coalesce(c.name, 'Sem categoria') as category,
    coalesce(sum(coalesce(e.valor, 0)), 0) as total,
    count(*)::int as items
  from public.expenses e
  left join public.categories c on c.id = e.category_id
  cross join range
  where e.clinic_id = p_clinic_id
    and coalesce(e.data_pagamento, e.data_vencimento, e.data_competencia) >= range.start_date
    and coalesce(e.data_pagamento, e.data_vencimento, e.data_competencia) < range.end_date
  group by 1
  order by total desc;
$$;

create or replace function public.get_cashflow_projection(p_clinic_id uuid, p_days integer)
returns table(total_receber numeric, total_pagar numeric, saldo numeric)
language sql
stable
as $$
  with range as (
    select (now() at time zone 'America/Sao_Paulo')::date as start_date,
           ((now() at time zone 'America/Sao_Paulo')::date + (p_days || ' days')::interval)::date as end_date
  ),
  rece as (
    select coalesce(sum(coalesce(r.valor_liquido, r.valor_bruto, r.valor, 0)), 0) as total
    from public.revenues r
    cross join range
    where r.clinic_id = p_clinic_id
      and coalesce(r.data_recebimento, r.data_competencia) >= range.start_date
      and coalesce(r.data_recebimento, r.data_competencia) < range.end_date
  ),
  paga as (
    select coalesce(sum(coalesce(e.valor, 0)), 0) as total
    from public.expenses e
    cross join range
    where e.clinic_id = p_clinic_id
      and coalesce(e.data_pagamento, e.data_vencimento, e.data_competencia) >= range.start_date
      and coalesce(e.data_pagamento, e.data_vencimento, e.data_competencia) < range.end_date
  )
  select rece.total as total_receber,
         paga.total as total_pagar,
         rece.total - paga.total as saldo
  from rece, paga;
$$;

create or replace function public.get_top_procedures_profitability(p_clinic_id uuid, p_days integer)
returns table(procedimento text, lucro numeric, itens integer)
language sql
stable
as $$
  with range as (
    select (now() at time zone 'America/Sao_Paulo')::date as start_date,
           ((now() at time zone 'America/Sao_Paulo')::date + (p_days || ' days')::interval)::date as end_date
  )
  select
    coalesce(rp.procedimento, p.procedimento) as procedimento,
    coalesce(
      sum(
        (
          coalesce(rp.valor_cobrado, p.valor_cobrado, 0)
          - coalesce(p.custo_insumo, 0)
        ) * coalesce(rp.quantidade, 1)
      ),
      0
    ) as lucro,
    coalesce(sum(coalesce(rp.quantidade, 1)), 0)::int as itens
  from public.revenue_procedures rp
  join public.revenues r on r.id = rp.revenue_id
  left join public.procedures p on p.id = rp.procedure_id
  cross join range
  where r.clinic_id = p_clinic_id
    and coalesce(rp.procedimento, p.procedimento) is not null
    and coalesce(r.data_competencia, r.data_recebimento) >= range.start_date
    and coalesce(r.data_competencia, r.data_recebimento) < range.end_date
  group by coalesce(rp.procedimento, p.procedimento)
  order by lucro desc
  limit 10;
$$;

grant execute on function public.get_receivables_summary(uuid, integer) to authenticated;
grant execute on function public.get_payables_summary(uuid, integer) to authenticated;
grant execute on function public.get_cashflow_projection(uuid, integer) to authenticated;
grant execute on function public.get_top_procedures_profitability(uuid, integer) to authenticated;
