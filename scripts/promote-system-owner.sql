-- Promote a user to system_owner by email (run in Supabase SQL editor).
insert into public.profiles (id, role)
select id, 'system_owner'
from auth.users
where email = 'thiago@odeducacao.com.br'
on conflict (id) do update
set role = 'system_owner';

select id, email
from auth.users
where email = 'thiago@odeducacao.com.br';

select id, role
from public.profiles
where id = (select id from auth.users where email = 'thiago@odeducacao.com.br');
