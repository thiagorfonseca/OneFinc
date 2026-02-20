-- Permite que system_owner/super_admin acessem somente a clínica selecionada (profile.clinic_id).

create or replace function public.current_clinic_id()
returns uuid stable language sql as $$
  select coalesce(
    (
      select cu.clinic_id
      from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
        and cu.clinic_id is not null
      limit 1
    ),
    (
      select clinic_id
      from public.clinic_users
      where user_id = auth.uid()
        and ativo = true
      order by created_at desc
      limit 1
    )
  );
$$;

create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean stable language sql as $$
  select exists(
    select 1
    from public.clinic_users cu
    where cu.clinic_id = p_clinic_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
  )
  or exists(
    select 1
    from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
      and cu.clinic_id = p_clinic_id
  );
$$;
