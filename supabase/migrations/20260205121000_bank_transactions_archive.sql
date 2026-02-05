alter table public.bank_transactions
  add column if not exists arquivado boolean default false;