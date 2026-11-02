-- ---------------------------------------------------------------------------
-- Auditoria de staff em saved_properties e search_alerts (completa o A8)
-- ---------------------------------------------------------------------------
-- O A8 (20261102090000) pôs `audit_staff_write` em 28 tabelas, escolhidas à
-- mão. Faltaram estas duas: as policies `for all` de ambas têm `is_staff()` no
-- `using` — o staff pode alterar e apagar os favoritos e os alertas de um
-- cliente —, e essa escrita ficava sem rasto.
--
-- Não foi uma revisão que as encontrou: foi o detetor que o `audit-rls.test.ts`
-- ganhou no mesmo dia, que lê as policies de todas as migrações e recusa uma
-- tabela com escrita de staff sem o trigger. Correu pela primeira vez e
-- devolveu estas duas. É a razão de a regra ser verificada e não só escrita.
--
-- ## A regra, para quem vier a seguir
--
-- **Tabela em que o staff escreve ⇒ trigger `audit_staff_write`**, numa
-- migração, e o nome em `VIGIADAS` (`packages/db/src/audit-rls.test.ts`).
--   * Se a escrita passa por uma policy de RLS, o teste dá por ela sozinho.
--   * Se passa só por uma RPC `security definer` (sem policy de escrita), o
--     teste não a vê: acrescenta-se à mão. Na dúvida, acrescenta-se — um
--     trigger a mais numa tabela onde o staff nunca escreve não custa nada.
--
-- O trigger só escreve quando a sessão é de staff (`is_internal()`). As
-- escritas do próprio cliente nos seus favoritos não entram.
-- ---------------------------------------------------------------------------

drop trigger if exists saved_properties_audit_staff on public.saved_properties;
create trigger saved_properties_audit_staff after insert or update or delete on public.saved_properties
  for each row execute function public.audit_staff_write();

drop trigger if exists search_alerts_audit_staff on public.search_alerts;
create trigger search_alerts_audit_staff after insert or update or delete on public.search_alerts
  for each row execute function public.audit_staff_write();
