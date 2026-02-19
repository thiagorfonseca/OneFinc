alter table public.clinics
  add column if not exists address_cep text,
  add column if not exists address_logradouro text,
  add column if not exists address_numero text,
  add column if not exists address_complemento text,
  add column if not exists address_bairro text,
  add column if not exists address_cidade text,
  add column if not exists address_uf text;
