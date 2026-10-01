-- UProperty Market — Fase 7 (Faturação), complemento de P7-02
--
-- `profiles.stripe_customer_id` deixou de ser escrita pela sessão na migração
-- `20261001120100` (escalada de privilégios). O Checkout precisa, mesmo assim,
-- de associar um `customer` à conta na primeira compra — e é só isso que esta
-- função deixa fazer.
--
-- Porque é que não a escreve o webhook e acabou: o `customer` tem de existir
-- ANTES de abrir a sessão de Checkout, senão o Stripe cria um por cada compra
-- e a mesma pessoa fica com vários clientes e várias subscrições soltas.

create or replace function public.attach_stripe_customer(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_existing text;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  if p_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'Identificador de cliente inválido' using errcode = '22023';
  end if;

  select stripe_customer_id into v_existing from public.profiles where id = v_me;

  -- Só preenche quando está vazio. Trocar o `customer` de uma conta que já
  -- tem subscrição é desligá-la da faturação dela — isso faz-se no Admin,
  -- com registo, nunca a partir de uma sessão de utilizador.
  if v_existing is not null then
    if v_existing is distinct from p_customer_id then
      raise exception 'Esta conta já tem faturação associada' using errcode = '42501';
    end if;
    return;
  end if;

  update public.profiles set stripe_customer_id = p_customer_id where id = v_me;
end;
$$;
