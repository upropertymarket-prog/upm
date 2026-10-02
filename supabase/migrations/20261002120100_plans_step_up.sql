-- UProperty Market — Fase 8 (Admin), P8-07
--
-- Correção a P7-05, autorizada pelo cliente a 2 out 2026 (07 §21.7 #2).
--
-- 07 §6 lista "editar planos e preços" entre as ações que exigem PIN de
-- operação, e a Fase 7 entregou Admin › Planos sem ele — porque o mecanismo
-- nunca tinha sido usado por ninguém (07 §21.1).
--
-- O guarda vive num **gatilho**, não na Server Action, pela razão de 07 §20.5:
-- uma verificação na action vale enquanto a action for o único caminho até à
-- tabela, e não é — a policy `plans_admin_write` deixa qualquer sessão de admin
-- escrever em `plans` diretamente pelo PostgREST.
--
-- `addons` leva o mesmo gatilho: o extra Cloud 5 GB tem preço (07 §19.3), e um
-- preço é um preço.

create or replace function public.require_step_up_for_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem sessão não há PIN que se possa pedir: é o `service_role` a escrever —
  -- a sincronização com o Stripe (P7-01), o webhook e o `seed.sql`. Esses
  -- caminhos não vêm de um browser e não são o que 07 §6 quer travar.
  if auth.uid() is null then
    return new;
  end if;

  perform public.require_step_up();
  return new;
end;
$$;

comment on function public.require_step_up_for_catalog() is
  'Exige step-up de PIN em escritas de catálogo feitas a partir de uma sessão '
  '(07 §6). O service_role passa: não tem sessão nem PIN.';

create trigger plans_require_step_up
  before insert or update on public.plans
  for each row execute function public.require_step_up_for_catalog();

create trigger addons_require_step_up
  before insert or update on public.addons
  for each row execute function public.require_step_up_for_catalog();
