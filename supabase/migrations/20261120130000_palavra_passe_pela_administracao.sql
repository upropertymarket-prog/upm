-- ===========================================================================
-- A palavra-passe da equipa é da administração (20 nov 2026)
-- ===========================================================================
-- Decisão do cliente: a app é da empresa, e são os admins que decidem quem
-- tem acesso. Ninguém da equipa — admins incluídos — define ou recupera a
-- própria palavra-passe; muda-a um admin, a qualquer altura, e um admin muda
-- a de outro admin (nunca a sua).
--
-- Substitui o caminho de 8 nov (link de recuperação para o e-mail do próprio,
-- e "Esqueci-me" para os admins), que saiu do interno.
--
-- **A regra vive na base, e não só no interno.** O interno deixou de ter
-- ecrãs para isto, mas o Supabase Auth continua a aceitar `updateUser` de
-- qualquer sessão, e o "recuperar palavra-passe" do site responde a qualquer
-- e-mail. Um gatilho em `auth.users` recusa toda a mudança de palavra-passe
-- numa conta de equipa que não venha de `admin_set_staff_password` — seja do
-- Auth, da API de administração, do site ou de uma chamada à mão.
--
-- Como o gatilho distingue: a função marca a transação com
-- `upm.staff_password_change = 'on'` (`set_config(..., true)`, local à
-- transação). O Auth escreve nas suas próprias transações, que nunca a têm.
-- Não há janela: a marca e a escrita são a mesma transação.
--
-- **Quem estava dentro sai.** A mudança apaga as sessões da conta (e com elas
-- os refresh tokens, em cascata): a palavra-passe antiga deixa de servir e a
-- sessão aberta com ela também.
--
-- **A palavra-passe nunca fica em lado nenhum.** Chega como parâmetro, é
-- cifrada aqui (bcrypt, o formato do Auth) e não entra no `audit_log`, que só
-- regista quem mudou a de quem.
--
-- Último recurso (um admin sem o outro): no SQL Editor do Supabase, numa só
-- transação —
--   begin;
--   select set_config('upm.staff_password_change', 'on', true);
--   update auth.users
--     set encrypted_password = extensions.crypt('<nova>', extensions.gen_salt('bf', 10))
--     where email = '<email>';
--   commit;
-- ===========================================================================

create or replace function public.guard_staff_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is not distinct from old.encrypted_password then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.id and p.role in ('admin', 'support', 'marketing')
  ) then
    return new;
  end if;
  if coalesce(current_setting('upm.staff_password_change', true), '') <> 'on' then
    raise exception 'A palavra-passe de uma conta de equipa só é mudada pela administração'
      using errcode = '42501', hint = 'staff_password_admin_only';
  end if;
  -- Quem tinha a palavra-passe antiga sai: as sessões caem, e os refresh
  -- tokens com elas (`on delete cascade`).
  delete from auth.sessions where user_id = new.id;
  return new;
end;
$$;

revoke all on function public.guard_staff_password_change() from public, anon, authenticated;

comment on function public.guard_staff_password_change() is
  'Gatilho de auth.users: recusa a mudança de palavra-passe de uma conta de equipa fora de '
  'admin_set_staff_password, e termina as sessões quando é permitida (20 nov 2026).';

drop trigger if exists on_auth_user_staff_password on auth.users;
create trigger on_auth_user_staff_password
  before update of encrypted_password on auth.users
  for each row
  execute function public.guard_staff_password_change();

create or replace function public.admin_set_staff_password(
  p_profile_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_status public.profile_status;
begin
  perform public.require_step_up();
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_profile_id is null or p_profile_id = auth.uid() then
    raise exception 'A própria palavra-passe muda-a outro administrador' using errcode = '42501';
  end if;
  -- A mesma política do resto das contas (`passwordSchema`): 10 a 72. O teto é
  -- o do bcrypt, que ignora o que passar dos 72 bytes.
  if p_password is null or length(p_password) < 10 or octet_length(p_password) > 72 then
    raise exception 'Palavra-passe inválida' using errcode = '22023';
  end if;

  select p.role, p.status into v_role, v_status
  from public.profiles p
  where p.id = p_profile_id
  for update;
  if not found or v_role not in ('admin', 'support', 'marketing') then
    raise exception 'Não é uma conta de equipa' using errcode = '42501';
  end if;
  if v_status <> 'active' then
    raise exception 'Só contas ativas' using errcode = '22023';
  end if;

  perform set_config('upm.staff_password_change', 'on', true);
  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        updated_at = now()
    where id = p_profile_id;
  perform set_config('upm.staff_password_change', '', true);

  perform public.write_audit_log(
    'staff.password_set_by_admin',
    'profiles',
    p_profile_id,
    jsonb_build_object('role', v_role)
  );
end;
$$;

revoke all on function public.admin_set_staff_password(uuid, text) from public, anon;
grant execute on function public.admin_set_staff_password(uuid, text) to authenticated;

comment on function public.admin_set_staff_password(uuid, text) is
  'Admin com PIN muda a palavra-passe de outra conta de equipa ativa; termina-lhe as sessões. '
  'A palavra-passe não fica registada (20 nov 2026).';
