-- ---------------------------------------------------------------------------
-- is_internal() e is_marketing() voltam a poder ser chamadas pelo `anon`
-- ---------------------------------------------------------------------------
-- 20261014120100 criou-as com `revoke all ... from public, anon`, ao contrário
-- das gémeas mais antigas (`is_staff()`, `is_admin()`, `is_support()`), que
-- nunca o fizeram. Parecia mais fechado; era mais frágil.
--
-- Uma policy chama a função **para toda a sessão que a avalia**, não só para
-- quem ela se destina. As policies da Cloud interna (20261015180000) usam
-- `is_internal()` sobre `storage.objects`, e o Postgres junta todas as
-- policies permissivas da tabela com OR. Resultado: um visitante anónimo a
-- pedir um URL assinado de uma foto de imóvel (`property-media`, que não tem
-- nada a ver com a Cloud) avaliava a policy da Cloud, chamava `is_internal()`
-- sem `execute`, e levava "permission denied for function is_internal" em vez
-- de uma resposta. Foi o `storage-rls.test.ts` que o mostrou a 1 nov, ao
-- correr pela primeira vez contra a base real.
--
-- Dar `execute` ao `anon` não abre nada: sem sessão, `auth.uid()` é null, a
-- consulta a `profiles` não encontra linha e as duas devolvem `false`. Uma
-- função de papel é uma pergunta, e a pergunta "é da equipa?" tem de poder
-- ser feita por quem não é — a resposta é que é "não".
-- ---------------------------------------------------------------------------

grant execute on function public.is_internal() to anon;
grant execute on function public.is_marketing() to anon;
