-- UProperty Market — Fase 8 (Admin), P8-07
--
-- Duas correções aos grants de 20261002120000_step_up.sql, apanhadas pelos
-- testes de `step-up.test.ts` na mesma sessão. Ficam em migração própria, e não
-- reescritas na original, porque essa já estava aplicada em staging — mesmo
-- critério de 07 §20.7: reescrever história aplicada é pior do que mostrar o
-- caminho.

-- ---------------------------------------------------------------------------
-- 1. O staff voltou a poder definir o seu PIN
-- ---------------------------------------------------------------------------
-- `/definicoes/seguranca` grava o PIN com um upsert, que o PostgREST traduz em
-- `insert ... on conflict do update set` **de todas as colunas do payload** —
-- `profile_id` incluído. Sem `update(profile_id)`, o upsert era recusado com
-- "permission denied for table staff_auth" e ninguém conseguia definir um PIN.
--
-- Conceder `update(profile_id)` não abre nada: a policy `staff_auth_self` tem
-- `with check (profile_id = auth.uid() or public.is_admin())`, logo um membro de
-- staff não consegue apontar a sua linha para outra pessoa. O que continua
-- revogado é o que importa: `last_step_up_at`.

grant update (profile_id, pin_hash, pin_updated_at, recovery_codes_hash)
  on public.staff_auth to authenticated;

-- ---------------------------------------------------------------------------
-- 2. `anon` deixa de chegar às funções de step-up
-- ---------------------------------------------------------------------------
-- Uma função nasce com `execute` para **PUBLIC**, e `revoke ... from anon` não
-- tira o que vem por PUBLIC — tem de se revogar a PUBLIC primeiro. Foi o que a
-- migração original fez para `mark_step_up` e `write_audit_log`, e foi o que
-- lhe faltou aqui.
--
-- Não havia fuga: sem sessão, `step_up_valid()` devolve falso e
-- `require_step_up()` recusa. Mas é superfície que não tem razão para existir, e
-- a lição é a que vale guardar: **num `revoke` de função, PUBLIC é o alvo**.

revoke all on function public.step_up_valid() from public;
revoke all on function public.require_step_up() from public;

grant execute on function public.step_up_valid() to authenticated;
grant execute on function public.require_step_up() to authenticated;
