-- O registo já não escolhe papel de staff (18 nov 2026)
-- =========================================================================
-- `handle_new_user()` (base.sql) copiava `raw_user_meta_data ->> 'role'` para
-- `profiles.role`. Esse metadata é do cliente: qualquer um chama o
-- `/auth/v1/signup` do Supabase diretamente, com a anon key, e manda
-- `data: { role: 'admin' }`. A validação zod da Server Action de registo não
-- protege nada — fica do lado de lá de um pedido que não passa por ela. E o
-- enum `user_role` aceita 'admin', 'support' e 'marketing', por isso o cast
-- não falhava: a conta nascia staff.
--
-- Agora o trigger só respeita 'buyer' e 'owner', os dois papéis que o registo
-- público oferece; tudo o resto, incluindo ausente ou inválido, dá 'buyer'.
-- Papéis da equipa só os define o service_role, com um `update` a `profiles`
-- depois de criar a conta — como `scripts/create-staff-user.mjs` já fazia.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when (new.raw_user_meta_data ->> 'role') in ('buyer', 'owner')
        then (new.raw_user_meta_data ->> 'role')::public.user_role
      else 'buyer'
    end
  );
  return new;
end;
$$;
