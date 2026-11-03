-- =========================================================================
-- A15, segunda parte — o `execute` de PUBLIC é global (3 nov 2026)
-- =========================================================================
-- A `20261102110000_superficie_anon.sql` fez
--   alter default privileges for role postgres in schema public
--     revoke execute on functions from public, anon;
-- e o `anon` saiu da regra do esquema. Mas o teste negativo — criar uma
-- função numa transação desfeita e perguntar quem a executa — mostrou que
-- ela continuava a nascer com `=X/postgres`: `execute` para PUBLIC, de que o
-- `anon` herda. No Postgres, esse privilégio de PUBLIC sobre funções é um
-- **omissão global**; as regras por esquema só acrescentam a ela, não a
-- retiram. Revoga-se sem `in schema`.
--
-- Âmbito: só as funções que o `postgres` criar daqui em diante. As 299
-- funções das migrações estão todas em `public` (verificado a 3 nov). O
-- `storage` tem a sua regra explícita para `anon`/`authenticated`, que não
-- muda. As funções que já existem ficaram tratadas pela A15.
-- =========================================================================

alter default privileges for role postgres
  revoke execute on functions from public;
