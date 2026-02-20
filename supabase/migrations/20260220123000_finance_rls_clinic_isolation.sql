-- Garante isolamento por clínica para dados financeiros e cadastros auxiliares.

alter table public.categories enable row level security;
drop policy if exists "Authenticated access" on public.categories;
drop policy if exists "categories_clinic_access" on public.categories;
create policy "categories_clinic_access"
  on public.categories
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.card_fees enable row level security;
drop policy if exists "Authenticated access" on public.card_fees;
drop policy if exists "card_fees_clinic_access" on public.card_fees;
create policy "card_fees_clinic_access"
  on public.card_fees
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.customers enable row level security;
drop policy if exists "Authenticated access" on public.customers;
drop policy if exists "customers_clinic_access" on public.customers;
create policy "customers_clinic_access"
  on public.customers
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.procedures enable row level security;
drop policy if exists "Authenticated access" on public.procedures;
drop policy if exists "procedures_clinic_access" on public.procedures;
create policy "procedures_clinic_access"
  on public.procedures
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.professionals enable row level security;
drop policy if exists "Authenticated access" on public.professionals;
drop policy if exists "professionals_clinic_access" on public.professionals;
create policy "professionals_clinic_access"
  on public.professionals
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.suppliers enable row level security;
drop policy if exists "Authenticated access" on public.suppliers;
drop policy if exists "suppliers_clinic_access" on public.suppliers;
create policy "suppliers_clinic_access"
  on public.suppliers
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.revenues enable row level security;
drop policy if exists "Authenticated access" on public.revenues;
drop policy if exists "revenues_clinic_access" on public.revenues;
create policy "revenues_clinic_access"
  on public.revenues
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.expenses enable row level security;
drop policy if exists "Authenticated access" on public.expenses;
drop policy if exists "expenses_clinic_access" on public.expenses;
create policy "expenses_clinic_access"
  on public.expenses
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());

alter table public.revenue_procedures enable row level security;
drop policy if exists "Authenticated access" on public.revenue_procedures;
drop policy if exists "revenue_procedures_clinic_access" on public.revenue_procedures;
create policy "revenue_procedures_clinic_access"
  on public.revenue_procedures
  for all
  to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_member(clinic_id) or public.is_system_admin());
