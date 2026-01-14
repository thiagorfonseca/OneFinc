alter table public.revenues
  add column if not exists recebimento_parcelas jsonb,
  add column if not exists boleto_due_date date,
  add column if not exists cheque_number text,
  add column if not exists cheque_bank text,
  add column if not exists cheque_due_date date,
  add column if not exists cheque_pages integer,
  add column if not exists cheque_value numeric(14,2);
