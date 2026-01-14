-- Corrige data_competencia para despesas parceladas criadas pelo fluxo antigo,
-- mantendo a data de compra igual para todas as parcelas.
with grupos as (
  select
    clinic_id,
    description,
    fornecedor,
    supplier_id,
    category_id,
    bank_account_id,
    forma_pagamento,
    valor,
    date_trunc('minute', created_at) as created_at_key,
    min(data_competencia) as compra_min,
    min(data_vencimento) as venc_min,
    max(data_competencia) as comp_max,
    count(*) as total
  from public.expenses
  where data_competencia is not null
  group by
    clinic_id,
    description,
    fornecedor,
    supplier_id,
    category_id,
    bank_account_id,
    forma_pagamento,
    valor,
    date_trunc('minute', created_at)
  having count(*) > 1
    and min(data_competencia) <> max(data_competencia)
),
ajuste as (
  select
    g.*,
    case
      when lower(translate(coalesce(forma_pagamento, ''), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç', 'AAAAEEEIIIOOOOUUUCAAAAEEEIIIOOOOUUUC')) like '%credito%'
        and g.compra_min = g.venc_min
        then (g.compra_min - interval '30 days')::date
      else g.compra_min
    end as compra_corrigida
  from grupos g
),
alvos as (
  select e.id, a.compra_corrigida
  from public.expenses e
  join ajuste a
    on e.clinic_id is not distinct from a.clinic_id
   and e.description is not distinct from a.description
   and e.fornecedor is not distinct from a.fornecedor
   and e.supplier_id is not distinct from a.supplier_id
   and e.category_id is not distinct from a.category_id
   and e.bank_account_id is not distinct from a.bank_account_id
   and e.forma_pagamento is not distinct from a.forma_pagamento
   and e.valor is not distinct from a.valor
   and date_trunc('minute', e.created_at) = a.created_at_key
)
update public.expenses e
set data_competencia = a.compra_corrigida
from alvos a
where e.id = a.id;
