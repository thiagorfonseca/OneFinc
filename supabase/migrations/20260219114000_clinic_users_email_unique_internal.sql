drop index if exists clinic_users_email_unique;

create unique index if not exists clinic_users_email_unique
on public.clinic_users (lower(email))
where coalesce(role, '') not in ('one_doctor_admin', 'one_doctor_sales', 'system_owner', 'super_admin');
