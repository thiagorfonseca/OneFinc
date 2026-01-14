alter table public.expenses
  add column if not exists data_vencimento date;

update public.expenses
set data_vencimento = data_pagamento
where data_vencimento is null
  and data_pagamento is not null;
