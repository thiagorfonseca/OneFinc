update public.clinic_users
set email = lower(email)
where email <> lower(email);

create unique index if not exists clinic_users_email_unique
on public.clinic_users (lower(email));

create unique index if not exists clinic_invites_email_unique
on public.clinic_invites (lower(email));
