-- UProperty Market — Fase 5, arrumação do nome da chave estrangeira
--
-- `alter table ... rename column` renomeia a coluna mas não as constraints que
-- lhe apontam: depois de `last_rescheduled_by` passar a `proposed_by`
-- (20260929120300), a FK continuava a chamar-se
-- `visit_requests_last_rescheduled_by_fkey` — e esse nome antigo aparecia nos
-- tipos gerados de `database.types.ts`, que é onde alguém o vai ler a seguir.
--
-- Só o nome muda. A constraint é a mesma, não há reescrita de tabela nem
-- validação: o Postgres altera uma entrada de catálogo.

alter table public.visit_requests
  rename constraint visit_requests_last_rescheduled_by_fkey
  to visit_requests_proposed_by_fkey;
