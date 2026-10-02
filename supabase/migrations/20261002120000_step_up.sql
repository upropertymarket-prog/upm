-- UProperty Market — Fase 8 (Admin), P8-07
--
-- Põe em uso o PIN de operação que 07 §6 exige antes de cada ação sensível do
-- `interno`. A decisão de lhe dar ID próprio está em 07 §21.1.
--
-- A Fase 3 criou `staff_auth.last_step_up_at` e as funções TypeScript que o
-- leem e escrevem, mas **nenhuma ação sensível as chamava** — e foi por isso
-- que ninguém notou dois defeitos que esta migração fecha.
--
-- Defeito 1 — o step-up era contornável sem PIN.
-- A policy `staff_auth_self` é `for all`, logo qualquer sessão de staff podia
-- correr, pelo PostgREST:
--     update staff_auth set last_step_up_at = now()
-- e ficar com step-up válido sem nunca ter escrito o PIN. É exatamente a classe
-- de defeito de 07 §20.6 (escalada de privilégios no próprio perfil), e a
-- ferramenta certa é a mesma: **privilégios de coluna, que a RLS não
-- substitui** — a RLS do Postgres autoriza a linha, não a coluna.
--
-- Defeito 2 — o `audit_log` de Admin › Planos nunca escreveu nada.
-- `savePlan` (P7-05) insere em `audit_log` com a sessão do utilizador, e
-- `audit_log` não tem policy de insert, de propósito ("escrita exclusivamente
-- por service_role" — 20260926120000_base.sql). A RLS recusava, o código
-- ignorava o erro, e a alteração de preço ficava sem rasto. 08 §6.7 exige esse
-- rasto. A saída é `write_audit_log()`, abaixo: uma porta única, que fixa o
-- actor a partir da sessão em vez de o aceitar de quem chama.

-- ---------------------------------------------------------------------------
-- 1. `last_step_up_at` deixa de ser escrevível pelo cliente
-- ---------------------------------------------------------------------------
-- Mesmo padrão de 20261001120100_plan_enforcement.sql para `profiles`: revoga
-- a operação inteira e devolve, coluna a coluna, só o que tem caminho
-- legítimo a partir do browser.
--
--   pin_hash / pin_updated_at   → /definicoes/seguranca (o staff define o seu PIN)
--   recovery_codes_hash         → /configurar-2fa (códigos gerados no enrolment)
--   last_step_up_at             → ninguém. Só `mark_step_up()`, e essa só com
--                                 `service_role`, depois de o PIN ser verificado.
--
-- `delete` também sai: nada no produto apaga uma linha de `staff_auth`, e a
-- cascata de `profiles` continua a limpá-la quando a conta desaparece.

revoke all on public.staff_auth from anon;

revoke insert, update, delete on public.staff_auth from authenticated;

grant insert (profile_id, pin_hash, pin_updated_at, recovery_codes_hash)
  on public.staff_auth to authenticated;

grant update (pin_hash, pin_updated_at, recovery_codes_hash)
  on public.staff_auth to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ler o estado do step-up
-- ---------------------------------------------------------------------------
-- 15 minutos, de 07 §6. O valor vive aqui, que é onde a decisão é aplicada;
-- `STEP_UP_VALIDITY_MS` em packages/db/src/auth.ts existe só para a contagem
-- na interface e tem de concordar com este intervalo.

create or replace function public.step_up_valid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sa.last_step_up_at > now() - interval '15 minutes'
      from public.staff_auth sa
      where sa.profile_id = auth.uid()
    ),
    false
  );
$$;

comment on function public.step_up_valid() is
  'Step-up de PIN ainda válido para a sessão atual (07 §6, 15 min). Para a UI; '
  'quem decide é require_step_up().';

-- ---------------------------------------------------------------------------
-- 3. Exigir step-up — o guarda que as funções de negócio chamam
-- ---------------------------------------------------------------------------
-- Vive em SQL e não nas Server Actions pela razão de 07 §20.5: uma verificação
-- na action vale enquanto a action for o único caminho até à tabela, e não é —
-- há três apps, há RPC, e amanhã há mais uma action.
--
-- O `hint` é `step_up_required` para a camada de aplicação distinguir "falta o
-- PIN" (abre o modal) de "não tens permissão" (mostra erro), sem ter de ler a
-- mensagem. Mesmo contrato dos gatilhos de limites de 07 §20.5.

create or replace function public.require_step_up()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.step_up_valid() then
    raise exception 'Confirmação por PIN necessária'
      using errcode = '42501', hint = 'step_up_required';
  end if;
end;
$$;

comment on function public.require_step_up() is
  'Recusa a operação quando não há step-up de PIN válido (07 §6). Chamar no '
  'início de toda a função de ação sensível.';

-- ---------------------------------------------------------------------------
-- 4. Conceder step-up — só depois de o PIN ser verificado, e só com service_role
-- ---------------------------------------------------------------------------
-- O PIN é Argon2id (08 §7.7), que o Postgres não calcula: a verificação tem de
-- acontecer em Node. Esta função é o outro lado dessa ponte, e **não é
-- concedida a `authenticated`** — se fosse, era o defeito 1 outra vez, com um
-- nome mais bonito. Só o cliente `service_role` da Server Action a chama, e só
-- depois de `verifyPin` ter dado verdadeiro.
--
-- Escreve o `audit_log` na mesma transação: conceder step-up e registar que foi
-- concedido são a mesma coisa, e separá-los deixava a porta aberta a conceder
-- sem registar.

create or replace function public.mark_step_up(p_profile_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  update public.staff_auth
  set last_step_up_at = v_now
  where profile_id = p_profile_id;

  if not found then
    raise exception 'Sem registo de autenticação para este membro de staff'
      using errcode = 'P0002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (p_profile_id, 'staff.step_up', 'staff_auth', p_profile_id);

  return v_now;
end;
$$;

-- Uma função nasce com `execute` para `public`; sem este revoke, qualquer
-- sessão autenticada concedia-se step-up a si mesma.
revoke all on function public.mark_step_up(uuid) from public;
revoke all on function public.mark_step_up(uuid) from anon;
revoke all on function public.mark_step_up(uuid) from authenticated;
grant execute on function public.mark_step_up(uuid) to service_role;

comment on function public.mark_step_up(uuid) is
  'Concede 15 min de step-up e registra-o no audit_log. Só service_role, e só '
  'depois de o PIN ter sido verificado em Node (Argon2id, 08 §7.7).';

-- ---------------------------------------------------------------------------
-- 5. `write_audit_log` — a porta única do registo de ações sensíveis
-- ---------------------------------------------------------------------------
-- `audit_log` não tem policy de insert e não vai ter: uma tabela de prova não
-- se escreve a partir do cliente. Mas as Server Actions precisam de escrever
-- nela, e passar um cliente `service_role` a cada uma delas significa que cada
-- uma escolhe o seu `actor_id` — que é precisamente o defeito que 07 §20.7
-- corrigiu em `log_document_access`: uma prova que quem chama consegue assinar
-- com o nome de outro não é prova nenhuma.
--
-- Esta função fixa `actor_id := auth.uid()`. Não há parâmetro para o actor, de
-- propósito.

create or replace function public.write_audit_log(
  p_action text,
  p_entity text,
  p_entity_id uuid default null,
  p_diff jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- 08 §7.8: limites de comprimento em todos os campos de texto, também quando
  -- quem escreve é código nosso — um `action` de 10 kB torna a tabela ilegível.
  if coalesce(btrim(p_action), '') = '' or length(p_action) > 80 then
    raise exception 'action inválida' using errcode = '22023';
  end if;

  if coalesce(btrim(p_entity), '') = '' or length(p_entity) > 80 then
    raise exception 'entity inválida' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (v_actor, btrim(p_action), btrim(p_entity), p_entity_id, p_diff)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_log(text, text, uuid, jsonb) from public;
revoke all on function public.write_audit_log(text, text, uuid, jsonb) from anon;
grant execute on function public.write_audit_log(text, text, uuid, jsonb) to authenticated;

comment on function public.write_audit_log(text, text, uuid, jsonb) is
  'Única via de escrita em audit_log a partir de uma sessão (08 §6.7). O actor '
  'vem de auth.uid() e nunca de quem chama (07 §20.7).';

-- ---------------------------------------------------------------------------
-- 6. Grants de leitura
-- ---------------------------------------------------------------------------

grant execute on function public.step_up_valid() to authenticated;
grant execute on function public.require_step_up() to authenticated;
revoke all on function public.step_up_valid() from anon;
revoke all on function public.require_step_up() from anon;
