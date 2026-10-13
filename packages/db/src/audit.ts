import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Registo de ações sensíveis (08 §6.7) — Fase 8, P8-07
 * =========================================================================
 * `audit_log` não tem policy de insert e não vai ter: uma tabela de prova não
 * se escreve a partir do cliente. A única via a partir de uma sessão é a função
 * `write_audit_log`, que fixa o `actor_id` em `auth.uid()` e **não aceita** um
 * actor de quem chama — a lição de 07 §20.7, onde um registo que qualquer um
 * podia assinar com o nome de outro deixava de ser prova.
 *
 * Isto corrige, de passagem, um defeito da Fase 7: `savePlan` inseria em
 * `audit_log` com a sessão do utilizador, a RLS recusava, o erro era ignorado e
 * a alteração de preço ficava sem rasto nenhum.
 */

type AnySupabaseClient = SupabaseClient<Database>;

export type AuditEntry = {
  /** Verbo com namespace: `profile.suspended`, `property.approved`, `flag.updated`. */
  action: string;
  /** Tabela ou agregado a que a ação se aplica. */
  entity: string;
  /**
   * **Tem de ser um uuid**: `audit_log.entity_id` é `uuid` e o Postgres recusa
   * o cast de qualquer outra coisa — a chamada atira, em vez de guardar o
   * valor como texto. Uma entidade cuja chave não é um uuid (a rota, em
   * `seo_pages`) identifica-se dentro do `diff`.
   */
  entityId?: string | null;
  /** `{ before, after }` nas alterações; o que explique a decisão nas restantes. */
  diff?: Record<string, unknown> | null;
};

/**
 * Escreve uma linha e devolve o id. **Atira** quando a escrita falha: um registo
 * de auditoria que se perde em silêncio é pior do que não existir, porque quem
 * o lê acredita que está completo. Quem chama decide se a ação de negócio
 * também falha — mas tem de decidir, em vez de não saber.
 */
export async function writeAuditLog(
  supabase: AnySupabaseClient,
  entry: AuditEntry,
): Promise<string> {
  const { data, error } = await supabase.rpc("write_audit_log", {
    p_action: entry.action,
    p_entity: entry.entity,
    p_entity_id: entry.entityId ?? undefined,
    p_diff: (entry.diff ?? undefined) as never,
  });

  if (error) throw new Error(`audit_log: ${error.message}`);
  return data as string;
}
